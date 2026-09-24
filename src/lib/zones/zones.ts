/**
 * The three audiences this one Next app serves (00-master-plan.md §2).
 *
 * One host per zone, so cookies are host-only, the CSP differs per zone, and a storefront
 * XSS cannot ride a staff session. This is the canonical list: `src/lib/env` validates the
 * `ZONES` allow-list against it and `src/ui/theme/themes.ts` keys its per-zone defaults off
 * it, so a fourth zone cannot be half-added.
 */
export const ZONES = ["customer", "admin", "partner"] as const;

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
    indexable: true,
    /** Only the customer zone is multilingual by URL: `th` at `/`, `en` at `/en`. */
    localePrefixed: true,
  },
  admin: {
    routePrefix: "/admin",
    bffPath: "/admin/bff",
    apiPrefix: "/v1/admin",
    authPrefixes: [],
    indexable: false,
    localePrefixed: false,
  },
  partner: {
    routePrefix: "/partner",
    bffPath: "/partner/bff",
    apiPrefix: "/v1/partner",
    authPrefixes: [],
    indexable: false,
    localePrefixed: false,
  },
} as const satisfies Record<Zone, ZoneConfig>;

export interface ZoneConfig {
  readonly routePrefix: string;
  readonly bffPath: string;
  readonly apiPrefix: string;
  readonly authPrefixes: readonly string[];
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
  return [config.apiPrefix, ...config.authPrefixes];
}

/** True when `path` is on a surface this zone is allowed to call. */
export function isUpstreamPathAllowed(zone: Zone, path: string): boolean {
  // A path must match a prefix at a segment boundary: `/v1/storefront` must not pass as
  // `/v1/store`, and `/v1/store/../admin/orders` must not pass at all.
  if (path.includes("..")) return false;
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
  return `${BROWSER_BFF_PATH}${ZONE_CONFIG[zone].apiPrefix}${upstreamPath}`;
}

/** The `x-packio-zone` request header the proxy stamps so server code can read the zone. */
export const ZONE_HEADER = "x-packio-zone";

/**
 * The path as the browser asked for it, stamped by the proxy before any rewrite.
 *
 * Next gives a Server Component no way to read the current pathname, and by the time a page
 * renders, the admin host's `/orders` has already become the internal `/admin/orders`. A
 * layout guard needs the browser's spelling to build a `returnTo` someone can actually be
 * sent back to.
 */
export const PATH_HEADER = "x-packio-path";
