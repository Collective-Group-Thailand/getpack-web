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
export async function refreshSession(
  zone: Zone,
  refreshToken: string,
  forwardedFor: string | null = null,
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
