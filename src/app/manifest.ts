import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { BRAND_NAME, BRAND_TAGLINE } from "@/ui/brand";
import { ZONE_HEADER, isZone } from "@/lib/zones";

/**
 * The web-app manifest. The partner zone is the installable one (00-master-plan.md §2).
 *
 * One file, but its contents differ by zone, because a manifest is what the phone uses when a
 * factory user adds Packio to their home screen: the name on the icon, the colour of the
 * status bar and the URL it opens. Serving the storefront's manifest there would install a
 * shortcut to the shop.
 *
 * `display: "standalone"` matters on the shop floor — no browser chrome means no address bar
 * to mis-tap and a full screen for 64 px targets.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const zoneHeader = (await headers()).get(ZONE_HEADER);
  const zone = isZone(zoneHeader) ? zoneHeader : "customer";
  const isPartner = zone === "partner";

  return {
    name: isPartner ? `${BRAND_NAME} Partner` : BRAND_NAME,
    short_name: isPartner ? `${BRAND_NAME} Partner` : BRAND_NAME,
    description: BRAND_TAGLINE,
    start_url: "/",
    scope: "/",
    display: isPartner ? "standalone" : "browser",
    // Portrait on a 6" phone is the shop-floor case; the storefront leaves it to the device.
    orientation: isPartner ? "portrait" : "any",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
