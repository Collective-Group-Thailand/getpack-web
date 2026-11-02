import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { manifestFor } from "@/lib/pwa/manifest";
import { ZONE_HEADER, isZone } from "@/lib/zones";

/**
 * The web-app manifest. The partner zone and getpack Agent are the installable ones (00-master-plan.md §2, D-467).
 *
 * One file, but its contents differ by zone, because a manifest is what the phone uses when someone adds getpack
 * to their home screen: the name on the icon, the colour of the status bar and the URL it opens. Serving the
 * storefront's manifest there would install a shortcut to the shop. The contents per zone: `src/lib/pwa/manifest.ts`.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const zoneHeader = (await headers()).get(ZONE_HEADER);
  return manifestFor(isZone(zoneHeader) ? zoneHeader : "customer");
}
