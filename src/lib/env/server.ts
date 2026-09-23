import "server-only";

import { ZONES, type Zone, type ZoneHosts } from "@/lib/zones";

import { parseEnv, serverEnvSchema, type ServerEnv } from "./schema";

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

export const zoneHosts: ZoneHosts = {
  customer: serverEnv.PUBLIC_HOST,
  admin: serverEnv.ADMIN_HOST,
  partner: serverEnv.PARTNER_HOST,
};

/** The zones this deployment answers for; every zone unless `ZONES` narrows it. */
export const enabledZones: readonly Zone[] = serverEnv.ZONES ?? ZONES;
