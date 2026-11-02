/**
 * The four audiences this one Next app serves (00-master-plan.md §2; the agent zone, D-467).
 *
 * One host per zone, so cookies are host-only, the CSP differs per zone, and a storefront
 * XSS cannot ride a staff session. This is the canonical list: `src/lib/env` validates the
 * `ZONES` allow-list against it and `src/ui/theme/themes.ts` keys its per-zone defaults off
 * it, so a fourth zone cannot be half-added.
 */
export const ZONES = ["customer", "admin", "partner", "agent"] as const;

export type Zone = (typeof ZONES)[number];

export function isZone(value: unknown): value is Zone {
  return typeof value === "string" && (ZONES as readonly string[]).includes(value);
}

/**
 * What the request for this zone is called on the way in and on the way out.
 *
 * `routePrefix` is the internal `src/app` segment the proxy rewrites a host's request to;
 * it never appears in a URL a user sees. `apiPrefix` is the zone's upstream surface from
 * `docs/contract/api-conventions.md` §2, and `authPrefixes` the `/v1/auth/*` paths that zone
 * may additionally reach — both recorded here so the BFF allow-list reads them rather than
 * re-deriving them.
 *
 * A token issued for one audience is rejected on every other prefix by the API itself
 * (api-conventions §2). The allow-list is the second lock: it stops this app from forwarding
 * a request to a surface the zone has no business touching, whatever the token says.
 */
export const ZONE_CONFIG = {
  customer: {
    routePrefix: "",
    bffPath: "/bff",
    apiPrefix: "/v1/store",
    /** Customer sign-in runs through the BFF; the other zones' logins are Server Actions. */
    authPrefixes: ["/v1/auth/customer"],
    extraPrefixes: [],
    exactPaths: [],
    surface: "/v1/store",
    indexable: true,
    /** Only the customer zone is multilingual by URL: `th` at `/`, `en` at `/en`. */
    localePrefixed: true,
  },
  admin: {
    routePrefix: "/admin",
    bffPath: "/admin/bff",
    apiPrefix: "/v1/admin",
    authPrefixes: [],
    extraPrefixes: [],
    exactPaths: [],
    surface: "/v1/admin",
    indexable: false,
    localePrefixed: false,
  },
  partner: {
    routePrefix: "/partner",
    bffPath: "/partner/bff",
    apiPrefix: "/v1/partner",
    authPrefixes: [],
    extraPrefixes: [],
    exactPaths: [],
    surface: "/v1/partner",
    indexable: false,
    localePrefixed: false,
  },
  /**
   * getpack Agent, `agent.getpack.co` (D-467, PLAN A-08): a freelance sales agent's own app. The person is a
   * customer (the customer audience token, kept in this host's own cookies — never the storefront's), but this
   * zone reaches only the agent surface, customer sign-in, and the handful of `/v1/store` paths named below —
   * nothing else of the shop.
   */
  agent: {
    routePrefix: "/agent-zone",
    bffPath: "/agent-zone/bff",
    apiPrefix: "/v1/store/agent",
    /** Phone OTP, LINE, Google / Apple with `client: "agent"`, and the hand-off redeem. */
    authPrefixes: ["/v1/auth/customer"],
    /**
     * Most specific first. `me/sessions` — the agent's signed-in devices (โปรไฟล์และสัญญา); `me/consents` — the
     * PDPA step right after a first sign-in here; `files` — the payout profile's and the ล.ย.01's evidence
     * uploads; `rum` — field Web Vitals. Every other `/v1/store` path is refused.
     */
    extraPrefixes: ["/v1/store/me/sessions", "/v1/store/me/consents", "/v1/store/files", "/v1/store/rum"],
    /** Who is signed in (`store.me.get`), for the zone's guard — the path itself, nothing under it. */
    exactPaths: ["/v1/store/me"],
    surface: "/v1/store",
    indexable: false,
    localePrefixed: false,
  },
} as const satisfies Record<Zone, ZoneConfig>;

export interface ZoneConfig {
  readonly routePrefix: string;
  readonly bffPath: string;
  readonly apiPrefix: string;
  readonly authPrefixes: readonly string[];
  /** Further upstream prefixes outside `apiPrefix` this zone may reach (the agent zone's few `/v1/store` paths). */
  readonly extraPrefixes: readonly string[];
  /** Upstream paths allowed as themselves only, not as a prefix. */
  readonly exactPaths: readonly string[];
  /** The API surface the zone's token belongs to (api-conventions §2): what `browserBffUrl` builds on. */
  readonly surface: string;
  readonly indexable: boolean;
  readonly localePrefixed: boolean;
}

/**
 * Every upstream path prefix this zone may reach, most specific first.
 *
 * Used by the BFF to allow-list what the browser can proxy, and by `serverApi(zone)` to catch
 * a Server Component calling another zone's surface — the mistake the ESLint zone boundaries
 * cannot see, because the surface is a string in a fetch, not an import.
 */
export function upstreamPrefixes(zone: Zone): readonly string[] {
  const config = ZONE_CONFIG[zone];
  return [...config.extraPrefixes, config.apiPrefix, ...config.authPrefixes];
}

/** True when `path` is on a surface this zone is allowed to call. */
export function isUpstreamPathAllowed(zone: Zone, path: string): boolean {
  // A path must match a prefix at a segment boundary: `/v1/storefront` must not pass as
  // `/v1/store`, and `/v1/store/../admin/orders` must not pass at all.
  if (path.includes("..")) return false;
  if ((ZONE_CONFIG[zone].exactPaths as readonly string[]).includes(path)) return true;
  return upstreamPrefixes(zone).some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * The URL a **browser** uses to reach an upstream path through its zone's BFF.
 *
 * `ZONE_CONFIG[zone].bffPath` is the *internal* route segment — `/admin/bff` — which is where
 * the handler lives in `src/app` after `src/proxy.ts` has rewritten the request. A browser on
 * the admin host never sees that prefix: it asks for `/bff/...` on its own origin, exactly as
 * the storefront does, and the proxy adds `/admin`. Asking for `/admin/bff/...` from the
 * browser is refused by `isInternalOnlyPath` before any of it runs.
 *
 * `browserApi` hard-codes `/bff` for the same reason. This exists for the calls that cannot go
 * through the typed client because their endpoint is still a contract request — Web Vitals,
 * push subscriptions, notifications — so that the three of them cannot each get it wrong
 * separately. (They each did.)
 */
export const BROWSER_BFF_PATH = "/bff";

export function browserBffUrl(zone: Zone, upstreamPath: string): string {
  return `${BROWSER_BFF_PATH}${ZONE_CONFIG[zone].surface}${upstreamPath}`;
}

/** The `x-getpack-zone` request header the proxy stamps so server code can read the zone. */
export const ZONE_HEADER = "x-getpack-zone";

/**
 * The path as the browser asked for it, stamped by the proxy before any rewrite.
 *
 * Next gives a Server Component no way to read the current pathname, and by the time a page
 * renders, the admin host's `/orders` has already become the internal `/admin/orders`. A
 * layout guard needs the browser's spelling to build a `returnTo` someone can actually be
 * sent back to.
 */
export const PATH_HEADER = "x-getpack-path";
