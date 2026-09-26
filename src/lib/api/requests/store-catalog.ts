/**
 * What the storefront's catalogue pages need beyond packio-api B2.1's public reads (F3 3.1):
 * the "starting from" price and lead-time range a product card and page show, a product's own
 * FAQs, and the category list the catalogue is browsed by.
 *
 * B2.1's `GET /v1/store/catalog/products` says "No prices here" on purpose — catalogue content
 * changes when an admin edits it, prices change with every factory price list (D-043) and
 * capacity week (D-101). So the price is asked for as its own read, with its own cache life,
 * rather than as fields on the product.
 */

import { z } from "zod";

import { currency, dateTime, money, request } from "./define";

/** The quantity, size and inclusions a "starting from" figure was computed at — shown with it. */
export const priceHintBasis = z
  .object({
    quantity: z.number().int(),
    /** The standard size it was priced at, when the product has standard sizes. */
    sizeCode: z.string().nullable(),
    includesVat: z.boolean(),
    includesDelivery: z.boolean(),
  })
  .meta({ id: "PriceHintBasisDto" });

export const businessDayRange = z
  .object({ min: z.number().int(), max: z.number().int() })
  .meta({ id: "BusinessDayRangeDto" });

export const priceHint = z
  .object({
    /** `slug` for a catalogue product, `sku` for a stock product. */
    key: z.string(),
    kind: z.enum(["catalog_product", "stock_product"]).meta({ id: "PriceHintKind" }),
    productTypeCode: z.string(),
    /** Per piece. `null` when no active factory can price it — the product is RFQ (D-043). */
    startingFromPerPiece: money().nullable(),
    currency: currency(),
    basis: priceHintBasis.nullable(),
    /** Production lead time on the business calendar (D-161), capacity-aware (D-101). */
    leadTimeBusinessDays: businessDayRange.nullable(),
    computedAt: dateTime(),
  })
  .meta({ id: "PriceHintDto" });

export const storeFaq = z
  .object({
    questionTh: z.string(),
    questionEn: z.string().nullable(),
    answerTh: z.string(),
    answerEn: z.string().nullable(),
  })
  .meta({ id: "StoreProductFaqDto" });

export const storeProductCategory = z
  .object({
    code: z.string(),
    nameTh: z.string(),
    nameEn: z.string(),
    parentCode: z.string().nullable(),
    sort: z.number().int(),
  })
  .meta({ id: "StoreProductCategoryDto" });

/** A comma-separated list in a query string. */
const keyList = () =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+(,[A-Za-z0-9_-]+)*$/)
    .optional();

export const storeCatalogRequests = {
  "GET /v1/store/catalog/price-hints": request({
    request: "store.price-hints",
    summary: 'The "starting from" price and lead-time range for catalogue and stock products',
    decisions: ["D-043", "D-050", "D-101", "D-161"],
    public: true,
    query: z.object({
      productType: z.string().optional(),
      slugs: keyList(),
      skus: keyList(),
    }),
    response: z.object({ data: z.array(priceHint) }),
  }),
  "GET /v1/store/catalog/products/{slug}/faqs": request({
    request: "store.product-faqs",
    summary: "The questions shown on one product's page",
    public: true,
    response: z.array(storeFaq),
  }),
  "GET /v1/store/catalog/product-categories": request({
    request: "store.product-categories",
    summary: "The active product categories the catalogue is browsed by",
    decisions: ["D-100"],
    public: true,
    response: z.array(storeProductCategory),
  }),
} as const;
