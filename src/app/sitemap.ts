import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { getSitemapEntries, listAllStyles, type SitemapEntry } from "@/features/customer/catalog/api.server";
import { styleHref, styleTopicHref, topicHubHref, forUseCaseHref } from "@/features/customer/styles/paths";
import { topicsOf } from "@/features/customer/styles/topics";
import { isLandingPublished, PACKAGING_LANDINGS, packagingHref } from "@/features/customer/styles/packaging-landings";
import { USE_CASES } from "@/features/customer/styles/use-cases";
import { featureFlags } from "@/lib/env/server";
import { articleHref, categoryHref, productHref, stockProductHref } from "@/features/customer/catalog/paths";
import { routing } from "@/i18n/routing";
import { alternateUrls, publicOrigin } from "@/lib/seo";
import { ZONE_CONFIG, ZONE_HEADER, isZone } from "@/lib/zones";

/**
 * `/sitemap.xml`, for the storefront.
 *
 * The static routes are listed here; the catalogue comes from `store.catalog.getSitemap` —
 * categories, catalogue and stock products and articles, with their last change and `noindex`
 * pages already left out — each at the path `catalog/paths.ts` gives it. A read that fails leaves
 * the catalogue out: a short sitemap is honest, one listing pages that 404 is not.
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
  { path: "/styles", priority: 0.8, changeFrequency: "weekly" },
  { path: "/help", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help/how-it-works", priority: 0.6, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/articles", priority: 0.6, changeFrequency: "weekly" },
  { path: "/help/glossary", priority: 0.4, changeFrequency: "monthly" },
  { path: "/about", priority: 0.4, changeFrequency: "yearly" },
  { path: "/network", priority: 0.4, changeFrequency: "yearly" },
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

  // The style library (U3.5 §5): one page per published base, at its Thai URL (the default locale);
  // a read that fails leaves the styles out, like the catalogue.
  const [origin, catalogue, styles] = await Promise.all([
    publicOrigin(),
    getSitemapEntries(),
    listAllStyles().catch(() => []),
  ]);

  const entries: { path: string; priority: number; changeFrequency: Frequency; lastModified?: string }[] = [
    ...STATIC_ROUTES,
    ...catalogue
      .filter((entry) => entry.kind in ENTRY)
      .map((entry) => ({ ...ENTRY[entry.kind](entry), lastModified: entry.lastModified })),
    ...styles.map((style) => ({
      path: styleHref(style.code, style.nameTh),
      priority: 0.7,
      changeFrequency: "monthly" as const,
    })),
    // D-410: a style's page per sought-after feature, a page per feature and per product — the
    // variants themselves are cards, not pages.
    ...styles.flatMap((style) =>
      topicsOf(style.options ?? []).map((topic) => ({
        path: styleTopicHref(style.code, style.nameTh, topic.id),
        priority: 0.6,
        changeFrequency: "monthly" as const,
      })),
    ),
    ...(styles.length
      ? [...new Set(styles.flatMap((style) => topicsOf(style.options ?? []).map((topic) => topic.id)))].map(
          (topic) => ({ path: topicHubHref(topic), priority: 0.7, changeFrequency: "weekly" as const }),
        )
      : []),
    // C0: the packaging landing pages, only while their flag is on — and (C0b) once their copy is approved.
    ...(styles.length && featureFlags.packagingLandings
      ? PACKAGING_LANDINGS.filter((landing) => isLandingPublished(landing.slug)).map((landing) => ({
          path: packagingHref(landing.slug),
          priority: 0.8,
          changeFrequency: "weekly" as const,
        }))
      : []),
    ...(styles.length
      ? USE_CASES.map((useCase) => ({
          path: forUseCaseHref(useCase),
          priority: 0.7,
          changeFrequency: "weekly" as const,
        }))
      : []),
  ];

  return entries.map(({ path, priority, changeFrequency, lastModified }) => {
    const { canonical, languages } = alternateUrls(origin, path, routing.defaultLocale);
    return {
      url: canonical,
      priority,
      changeFrequency,
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages },
    };
  });
}

type Frequency = MetadataRoute.Sitemap[number]["changeFrequency"];

/** Where each kind of entry lives, and how a crawler should weigh it. */
const ENTRY: Record<
  SitemapEntry["kind"],
  (entry: SitemapEntry) => { path: string; priority: number; changeFrequency: Frequency }
> = {
  category: (entry) => ({ path: categoryHref(entry.key), priority: 0.8, changeFrequency: "weekly" }),
  catalog_product: (entry) => ({ path: productHref(entry.key), priority: 0.8, changeFrequency: "weekly" }),
  stock_product: (entry) => ({ path: stockProductHref(entry.key), priority: 0.6, changeFrequency: "weekly" }),
  article: (entry) => ({ path: articleHref(entry.key), priority: 0.5, changeFrequency: "monthly" }),
};
