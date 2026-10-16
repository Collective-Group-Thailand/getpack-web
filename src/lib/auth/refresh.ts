import { upstreamApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { apiInternalUrl } from "@/lib/env/lazy-server";
import type { Zone } from "@/lib/zones";

import { isExpiringSoon } from "./cookies";

export interface RefreshInput {
  hasAccessToken: boolean;
  /** When the access token expires, if the session cookie recorded it. */
  accessExpiresAt: Date | null;
  hasRefreshToken: boolean;
  now: Date;
}

export type RefreshDecision = "none" | "refresh";

/**
 * Whether `src/proxy.ts` should refresh before rendering.
 *
 * Server Components cannot set cookies, so a token that expires mid-render leaves the page
 * half signed in; the decision has to be made in the proxy, before anything renders
 * (00-master-plan.md §4). Pure, so the rule is testable without a request.
 */
export function refreshDecision({
  hasAccessToken,
  accessExpiresAt,
  hasRefreshToken,
  now,
}: RefreshInput): RefreshDecision {
  if (!hasRefreshToken) return "none";
  if (!hasAccessToken) return "refresh";
  return isExpiringSoon(accessExpiresAt, now) ? "refresh" : "none";
}

export interface RefreshedSession {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/**
 * Exchange a refresh token for a new session at `POST /v1/auth/refresh`.
 *
 * `null` means the refresh failed and the session is over: the caller clears the cookies and
 * continues anonymously. It is returned for *every* failure, not only a 401, and deliberately
 * so. Refresh tokens are single-use and rotating, and presenting one that has already been
 * rotated revokes the whole family (api-conventions §4) — so a token this app is unsure about
 * must never be sent twice. Signing the visitor out is recoverable; retrying is not.
 *
 * The `zone` is not sent anywhere. `/v1/auth/*` issues tokens for every audience and the
 * refresh token itself carries which one; the parameter is here because every caller knows
 * its zone and a future per-zone upstream would otherwise change this signature.
 * `forwardedFor` is the visitor's address (`src/lib/security/client-ip.ts`): the proxy and the
 * BFF read it from the request they are handling, since neither can use `next/headers`.
 */
export function refreshSession(
  zone: Zone,
  refreshToken: string,
  forwardedFor: string | null = null,
): Promise<RefreshedSession | null> {
  const flights = inFlight();
  const now = Date.now();
  for (const [token, flight] of flights) if (now - flight.startedAt > REUSE_WINDOW_MS) flights.delete(token);
  const running = flights.get(refreshToken);
  if (running) return running.result;
  const result = exchange(zone, refreshToken, forwardedFor);
  flights.set(refreshToken, { startedAt: now, result });
  return result;
}

/**
 * How long one refresh token's answer is handed to every request that presents it.
 *
 * A page fires requests in parallel — the studio's autosave, pricing and checks, a navigation's
 * prefetches — and when the access token runs out each of them meets a 401 holding the *same*
 * refresh token. Sent twice, it reads as theft: the API keeps the first rotation and revokes the
 * whole family for the second (`auth.refresh_reused`), and the customer is signed out for having
 * opened the studio (round 2, B4). So the first request refreshes and the others, in flight or
 * arriving with the old cookie a moment later, are given its result. Long enough for a browser to
 * pick up the rotated cookies; far shorter than a refresh token's life.
 */
const REUSE_WINDOW_MS = 30_000;

interface Flight {
  startedAt: number;
  result: Promise<RefreshedSession | null>;
}

/**
 * Process-wide, on `globalThis`: the proxy and the BFF route handlers are bundled apart, so a
 * module-level map would give each its own copy and they would still race each other.
 */
function inFlight(): Map<string, Flight> {
  const holder = globalThis as typeof globalThis & { __getpackRefreshFlights?: Map<string, Flight> };
  return (holder.__getpackRefreshFlights ??= new Map());
}

async function exchange(
  zone: Zone,
  refreshToken: string,
  forwardedFor: string | null,
): Promise<RefreshedSession | null> {
  try {
    const api = upstreamApi({ baseUrl: await apiInternalUrl(), forwardedFor });
    const { data } = await api.POST("/v1/auth/refresh", { body: { refreshToken } });
    if (!data) return null;

    return {
      accessToken: data.accessToken,
      accessTokenExpiresAt: new Date(data.accessTokenExpiresAt),
      refreshToken: data.refreshToken,
      refreshTokenExpiresAt: new Date(data.refreshTokenExpiresAt),
    };
  } catch (error) {
    // An `ApiError` is the API refusing the token; anything else is the API being
    // unreachable. Both end the session here, because this app cannot tell a rotated token
    // from a lost network without asking again — and asking again is the one thing that
    // would revoke a session that was still good. `zone` is logged by the caller's request
    // id, not swallowed here.
    if (!isApiError(error) && process.env.NODE_ENV !== "production") {
      process.stderr.write(`refreshSession(${zone}) could not reach the API: ${String(error)}\n`);
    }
    return null;
  }
}
