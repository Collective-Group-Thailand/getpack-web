import "server-only";

import { headers } from "next/headers";

import { zoneHosts } from "@/lib/env/server";

import { zoneOriginFor } from "./origin";
import type { Zone } from "./zones";

/** `https://agent.getpack.co` — another zone's origin, as this request would reach it. */
export async function zoneOrigin(zone: Zone): Promise<string> {
  return zoneOriginFor(zoneHosts[zone], (await headers()).get("x-forwarded-proto"));
}
