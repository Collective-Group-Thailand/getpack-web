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
 * DELIVERABLE 1.2 fills this in against the generated client. It cannot be written here:
 * `src/lib/api/schema.d.ts` does not exist until `pnpm gen:api` runs in 1.2, and CLAUDE.md
 * forbids hand-writing a response type ahead of the contract.
 *
 * `null` is not a placeholder value — it is the real "refresh failed" answer, and the proxy
 * already handles it by clearing the session and rendering anonymously. Until 1.2 there is
 * no login, so nothing ever sets a refresh cookie and this is unreachable in practice.
 */
export async function refreshSession(_zone: Zone, _refreshToken: string): Promise<RefreshedSession | null> {
  return null;
}
