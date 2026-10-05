import type { Zone } from "@/lib/zones";

const ZONE_OF_PREFIX: Record<string, Zone> = { s: "customer", a: "admin", p: "partner" };
const TOKEN = /^[sap][A-Za-z0-9_-]{8,400}$/;

/** The zone a notification token belongs to: its first letter (`s` store, `a` admin, `p` partner — D-299). */
export function zoneOfToken(token: string): Zone | null {
  return TOKEN.test(token) ? (ZONE_OF_PREFIX[token[0]!] ?? null) : null;
}
