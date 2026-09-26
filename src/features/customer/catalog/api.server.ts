import "server-only";

import type { Client } from "openapi-fetch";
import { getLocale } from "next-intl/server";

import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { createRequestClient, type ResponseOf } from "@/lib/api/requests/client";
import { REQUESTS, type Requests } from "@/lib/api/requests/registry";
import type { ApiPaths, Schemas } from "@/lib/api/types";
import { apiInternalUrl } from "@/lib/env/lazy-server";

/**
 * The storefront's public catalogue and content, read once and shared by every visitor.
 *
 * Every page is rendered per request — the CSP nonce sees to that (PROGRESS F1.1) — so the
 * caching F3 asks for ("ISR / `use cache` for catalogue & content") happens one level down, on
 * the data: each read is a `fetch` with `revalidate` and tags in Next's data cache, keyed on
 * the URL and the language. Three rules keep that safe:
 *
 * - **No token, ever.** These are the API's `@Public()` reads; a cached response must not be
 *   one customer's view of anything. Signed-in data goes through `serverApi("customer")`.
 * - **No per-request header.** The request id is left off (`requestId: null`), or every fetch
 *   would be its own cache entry.
 * - **Lifetimes follow how the data changes**: catalogue content when an admin edits it,
 *   articles and FAQs more rarely, prices with every price list and capacity week (D-043,
 *   D-101) — a minute, so a price is never shown long after it stopped being true.
 *
 * Tags are there for a revalidation hook from the API when it publishes one; until then the
 * lifetimes are the only expiry.
 */

const LIFETIME = { catalogue: 300, content: 900, prices: 60 } as const;
type Lifetime = keyof typeof LIFETIME;

async function publicApi(lifetime: Lifetime): Promise<Client<ApiPaths>> {
  const [baseUrl, locale] = await Promise.all([apiInternalUrl(), getLocale()]);
  return createApiClient({
    baseUrl,
    locale,
    requestId: null,
    surfaceZone: "customer",
    fetch: (input, init) =>
      fetch(input, { ...init, next: { revalidate: LIFETIME[lifetime], tags: [`store:${lifetime}`] } }),
  });
}

async function publicRequests(lifetime: Lifetime) {
  return createRequestClient(REQUESTS, (await publicApi(lifetime)) as unknown as Client<never>);
}

/** `null` for a 404 — a page that does not exist is `notFound()`, not an error boundary. */
async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** For what decorates a page rather than makes it: a failure shows the page without it. */
async function orFallback<T>(read: Promise<T>, fallback: T): Promise<T> {
  try {
    return await read;
  } catch {
    return fallback;
  }
}

export type ProductType = Schemas["StoreProductTypeDto"];
export type ProductCategory = ResponseOf<Requests, "GET /v1/store/catalog/product-categories">[number];
export type ProductCard = Schemas["StoreProductCardDto"];
export type ProductDetail = Schemas["StoreProductDetailDto"];
export type StockProduct = Schemas["StoreStockProductDto"];
export type PriceHint = ResponseOf<Requests, "GET /v1/store/catalog/price-hints">["data"][number];
export type ProductFaq = ResponseOf<Requests, "GET /v1/store/catalog/products/{slug}/faqs">[number];
export type ArticleCard = Schemas["StoreArticleCardDto"];
export type Article = Schemas["StoreArticleDto"];
export type ArticleCategory = Schemas["StoreArticleCategoryDto"];
export type FaqGroup = Schemas["StoreFaqGroupDto"];
export type HomeSection = Schemas["StoreHomeSectionDto"];
export type Banner = Schemas["StoreBannerDto"];
export type BannerPosition = Schemas["BannerPosition"];
export type SearchResult = Schemas["StoreSearchResultDto"];
export type ShowcaseProduct = Schemas["StoreShowcaseProductDto"];
export type Page<T> = { data: T[]; meta: Schemas["PageMeta"] };

/* ------------------------------------------------------------------------- catalogue */

export async function getProductTypes(): Promise<ProductType[]> {
  const { data } = await (await publicApi("catalogue")).GET("/v1/store/catalog/product-types");
  return data ?? [];
}

export async function getProductCategories(): Promise<ProductCategory[]> {
  return (await publicRequests("catalogue")).call("GET /v1/store/catalog/product-categories");
}

/** A category with the product types in it — the unit the catalogue is browsed by. */
export interface CatalogueCategory extends ProductCategory {
  types: ProductType[];
}

/**
 * Categories that have at least one product type, each with its types, in admin order.
 * A failure is an empty menu, not a broken header.
 */
export async function getCatalogueTree(): Promise<CatalogueCategory[]> {
  const [categories, types] = await orFallback(Promise.all([getProductCategories(), getProductTypes()]), [[], []]);
  return categories
    .map((category) => ({ ...category, types: types.filter((type) => type.categoryCode === category.code) }))
    .filter((category) => category.types.length > 0);
}

export interface ProductListQuery {
  productType?: string;
  q?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  perPage?: number;
}

export async function listProducts(query: ProductListQuery = {}): Promise<Page<ProductCard>> {
  const { data } = await (
    await publicApi("catalogue")
  ).GET("/v1/store/catalog/products", {
    params: { query },
  });
  return data!;
}

export async function listStockProducts(query: ProductListQuery = {}): Promise<Page<StockProduct>> {
  const { data } = await (
    await publicApi("catalogue")
  ).GET("/v1/store/catalog/stock-products", {
    params: { query },
  });
  return data!;
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  const api = await publicApi("catalogue");
  return orNull(api.GET("/v1/store/catalog/products/{slug}", { params: { path: { slug } } }).then((r) => r.data!));
}

export async function getStockProduct(sku: string): Promise<StockProduct | null> {
  const api = await publicApi("catalogue");
  return orNull(api.GET("/v1/store/catalog/stock-products/{sku}", { params: { path: { sku } } }).then((r) => r.data!));
}

/**
 * "Starting from" and lead time, keyed by slug or SKU. A price is an enhancement on a card, so
 * a failure is an empty map — the card shows "ดูราคา" rather than the page failing.
 */
export async function getPriceHints(query: {
  productType?: string;
  slugs?: string[];
  skus?: string[];
}): Promise<Map<string, PriceHint>> {
  if (query.slugs?.length === 0 && query.skus?.length === 0) return new Map();
  const requests = await publicRequests("prices");
  const response = await orFallback(
    requests.call("GET /v1/store/catalog/price-hints", {
      query: {
        productType: query.productType,
        slugs: query.slugs?.length ? query.slugs.join(",") : undefined,
        skus: query.skus?.length ? query.skus.join(",") : undefined,
      },
    }),
    { data: [] },
  );
  return new Map(response.data.map((hint) => [hint.key, hint]));
}

export async function getProductFaqs(slug: string): Promise<ProductFaq[]> {
  const requests = await publicRequests("content");
  return orFallback(requests.call("GET /v1/store/catalog/products/{slug}/faqs", { path: { slug } }), []);
}

export async function listShowcase(
  query: { category?: string; perPage?: number } = {},
): Promise<Page<ShowcaseProduct>> {
  const { data } = await (await publicApi("catalogue")).GET("/v1/store/catalog/showcase", { params: { query } });
  return data!;
}

/* --------------------------------------------------------------------------- content */

export async function getHomeSections(): Promise<HomeSection[]> {
  const { data } = await (await publicApi("content")).GET("/v1/store/catalog/home-sections");
  return data ?? [];
}

export async function getBanners(position: BannerPosition): Promise<Banner[]> {
  const api = await publicApi("content");
  return orFallback(
    api.GET("/v1/store/catalog/banners", { params: { query: { position } } }).then((r) => r.data ?? []),
    [],
  );
}

export async function listArticles(
  query: { category?: string; q?: string; page?: number; perPage?: number } = {},
): Promise<Page<ArticleCard>> {
  const { data } = await (await publicApi("content")).GET("/v1/store/catalog/articles", { params: { query } });
  return data!;
}

export async function getArticle(slug: string): Promise<Article | null> {
  const api = await publicApi("content");
  return orNull(api.GET("/v1/store/catalog/articles/{slug}", { params: { path: { slug } } }).then((r) => r.data!));
}

export async function listArticleCategories(): Promise<ArticleCategory[]> {
  const { data } = await (await publicApi("content")).GET("/v1/store/catalog/article-categories");
  return data ?? [];
}

export async function listFaqs(): Promise<FaqGroup[]> {
  const { data } = await (await publicApi("content")).GET("/v1/store/catalog/faqs");
  return data ?? [];
}

/** Catalogue search (products, stock, showcase, articles). Short-lived: a query is not content. */
export async function searchCatalogue(q: string): Promise<SearchResult> {
  const { data } = await (await publicApi("prices")).GET("/v1/store/catalog/search", { params: { query: { q } } });
  return data!;
}
