/**
 * The path to send someone to after signing in.
 *
 * Only a same-site absolute path is allowed. A `returnTo` is attacker-supplied — it arrives
 * in the query string of a link anyone can send — so anything that could leave this origin is
 * dropped in favour of the zone root. `//evil.test` and `https://evil.test` are the obvious
 * cases; `/\evil.test` is the one that is easy to miss, because browsers normalise the
 * backslash to a slash and treat it as protocol-relative.
 */
export function safeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/** The sign-in pages of every zone, with or without the customer zone's `/en` prefix. */
const SIGN_IN_PAGE = /^(?:\/en)?\/(?:login|sign-in)(?:[/?#]|$)/;
/** Internal route segments (`src/proxy.ts` rewrites to them); a browser path never starts with one. */
const INTERNAL_PREFIX = /^\/(?:admin|partner|bff)(?:[/?#]|$)/;

/**
 * Where to go once signed in: `safeReturnTo`, and never back to a sign-in page or an internal
 * route spelling. Returning to `/login` would show the form again to someone who just filled it
 * in, and `/admin/orders` on the admin host is rewritten to `/admin/admin/orders` — a 404 (UX
 * audit Flow 1, bug #2).
 */
export function signInReturnTo(value: string | null | undefined, fallback = "/"): string {
  const path = safeReturnTo(value, fallback);
  if (SIGN_IN_PAGE.test(path) || INTERNAL_PREFIX.test(path)) return fallback;
  return path;
}
