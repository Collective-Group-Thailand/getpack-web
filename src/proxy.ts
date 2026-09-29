import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import {
  clearedSessionCookieWrites,
  readSessionTokens,
  refreshDecision,
  refreshSession,
  sessionCookieWrites,
} from "@/lib/auth";
import {
  MOCK_SCENARIO_COOKIE,
  MOCK_SCENARIO_HEADER,
  mocksEnabled,
  resolveMockScenario,
  type ScenarioCookie,
} from "@/lib/api/mock-scenario";
import { clientEnv } from "@/lib/env";
import { enabledZones, serverEnv, zoneHosts } from "@/lib/env/server";
import {
  contentSecurityPolicy,
  createNonce,
  CSP_HEADER,
  isHttpsRequest,
  NONCE_HEADER,
  securityHeaders,
} from "@/lib/security";
import { clientIp } from "@/lib/security/client-ip";
import { isInternalOnlyPath, PATH_HEADER, resolveZone, ZONE_CONFIG, ZONE_HEADER, type Zone } from "@/lib/zones";

/**
 * Next 16 replaces `middleware.ts` with `proxy.ts`. This is the seam every request passes
 * through, and it does five things in order (F1 Deliverable 1.1):
 *
 * 1. decide which zone the `Host` belongs to — unknown hosts are not served;
 * 2. refuse the internal route prefixes (`/admin/*`, `/partner/*`) from outside;
 * 3. refresh the access token before anything renders, because Server Components cannot
 *    set cookies (00-master-plan.md §4);
 * 4. rewrite the host's path into that zone's route segment, running next-intl on the
 *    customer host only;
 * 5. stamp the per-zone CSP, its nonce and the rest of the security headers.
 *
 * Every rule it applies lives in a tested module under `src/lib`; this file is the order
 * they happen in.
 */

const intlMiddleware = createMiddleware(routing);

/**
 * Next's metadata file conventions are served from the app root and belong to no zone, so
 * they are passed through unprefixed. They still get the security headers.
 */
const ROOT_ASSETS = new Set([
  "/favicon.ico",
  "/icon.svg",
  // The service worker must be served from the root or its scope is not the whole origin, and
  // it must not be rewritten onto a zone segment or the browser refuses to register it.
  "/sw.js",
  "/manifest.webmanifest",
]);

/**
 * Files that exist for crawlers, and only on the indexed zone.
 *
 * They must be passed through *before* next-intl, or `/robots.txt` is negotiated into
 * `/th/robots.txt` and a crawler gets a 404 — the kind of failure nobody notices until the
 * site is not in the index. On a zone that is `noindex` they do not exist at all: answering
 * them on `admin.packio.co.th` would publish the shape of the back office to anyone who
 * asked.
 */
const CRAWLER_FILES = new Set(["/robots.txt", "/sitemap.xml"]);

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const zone = resolveZone(request.headers.get("host"), zoneHosts, enabledZones);
  const isSecure = isHttpsRequest(request.headers, request.nextUrl.protocol);

  // An unknown or forged Host picks no zone, and a zone this deployment does not serve
  // (`ZONES`) is not a zone either. Neither gets a default.
  if (!zone) return notFound(isSecure);

  const { pathname } = request.nextUrl;
  if (isInternalOnlyPath(pathname)) return notFound(isSecure, zone);

  const nonce = createNonce();
  const csp = contentSecurityPolicy(zone, {
    nonce,
    isDev: process.env.NODE_ENV !== "production",
    origins: {
      asset: clientEnv.NEXT_PUBLIC_ASSET_BASE_URL,
      realtime: clientEnv.NEXT_PUBLIC_REALTIME_HOST && `https://${clientEnv.NEXT_PUBLIC_REALTIME_HOST}`,
      sentry: sentryOrigin(serverEnv.SENTRY_DSN),
      // Present only where the deployment has the credentials; absent keeps the sign-in
      // origins out of the policy entirely, which is also what the sheet renders from.
      firebaseAuthDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      line: Boolean(clientEnv.NEXT_PUBLIC_LIFF_ID),
    },
  });

  // Next reads the nonce out of the Content-Security-Policy *request* header to stamp its
  // own bootstrap scripts; `x-nonce` is the copy a root layout reads for ours.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, csp);
  requestHeaders.set(ZONE_HEADER, zone);
  // Stamped before the rewrite, so a layout guard can build a `returnTo` in the spelling the
  // browser used — by render time, the admin host's `/orders` is the internal `/admin/orders`.
  requestHeaders.set(PATH_HEADER, pathname);
  const scenarioCookie = applyMockScenario(request, requestHeaders);

  const response = route(request, zone, requestHeaders);
  await applySessionRefresh(request, response, zone, isSecure);
  if (scenarioCookie === "clear") response.cookies.delete(MOCK_SCENARIO_COOKIE);
  else if (scenarioCookie !== "keep") {
    response.cookies.set({
      name: MOCK_SCENARIO_COOKIE,
      value: scenarioCookie.set,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
  }

  response.headers.set(CSP_HEADER, csp);
  for (const [name, value] of Object.entries(securityHeaders(zone, { isHttps: isSecure }))) {
    response.headers.set(name, value);
  }
  return response;
}

/**
 * `?mock=<operationId>:<code>` under `pnpm dev:mock` (src/lib/api/mock-scenario.ts): stamps the
 * scenario on the request the render and the BFF see, and says what to do with its cookie.
 * Off the mock the header is removed, so a visitor cannot send one through to a real backend.
 */
function applyMockScenario(request: NextRequest, requestHeaders: Headers): ScenarioCookie {
  requestHeaders.delete(MOCK_SCENARIO_HEADER);
  if (!mocksEnabled()) return "keep";
  const { scenario, cookie } = resolveMockScenario(request.nextUrl, request.cookies.get(MOCK_SCENARIO_COOKIE)?.value);
  if (scenario) requestHeaders.set(MOCK_SCENARIO_HEADER, scenario);
  return cookie;
}

/** Host path → internal route segment. */
function route(request: NextRequest, zone: Zone, requestHeaders: Headers): NextResponse {
  const { pathname } = request.nextUrl;
  const { routePrefix, bffPath } = ZONE_CONFIG[zone];

  if (ROOT_ASSETS.has(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (CRAWLER_FILES.has(pathname)) {
    // Keyed off the config rather than a literal `"customer"`, so a fourth zone cannot be
    // half-added: whatever `indexable` says is what a crawler gets.
    if (!ZONE_CONFIG[zone].indexable) return notFound(isHttpsRequest(request.headers, request.nextUrl.protocol), zone);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (zone === "customer") {
    // The BFF is a route handler outside `[locale]`, so next-intl must not prefix it.
    if (isUnder(pathname, bffPath)) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    // next-intl builds its rewrite from `request.headers`, so a header-only clone is enough
    // to carry the nonce, the CSP and the zone through to the render — and locale
    // negotiation, the alternate-link header and trailing-slash handling stay its job.
    return intlMiddleware(new NextRequest(request.url, { headers: requestHeaders }));
  }

  const url = request.nextUrl.clone();
  url.pathname = `${routePrefix}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

/**
 * Refresh the access token before rendering when it is missing or nearly expired and a
 * refresh token is present, and rotate the cookies onto the outgoing response.
 *
 * Server Components cannot set cookies, so this is the only place a token can be renewed
 * before a page renders; the BFF does the same on a `401` for calls the browser makes after
 * it. A `null` answer means the refresh failed, so the session cookies are cleared rather
 * than retried on every subsequent request — refresh tokens are single-use, and presenting a
 * spent one again would revoke the whole family (api-conventions §4).
 */
async function applySessionRefresh(
  request: NextRequest,
  response: NextResponse,
  zone: Zone,
  isSecure: boolean,
): Promise<void> {
  const { accessToken, accessExpiresAt, refreshToken } = readSessionTokens(request.cookies, isSecure);

  const decision = refreshDecision({
    hasAccessToken: Boolean(accessToken),
    accessExpiresAt,
    hasRefreshToken: Boolean(refreshToken),
    now: new Date(),
  });

  if (decision === "none" || !refreshToken) return;

  const session = await refreshSession(zone, refreshToken, clientIp(request.headers, serverEnv.TRUSTED_PROXY_HOPS));
  const writes = session ? sessionCookieWrites(session, isSecure) : clearedSessionCookieWrites();

  for (const cookie of writes) response.cookies.set(cookie);
}

function notFound(isSecure: boolean, zone?: Zone): NextResponse {
  // No body and no app render: a probe for another zone's paths learns nothing about
  // whether the route exists, and the storefront's 404 page is reserved for real misses.
  const response = new NextResponse(null, { status: 404 });

  // An unknown host has no zone, so it gets the tightest zone's headers rather than none.
  for (const [name, value] of Object.entries(securityHeaders(zone ?? "admin", { isHttps: isSecure }))) {
    response.headers.set(name, value);
  }
  // Explicit, because the customer zone is otherwise indexable and this is not a real page.
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Sentry's ingest origin, so `connect-src` can allow it without allowing the whole web. */
function sentryOrigin(dsn: string | undefined): string | undefined {
  if (!dsn) return undefined;
  try {
    return new URL(dsn).origin;
  } catch {
    return undefined;
  }
}

export const config = {
  // Everything except Next's own asset and HMR routes: the proxy now has to rewrite the
  // per-zone BFF paths too, which the F0 matcher excluded.
  matcher: ["/((?!_next|_vercel).*)"],
};
