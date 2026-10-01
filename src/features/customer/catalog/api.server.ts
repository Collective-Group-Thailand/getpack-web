import "server-only";

import type { Client } from "openapi-fetch";
import { getLocale } from "next-intl/server";

import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { createRequestClient, type ResponseOf } from "@/lib/api/requests/client";
import { REQUESTS, type Requests } from "@/lib/api/requests/registry";
import type { ApiPaths, Schemas } from "@/lib/api/types";
import { apiInternalUrl } from "@/lib/env/lazy-server";

import { pick } from "./localize";

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

/**
 * The mock API (`API_MOCKS=1`: `pnpm dev:mock` and the e2e suite) cannot sit behind the data
 * cache: Next serves a cached `fetch` through the original, unpatched `fetch` it captured at
 * start-up, before MSW installed itself, so a cached read would go to a backend that is not
 * running. Under the mock every read is live — which also means a change made in the mock
 * back office shows on the storefront at once, as a test expects.
 */
const DATA_CACHE = process.env.API_MOCKS !== "1";

async function publicApi(lifetime: Lifetime): Promise<Client<ApiPaths>> {
  const [baseUrl, locale] = await Promise.all([apiInternalUrl(), getLocale()]);
  return createApiClient({
    baseUrl,
    locale,
    requestId: null,
    surfaceZone: "customer",
    ...(DATA_CACHE
      ? {
          fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
            fetch(input, {
              ...init,
              next: { revalidate: LIFETIME[lifetime], tags: [`store:${lifetime}`] },
            })) as typeof fetch,
        }
      : {}),
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
export type ProductCategory = Schemas["StoreProductCategoryDto"];
export type ProductCard = Schemas["StoreProductCardDto"];
export type ProductDetail = Schemas["StoreProductDetailDto"];
export type StockProduct = Schemas["StoreStockProductDto"];
export type PriceHint = Schemas["PriceHintDto"];
export type ProductFaq = Schemas["StoreFaqDto"];
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
export type Configurator = ResponseOf<Requests, "GET /v1/store/catalog/products/{slug}/configurator">;
export type SharedQuote = Schemas["SavedQuoteDto"];
export type SupportChannels = Schemas["StoreSupportChannelsDto"];
export type RfqForm = Schemas["StoreRfqFormDto"];
export type SitemapEntry = Schemas["StoreSitemapEntryDto"];

/* ------------------------------------------------------------------------- catalogue */

export async function getProductTypes(): Promise<ProductType[]> {
  const { data } = await (await publicApi("catalogue")).GET("/v1/store/catalog/product-types");
  return data ?? [];
}

/** Product type code → its name in `locale` — for records that name their type only. */
export async function getProductTypeNames(locale: string): Promise<Record<string, string>> {
  const types = await getProductTypes();
  return Object.fromEntries(types.map((type) => [type.code, pick(locale, type.nameTh, type.nameEn)]));
}

/** Active categories that hold an active product type (`store.catalog.listProductCategories`, D-228). */
export async function getProductCategories(): Promise<ProductCategory[]> {
  const { data } = await (await publicApi("catalogue")).GET("/v1/store/catalog/product-categories");
  return data ?? [];
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
  /** A category code; the API includes its sub-categories (D-228). */
  category?: string;
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
  const api = await publicApi("prices");
  const hints = await orFallback(
    api
      .GET("/v1/store/catalog/price-hints", {
        params: {
          query: {
            productType: query.productType,
            slugs: query.slugs?.length ? query.slugs : undefined,
            skus: query.skus?.length ? query.skus : undefined,
          },
        },
      })
      .then(({ data }) => data ?? []),
    [],
  );
  return new Map(hints.map((hint) => [hint.key, hint]));
}

export async function getProductFaqs(slug: string): Promise<ProductFaq[]> {
  const api = await publicApi("content");
  return orFallback(
    api.GET("/v1/store/catalog/products/{slug}/faqs", { params: { path: { slug } } }).then(({ data }) => data ?? []),
    [],
  );
}

export async function listShowcase(
  query: { category?: string; perPage?: number } = {},
): Promise<Page<ShowcaseProduct>> {
  const { data } = await (await publicApi("catalogue")).GET("/v1/store/catalog/showcase", { params: { query } });
  return data!;
}

/**
 * What the configurator offers for a product, with the catalogue ids the calculator takes
 * (CONTRACT-REQUEST store.configurator). `null` for a product that is quoted on request only.
 */
export async function getConfigurator(slug: string): Promise<Configurator | null> {
  const requests = await publicRequests("catalogue");
  return orNull(requests.call("GET /v1/store/catalog/products/{slug}/configurator", { path: { slug } }));
}

/** A quotation someone shared (`store.quotes.getShared`); `null` once the link has expired. */
export async function getSharedQuote(token: string): Promise<SharedQuote | null> {
  return orNull(
    (await publicApi("prices"))
      .GET("/v1/store/quotes/shared/{token}", { params: { path: { token } } })
      .then(({ data }) => data!),
  );
}

/** Packio's CS channels (`store.support.getChannels`, D-221); `null` when unavailable. */
export async function getSupportChannels(): Promise<SupportChannels | null> {
  const api = await publicApi("content");
  return orFallback(
    api.GET("/v1/store/support-channels").then(({ data }) => data ?? null),
    null,
  );
}

/** A category's RFQ form (`store.rfqs.getForm`); `null` for an unknown type. */
export async function getRfqForm(productTypeCode: string): Promise<RfqForm | null> {
  const api = await publicApi("catalogue");
  return orNull(
    api
      .GET("/v1/store/rfq-forms/{productTypeCode}", { params: { path: { productTypeCode } } })
      .then(({ data }) => data!),
  );
}

/**
 * What the sitemap lists (`store.catalog.getSitemap`): categories, catalogue and stock products
 * and articles, each with its last change; `noindex` pages are already left out. Empty when the
 * API cannot answer — a short sitemap is honest, one listing pages that 404 is not.
 */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  const api = await publicApi("content");
  return orFallback(
    api.GET("/v1/store/sitemap").then(({ data }) => data ?? []),
    [],
  );
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

/** Catalogue search (products, stock, showcase, articles, FAQs). Short-lived: a query is not content. */
export async function searchCatalogue(q: string): Promise<SearchResult> {
  const { data } = await (await publicApi("prices")).GET("/v1/store/catalog/search", { params: { query: { q } } });
  return data!;
}

export type Tracking = Schemas["PublicTrackingDto"];

/** The public tracking page's data (`store.tracking.get`); `null` for an unknown token. */
export async function getTracking(token: string): Promise<Tracking | null> {
  return orNull(
    (await publicApi("prices"))
      .GET("/v1/store/track/{token}", { params: { path: { token } } })
      .then(({ data }) => data!),
  );
}

export type SampleKit = ResponseOf<Requests, "GET /v1/store/sample-kits">["data"][number];

/** The sample kits on offer (CONTRACT-REQUEST store.sample-kits); empty when unavailable. */
export async function getSampleKits(): Promise<SampleKit[]> {
  const requests = await publicRequests("content");
  return orFallback(
    requests.call("GET /v1/store/sample-kits").then((result) => result.data),
    [],
  );
}

/* ------------------------------------------------------------------------- designer */

export type DesignerCatalog = ResponseOf<Requests, "GET /v1/store/designer/catalog">;

/**
 * The designer's catalogue slice (`store.designer-catalog`): patterns with dieline keys and
 * limits, materials with caliper, templates, colours, fonts and artwork rules — for one product
 * or for all. Public and cached like the catalogue; `null` when the API cannot answer, and the
 * designer then draws on the engine's typical boards (never priced).
 */
export async function getDesignerCatalog(product?: string): Promise<DesignerCatalog | null> {
  return orFallback(
    (await publicRequests("catalogue")).call("GET /v1/store/designer/catalog", { query: product ? { product } : {} }),
    null,
  );
}
