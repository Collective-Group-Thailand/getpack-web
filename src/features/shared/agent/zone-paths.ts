/**
 * Where the agent pages live in getpack Agent (`agent.getpack.co`, D-467), and where each old storefront URL
 * (`/account/agent/**`, P0–P1) now points. Shared: the storefront answers its old URLs with a 308 to these, and the
 * agent zone builds its navigation from the same names, so the two cannot drift.
 */
export const AGENT_ZONE_PATHS = {
  home: "/",
  leads: "/leads",
  quotes: "/quotes",
  commissions: "/commissions",
  statements: "/statements",
  customers: "/customers",
  payout: "/payout",
  tax: "/tax",
  notifications: "/notifications",
  profile: "/profile",
  /** คู่มือการขาย (D-468): the sidebar and the profile menu, never a fifth phone tab. */
  playbook: "/playbook",
  signIn: "/sign-in",
  handoff: "/handoff",
} as const;

/** The storefront section the agent pages used to live under. */
export const ACCOUNT_AGENT_PREFIX = "/account/agent";

const STATEMENT_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * The agent-zone path for an old `/account/agent/**` path, with its query string kept; `null` when the path is not
 * one of the old agent pages (it then 404s as before). `segments` are the parts after `/account/agent`.
 */
export function agentZonePathFor(segments: readonly string[], search = ""): string | null {
  const query = search && search !== "?" ? (search.startsWith("?") ? search : `?${search}`) : "";
  const [first, second, ...rest] = segments;
  if (rest.length > 0) return null;
  let path: string | null = null;
  if (first === undefined) path = AGENT_ZONE_PATHS.home;
  else if (second === undefined) {
    const map: Record<string, string> = {
      customers: AGENT_ZONE_PATHS.customers,
      leads: AGENT_ZONE_PATHS.leads,
      commissions: AGENT_ZONE_PATHS.commissions,
      statements: AGENT_ZONE_PATHS.statements,
      tax: AGENT_ZONE_PATHS.tax,
      payout: AGENT_ZONE_PATHS.payout,
    };
    path = map[first] ?? null;
  } else if (first === "statements" && STATEMENT_ID.test(second)) {
    path = `${AGENT_ZONE_PATHS.statements}/${second}`;
  }
  return path === null ? null : `${path}${query}`;
}

/** A query string from a page's `searchParams`, in a stable order. */
export function searchOf(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) query.append(key, one);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
