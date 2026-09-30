import type { MetadataRoute } from "next";

import { publicOrigin } from "@/lib/seo";
import { ZONE_CONFIG, ZONE_HEADER, isZone } from "@/lib/zones";
import { headers } from "next/headers";

/**
 * `/robots.txt`, answered on the indexed zone only.
 *
 * `src/proxy.ts` 404s this path on admin and partner before it reaches here (`CRAWLER_FILES`),
 * so the zone check below is the second lock rather than the first — worth keeping, because a
 * misconfigured proxy should degrade to "disallow everything" rather than to a map of the
 * back office.
 */
/** This app's own machinery, never pages. */
const APP_PATHS = ["/api/", "/bff/", "/monitoring"];

/**
 * Pages that must never be indexed, in both languages (`/en` is a prefix, so each needs its
 * English twin or `/en/account/` would be crawlable). `/configure/` and `/rfq/` are per-visitor
 * tools for a product whose page is the one to index; `/referral/` carries a person's code.
 */
const PRIVATE_PAGES = [
  "/account/",
  "/cart",
  "/checkout",
  "/payments/",
  "/track/",
  "/liff",
  "/sign-in",
  "/configure/",
  "/rfq/",
  "/referral/",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const zoneHeader = (await headers()).get(ZONE_HEADER);
  const zone = isZone(zoneHeader) ? zoneHeader : "customer";

  if (!ZONE_CONFIG[zone].indexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  const origin = await publicOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /*
       * Paths that are pages but must never be indexed.
       *
       * `/track/` carries a per-order token in the URL, so an indexed one exposes a
       * stranger's delivery; `/account/` and `/cart` are per-person and would be crawled
       * signed-out anyway; `/monitoring` is Sentry's tunnel; `/bff/` is this app's own API.
       * `/liff/` is the LINE in-app surface (D-151), which is not a web page.
       */
      disallow: [...APP_PATHS, ...PRIVATE_PAGES, ...PRIVATE_PAGES.map((path) => `/en${path}`)],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
