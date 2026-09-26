/**
 * The storefront's catalogue (packio-api B2.1's public `/v1/store/catalog/*` reads), mocked
 * from the same rows the back office edits (`../admin/catalogue.ts`): what is active or
 * published in admin is what the shop shows, in the store DTOs' shapes, typed by `Schemas`.
 *
 * Plus the storefront's contract requests (CONTRACT-REQUEST store.price-hints,
 * store.product-faqs, store.product-categories) through `mockRequest`, which holds each
 * response to its requested schema.
 *
 * Every figure here is obviously fake. Prices are a deterministic function of the product's
 * slug — nothing is computed the way the API will compute it.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { catalogueRows } from "../admin/catalogue";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, paginate, problem, sortBy } from "../support";

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

function card(product: Row): Schemas["StoreProductCardDto"] {
  const images = (product.images as { fileId: string }[] | undefined) ?? [];
  return {
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
          code: String(row.code),
          nameTh: String(row.nameTh ?? row.code),
          nameEn: String(row.nameEn ?? row.code),
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
              dielineKey: str(pattern.dielineKey),
              constraints: (pattern.constraints as Record<string, unknown>) ?? {},
            },
          ]
        : [];
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
    sku: String(product.sku),
    nameTh: String(product.nameTh),
    nameEn: String(product.nameEn),
    description: str(product.description),
    imageUrls: ((product.images as { fileId: string }[] | undefined) ?? []).map((image) => imageUrl(image.fileId)!),
    inStock: true,
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

function articles(): Row[] {
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
function fakePrice(key: string): string {
  const seed = [...key].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 100_000, 7);
  return (1.5 + (seed % 900) / 100).toFixed(2);
}

/** An obviously fake picture for every catalogue image: a box outline and the word "mock". */
function placeholderSvg(fileId: string): string {
  const hue = [...fileId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600"><rect width="800" height="600" fill="hsl(${hue} 35% 92%)"/><path d="M280 230l120-60 120 60v150l-120 60-120-60z" fill="none" stroke="hsl(${hue} 30% 45%)" stroke-width="10" stroke-linejoin="round"/><path d="M280 230l120 60 120-60M400 290v150" fill="none" stroke="hsl(${hue} 30% 45%)" stroke-width="10" stroke-linejoin="round"/><text x="400" y="520" font-family="sans-serif" font-size="28" text-anchor="middle" fill="hsl(${hue} 25% 40%)">mock image</text></svg>`;
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
};

export const storeCatalogHandlers: HttpHandler[] = [
  http.get("*/v1/store/catalog/geo/postcodes/:postcode", ({ params }) => {
    const known = POSTCODE_AREAS[String(params.postcode)];
    const area = (code: string, nameTh: string, nameEn: string) => ({ code, nameTh, nameEn });
    const body: Schemas["StorePostcodeAreaDto"][] = known
      ? [
          {
            province: area(...known[0]),
            district: area(...known[1]),
            subdistrict: { ...area(`${known[1][0]}01`, known[1][1], known[1][2]), postcode: String(params.postcode) },
          },
        ]
      : [];
    return HttpResponse.json(body);
  }),
  http.get("*/v1/store/catalog/product-types", () =>
    HttpResponse.json(
      productTypes().map((type): Schemas["StoreProductTypeDto"] => ({
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
    const q = url.searchParams.get("q") ?? undefined;
    const rows = catalogProducts()
      .filter((row) => !type || typeCodeOf(row) === type)
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
    const rows = stockProducts()
      .filter((row) => !type || typeCodeOf(row) === type)
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
      ...articles().map((row) => {
        const a = articleCard(row);
        return hit("article", a.slug, a.titleTh, a.titleEn, a.coverUrl);
      }),
    ]
      .filter((entry): entry is Schemas["StoreSearchHitDto"] => entry !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
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

  // CONTRACT-REQUEST store.product-categories
  mockRequest("GET /v1/store/catalog/product-categories", () => {
    const categories = catalogueRows("productCategories");
    const used = new Set(productTypes().map((type) => type.categoryId));
    return sortBy(live(categories), "sort", "asc")
      .filter((row) => used.has(row.id))
      .map((row) => ({
        code: String(row.code),
        nameTh: String(row.nameTh),
        nameEn: String(row.nameEn),
        parentCode: str(byId(categories, row.parentId)?.code),
        sort: Number(row.sort ?? 0),
      }));
  }),

  // CONTRACT-REQUEST store.price-hints
  mockRequest("GET /v1/store/catalog/price-hints", ({ query }) => {
    const slugs = query.slugs?.split(",");
    const skus = query.skus?.split(",");
    const quoteModeOf = (row: Row) =>
      String(byId(catalogueRows("productTypes"), row.productTypeId)?.quoteMode ?? "rfq");
    const wanted = (row: Row, list: string[] | undefined, key: string) =>
      (!query.productType || typeCodeOf(row) === query.productType) && (!list || list.includes(key));
    const hint = (row: Row, kind: "catalog_product" | "stock_product", key: string, quantity: number) => {
      const instant = quoteModeOf(row) === "instant";
      const size = live(catalogueRows("standardSizes")).find((entry) => entry.catalogProductId === row.id);
      return {
        key,
        kind,
        productTypeCode: typeCodeOf(row),
        startingFromPerPiece: instant ? fakePrice(key) : null,
        currency: "THB" as const,
        basis: instant ? { quantity, sizeCode: str(size?.code), includesVat: true, includesDelivery: false } : null,
        leadTimeBusinessDays: instant ? { min: 7, max: 10 } : null,
        computedAt: bangkokIso(),
      };
    };
    return {
      data: [
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
      ],
    };
  }),

  // CONTRACT-REQUEST store.product-faqs — no link between FAQs and products exists in the
  // admin mock, so every product shows the first two published questions.
  mockRequest("GET /v1/store/catalog/products/{slug}/faqs", ({ params }) => {
    if (!catalogProducts().some((row) => row.slug === params.slug)) return notFound();
    return sortBy(live(catalogueRows("faqs")), "sort", "asc")
      .slice(0, 2)
      .map((faq) => ({
        questionTh: String(faq.questionTh),
        questionEn: str(faq.questionEn),
        answerTh: String(faq.answerTh),
        answerEn: str(faq.answerEn),
      }));
  }),
];
