import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { routing } from "@/i18n/routing";
import { alternateUrls, publicOrigin } from "@/lib/seo";
import { ZONE_CONFIG, ZONE_HEADER, isZone } from "@/lib/zones";

/**
 * `/sitemap.xml`, for the storefront.
 *
 * CONTRACT-REQUEST `store.sitemap`: the entries that matter — product types, standard
 * products, articles, FAQs — are catalogue data the API owns, and there is no endpoint for
 * them yet (F1 1.3 asks for "sitemap data from the API"). Until there is, this lists the
 * static routes that genuinely exist today, which is honest: a sitemap listing pages that
 * 404 is worse than a short one.
 *
 * Every entry carries its `alternates`, which is the half of hreflang a sitemap is responsible
 * for; the other half is the `<link rel="alternate">` tags next-intl emits per page.
 */
const STATIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/products", priority: 0.9, changeFrequency: "weekly" },
  { path: "/help", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help/how-it-works", priority: 0.6, changeFrequency: "monthly" },
  { path: "/help/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help/glossary", priority: 0.4, changeFrequency: "monthly" },
  { path: "/about", priority: 0.4, changeFrequency: "yearly" },
  { path: "/partner-with-us", priority: 0.6, changeFrequency: "monthly" },
  { path: "/legal/terms", priority: 0.1, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.1, changeFrequency: "yearly" },
  { path: "/legal/cookies", priority: 0.1, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const zoneHeader = (await headers()).get(ZONE_HEADER);
  const zone = isZone(zoneHeader) ? zoneHeader : "customer";
  // The proxy 404s this on a non-indexed zone; an empty sitemap is the safe second answer.
  if (!ZONE_CONFIG[zone].indexable) return [];

  const origin = await publicOrigin();

  return STATIC_ROUTES.map(({ path, priority, changeFrequency }) => {
    const { canonical, languages } = alternateUrls(origin, path, routing.defaultLocale);
    return { url: canonical, priority, changeFrequency, alternates: { languages } };
  });
}
