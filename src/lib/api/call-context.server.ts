import "server-only";

import { headers } from "next/headers";

import { trustedProxyHops } from "@/lib/env/lazy-server";
import { clientIp } from "@/lib/security/client-ip";

import { mockScenarioOf } from "./mock-scenario";

export interface ServerCallContext {
  /** The visitor's address for the API's per-IP throttles (`src/lib/security/client-ip.ts`). */
  forwardedFor: string | null;
  /** `?mock=` in `pnpm dev:mock` only (`./mock-scenario.ts`); always `null` otherwise. */
  mockScenario: string | null;
}

/**
 * What a call made on a visitor's behalf — from a Server Component or a Server Action — carries
 * from the request being handled, the counterpart of what the BFF copies for browser calls.
 */
export async function serverCallContext(): Promise<ServerCallContext> {
  const [incoming, hops] = await Promise.all([headers(), trustedProxyHops()]);
  return { forwardedFor: clientIp(incoming, hops), mockScenario: mockScenarioOf(incoming) };
}
