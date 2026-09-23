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
 * it never appears in a URL a user sees. `apiPrefix` is the upstream surface from
 * `docs/contract/api-conventions.md` §2 — recorded here so the BFF allow-list in 1.2 reads
 * it rather than re-deriving it.
 */
export const ZONE_CONFIG = {
  customer: {
    routePrefix: "",
    bffPath: "/bff",
    apiPrefix: "/v1/store",
    indexable: true,
    /** Only the customer zone is multilingual by URL: `th` at `/`, `en` at `/en`. */
    localePrefixed: true,
  },
  admin: {
    routePrefix: "/admin",
    bffPath: "/admin/bff",
    apiPrefix: "/v1/admin",
    indexable: false,
    localePrefixed: false,
  },
  partner: {
    routePrefix: "/partner",
    bffPath: "/partner/bff",
    apiPrefix: "/v1/partner",
    indexable: false,
    localePrefixed: false,
  },
} as const satisfies Record<Zone, ZoneConfig>;

export interface ZoneConfig {
  readonly routePrefix: string;
  readonly bffPath: string;
  readonly apiPrefix: string;
  readonly indexable: boolean;
  readonly localePrefixed: boolean;
}

/** The `x-packio-zone` request header the proxy stamps so server code can read the zone. */
export const ZONE_HEADER = "x-packio-zone";
