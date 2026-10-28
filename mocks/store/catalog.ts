/**
 * The storefront's catalogue (getpack-api's public `/v1/store/catalog/*` reads), mocked from the
 * same rows the back office edits (`../admin/catalogue.ts`): what is active or published in admin
 * is what the shop shows, in the store DTOs' shapes, typed by `Schemas` — the categories, price
 * hints, product FAQs and the sitemap (U-B0.1) among them.
 *
 * Every figure here is obviously fake. Prices are a deterministic function of the product's
 * slug — nothing is computed the way the API will compute it.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { catalogueRows } from "../admin/catalogue";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";
import { startingOf } from "./quotes";
import { publishedStyle, styleSearchHits } from "./styles";

export type Row = ReturnType<typeof catalogueRows>[number];

const ACTIVE = new Set(["active", "published"]);
export const live = (rows: Row[]) => rows.filter((row) => ACTIVE.has(String(row.status)));
export const byId = (rows: Row[], id: unknown) => rows.find((row) => row.id === id);
export const imageUrl = (fileId: unknown) => (typeof fileId === "string" ? `/v1/store/catalog/images/${fileId}` : null);
const english = (request: Request) => request.headers.get("accept-language")?.startsWith("en") ?? false;
const str = (value: unknown) => (typeof value === "string" ? value : null);

/* ----------------------------------------------------------------------------- mapping */

function categoryCodeOf(type: Row): string {
  return String(byId(catalogueRows("productCategories"), type.categoryId)?.code ?? type.code);
}

function productTypes(): Row[] {
  return sortBy(live(catalogueRows("productTypes")), "sort", "asc");
}

export function typeCodeOf(product: Row): string {
  return String(byId(catalogueRows("productTypes"), product.productTypeId)?.code ?? "");
}

export function catalogProducts(): Row[] {
  const types = new Set(productTypes().map((type) => type.id));
  return sortBy(
    live(catalogueRows("catalogProducts")).filter((row) => types.has(row.productTypeId as string)),
    "sort",
    "asc",
  );
}

/**
 * The U-B4 card facts (D-307, D-220, D-308), consistent with the mock's price hints: an instant
 * product starts at the same fake figure at 1,000 pieces, with a fake lead time; no live
 * promotion, so no campaign badge and no reference price.
 */
function cardFacts(
  quoteMode: unknown,
  moq: unknown,
  tags: string[],
  key?: string,
  starting?: ReturnType<typeof startingOf>,
): Pick<
  Schemas["StoreProductCardDto"],
  | "startingPricePerPiece"
  | "startingPricePerPieceExVat"
  | "startingPriceAssumes"
  | "moq"
  | "leadTimeDays"
  | "availability"
  | "campaignBadge"
  | "cacheTags"
> {
  const instant = quoteMode === "instant" && key !== undefined;
  return {
    // A product's starting price is its reference configuration priced by the configurator's own engine
    // (D-441); only the type-level cards, which have no single product, keep a made-up figure.
    startingPricePerPiece: starting !== undefined ? (starting?.unitPrice ?? null) : instant ? fakePrice(key) : null,
    startingPricePerPieceExVat: mockExVat(
      starting !== undefined ? (starting?.unitPrice ?? null) : instant ? fakePrice(key) : null,
    ),
    startingPriceAssumes:
      starting !== undefined
        ? starting
          ? { quantity: starting.spec.quantity, label: starting.spec.specLabel, specs: starting.spec.specs }
          : null
        : instant
          ? { quantity: 1000, label: { th: "1,000 ชิ้น", en: "1,000 pieces" }, specs: [] }
          : null,
    moq: typeof moq === "number" ? moq : null,
    leadTimeDays: instant ? { min: 7, max: 10 } : null,
    availability: quoteMode === "instant" ? "instant" : "rfq",
    campaignBadge: null,
    cacheTags: tags,
  };
}

function card(product: Row): Schemas["StoreProductCardDto"] {
  const images = (product.images as { fileId: string }[] | undefined) ?? [];
  const type = byId(catalogueRows("productTypes"), product.productTypeId);
  return {
    ...cardFacts(
      type?.quoteMode,
      product.quantityMin,
      [`catalog:type:${type?.id}`, `catalog:product:${product.slug}`],
      String(product.slug),
      startingOf(product),
    ),
    slug: String(product.slug),
    nameTh: String(product.nameTh),
    nameEn: String(product.nameEn),
    productTypeCode: typeCodeOf(product),
    imageUrl: imageUrl(images[0]?.fileId),
    templateAvailability: product.templateAvailability as Schemas["TemplateAvailability"],
  };
}

function seoOf(seoPageId: unknown, request: Request): Schemas["StoreSeoDto"] | null {
  const page = byId(catalogueRows("seoPages"), seoPageId);
  if (!page) return null;
  const en = english(request);
  return {
    title: String((en && page.titleEn) || page.titleTh),
    description: str(en ? (page.descriptionEn ?? page.descriptionTh) : page.descriptionTh),
    h1: str(page.h1),
    h2: str(page.h2),
    keywords: str(page.keywords),
    canonicalUrl: str(page.canonicalUrl),
    ogImageUrl: imageUrl(page.ogImageFileId),
    noindex: Boolean(page.noindex),
  };
}

/** The option tables a product's choices come from, by the kind the store groups them under. */
const OPTION_TABLES = { material: "materials", print_type: "printTypes", finish: "finishes" } as const;

function optionGroups(): Schemas["StoreOptionGroupDto"][] {
  // The contract's example options point at ids no table holds, so the mock offers each
  // kind's first few active rows instead — enough for a spec list, not a real offer.
  return Object.entries(OPTION_TABLES).flatMap(([kind, table]) => {
    const rows = live(catalogueRows(table)).slice(0, 4);
    if (rows.length === 0) return [];
    return [
      {
        kind: kind as Schemas["OfferableOptionKind"],
        options: rows.map((row, index) => ({
          id: String(row.id),
          code: String(row.code),
          nameTh: String(row.nameTh ?? row.code),
          nameEn: String(row.nameEn ?? row.code),
          // Whatever the option row holds; null where the table keeps no description, image or swatch.
          descriptionTh: str(row.descriptionTh),
          descriptionEn: str(row.descriptionEn),
          imageUrl: imageUrl(row.imageFileId),
          swatchHex: str(row.swatchHex),
          isDefault: index === 0,
          attributes: {},
        })),
      },
    ];
  });
}

function detail(product: Row, request: Request): Schemas["StoreProductDetailDto"] {
  const images = (product.images as { fileId: string; variant: Record<string, unknown> | null }[] | undefined) ?? [];
  const patterns = (product.patterns as { patternId: string }[] | undefined) ?? [];
  return {
    ...card(product),
    descriptionTh: str(product.descriptionTh),
    descriptionEn: str(product.descriptionEn),
    isCombination: Boolean(product.isCombination),
    images: images.map((image) => ({ url: imageUrl(image.fileId)!, variant: image.variant ?? null })),
    optionGroups: optionGroups(),
    patterns: patterns.flatMap((entry) => {
      const pattern = byId(catalogueRows("patterns"), entry.patternId);
      return pattern
        ? [
            {
              code: String(pattern.code),
              name: String(pattern.name),
              styleCode: str(pattern.styleCode),
              internationalName: str(pattern.internationalName),
              dielineKey: str(pattern.dielineKey),
              constraints: (pattern.constraints as Record<string, unknown>) ?? {},
            },
          ]
        : [];
    }),
    // C1: the published styles of the product's patterns (product ↔ style mapping).
    styles: patterns.flatMap((entry) => {
      const style = publishedStyle(str(byId(catalogueRows("patterns"), entry.patternId)?.styleCode));
      return style ? [style] : [];
    }),
    standardSizes: sortBy(
      live(catalogueRows("standardSizes")).filter((size) => size.catalogProductId === product.id),
      "sort",
      "asc",
    ).map((size) => ({
      code: String(size.code),
      name: String(size.name),
      widthMm: Number(size.widthMm),
      lengthMm: Number(size.lengthMm),
      heightMm: Number(size.heightMm),
    })),
    videos: catalogueRows("videos")
      .filter((video) => video.subjectId === product.id)
      .map((video) => ({
        provider: video.provider as Schemas["VideoProvider"],
        title: str(video.title),
        url: String(video.url),
      })),
    seo: seoOf(product.seoPageId, request),
  };
}

function stockProducts(): Row[] {
  const types = new Set(productTypes().map((type) => type.id));
  return live(catalogueRows("stockProducts")).filter((row) => types.has(row.productTypeId as string));
}

function stock(product: Row): Schemas["StoreStockProductDto"] {
  const values = catalogueRows("stockAttributeValues");
  const attributes = (product.attributes as { attribute: string; valueId: string; valueCode: string }[]) ?? [];
  const num = (value: unknown) => (typeof value === "number" ? value : null);
  return {
    id: String(product.id),
    campaignBadge: null,
    cacheTags: [`catalog:type:${String(product.productTypeId)}`],
    sku: String(product.sku),
    nameTh: String(product.nameTh),
    nameEn: String(product.nameEn),
    description: str(product.description),
    imageUrls: ((product.images as { fileId: string }[] | undefined) ?? []).map((image) => imageUrl(image.fileId)!),
    images: ((product.images as { fileId: string }[] | undefined) ?? []).map((image) => ({
      url: imageUrl(image.fileId)!,
      variant: null,
    })),
    // One obviously-mock item is out of stock, so "สินค้าหมด" (no cart, D-447 §10.4) can be seen and tested.
    inStock: product.sku !== "JAR-100",
    isFoodGrade: Boolean(product.isFoodGrade),
    minOrderQty: Number(product.minOrderQty ?? 1),
    unit: product.unit as Schemas["ProductUnit"],
    widthMm: num(product.widthMm),
    lengthMm: num(product.lengthMm),
    heightMm: num(product.heightMm),
    capacityMl: num(product.capacityMl),
    attributes: attributes.map((entry) => {
      const value = byId(values, entry.valueId);
      return {
        attribute: entry.attribute as Schemas["StockAttribute"],
        code: entry.valueCode,
        nameTh: String(value?.nameTh ?? entry.valueCode),
        nameEn: String(value?.nameEn ?? entry.valueCode),
      };
    }),
  };
}

export function articles(): Row[] {
  const now = Date.now();
  return live(catalogueRows("articles"))
    .filter((row) => typeof row.publishedAt === "string" && Date.parse(row.publishedAt) <= now)
    .sort((a, b) => Date.parse(String(b.publishedAt)) - Date.parse(String(a.publishedAt)));
}

function articleCard(article: Row): Schemas["StoreArticleCardDto"] {
  const categories = catalogueRows("articleCategories");
  return {
    slug: String(article.slug),
    titleTh: String(article.titleTh),
    titleEn: str(article.titleEn),
    excerptTh: str(article.excerptTh),
    coverUrl: imageUrl(article.coverFileId),
    categorySlugs: ((article.categoryIds as string[] | undefined) ?? [])
      .map((id) => byId(categories, id)?.slug)
      .filter((slug): slug is string => typeof slug === "string"),
    publishedAt: String(article.publishedAt),
  };
}

function showcase(): Row[] {
  return sortBy(live(catalogueRows("showcaseProducts")), "sort", "asc");
}

function showcaseDto(row: Row): Schemas["StoreShowcaseProductDto"] {
  return {
    slug: String(row.slug),
    productSlug: String(byId(catalogueRows("catalogProducts"), row.catalogProductId)?.slug ?? ""),
    categorySlug: str(byId(catalogueRows("showcaseCategories"), row.categoryId)?.slug),
    nameTh: String(row.nameTh),
    nameEn: String(row.nameEn),
    descriptionTh: str(row.descriptionTh),
    imageUrl: imageUrl(row.coverFileId),
    preset: (row.preset as Record<string, unknown>) ?? {},
  };
}

function inWindow(row: Row): boolean {
  const now = Date.now();
  return (
    (typeof row.validFrom !== "string" || Date.parse(row.validFrom) <= now) &&
    (typeof row.validTo !== "string" || Date.parse(row.validTo) >= now)
  );
}

/** A fake price per piece from the slug — stable across reloads, meaningless otherwise. */
/**
 * The ex-VAT figure the API sends next to a VAT-inclusive price (C1b, D-447) — the mock backend's own stand-in for
 * the API's shared VAT helper (7 % here; the real rate is the API's). The web never computes it.
 */
function mockExVat(inclusive: string | null): string | null {
  if (inclusive === null) return null;
  return (Math.round((Number(inclusive) * 100 * 100) / 107) / 100).toFixed(2);
}

function fakePrice(key: string): string {
  const seed = [...key].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 100_000, 7);
  return (1.5 + (seed % 900) / 100).toFixed(2);
}

/** An obviously fake picture for every catalogue image: a box outline and the word "mock". */
function placeholderSvg(fileId: string): string {
  const hue = [...fileId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600"><rect width="800" height="600" fill="hsl(${hue} 35% 92%)"/><path d="M280 230l120-60 120 60v150l-120 60-120-60z" fill="none" stroke="hsl(${hue} 30% 45%)" stroke-width="10" stroke-linejoin="round"/><path d="M280 230l120 60 120-60M400 290v150" fill="none" stroke="hsl(${hue} 30% 45%)" stroke-width="10" stroke-linejoin="round"/><text x="400" y="520" font-family="sans-serif" font-size="28" text-anchor="middle" fill="hsl(${hue} 25% 40%)">mock image</text></svg>`;
}

/** Active categories that hold an active product type, directly or through a sub-category (D-228). */
function productCategories(): Schemas["StoreProductCategoryDto"][] {
  const categories = catalogueRows("productCategories");
  const used = new Set(productTypes().map((type) => type.categoryId));
  return sortBy(live(categories), "sort", "asc")
    .filter(
      (row) => used.has(row.id) || live(categories).some((child) => child.parentId === row.id && used.has(child.id)),
    )
    .map((row) => ({
      code: String(row.code),
      nameTh: String(row.nameTh),
      nameEn: String(row.nameEn),
      parentCode: str(byId(categories, row.parentId)?.code),
      sort: Number(row.sort ?? 0),
    }));
}

/** Whether a product's type sits in the category `code` or one of its sub-categories (D-228). */
function inCategory(product: Row, code: string): boolean {
  const categories = catalogueRows("productCategories");
  const type = byId(catalogueRows("productTypes"), product.productTypeId);
  for (let category = byId(categories, type?.categoryId); category; category = byId(categories, category.parentId)) {
    if (category.code === code) return true;
  }
  return false;
}

/**
 * C1-API-3: the product an RFQ (or a basket line) names — an active catalogue or stock product of the
 * request's type; `"refused"` names the field the API answers 422 on.
 */
export function productRefOf(input: {
  productTypeCode: string;
  catalogProductSlug?: string | null;
  stockProductSku?: string | null;
}): Schemas["RfqProductRefDto"] | null | { refused: "catalogProductSlug" | "stockProductSku" } {
  if (input.catalogProductSlug && input.stockProductSku) return { refused: "stockProductSku" };
  if (input.catalogProductSlug) {
    const row = catalogProducts().find(
      (p) => p.slug === input.catalogProductSlug && typeCodeOf(p) === input.productTypeCode,
    );
    return row
      ? { kind: "catalog_product", key: String(row.slug), nameTh: String(row.nameTh), nameEn: String(row.nameEn) }
      : { refused: "catalogProductSlug" };
  }
  if (input.stockProductSku) {
    const row = stockProducts().find((p) => p.sku === input.stockProductSku && typeCodeOf(p) === input.productTypeCode);
    return row
      ? { kind: "stock_product", key: String(row.sku), nameTh: String(row.nameTh), nameEn: String(row.nameEn) }
      : { refused: "stockProductSku" };
  }
  return null;
}

/**
 * C1b (D-447): the active catalogue or stock product a quote-tray line names, with its type, category and the
 * reference the API returns — null when there is no such product.
 */
export function basketProductOf(input: { catalogProductSlug?: string; stockProductSku?: string }): {
  productTypeCode: string;
  categoryCode: string | null;
  product: Schemas["RfqProductRefDto"];
} | null {
  const row = input.catalogProductSlug
    ? catalogProducts().find((p) => p.slug === input.catalogProductSlug)
    : input.stockProductSku
      ? stockProducts().find((p) => p.sku === input.stockProductSku)
      : undefined;
  if (!row) return null;
  const type = byId(catalogueRows("productTypes"), row.productTypeId);
  return {
    productTypeCode: typeCodeOf(row),
    categoryCode: type ? categoryCodeOf(type) : null,
    product: input.catalogProductSlug
      ? { kind: "catalog_product", key: String(row.slug), nameTh: String(row.nameTh), nameEn: String(row.nameEn) }
      : { kind: "stock_product", key: String(row.sku), nameTh: String(row.nameTh), nameEn: String(row.nameEn) },
  };
}

/* ---------------------------------------------------------------------------- handlers */

const notFound = () => problem(404, "http.not_found", "ไม่พบรายการนี้");

/**
 * A postcode's areas. The admin geography mock holds almost no rows, so the postcodes the mock
 * customers' addresses use are answered from this short list — public place names, nothing else.
 */
const POSTCODE_AREAS: Record<string, [province: [string, string, string], district: [string, string, string]]> = {
  "10110": [
    ["10", "กรุงเทพมหานคร", "Bangkok"],
    ["1033", "คลองเตย", "Khlong Toei"],
  ],
  "10400": [
    ["10", "กรุงเทพมหานคร", "Bangkok"],
    ["1014", "พญาไท", "Phaya Thai"],
  ],
  "50200": [
    ["50", "เชียงใหม่", "Chiang Mai"],
    ["5001", "เมืองเชียงใหม่", "Mueang Chiang Mai"],
  ],
  "20000": [
    ["20", "ชลบุรี", "Chon Buri"],
    ["2001", "เมืองชลบุรี", "Mueang Chon Buri"],
  ],
  "90110": [
    ["90", "สงขลา", "Songkhla"],
    ["9011", "หาดใหญ่", "Hat Yai"],
  ],
  "40000": [
    ["40", "ขอนแก่น", "Khon Kaen"],
    ["4001", "เมืองขอนแก่น", "Mueang Khon Kaen"],
  ],
  "10260": [
    ["10", "กรุงเทพมหานคร", "Bangkok"],
    ["1047", "บางนา", "Bang Na"],
  ],
};

/** A known postcode's province and district (the company branches' addresses use them too). */
export function postcodeArea(postcode: string) {
  const known = POSTCODE_AREAS[postcode];
  if (!known) return undefined;
  const [province, district] = known.map(([code, nameTh, nameEn]) => ({ code, nameTh, nameEn }));
  return { province: province!, district: district! };
}

/**
 * The names an address filed under these ids carries, or `undefined` when the ids are not the
 * postcode's (the API's 422 on `postcode`): the mock rows keep names, the contract ids.
 */
export function areaOfIds(postcode: string, provinceId: string, subdistrictId?: string | null) {
  const area = postcodeArea(postcode);
  if (!area || provinceId !== mockId("gpv", Number(area.province.code))) return undefined;
  if (subdistrictId && subdistrictId !== mockId("gsd", Number(`${area.district.code}01`))) return undefined;
  return { province: area.province.nameTh, district: area.district.nameTh, subdistrict: area.district.nameTh };
}

/**
 * A postcode's province as a geography ref (`gpv` + code, the admin geography mock's ids). A
 * postcode the short list lacks keeps the Thai name the row holds, in both languages.
 */
export function provinceRefOf(postcode: string, nameTh: string): Schemas["GeoRefDto"] {
  const province = postcodeArea(postcode)?.province;
  return province
    ? { id: mockId("gpv", Number(province.code)), nameTh: province.nameTh, nameEn: province.nameEn }
    : { id: mockId("gpv", 0), nameTh, nameEn: nameTh };
}

export const storeCatalogHandlers: HttpHandler[] = [
  // store.catalog.getFeaturedServices (C1b, D-447): staff have chosen nothing in the mock — the page uses its own list.
  http.get("*/v1/store/catalog/featured-services", () =>
    HttpResponse.json({ curated: false, slugs: [] } satisfies Schemas["StoreFeaturedServicesDto"]),
  ),

  http.get("*/v1/store/catalog/geo/postcodes/:postcode", ({ params }) => {
    const known = POSTCODE_AREAS[String(params.postcode)];
    // Ids in the admin geography mock's namespaces (`gpv` / `gdt` / `gsd` + code).
    const area = (code: string, nameTh: string, nameEn: string, ns = "gdt") => ({
      id: mockId(ns, Number(code)),
      code,
      nameTh,
      nameEn,
    });
    const body: Schemas["StorePostcodeAreaDto"][] = known
      ? [
          {
            province: area(...known[0], "gpv"),
            district: area(...known[1]),
            subdistrict: {
              ...area(`${known[1][0]}01`, known[1][1], known[1][2], "gsd"),
              postcode: String(params.postcode),
            },
          },
        ]
      : [];
    return HttpResponse.json(body);
  }),
  http.get("*/v1/store/catalog/product-types", () =>
    HttpResponse.json(
      productTypes().map((type): Schemas["StoreProductTypeDto"] => ({
        ...cardFacts(type.quoteMode, null, [`catalog:type:${String(type.id)}`], String(type.code)),
        code: String(type.code),
        categoryCode: categoryCodeOf(type),
        nameTh: String(type.nameTh),
        nameEn: String(type.nameEn),
        quoteMode: type.quoteMode as Schemas["QuoteMode"],
      })),
    ),
  ),

  http.get("*/v1/store/catalog/products", ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("productType");
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = catalogProducts()
      .filter((row) => !type || typeCodeOf(row) === type)
      .filter((row) => !category || inCategory(row, category))
      .filter((row) => matchesQuery(q, String(row.nameTh), String(row.nameEn), String(row.slug)));
    const sorted = sortBy(
      rows,
      url.searchParams.get("sort") ?? undefined,
      (url.searchParams.get("order") as "asc" | "desc" | null) ?? undefined,
    );
    return HttpResponse.json(
      paginate(sorted.map(card), {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  http.get("*/v1/store/catalog/products/:slug", ({ params, request }) => {
    const product = catalogProducts().find((row) => row.slug === params.slug);
    return product ? HttpResponse.json(detail(product, request)) : notFound();
  }),

  http.get("*/v1/store/catalog/stock-products", ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("productType");
    const q = url.searchParams.get("q") ?? undefined;
    const category = url.searchParams.get("category");
    const rows = stockProducts()
      .filter((row) => !type || typeCodeOf(row) === type)
      .filter((row) => !category || inCategory(row, category))
      .filter((row) => matchesQuery(q, String(row.nameTh), String(row.nameEn), String(row.sku)));
    return HttpResponse.json(
      paginate(rows.map(stock), {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  http.get("*/v1/store/catalog/stock-products/:sku", ({ params }) => {
    const product = stockProducts().find((row) => row.sku === params.sku);
    return product ? HttpResponse.json(stock(product)) : notFound();
  }),

  http.get("*/v1/store/catalog/showcase", ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const rows = showcase()
      .map(showcaseDto)
      .filter((row) => !category || row.categorySlug === category);
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  http.get("*/v1/store/catalog/showcase/:slug", ({ params }) => {
    const row = showcase().find((candidate) => candidate.slug === params.slug);
    return row ? HttpResponse.json(showcaseDto(row)) : notFound();
  }),

  http.get("*/v1/store/catalog/home-sections", () =>
    HttpResponse.json(
      sortBy(live(catalogueRows("homeSections")), "sort", "asc").map((row): Schemas["StoreHomeSectionDto"] => ({
        slug: String(row.slug),
        titleTh: str(row.titleTh),
        titleEn: str(row.titleEn),
        kind: row.kind as Schemas["HomeSectionKind"],
        config: (row.config as Record<string, unknown>) ?? {},
      })),
    ),
  ),

  http.get("*/v1/store/catalog/banners", ({ request }) => {
    const position = new URL(request.url).searchParams.get("position");
    return HttpResponse.json(
      sortBy(live(catalogueRows("banners")), "sort", "asc")
        .filter((row) => inWindow(row) && (!position || row.position === position))
        .map((row): Schemas["StoreBannerDto"] => ({
          title: String(row.title),
          desktopImageUrl: imageUrl(row.desktopFileId)!,
          mobileImageUrl: imageUrl(row.mobileFileId),
          videoUrl: str(row.videoUrl),
          targetUrl: str(row.targetUrl),
          position: row.position as Schemas["BannerPosition"],
        })),
    );
  }),

  http.get("*/v1/store/catalog/articles", ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = articles()
      .map(articleCard)
      .filter((row) => !category || row.categorySlugs.includes(category))
      .filter((row) => matchesQuery(q, row.titleTh, row.titleEn, row.excerptTh));
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  http.get("*/v1/store/catalog/articles/:slug", ({ params, request }) => {
    const article = articles().find((row) => row.slug === params.slug);
    if (!article) return notFound();
    return HttpResponse.json({
      ...articleCard(article),
      body: (article.body as Record<string, unknown>) ?? {},
      bodySchemaVersion: Number(article.bodySchemaVersion ?? 1),
      seo: seoOf(article.seoPageId, request),
    } satisfies Schemas["StoreArticleDto"]);
  }),

  http.get("*/v1/store/catalog/article-categories", () =>
    HttpResponse.json(
      sortBy(live(catalogueRows("articleCategories")), "sort", "asc").map(
        (row): Schemas["StoreArticleCategoryDto"] => ({
          slug: String(row.slug),
          nameTh: String(row.nameTh),
          nameEn: String(row.nameEn),
        }),
      ),
    ),
  ),

  http.get("*/v1/store/catalog/faqs", () => {
    const faqs = sortBy(live(catalogueRows("faqs")), "sort", "asc");
    const categories = sortBy(live(catalogueRows("faqCategories")), "sort", "asc");
    const groups: Schemas["StoreFaqGroupDto"][] = categories.map((category) => ({
      categoryCode: String(category.code),
      categoryNameTh: String(category.nameTh),
      categoryNameEn: String(category.nameEn),
      faqs: faqs
        .filter((faq) => faq.categoryId === category.id)
        .map((faq) => ({
          questionTh: String(faq.questionTh),
          questionEn: str(faq.questionEn),
          answerTh: String(faq.answerTh),
          answerEn: str(faq.answerEn),
        })),
    }));
    return HttpResponse.json(groups.filter((group) => group.faqs.length > 0));
  }),

  http.get("*/v1/store/catalog/search", ({ request }) => {
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2 || q.length > 100) {
      return problem(422, "validation.failed", "คำค้นต้องยาว 2–100 ตัวอักษร", [
        { path: "q", code: "length", message: "2–100" },
      ]);
    }
    const hit = (
      kind: Schemas["StoreSearchHitKind"],
      key: string,
      titleTh: string,
      titleEn: string | null,
      image: string | null,
    ): Schemas["StoreSearchHitDto"] | null =>
      matchesQuery(q, titleTh, titleEn, key)
        ? { kind, key, titleTh, titleEn, imageUrl: image, score: titleTh.includes(q) ? 0.9 : 0.5 }
        : null;
    const hits = [
      ...catalogProducts().map((row) => {
        const c = card(row);
        return hit("catalog_product", c.slug, c.nameTh, c.nameEn, c.imageUrl);
      }),
      ...stockProducts().map((row) => {
        const s = stock(row);
        return hit("stock_product", s.sku, s.nameTh, s.nameEn, s.imageUrls[0] ?? null);
      }),
      ...showcase().map((row) => {
        const s = showcaseDto(row);
        return hit("showcase_product", s.slug, s.nameTh, s.nameEn, s.imageUrl);
      }),
      ...styleSearchHits().map((style) =>
        hit("style", style.key, style.titleTh, style.titleEn ?? null, style.imageUrl),
      ),
      ...articles().map((row) => {
        const a = articleCard(row);
        return hit("article", a.slug, a.titleTh, a.titleEn, a.coverUrl);
      }),
      // Published FAQ questions; the key is the FAQ's id (U-B0.1 `store.search-faq-hits`).
      ...live(catalogueRows("faqs")).map((row) =>
        hit("faq", String(row.id), String(row.questionTh), str(row.questionEn), null),
      ),
    ]
      .filter((entry): entry is Schemas["StoreSearchHitDto"] => entry !== null)
      .sort((a, b) => b.score - a.score)
      // As the API: the best 8 of each kind, then 40 in all.
      .filter((entry, _index, all) => all.filter((other) => other.kind === entry.kind).indexOf(entry) < 8)
      .slice(0, 40);
    return HttpResponse.json({ q, hits } satisfies Schemas["StoreSearchResultDto"]);
  }),

  http.get("*/v1/store/catalog/seo", ({ request }) => {
    const key = new URL(request.url).searchParams.get("pageKey");
    const page = catalogueRows("seoPages").find((row) => row.pageKey === key);
    return page ? HttpResponse.json(seoOf(page.id, request)) : notFound();
  }),

  http.get(
    "*/v1/store/catalog/images/:fileId",
    ({ params }) =>
      new HttpResponse(placeholderSvg(String(params.fileId)), {
        headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" },
      }),
  ),

  // store.catalog.listProductCategories: active categories holding an active product type.
  http.get("*/v1/store/catalog/product-categories", () => HttpResponse.json(productCategories())),

  // store.catalog.getSitemap: what the storefront lists, each with its last change.
  http.get("*/v1/store/sitemap", () => {
    const at = (row: Row) => String(row.updatedAt ?? row.publishedAt ?? "2026-09-01T09:00:00+07:00");
    const entries: Schemas["StoreSitemapEntryDto"][] = [
      ...productCategories().map((category) => ({
        kind: "category" as const,
        key: category.code,
        lastModified: "2026-09-01T09:00:00+07:00",
      })),
      ...catalogProducts().map((row) => ({
        kind: "catalog_product" as const,
        key: String(row.slug),
        lastModified: at(row),
      })),
      ...stockProducts().map((row) => ({
        kind: "stock_product" as const,
        key: String(row.sku),
        lastModified: at(row),
      })),
      ...articles().map((row) => ({ kind: "article" as const, key: String(row.slug), lastModified: at(row) })),
    ];
    return HttpResponse.json(entries);
  }),

  // store.catalog.listPriceHints (D-220): a fake figure per product, `null` for an RFQ type.
  http.get("*/v1/store/catalog/price-hints", ({ request }) => {
    const url = new URL(request.url);
    const list = (name: string) => {
      const values = url.searchParams
        .getAll(name)
        .flatMap((value) => value.split(","))
        .filter(Boolean);
      return values.length ? values : undefined;
    };
    const productType = url.searchParams.get("productType");
    const slugs = list("slugs");
    const skus = list("skus");
    const quoteModeOf = (row: Row) =>
      String(byId(catalogueRows("productTypes"), row.productTypeId)?.quoteMode ?? "rfq");
    const wanted = (row: Row, keys: string[] | undefined, key: string) =>
      (!productType || typeCodeOf(row) === productType) && (!keys || keys.includes(key));
    const hint = (row: Row, kind: Schemas["PriceHintKind"], key: string, quantity: number): Schemas["PriceHintDto"] => {
      const instant = quoteModeOf(row) === "instant";
      const size = live(catalogueRows("standardSizes")).find((entry) => entry.catalogProductId === row.id);
      // A catalogue product's hint is its reference configuration priced by the configurator's engine (D-441).
      const reference = kind === "catalog_product" ? startingOf(row) : null;
      const fake = kind !== "catalog_product";
      return {
        key,
        kind,
        productTypeCode: typeCodeOf(row),
        startingFromPerPiece: reference ? reference.unitPrice : fake && instant ? fakePrice(key) : null,
        startingFromPerPieceExVat: mockExVat(reference ? reference.unitPrice : fake && instant ? fakePrice(key) : null),
        currency: "THB",
        basis: reference
          ? {
              quantity: reference.spec.quantity,
              sizeCode: reference.spec.standardSizeCode,
              includesVat: true,
              includesDelivery: false,
              label: reference.spec.specLabel,
              specs: reference.spec.specs,
            }
          : fake && instant
            ? {
                quantity,
                sizeCode: str(size?.code),
                includesVat: true,
                includesDelivery: false,
                label: {
                  th: [row.nameTh, size ? (size.name ?? size.code) : null].filter(Boolean).join(" · "),
                  en: [row.nameEn, size ? (size.name ?? size.code) : null].filter(Boolean).join(" · "),
                },
                specs: [
                  {
                    key: "style",
                    labelTh: "ทรง",
                    labelEn: "Style",
                    valueTh: String(row.nameTh),
                    valueEn: String(row.nameEn),
                  },
                ],
              }
            : null,
        leadTimeBusinessDays: instant ? { min: 7, max: 10 } : null,
        computedAt: instant ? bangkokIso() : null,
      };
    };
    return HttpResponse.json([
      ...(skus && !slugs
        ? []
        : catalogProducts()
            .filter((row) => wanted(row, slugs, String(row.slug)))
            .map((row) => hint(row, "catalog_product", String(row.slug), 1000))),
      ...(slugs && !skus
        ? []
        : stockProducts()
            .filter((row) => wanted(row, skus, String(row.sku)))
            .map((row) => hint(row, "stock_product", String(row.sku), Number(row.minOrderQty ?? 1)))),
    ]);
  }),

  // store.catalog.listProductFaqs — no link between FAQs and products exists in the admin mock,
  // so every product shows the first two published questions.
  http.get("*/v1/store/catalog/products/:slug/faqs", ({ params }) => {
    if (!catalogProducts().some((row) => row.slug === params.slug)) return notFound();
    const faqs: Schemas["StoreFaqDto"][] = sortBy(live(catalogueRows("faqs")), "sort", "asc")
      .slice(0, 2)
      .map((faq) => ({
        questionTh: String(faq.questionTh),
        questionEn: str(faq.questionEn),
        answerTh: String(faq.answerTh),
        answerEn: str(faq.answerEn),
      }));
    return HttpResponse.json(faqs);
  }),
];
