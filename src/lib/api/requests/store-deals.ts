/**
 * Points & Deals P1.5 (loyalty earn expansion): the deals surface.
 *
 * CONTRACT: API-CHANGES-P15 — `docs/design/loyalty-earn-expansion/API-CHANGES-P15.md` is the contract getpack-api
 * builds on `feat/loyalty-p15-deals-surface`. Until that release is adopted (`pnpm gen:api --adopt`), the web calls
 * these operations through their request definitions; `registry.test.ts` then names them for deletion.
 *
 * What the API sends is display-ready: the deal's text comes from `promotions.display` in the request's locale, the
 * benefit carries its own one-line summary, and money is a decimal string the web only formats (D-220 prices are
 * VAT-inclusive). The web adds no deal, never computes a saving and never re-orders the list.
 */

import { z } from "zod";

import { dateTime, money, pct, request, uuid } from "./define";

export const DEAL_TABS = ["all", "for_you", "ending_soon", "points"] as const;
export const DEAL_BENEFIT_KINDS = ["percent", "amount", "free_shipping", "points_multiplier"] as const;
export const DEAL_MY_STATUSES = ["claimable", "saved", "used", "not_eligible"] as const;

export const dealBenefit = z
  .object({
    kind: z.enum(DEAL_BENEFIT_KINDS).meta({ id: "DealBenefitKind" }),
    /** The figure the stub shows: "10" for 10 %, "300.00" for ฿300, "2" for ×2; "" for free shipping. */
    value: z.string(),
    maxDiscount: money().nullable(),
    /** The API's one line, "ลด 10% สูงสุด ฿1,500" — the text equivalent of the stub. */
    summary: z.string(),
  })
  .meta({ id: "DealBenefitDto" });

export const deal = z
  .object({
    id: uuid(),
    slug: z.string().min(1),
    featured: z.boolean(),
    headline: z.string(),
    subline: z.string().nullable(),
    /** `display.badge` ("ดีลเด่น"); the web shows at most one amber badge per surface (D-486). */
    badge: z.string().nullable(),
    benefit: dealBenefit,
    /** The main conditions as label/value pairs, from the engine ("ขั้นต่ำ" · "1,000 ใบ"). */
    conditions: z.array(z.object({ label: z.string(), value: z.string() })),
    productTypeCodes: z.array(z.string()),
    /** Only for a single-code promotion (`CouponKind.single`); null for an automatic one. */
    code: z.string().nullable(),
    startsAt: dateTime(),
    endsAt: dateTime().nullable(),
    /** Less than 72 h left: a static label, never a countdown (D-481). */
    endingSoon: z.boolean(),
    terms: z.string(),
    heroImageUrl: z.string().nullable(),
    /** Per signed-in customer; null for a guest. */
    myStatus: z.enum(DEAL_MY_STATUSES).meta({ id: "DealMyStatus" }).nullable(),
    /** A `checkCode` failure code (`first_order_only`, `min_quantity` …) when `myStatus` is `not_eligible`. */
    notEligibleReason: z.string().nullable(),
    /** `https://getpack.co/deals/{slug}`, with `?ref=` echoed when the list was asked for with one. */
    shareUrl: z.string().url(),
  })
  .meta({ id: "PublicDealDto" });

export const dealList = z
  .object({
    items: z.array(deal),
    counts: z.object({
      all: z.number().int().min(0),
      for_you: z.number().int().min(0),
      ending_soon: z.number().int().min(0),
      points: z.number().int().min(0),
    }),
  })
  .meta({ id: "PublicDealListDto" });

export const dealDetail = deal
  .extend({ faq: z.array(z.object({ q: z.string(), a: z.string() })) })
  .meta({ id: "PublicDealDetailDto" });

export const applicableCodes = z
  .object({
    applicable: z.array(
      z.object({
        code: z.string(),
        promotionId: uuid(),
        headline: z.string(),
        benefitSummary: z.string(),
        /** What `checkCode` / apply takes off this cart (gate 9). */
        saving: money(),
        stackGroup: z.string().nullable(),
        /** Codes in this list that cannot be held together with this one. */
        conflictsWith: z.array(z.string()),
        /** The highest saving. */
        best: z.boolean(),
      }),
    ),
    notYet: z.array(
      z.object({
        code: z.string(),
        headline: z.string(),
        /** The `checkCode` failure code. */
        reason: z.string(),
        /** The API's sentence for it, e.g. "สั่งกล่องเพิ่มอีก 1,000 ใบ". */
        reasonText: z.string(),
      }),
    ),
    /** `promotions.max_codes_per_cart` (D-452). */
    maxCodes: z.number().int().min(1),
  })
  .meta({ id: "ApplicableCodesDto" });

export const priceLadder = z
  .object({
    unit: z.string(),
    current: z.number().int().min(1),
    rows: z.array(
      z.object({
        quantity: z.number().int().min(1),
        /** VAT-inclusive (D-220), the quotation option's own figure. */
        unitPrice: money(),
        current: z.boolean().optional(),
        /** Saving per piece against the smallest row, in percent; absent on the smallest. */
        savingPct: pct().optional(),
      }),
    ),
    promoHint: z.object({ promotionId: uuid(), text: z.string(), estimatedTotal: money() }).nullable(),
  })
  .meta({ id: "PriceLadderDto" });

export const storeDealsRequests = {
  "GET /v1/store/promotions": request({
    request: "store.promotions.list-public",
    summary: "Public deals (visibility public, active, in their window), with per-customer status when signed in",
    decisions: ["D-481", "D-486"],
    public: true,
    query: z.object({
      productTypeCode: z.string().optional(),
      tab: z.enum(DEAL_TABS).optional(),
      /** An agent's code: the API records the attribution and echoes it in `shareUrl`. */
      ref: z.string().max(40).optional(),
    }),
    response: dealList,
  }),
  "GET /v1/store/promotions/{slug}": request({
    request: "store.promotions.list-public",
    summary: "One public deal by its slug, with its FAQ; 404 when it is not shown",
    decisions: ["D-481"],
    public: true,
    /** Web assumption: a share link lands here, so the detail takes the list's `?ref=` too. */
    query: z.object({ ref: z.string().max(40).optional() }),
    response: dealDetail,
  }),
  "POST /v1/store/promotions/{promotionId}/actions/save": request({
    request: "store.promotions.save",
    summary: "Keep a deal's code in my coupon wallet (customer_saved_coupons); 409 when already saved or not saveable",
    status: 201,
    response: z.object({ myStatus: z.literal("saved") }),
  }),
  "GET /v1/store/cart/applicable-codes": request({
    request: "store.cart.applicable-codes",
    summary: "Codes I hold that pass checkCode against my cart now, and those that do not yet (with the reason)",
    decisions: ["D-452"],
    response: applicableCodes,
  }),
  "GET /v1/store/quotations/{quotationId}/ladder": request({
    request: "store.quotations.ladder",
    summary: "My quotation's quantity ladder (its own tier options, no new pricing) and a matching deal's hint",
    decisions: ["D-220"],
    response: priceLadder,
  }),
  "GET /v1/store/pricing/ladder": request({
    request: "store.quotations.ladder",
    summary: "The same ladder for a recorded calculation (PDP / configurator before a quotation exists)",
    decisions: ["D-220"],
    public: true,
    query: z.object({ calculationId: uuid(), quantity: z.coerce.number().int().min(1).optional() }),
    response: priceLadder,
  }),
} as const;

export type Deal = z.infer<typeof deal>;
export type DealList = z.infer<typeof dealList>;
export type DealDetail = z.infer<typeof dealDetail>;
export type DealTab = (typeof DEAL_TABS)[number];
export type DealMyStatus = (typeof DEAL_MY_STATUSES)[number];
export type ApplicableCodes = z.infer<typeof applicableCodes>;
export type ApplicableCode = ApplicableCodes["applicable"][number];
export type NotYetCode = ApplicableCodes["notYet"][number];
export type PriceLadder = z.infer<typeof priceLadder>;
