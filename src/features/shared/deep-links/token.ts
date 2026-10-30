import type { Zone } from "@/lib/zones";

const ZONE_OF_PREFIX: Record<string, Zone> = { s: "customer", a: "admin", p: "partner" };
const TOKEN = /^[sap][A-Za-z0-9_-]{8,400}$/;
/** A driver handover token (D-463): `d` and 32 base64url characters, as getpack-api issues and checks it. */
const DRIVER_TOKEN = /^d[A-Za-z0-9_-]{32}$/;

/** The zone a notification token belongs to: its first letter (`s` store, `a` admin, `p` partner — D-299). */
export function zoneOfToken(token: string): Zone | null {
  return TOKEN.test(token) ? (ZONE_OF_PREFIX[token[0]!] ?? null) : null;
}

/**
 * A driver handover link `<storefront>/l/d…` (D-463, sealed carrier label). It is not a notification and belongs to
 * no signed-in zone: whoever holds it — the carrier's driver — opens the trip's recipient without signing in, so it
 * never goes through `zoneOfToken` or a sign-in redirect.
 */
export function isDriverToken(token: string): boolean {
  return DRIVER_TOKEN.test(token);
}
