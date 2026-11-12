import type { MetadataRoute } from "next";

import { BRAND_NAME, BRAND_TAGLINE } from "@/ui/brand";
import { oklchToHex } from "@/ui/tokens/color";
import { THEMES } from "@/ui/tokens/semantic";
import type { Zone } from "@/lib/zones";

/** The light theme's page and bar colours, from the tokens, so the splash screen matches the first paint. */
export const AGENT_APP_COLOURS = {
  background: oklchToHex(THEMES.light.bg),
  theme: oklchToHex(THEMES.light.surface),
} as const;

export function manifestFor(zone: Zone): MetadataRoute.Manifest {
  if (zone === "agent") {
    return {
      id: "/",
      name: `${BRAND_NAME} Agent`,
      short_name: `${BRAND_NAME} Agent`,
      description: BRAND_TAGLINE,
      start_url: "/",
      scope: "/",
      display: "standalone",
      // A phone in the hand at a meeting, and a laptop at a desk: no lock.
      orientation: "any",
      lang: "th",
      background_color: AGENT_APP_COLOURS.background,
      theme_color: AGENT_APP_COLOURS.theme,
      icons: [
        { src: "/agent-app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/agent-app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/agent-app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };
  }

  const isPartner = zone === "partner";
  return {
    name: isPartner ? `${BRAND_NAME} Partner` : BRAND_NAME,
    short_name: isPartner ? `${BRAND_NAME} Partner` : BRAND_NAME,
    description: BRAND_TAGLINE,
    start_url: "/",
    scope: "/",
    display: isPartner ? "standalone" : "browser",
    // Left to the device in both zones: the partner app is used in portrait on a 6" phone and in
    // landscape on an office tablet (design-system.md §5), and a lock would break the tablet.
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
