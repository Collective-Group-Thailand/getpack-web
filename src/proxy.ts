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
import { isInternalOnlyPath, resolveZone, ZONE_CONFIG, ZONE_HEADER, type Zone } from "@/lib/zones";

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
const ROOT_ASSETS = new Set(["/favicon.ico", "/icon.svg"]);

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
    },
  });

  // Next reads the nonce out of the Content-Security-Policy *request* header to stamp its
  // own bootstrap scripts; `x-nonce` is the copy a root layout reads for ours.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, csp);
  requestHeaders.set(ZONE_HEADER, zone);

  const response = route(request, zone, requestHeaders);
  await applySessionRefresh(request, response, zone, isSecure);

  response.headers.set(CSP_HEADER, csp);
  for (const [name, value] of Object.entries(securityHeaders(zone, { isHttps: isSecure }))) {
    response.headers.set(name, value);
  }
  return response;
}

/** Host path → internal route segment. */
function route(request: NextRequest, zone: Zone, requestHeaders: Headers): NextResponse {
  const { pathname } = request.nextUrl;
  const { routePrefix, bffPath } = ZONE_CONFIG[zone];

  if (ROOT_ASSETS.has(pathname)) {
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

  const session = await refreshSession(zone, refreshToken);
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
