import { ZONE_CONFIG, ZONES, type Zone } from "./zones";

/** The configured host per zone, as `PUBLIC_HOST` / `ADMIN_HOST` / `PARTNER_HOST` hold it. */
export type ZoneHosts = Record<Zone, string>;

/**
 * The hostname alone, lower-cased, without the port, the trailing dot of an absolute name
 * or the brackets of an IPv6 literal. Returns `null` for anything that is not a host.
 */
export function normaliseHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const trimmed = host.trim().toLowerCase();
  if (!trimmed) return null;

  // `[::1]:3000` / `[::1]` — the colons inside the brackets are not a port separator.
  if (trimmed.startsWith("[")) {
    const close = trimmed.indexOf("]");
    return close > 1 ? trimmed.slice(1, close) : null;
  }

  const withoutPort = trimmed.split(":", 1)[0] ?? "";
  // `packio.co.th.` and `packio.co.th` are the same name (RFC 1034); a stray trailing dot
  // is a classic way to slip past a host allow-list.
  const withoutRootDot = withoutPort.endsWith(".") ? withoutPort.slice(0, -1) : withoutPort;
  return withoutRootDot || null;
}

/**
 * Which zone serves this `Host` header, or `null` when no zone does.
 *
 * Matching is **port-insensitive**: the configured hosts may carry the port they are served
 * on, but one set of values then works for `pnpm dev` (:3000), Playwright (:3100) and
 * Lighthouse CI (:3200) alike. `*.localhost` needs no special case — it is an ordinary
 * hostname match.
 *
 * `null` for an unknown or missing host is deliberate: the proxy answers 404 rather than
 * picking a default zone, so a forged `Host` header cannot choose which zone it lands in.
 */
export function resolveZone(
  host: string | null | undefined,
  hosts: ZoneHosts,
  enabled: readonly Zone[] = ZONES,
): Zone | null {
  const hostname = normaliseHost(host);
  if (!hostname) return null;

  for (const zone of ZONES) {
    if (!enabled.includes(zone)) continue;
    if (normaliseHost(hosts[zone]) === hostname) return zone;
  }
  return null;
}

/**
 * Whether a path is one of the internal route prefixes the proxy rewrites *to*
 * (`/admin/*`, `/partner/*`) and which therefore may never be requested from outside.
 *
 * This is stricter than F1's "404 another zone's paths on the wrong host" and subsumes it:
 * on the admin host the real URL of an admin screen is `/orders`, never `/admin/orders`, so
 * an external `/admin/*` is wrong on *every* host — a probe on the storefront, or an attempt
 * to reach `/admin/admin` on the admin host. `/bff/*` needs no rule of its own: it is
 * rewritten per host, so the customer BFF is simply not reachable from the admin origin.
 */
export function isInternalOnlyPath(pathname: string): boolean {
  return ZONES.some((zone) => {
    const prefix = ZONE_CONFIG[zone].routePrefix;
    return prefix !== "" && (pathname === prefix || pathname.startsWith(`${prefix}/`));
  });
}
