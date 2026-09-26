import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import {
  getCatalogueTree,
  listArticles,
  listProducts,
  listStockProducts,
  type Page,
} from "@/features/customer/catalog/api.server";
import { articleHref, categoryHref, productHref, stockProductHref } from "@/features/customer/catalog/paths";
import { routing } from "@/i18n/routing";
import { alternateUrls, publicOrigin } from "@/lib/seo";
import { ZONE_CONFIG, ZONE_HEADER, isZone } from "@/lib/zones";

/**
 * `/sitemap.xml`, for the storefront.
 *
 * CONTRACT-REQUEST `store.sitemap`: there is no endpoint for sitemap data yet (F1 1.3 asks
 * for one). Until there is, the static routes are listed here and the catalogue is walked
 * through its public list reads — categories, catalogue products, stock products and articles, each at
 * the path `catalog/paths.ts` gives it. A read that fails leaves its part out: a short
 * sitemap is honest, one listing pages that 404 is not.
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
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/articles", priority: 0.6, changeFrequency: "weekly" },
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
  const [tree, products, stock, articles] = await Promise.all([
    getCatalogueTree(),
    everyPage((page) => listProducts({ page, perPage: 100 })),
    everyPage((page) => listStockProducts({ page, perPage: 100 })),
    everyPage((page) => listArticles({ page, perPage: 100 })),
  ]);

  const entries = [
    ...STATIC_ROUTES,
    ...tree.map((category) => ({ path: categoryHref(category.code), priority: 0.8, changeFrequency: WEEKLY })),
    ...products.map((product) => ({ path: productHref(product.slug), priority: 0.8, changeFrequency: WEEKLY })),
    ...stock.map((product) => ({ path: stockProductHref(product.sku), priority: 0.6, changeFrequency: WEEKLY })),
    ...articles.map((article) => ({ path: articleHref(article.slug), priority: 0.5, changeFrequency: MONTHLY })),
  ];

  return entries.map(({ path, priority, changeFrequency }) => {
    const { canonical, languages } = alternateUrls(origin, path, routing.defaultLocale);
    return { url: canonical, priority, changeFrequency, alternates: { languages } };
  });
}

const WEEKLY = "weekly" as const;
const MONTHLY = "monthly" as const;

/** Every row of a paged public list, up to a bound, or none when the API cannot be read. */
async function everyPage<T>(read: (page: number) => Promise<Page<T>>, maxPages = 50): Promise<T[]> {
  const rows: T[] = [];
  try {
    for (let page = 1; page <= maxPages; page++) {
      const { data, meta } = await read(page);
      rows.push(...data);
      if (page * meta.perPage >= meta.total || data.length === 0) break;
    }
  } catch {
    return rows;
  }
  return rows;
}
