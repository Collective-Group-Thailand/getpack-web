import "server-only";

import type { Client } from "openapi-fetch";
import { getLocale, getTranslations } from "next-intl/server";

import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { createRequestClient, type ResponseOf } from "@/lib/api/requests/client";
import { REQUESTS, type Requests } from "@/lib/api/requests/registry";
import type { ApiPaths, Schemas } from "@/lib/api/types";
import { apiInternalUrl } from "@/lib/env/lazy-server";

import type { Configurator } from "@/features/customer/configurator/model";
import { toCatalogView, type DesignerCatalog } from "@/features/designer/data/catalog-view";

import { publishableFaqs } from "./faq-hygiene";
import { formatSupportHours } from "./support-hours";
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

export async function publicApi(lifetime: Lifetime): Promise<Client<ApiPaths>> {
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
export type { Configurator };
export type SharedQuote = Schemas["SavedQuoteDto"];
export type SupportChannels = Schemas["StoreSupportChannelsDto"];
export type FeaturedServices = Schemas["StoreFeaturedServicesDto"];
export type PublicConfig = Schemas["PublicConfigDto"];
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
 * (`store.catalog.getConfigurator`, public and cacheable) — read as published (U2.F1). `null` for
 * a product whose type has no ported calculator — it is quoted on request only (D-100).
 */
export async function getConfigurator(slug: string): Promise<Configurator | null> {
  const api = await publicApi("catalogue");
  return orNull(
    api.GET("/v1/store/catalog/products/{slug}/configurator", { params: { path: { slug } } }).then(({ data }) => data!),
  );
}

/**
 * A configuration someone shared (`store.configurations.getShared`, D-185); `null` once the link
 * has expired, been revoked or replaced, or the draft converted.
 */
export async function getSharedConfiguration(token: string): Promise<Schemas["SharedConfigurationDraftDto"] | null> {
  return orNull(
    (await publicApi("prices"))
      .GET("/v1/store/shared-configurations/{token}", { params: { path: { token } } })
      .then(({ data }) => data!),
  );
}

/** A quotation someone shared (`store.quotes.getShared`); `null` once the link has expired. */
export async function getSharedQuote(token: string): Promise<SharedQuote | null> {
  return orNull(
    (await publicApi("prices"))
      .GET("/v1/store/quotes/shared/{token}", { params: { path: { token } } })
      .then(({ data }) => data!),
  );
}

/**
 * getpack's CS channels (`store.support.getChannels`, D-221); `null` when unavailable. `hours` is
 * worded per locale from the structured `storefront.support_hours` (`PublicConfigDto.supportHours`,
 * DECISIONS-STAGE-A §11.7); without it, Thai keeps the channels' own (Thai-only) text and English
 * shows no hours rather than Thai words.
 */
export async function getSupportChannels(): Promise<SupportChannels | null> {
  const api = await publicApi("content");
  const [channels, config, locale] = await Promise.all([
    orFallback(
      api.GET("/v1/store/support-channels").then(({ data }) => data ?? null),
      null,
    ),
    getPublicConfig(),
    getLocale(),
  ]);
  if (!channels) return null;
  const t = await getTranslations({ locale, namespace: "catalog.supportHours" });
  const worded = formatSupportHours(config?.supportHours, {
    days: (days) => t(`days.${days}`),
    text: (parts) => t("text", parts),
  });
  return { ...channels, hours: worded ?? (locale === "th" ? channels.hours : null) };
}

/** The add-on services staff feature (`store.catalog.getFeaturedServices`, D-447); `null` when unavailable. */
export async function getFeaturedServices(): Promise<FeaturedServices | null> {
  const api = await publicApi("content");
  return orFallback(
    api.GET("/v1/store/catalog/featured-services").then(({ data }) => data ?? null),
    null,
  );
}

/** The figures and company facts the storefront states (`store.publicConfig.get`, D-309, D-447); `null` when unavailable. */
export async function getPublicConfig(): Promise<PublicConfig | null> {
  const api = await publicApi("content");
  return orFallback(
    api.GET("/v1/store/public-config").then(({ data }) => data ?? null),
    null,
  );
}

export type ContactOptions = Schemas["SupportContactOptionsDto"];
export type PriceTiers = Schemas["PriceTiersDto"];
export type Province = Schemas["GeoProvinceDto"];

/**
 * What the contact form offers now (`store.support.contactOptions`, D-458): reply targets, whether CS answers
 * now, call-back days and windows; `null` when unavailable — the page then shows none of them.
 */
export async function getContactOptions(): Promise<ContactOptions | null> {
  const api = await publicApi("prices");
  return orFallback(
    api.GET("/v1/store/support/contact-options").then(({ data }) => data ?? null),
    null,
  );
}

/**
 * A product's default spec priced at its quantity presets (`store.catalog.getPriceTiers`, C1-API-2) — the one store
 * pricing path; `null` when unavailable, empty tiers when the product has no instant default spec.
 */
export async function getPriceTiers(slug: string): Promise<PriceTiers | null> {
  const api = await publicApi("prices");
  return orFallback(
    api
      .GET("/v1/store/catalog/price-hints/{slug}/tiers", { params: { path: { slug } } })
      .then(({ data }) => data ?? null),
    null,
  );
}

/** Thai provinces (`store.catalog.listProvinces`, D-170) for an address-free province pick; empty when unavailable. */
export async function getProvinces(): Promise<Province[]> {
  const api = await publicApi("catalogue");
  return orFallback(
    api.GET("/v1/store/catalog/geo/provinces").then(({ data }) => (data ?? []) as Province[]),
    [],
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
  return publishableFaqs(data ?? []);
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

export type StyleLibrarySettings = Schemas["StoreStyleLibrarySettingsDto"];

/**
 * The library page's staff-managed content (`store.styleLibrary.getSettings`, D-448) — quick
 * search terms, the compare limit, the trust block. `null` when unavailable: the page then hides
 * those parts and compares up to D-246's three.
 */
export async function getStyleLibrarySettings(): Promise<StyleLibrarySettings | null> {
  const api = await publicApi("content");
  return orFallback(
    api.GET("/v1/store/style-library/settings").then(({ data }) => data ?? null),
    null,
  );
}

/* ------------------------------------------------------------------------- designer */

/**
 * The designer's catalogue for one product (`store.designer.getCatalog`): its patterns with dieline
 * keys and size rules, materials with caliper and flute allowances, templates, fonts and artwork
 * rules, and the product's id a new design is created under. Public and cached like the catalogue;
 * `null` without a product or when the API cannot answer, and the designer then draws on the
 * engine's typical boards (never priced).
 */
export async function getDesignerCatalog(product?: string): Promise<DesignerCatalog | null> {
  if (!product) return null;
  const api = await publicApi("catalogue");
  return orFallback(
    api
      .GET("/v1/store/designer/catalog", { params: { query: { product } } })
      .then(({ data }) => (data ? toCatalogView(data) : null)),
    null,
  );
}

/**
 * The product a studio design priced from a style alone belongs to (round 2, B6): the studio is
 * opened from the header, the home page or "ลองเล่นกับแบบตัวอย่าง" with a box style and no product,
 * and without one it could neither keep the design in the account nor ask for its price. The style's
 * category is a product type code (`folding_carton`, `corrugated`); the first product of that type
 * in the admin's merchandising order that has a designer catalogue is taken, an instantly priced one
 * first. `null` when none has.
 */
export async function defaultProductForStyle(category: string): Promise<string | null> {
  const typeCodes = category === "corrugated" ? ["corrugated", "folding_carton"] : ["folding_carton", "corrugated"];
  // Within the style's own type an instantly priced product wins over one sold by quotation, so
  // the dock can show a price; another type is never taken for a price (it would be the wrong box).
  for (const productType of typeCodes) {
    const page = await orFallback(listProducts({ productType, perPage: 8 }), null);
    let quoted: string | null = null;
    for (const product of page?.data ?? []) {
      if (!(await getDesignerCatalog(product.slug))) continue;
      if ((await orFallback(getConfigurator(product.slug), null))?.instant) return product.slug;
      quoted ??= product.slug;
    }
    if (quoted) return quoted;
  }
  return null;
}

/* ------------------------------------------------------------------------- style library */

export type StyleCard = Schemas["StyleCardDto"];
export type StyleDetail = Schemas["StyleDetailDto"];
export type StyleList = Schemas["StyleListDto"];
export type StyleSort = Schemas["StyleSort"];

export interface StyleListQuery {
  category?: string;
  family?: string;
  closure?: string;
  feature?: string;
  materialClass?: string;
  pricePath?: Schemas["QuoteMode"];
  /** One use case, or groups `a,b;c` = (a or b) and c (C0 wizard). */
  useCase?: string;
  /** The size search (C0): the product's outside `LxWxH` in mm. */
  size?: string;
  q?: string;
  sort?: StyleSort;
  cursor?: string;
  limit?: number;
}

/**
 * A page of the style library with its facets (`store.styles.list`, U3.5). Public and cached like
 * the catalogue: `favourite` is the signed-in customer's and is left to the browser
 * (`store.styleFavourites.list`), so a cached page is never one customer's view.
 */
export async function listStyles(query: StyleListQuery = {}): Promise<StyleList> {
  const { data } = await (await publicApi("catalogue")).GET("/v1/store/styles", { params: { query } });
  return data!;
}

/** Every published style, for the sitemap: the list's pages followed to the end (at most 20). */
export async function listAllStyles(): Promise<StyleCard[]> {
  const out: StyleCard[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const list = await listStyles({ limit: 100, sort: "name", ...(cursor ? { cursor } : {}) });
    out.push(...list.data);
    if (!list.meta.nextCursor) break;
    cursor = list.meta.nextCursor;
  }
  return out;
}

export type StyleVariantCard = Schemas["StyleVariantCardDto"];
export type StyleVariantList = Schemas["StyleVariantListDto"];
export type StyleVariantSort = Schemas["StyleVariantSort"];

export interface StyleVariantListQuery {
  style?: string;
  category?: string;
  family?: string;
  materialClass?: string;
  pricePath?: Schemas["QuoteMode"];
  useCase?: string;
  /** `axis:value`; one axis's values are alternatives, different axes all apply (D-410). */
  option?: string[];
  q?: string;
  sort?: StyleVariantSort;
  cursor?: string;
  limit?: number;
}

/** A page of every shown variant, as cards (`store.styles.listVariants`, D-410). Public and cached. */
export async function listStyleVariants(query: StyleVariantListQuery = {}): Promise<StyleVariantList> {
  const { data } = await (await publicApi("catalogue")).GET("/v1/store/styles/variants", { params: { query } });
  return data!;
}

export type StudioFeatured = Schemas["StudioFeaturedStylesDto"];

/**
 * The Studio's "แบบที่คนเริ่มบ่อย" (`store.styles.studioFeatured`, D-455): the admins' ordered list until usage
 * reaches the threshold, then by usage — `source: none` (hide the section) when nothing is chosen or the API is down.
 */
export async function getStudioFeatured(): Promise<StudioFeatured> {
  try {
    const { data } = await (await publicApi("catalogue")).GET("/v1/store/styles/studio-featured");
    return data ?? { source: "none", data: [] };
  } catch {
    return { source: "none", data: [] };
  }
}

/** The library's headline counts — every shown variant and style — or `null` when the API is down. */
export async function getLibraryTotals(): Promise<{ variants: number; styles: number } | null> {
  try {
    const { meta } = await listStyleVariants({ limit: 1 });
    return meta.libraryTotal > 0 ? { variants: meta.libraryTotal, styles: meta.libraryStyles } : null;
  } catch {
    return null;
  }
}

export async function getStyle(code: string): Promise<StyleDetail | null> {
  const api = await publicApi("catalogue");
  return orNull(api.GET("/v1/store/styles/{code}", { params: { path: { code } } }).then((r) => r.data!));
}

/** Up to three styles side by side (`store.styles.compare`, D-246); `null` when one is unknown. */
export async function compareStyles(codes: string[]): Promise<StyleDetail[] | null> {
  if (codes.length === 0) return [];
  const api = await publicApi("catalogue");
  return orNull(
    api.GET("/v1/store/styles/compare", { params: { query: { codes: codes.join(",") } } }).then((r) => r.data!),
  );
}
