/**
 * The zone backend-for-frontend (ADR-0005).
 *
 * The browser never holds a token and never addresses the API. It calls `/bff/*` on its own
 * origin; this handler decides whether that path is one the zone may reach, attaches the
 * access token from the httpOnly cookie, forwards the request, and streams the answer back.
 * On a `401` it refreshes once and retries, rotating the cookies onto the response — the one
 * place a browser-initiated call can renew a session, since `src/proxy.ts` only runs before
 * a render.
 */

import { NextResponse, type NextRequest } from "next/server";

import { CSRF_HEADER, REQUEST_ID_HEADER } from "@/lib/api/client";
import {
  clearedSessionCookieWrites,
  readSessionTokens,
  sessionCookieWrites,
  type SessionCookieWrite,
} from "@/lib/auth/session";
import { refreshSession } from "@/lib/auth/refresh";
import { apiInternalUrl } from "@/lib/env/lazy-server";
import { isHttpsRequest } from "@/lib/security/headers";
import { isUpstreamPathAllowed, type Zone } from "@/lib/zones";

import { bffProblem } from "./problem";

/**
 * The largest request body the BFF will carry.
 *
 * Artwork and other large files never come through here: they are presigned and PUT straight
 * to S3 (api-conventions §3), so what remains is JSON. The body is buffered rather than
 * streamed because a `401` has to be retried after a refresh, and a streamed body can only be
 * read once — buffering is what makes the retry possible, and the cap is what keeps buffering
 * safe.
 */
export const MAX_BODY_BYTES = 1024 * 1024;

/** Headers forwarded from the browser. Everything else is this app's business, not the API's. */
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "idempotency-key",
  "if-match",
  "if-none-match",
  "range",
] as const;

/** Headers forwarded back. `set-cookie` is never among them: the API is cookie-agnostic. */
const FORWARDED_RESPONSE_HEADERS = [
  "accept-ranges",
  "content-disposition",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
  "location",
  "retry-after",
] as const;

const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

export function createBffHandler(zone: Zone) {
  return async function handle(request: NextRequest, context: RouteContext): Promise<NextResponse> {
    const requestId = request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
    const { path } = await context.params;
    const upstreamPath = `/${(path ?? []).join("/")}`;

    // 404 rather than 403: a path this zone may not reach should look like a path that does
    // not exist, so probing the BFF tells an attacker nothing about the API behind it.
    if (!isUpstreamPathAllowed(zone, upstreamPath)) {
      return bffProblem(404, "bff.unknown_path", `No route for ${upstreamPath} in the ${zone} zone.`, requestId);
    }

    const mutating = !METHODS_WITHOUT_BODY.has(request.method);
    if (mutating) {
      const refusal = checkCsrf(request, requestId);
      if (refusal) return refusal;
    }

    let body: ArrayBuffer | undefined;
    if (mutating) {
      const declared = Number(request.headers.get("content-length") ?? "0");
      if (declared > MAX_BODY_BYTES) {
        return bffProblem(413, "bff.body_too_large", `Bodies are limited to ${MAX_BODY_BYTES} bytes.`, requestId);
      }
      body = await request.arrayBuffer();
      if (body.byteLength > MAX_BODY_BYTES) {
        return bffProblem(413, "bff.body_too_large", `Bodies are limited to ${MAX_BODY_BYTES} bytes.`, requestId);
      }
    }

    const { accessToken, refreshToken } = readSessionTokens(
      request.cookies,
      isHttpsRequest(request.headers, request.nextUrl.protocol),
    );
    const url = `${await apiInternalUrl()}${upstreamPath}${request.nextUrl.search}`;

    let upstream = await forward(request, url, accessToken, body, requestId);
    let cookieWrites: SessionCookieWrite[] = [];

    if (upstream.status === 401 && refreshToken) {
      const session = await refreshSession(zone, refreshToken);
      if (session) {
        cookieWrites = sessionCookieWrites(session, isHttpsRequest(request.headers, request.nextUrl.protocol));
        upstream = await forward(request, url, session.accessToken, body, requestId);
      } else {
        // The refresh token is spent or rejected. Clearing now stops every subsequent request
        // paying for another doomed round trip, and stops the proxy trying the same token
        // before the next render.
        cookieWrites = clearedSessionCookieWrites();
      }
    }

    return respond(upstream, cookieWrites, requestId);
  };
}

/**
 * Same-origin `Origin` plus an explicit header on anything that can change state.
 *
 * `SameSite=Lax` lets the session cookie ride a top-level navigation, which is what keeps a
 * link from an email or LINE working — and is also what a cross-site form post could abuse.
 * `x-packio-csrf` closes that: a form post cannot set a custom header, so only code running
 * on this origin can produce one, and the `Origin` check makes sure that origin is ours.
 */
function checkCsrf(request: NextRequest, requestId: string): NextResponse | null {
  if (request.headers.get(CSRF_HEADER) !== "1") {
    return bffProblem(
      403,
      "bff.csrf_header_missing",
      `A ${request.method} through the BFF requires ${CSRF_HEADER}: 1.`,
      requestId,
    );
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return bffProblem(
      403,
      "bff.origin_missing",
      `A ${request.method} through the BFF requires an Origin header.`,
      requestId,
    );
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return bffProblem(403, "bff.origin_invalid", "The Origin header is not a URL.", requestId);
  }

  if (originHost !== request.headers.get("host")) {
    return bffProblem(403, "bff.origin_mismatch", "The Origin header is not this host.", requestId);
  }

  return null;
}

async function forward(
  request: NextRequest,
  url: string,
  accessToken: string | undefined,
  body: ArrayBuffer | undefined,
  requestId: string,
): Promise<Response> {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set(REQUEST_ID_HEADER, requestId);
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  try {
    return await fetch(url, {
      method: request.method,
      headers,
      ...(body === undefined ? {} : { body }),
      // Authenticated responses must never be reused by a shared cache, and Next's fetch
      // caches aggressively by default.
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return bffProblem(502, "bff.upstream_unreachable", "The API did not answer.", requestId);
  }
}

function respond(upstream: Response, cookieWrites: SessionCookieWrite[], requestId: string): NextResponse {
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("cache-control", "no-store");
  headers.set(REQUEST_ID_HEADER, upstream.headers.get(REQUEST_ID_HEADER) ?? requestId);

  // The body is passed through as a stream, so a file download or an SSE feed is not
  // buffered in this process on its way to the browser.
  const response = new NextResponse(upstream.body, { status: upstream.status, headers });
  for (const cookie of cookieWrites) response.cookies.set(cookie);
  return response;
}
