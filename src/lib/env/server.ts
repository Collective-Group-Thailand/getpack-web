import "server-only";

import { ZONES, type Zone, type ZoneHosts } from "@/lib/zones";

import { publicEnvSource } from "./public";
import { clientEnvSchema, parseEnv, serverEnvSchema, type ServerEnv } from "./schema";

/**
 * Server-side environment, validated once when this module is first loaded — at boot for
 * `src/proxy.ts` and the root layouts, which import it on every request path.
 *
 * `server-only` makes an accidental import from a client component a build error rather
 * than a leaked `API_INTERNAL_URL` (CLAUDE.md: no tokens or internal URLs in browser code).
 */
export const serverEnv: ServerEnv = parseEnv(
  serverEnvSchema({ isProduction: process.env.NODE_ENV === "production" }),
  process.env,
  "server",
);

// The public values the browser reads unchecked (`./client.ts`) are checked here, at boot:
// the build inlined the same values into both.
parseEnv(clientEnvSchema(), publicEnvSource(), "client");

export const zoneHosts: ZoneHosts = {
  customer: serverEnv.PUBLIC_HOST,
  admin: serverEnv.ADMIN_HOST,
  partner: serverEnv.PARTNER_HOST,
};

/** The zones this deployment answers for; every zone unless `ZONES` narrows it. */
export const enabledZones: readonly Zone[] = serverEnv.ZONES ?? ZONES;

/** Stage C feature flags (`FEATURE_*`, off unless `1`). */
export const featureFlags = {
  stylesWizard: serverEnv.FEATURE_STYLES_WIZARD === "1",
  packagingLandings: serverEnv.FEATURE_PACKAGING_LANDINGS === "1",
  rfqProductRef: serverEnv.FEATURE_RFQ_PRODUCT_REF === "1",
} as const;
