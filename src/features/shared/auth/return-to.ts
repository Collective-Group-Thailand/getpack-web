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
