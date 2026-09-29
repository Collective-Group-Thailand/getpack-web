import "server-only";

import { headers } from "next/headers";

import { trustedProxyHops } from "@/lib/env/lazy-server";

import { clientIp } from "./client-ip";

/**
 * The visitor's address for a call a Server Component or Server Action makes on their behalf —
 * the counterpart of what the BFF forwards (`client-ip.ts`). `null` when it cannot be known.
 */
export async function visitorIp(): Promise<string | null> {
  const [incoming, hops] = await Promise.all([headers(), trustedProxyHops()]);
  return clientIp(incoming, hops);
}
