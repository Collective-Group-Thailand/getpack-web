/**
 * Reading and writing the three cookies one session is spread across.
 *
 * F1.1 inlined these operations in `src/proxy.ts` because it was the only caller. There are
 * now four — the proxy's pre-render refresh, the BFF's refresh-on-401, the login actions and
 * `getActor` — and a session written with a different flag in one of them would be a bug
 * nobody sees until a browser silently drops the cookie. One module, one set of flags.
 */

import {
  ACCESS_COOKIE,
  ACCESS_EXPIRY_COOKIE,
  REFRESH_COOKIE,
  sessionCookieName,
  sessionCookieOptions,
  parseExpiry,
  type SessionCookie,
} from "./cookies";
import type { RefreshedSession } from "./refresh";

/** The read side of a cookie jar: `NextRequest.cookies` and `cookies()` both satisfy this. */
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/** One `Set-Cookie` to apply. `NextResponse.cookies.set` takes exactly this shape. */
export interface SessionCookieWrite {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  expires?: Date;
  maxAge?: number;
}

export interface SessionTokens {
  accessToken: string | undefined;
  accessExpiresAt: Date | null;
  refreshToken: string | undefined;
}

export const SESSION_COOKIES = [ACCESS_COOKIE, ACCESS_EXPIRY_COOKIE, REFRESH_COOKIE] as const;

export function readSessionTokens(jar: CookieReader, isSecure: boolean): SessionTokens {
  const read = (cookie: SessionCookie) => jar.get(sessionCookieName(cookie, isSecure))?.value;

  return {
    accessToken: read(ACCESS_COOKIE),
    accessExpiresAt: parseExpiry(read(ACCESS_EXPIRY_COOKIE)),
    refreshToken: read(REFRESH_COOKIE),
  };
}

/**
 * Reads the access token without knowing whether the request arrived over TLS.
 *
 * A Server Component cannot see the protocol, and the `__Host-` prefix is dropped on plain
 * http (see `sessionCookieName`), so the name differs between local development and
 * production. Reading both is unambiguous rather than lax: over https a browser will only
 * ever have sent the prefixed one, and the bare name cannot be set on a host that is https
 * to begin with — there is no second cookie for an attacker to shadow it with.
 */
export function readAccessToken(jar: CookieReader): string | undefined {
  return (
    jar.get(sessionCookieName(ACCESS_COOKIE, true))?.value ?? jar.get(sessionCookieName(ACCESS_COOKIE, false))?.value
  );
}

export function readRefreshToken(jar: CookieReader): string | undefined {
  return (
    jar.get(sessionCookieName(REFRESH_COOKIE, true))?.value ?? jar.get(sessionCookieName(REFRESH_COOKIE, false))?.value
  );
}

/**
 * The cookies that store a session, each expiring with the token it holds — followed by clears
 * of the other spelling.
 *
 * `readAccessToken` prefers `__Host-pk_at`, and Chrome treats `http://*.localhost` as a secure
 * context, so a prefixed cookie left over from an earlier https or forwarded-proto session
 * survives on plain http. Without the clears, every new sign-in writes `pk_at` while the
 * Server Components keep reading the stale `__Host-pk_at`, get a 401 and send the visitor
 * straight back to the sign-in page.
 */
export function sessionCookieWrites(session: RefreshedSession, isSecure: boolean): SessionCookieWrite[] {
  const options = sessionCookieOptions(isSecure);
  const name = (cookie: SessionCookie) => sessionCookieName(cookie, isSecure);
  const otherSpelling = SESSION_COOKIES.map((cookie) => ({
    ...sessionCookieOptions(!isSecure),
    name: sessionCookieName(cookie, !isSecure),
    value: "",
    maxAge: 0,
  }));

  return [
    {
      ...options,
      name: name(ACCESS_COOKIE),
      value: session.accessToken,
      expires: session.accessTokenExpiresAt,
    },
    {
      ...options,
      name: name(ACCESS_EXPIRY_COOKIE),
      value: String(Math.floor(session.accessTokenExpiresAt.getTime() / 1000)),
      expires: session.accessTokenExpiresAt,
    },
    {
      // The refresh cookie outlives the access token; it is what a returning visitor is
      // signed in by, and its own expiry is the real end of the session.
      ...options,
      name: name(REFRESH_COOKIE),
      value: session.refreshToken,
      expires: session.refreshTokenExpiresAt,
    },
    ...otherSpelling,
  ];
}

/**
 * Cookies that end the session.
 *
 * Both spellings of every name are cleared. Cookies are scoped to a host, not to a scheme:
 * a bare `pk_at` set while the site was on http is still sent once the same host is https,
 * so clearing only the name the current request uses would leave the other one behind for
 * the next page load to pick back up.
 *
 * Each spelling is cleared with the flag that spelling requires — `__Host-` is only valid
 * with `Secure`, and a browser drops the whole `Set-Cookie` if it is not — so both clears
 * are ones the browser will actually honour.
 */
export function clearedSessionCookieWrites(): SessionCookieWrite[] {
  return SESSION_COOKIES.flatMap((cookie) =>
    [true, false].map((secure) => ({
      ...sessionCookieOptions(secure),
      name: sessionCookieName(cookie, secure),
      value: "",
      maxAge: 0,
    })),
  );
}
