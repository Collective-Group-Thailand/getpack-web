import "server-only";

import { cookies, headers } from "next/headers";

import { ApiError } from "@/lib/api/problem";
import { clearedSessionCookieWrites, sessionCookieWrites } from "@/lib/auth/session";
import { readRefreshToken } from "@/lib/auth/session";
import { apiInternalUrl } from "@/lib/env/lazy-server";
import { upstreamApi } from "@/lib/api/client";
import type { Session } from "@/lib/api/types";

/**
 * Whether this request reached us over TLS, which decides the cookie names and the `Secure`
 * flag (see `sessionCookieName`).
 *
 * A Server Action has no `NextRequest`, so the protocol comes from the forwarded header the
 * load balancer sets, and falls back to "not secure" for local http. Getting this wrong in
 * the safe direction only means a cookie without the `__Host-` prefix in development.
 */
async function requestIsSecure(): Promise<boolean> {
  const forwarded = (await headers()).get("x-forwarded-proto");
  return forwarded ? forwarded.split(",")[0]!.trim() === "https" : false;
}

/** Writes a session the API just issued into the three httpOnly cookies. */
export async function startSession(session: Session): Promise<void> {
  const jar = await cookies();
  const writes = sessionCookieWrites(
    {
      accessToken: session.accessToken,
      accessTokenExpiresAt: new Date(session.accessTokenExpiresAt),
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: new Date(session.refreshTokenExpiresAt),
    },
    await requestIsSecure(),
  );

  for (const cookie of writes) jar.set(cookie);
}

/**
 * Ends the session here and, best-effort, at the API.
 *
 * The cookies are cleared whatever the API says. A sign-out that failed because the network
 * blinked would otherwise leave someone looking at a signed-in page having just been told
 * they were signed out — and on a shared machine that is the one failure that matters. The
 * server-side revocation is idempotent (see the seed contract), so a retry costs nothing.
 */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const refreshToken = readRefreshToken(jar);

  if (refreshToken) {
    try {
      const api = upstreamApi({ baseUrl: await apiInternalUrl() });
      await api.POST("/v1/auth/logout", { body: { refreshToken } });
    } catch (error) {
      // Nothing to do about it and nothing to tell the user: the local session is going
      // away regardless, and the refresh token expires on its own.
      if (!(error instanceof ApiError) && process.env.NODE_ENV !== "production") {
        process.stderr.write(`logout could not reach the API: ${String(error)}\n`);
      }
    }
  }

  for (const cookie of clearedSessionCookieWrites()) jar.set(cookie);
}
