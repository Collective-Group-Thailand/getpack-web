/**
 * Session cookie names and flags (00-master-plan.md §4, ADR-0005).
 *
 * The names are the same in every zone **on purpose**: each zone has its own host, the
 * `__Host-` prefix forbids a `Domain` attribute, and a host-only cookie therefore cannot
 * travel between `getpack.co` and `admin.getpack.co`. One name, three origins, no
 * sharing — rather than three names on one origin, which would share.
 */
export const ACCESS_COOKIE = "__Host-pk_at";
export const REFRESH_COOKIE = "__Host-pk_rt";

/**
 * `__Host-` requires `Secure` and `Path=/`, which means these cookies do not work over
 * plain `http://` — including `http://localhost`. Development drops the prefix so the local
 * flow is the same shape; nothing else about the flags changes.
 */
export function sessionCookieName(name: SessionCookie, isSecure: boolean): string {
  return isSecure ? name : name.replace(/^__Host-/, "");
}

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
}

/**
 * No `domain`: host-only is the isolation. `SameSite=Lax` rather than `Strict` so a link
 * from an email or a LINE message into an order page still arrives signed in; the BFF's
 * `Origin` + `x-getpack-csrf` check (1.2) is what defends the non-GET side.
 */
export function sessionCookieOptions(isSecure: boolean): SessionCookieOptions {
  return { httpOnly: true, secure: isSecure, sameSite: "lax", path: "/" };
}

/** Refresh this many seconds *before* the access token actually expires. */
export const REFRESH_SKEW_SECONDS = 60;

/**
 * Access tokens are 10–15 minutes (api-conventions.md §4), so their expiry is stored
 * alongside the token rather than parsed out of the JWT: the proxy must not have to trust,
 * or be able to read, a token it only forwards.
 */
export function isExpiringSoon(expiresAt: Date | null, now: Date, skewSeconds = REFRESH_SKEW_SECONDS): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - now.getTime() <= skewSeconds * 1000;
}

/**
 * Epoch seconds at which the access token expires, written beside it by the login and
 * refresh flows (1.2).
 *
 * A companion cookie rather than the JWT's own `exp` claim, so `src/proxy.ts` never parses
 * a token it only forwards: the API owns the JWT format and is the only thing that verifies
 * it. The value is not a secret — the flags match the other two only for uniformity.
 */
export const ACCESS_EXPIRY_COOKIE = "__Host-pk_ate";

/** The expiry a session cookie recorded, or `null` when it is missing or unparseable. */
export function parseExpiry(value: string | undefined): Date | null {
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

/** The three cookies one session is spread across. */
export type SessionCookie = typeof ACCESS_COOKIE | typeof REFRESH_COOKIE | typeof ACCESS_EXPIRY_COOKIE;
