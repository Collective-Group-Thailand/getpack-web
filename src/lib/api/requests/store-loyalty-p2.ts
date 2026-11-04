/**
 * Points & Deals P2 (loyalty earn expansion): engagement, lifecycle, "สำหรับคุณ" and bundles — the store side.
 *
 * CONTRACT: API-CHANGES-P2 — `docs/design/loyalty-earn-expansion/API-CHANGES-P2.md` is the contract getpack-api builds
 * on `feat/loyalty-p2-lifecycle`. Until that release is adopted (`pnpm gen:api --adopt`), the new operations below are
 * request definitions; `registry.test.ts` then names them for deletion.
 *
 * Operations that are already published but gain fields in P2 (`store.promotions.listPublic` / `getPublic`,
 * `store.loyalty.get`, `store.loyalty.tasks`, `store.reorderSuggestions.list`, the checkout `points` preview) cannot
 * be request definitions (`registry.test.ts` refuses a published path). Their additions are the `…P2Fields` schemas
 * here, read from the published response with `safeParse` at one place each (`features/shared/loyalty-p2/read.ts`),
 * so a response without them reads as "nothing new". CONTRACT-REQUEST store.loyalty.p2-fields.
 *
 * Money is a decimal string the web only formats; points are integers; the web never computes either.
 */

import { z } from "zod";

import { date, dateTime, money, request, uuid } from "./define";

/* ------------------------------------------------------------------ additions to published shapes */

/** Why a deal is in "สำหรับคุณ". Business-type and inactivity matches are never disclosed (null). */
export const FOR_YOU_REASONS = ["new_customer", "tier", "ordered_product_type"] as const;

export const dealBundleItem = z
  .object({
    productTypeCode: z.string(),
    productTypeName: z.string(),
    /** The preset as the API words it: "30 × 20 × 15 ซม. · ลอน B · พิมพ์ 1 สี". */
    summary: z.string(),
    quantity: z.number().int().min(1),
    unit: z.string(),
    /** VAT-inclusive (D-220), priced today from the preset. */
    unitPrice: money(),
  })
  .meta({ id: "DealBundleItemDto" });

export const dealBundle = z
  .object({
    items: z.array(dealBundleItem).min(2).max(4),
    /** VAT-exclusive, before the margin guard — an estimate the cart may not match exactly. */
    estimatedSaving: money().nullable(),
  })
  .meta({ id: "DealBundleDto" });

/** `store.promotions.listPublic` / `getPublic` items from P2 on. */
export const dealP2Fields = z
  .object({
    forYou: z.boolean(),
    forYouReason: z.enum(FOR_YOU_REASONS).meta({ id: "DealForYouReason" }).nullable(),
    bundle: dealBundle.nullable(),
  })
  .meta({ id: "DealP2Fields" });

/** P2's new task codes in `store.loyalty.tasks`, and `nextDueAt` (only for a done `data_refresh`). */
export const P2_TASK_CODES = ["data_refresh", "showcase_consent", "first_sample"] as const;
export const loyaltyTaskP2Fields = z
  .object({ nextDueAt: dateTime().nullable().optional() })
  .meta({ id: "EarnTaskP2Fields" });

/** `store.loyalty.get` from P2 on: the win-back lots and the count of active campaigns. */
export const loyaltySummaryP2Fields = z
  .object({
    bonusLots: z.array(
      z.object({
        points: z.number().int().min(1),
        reason: z.enum(["first_order", "winback", "promotion"]),
        expiresAt: dateTime(),
      }),
    ),
    activeCampaigns: z.number().int().min(0),
  })
  .meta({ id: "LoyaltySummaryP2Fields" });

/** The multipliers behind an order's points (decimal strings, the API's own rounding). */
export const pointsMultipliers = z
  .object({
    tier: z.string(),
    paymentMethod: z.string(),
    reorderCampaign: z.string(),
    promotion: z.string(),
    combined: z.string(),
    capped: z.boolean(),
  })
  .meta({ id: "PointsMultipliersDto" });

/** Ledger items from P2 on. */
export const ledgerEntryP2Fields = z
  .object({
    bonusReason: z.enum(["first_order", "winback", "promotion"]).nullable(),
    multipliers: pointsMultipliers.nullable(),
  })
  .partial()
  .meta({ id: "PointsEntryP2Fields" });

/** `store.reorderSuggestions.list` items from P2 on. */
export const reorderSuggestionP2Fields = z
  .object({
    predictedStockOutOn: date().nullable(),
    bonus: z.object({ multiplier: z.string(), endsAt: dateTime() }).nullable(),
  })
  .meta({ id: "ReorderSuggestionP2Fields" });

/** The checkout preview's `points` from P2 on. */
export const checkoutPointsP2Fields = z
  .object({
    multipliers: pointsMultipliers.nullable(),
    paymentBonus: z.object({ multiplier: z.string(), methods: z.array(z.string()) }).nullable(),
    toEarnWithPaymentBonus: z.number().int().min(0).nullable(),
  })
  .meta({ id: "CheckoutPointsP2Fields" });

/* ------------------------------------------------------------------------------- new operations */

export const loyaltyCampaign = z
  .object({
    id: uuid(),
    kind: z.enum(["reorder_bonus", "winback", "admin"]),
    multiplier: z.string(),
    startsAt: dateTime(),
    endsAt: dateTime(),
    productTypeCode: z.string().nullable(),
    productTypeName: z.string().nullable(),
    reorderOfOrderId: uuid().nullable(),
    reorderOfOrderCode: z.string().nullable(),
  })
  .meta({ id: "LoyaltyCampaignDto" });

export const SURVEY_QUESTION_KINDS = ["rating", "single", "multi", "text"] as const;

export const surveyQuestion = z
  .object({
    key: z.string().min(1),
    kind: z.enum(SURVEY_QUESTION_KINDS).meta({ id: "SurveyQuestionKind" }),
    label: z.string(),
    required: z.boolean(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    options: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
    maxLength: z.number().int().optional(),
  })
  .meta({ id: "SurveyQuestionDto" });

export const surveyInstance = z
  .object({
    id: uuid(),
    trigger: z.enum(["post_delivery", "quarterly"]).meta({ id: "SurveyTrigger" }),
    /** Only for `post_delivery`. */
    orderCode: z.string().nullable().optional(),
    status: z.enum(["open", "seen", "completed", "dismissed", "expired"]).meta({ id: "SurveyInstanceStatus" }),
    expiresAt: dateTime(),
    /** 0 when the template pays nothing or the activity cap is reached. */
    rewardPoints: z.number().int().min(0),
    title: z.string(),
    questions: z.array(surveyQuestion).min(3).max(5),
  })
  .meta({ id: "SurveyInstanceDto" });

export const surveyAnswers = z
  .record(z.string(), z.union([z.number().int(), z.string().max(500), z.array(z.string())]))
  .meta({ id: "SurveyAnswersDto" });

export const dataRefresh = z
  .object({
    due: z.boolean(),
    lastConfirmedAt: dateTime().nullable(),
    nextDueAt: dateTime().nullable(),
    rewardPoints: z.number().int().min(0),
    company: z.object({ id: uuid(), legalName: z.string() }).nullable(),
    taxProfiles: z.array(z.object({ id: uuid(), label: z.string() })),
    addresses: z.array(z.object({ id: uuid(), label: z.string(), isDefault: z.boolean() })),
  })
  .meta({ id: "DataRefreshDto" });

export const SHOWCASE_SCOPES = ["brand_name", "logo", "packaging_photos", "review_quote"] as const;

export const showcaseConsent = z
  .object({
    status: z.enum(["none", "requested", "approved", "rejected", "withdrawn"]).meta({ id: "ShowcaseConsentStatus" }),
    scope: z.array(z.enum(SHOWCASE_SCOPES).meta({ id: "ShowcaseScope" })),
    consentTextVersion: z.string().nullable(),
    requestedAt: dateTime().nullable(),
    decidedAt: dateTime().nullable(),
    rewardPoints: z.number().int().min(0),
  })
  .meta({ id: "ShowcaseConsentDto" });

export const storeLoyaltyP2Requests = {
  "POST /v1/store/promotions/{promotionId}/actions/add-bundle": request({
    request: "store.promotions.add-bundle",
    summary: "Price each bundle preset, save one quotation per item and add every option to my cart in one transaction",
    decisions: ["D-494"],
    status: 201,
    concurrency: true,
    body: z.object({
      items: z
        .array(
          z.object({
            designOption: z.enum(["own_file", "online_designer", "hired_design", "free_design"]),
            designNote: z.string().max(500).optional(),
          }),
        )
        .optional(),
    }),
    // The CartDto as published; only the fields the sheet reads are asserted here.
    response: z.object({ id: uuid(), items: z.array(z.object({ id: uuid() }).loose()) }).loose(),
  }),
  "GET /v1/store/loyalty/campaigns": request({
    request: "store.loyalty.campaigns",
    summary: "My active points campaigns (reorder bonus ×1.5 for a SKU, until a fixed date)",
    decisions: ["D-492", "D-481"],
    response: z.object({ items: z.array(loyaltyCampaign) }),
  }),
  "POST /v1/store/orders/{orderId}/review/photos": request({
    request: "store.reviews.add-photos",
    summary: "Attach up to 4 scrubbed photos to my review within 30 days (the first one earns the photo reward once)",
    decisions: ["D-490", "D-442"],
    status: 201,
    body: z.object({ photoFileIds: z.array(uuid()).min(1).max(4) }),
    response: z
      .object({
        photos: z.array(z.object({ id: uuid(), url: z.string() })),
        rewardPoints: z.number().int(),
        photoRewardPoints: z.number().int(),
      })
      .loose(),
  }),
  "GET /v1/store/loyalty/data-refresh": request({
    request: "store.loyalty.data-refresh",
    summary: "Whether my company, tax profiles and addresses are due for the yearly confirmation, and its reward",
    decisions: ["D-490"],
    response: dataRefresh,
  }),
  "POST /v1/store/loyalty/data-refresh/actions/confirm": request({
    request: "store.loyalty.data-refresh",
    summary: "Confirm my data is correct; earns earn_data_refresh at most once per 12 months",
    decisions: ["D-490"],
    body: z.object({ confirmed: z.literal(true) }),
    response: dataRefresh,
  }),
  "GET /v1/store/loyalty/showcase-consent": request({
    request: "store.loyalty.showcase-consent",
    summary: "My consent for getpack to show my brand, logo, packaging photos or review quote, and its status",
    decisions: ["D-490"],
    response: showcaseConsent,
  }),
  "PUT /v1/store/loyalty/showcase-consent": request({
    request: "store.loyalty.showcase-consent",
    summary: "Grant (opens a Marketing approval) or withdraw my showcase consent",
    decisions: ["D-490"],
    body: z.union([
      z.object({
        granted: z.literal(true),
        scope: z.array(z.enum(SHOWCASE_SCOPES)).min(1),
        consentTextVersion: z.string(),
      }),
      z.object({ granted: z.literal(false) }),
    ]),
    response: showcaseConsent,
  }),
  "GET /v1/store/surveys/next": request({
    request: "store.surveys",
    summary: "The one open survey to show now (oldest first), or null — read-only",
    decisions: ["D-482", "D-491"],
    response: z.object({ survey: surveyInstance.nullable() }),
  }),
  "GET /v1/store/surveys/{surveyId}": request({
    request: "store.surveys",
    summary: "One of my survey instances that has not expired (deep link)",
    decisions: ["D-491"],
    response: z.object({ survey: surveyInstance }),
  }),
  "POST /v1/store/surveys/{surveyId}/actions/seen": request({
    request: "store.surveys",
    summary: "open → seen: `next` stops returning it (shown once); idempotent",
    decisions: ["D-491"],
    status: 204,
  }),
  "POST /v1/store/surveys/{surveyId}/actions/dismiss": request({
    request: "store.surveys",
    summary: "→ dismissed (final for the feed; the link still opens it until it expires)",
    decisions: ["D-491"],
    status: 204,
  }),
  "POST /v1/store/surveys/{surveyId}/responses": request({
    request: "store.surveys",
    summary: "Submit my answers → completed; earns earn_survey once per instance",
    decisions: ["D-490", "D-491"],
    status: 201,
    body: z.object({ answers: surveyAnswers }),
    response: z.object({ status: z.literal("completed"), rewardPoints: z.number().int().min(0) }),
  }),
} as const;

export type ForYouReason = (typeof FOR_YOU_REASONS)[number];
export type DealBundle = z.infer<typeof dealBundle>;
export type DealBundleItem = z.infer<typeof dealBundleItem>;
export type DealP2Fields = z.infer<typeof dealP2Fields>;
export type P2TaskCode = (typeof P2_TASK_CODES)[number];
export type LoyaltySummaryP2Fields = z.infer<typeof loyaltySummaryP2Fields>;
export type BonusLot = LoyaltySummaryP2Fields["bonusLots"][number];
export type PointsMultipliers = z.infer<typeof pointsMultipliers>;
export type LedgerEntryP2Fields = z.infer<typeof ledgerEntryP2Fields>;
export type ReorderSuggestionP2Fields = z.infer<typeof reorderSuggestionP2Fields>;
export type CheckoutPointsP2Fields = z.infer<typeof checkoutPointsP2Fields>;
export type LoyaltyCampaign = z.infer<typeof loyaltyCampaign>;
export type SurveyInstance = z.infer<typeof surveyInstance>;
export type SurveyQuestion = z.infer<typeof surveyQuestion>;
export type SurveyAnswers = z.infer<typeof surveyAnswers>;
export type DataRefresh = z.infer<typeof dataRefresh>;
export type ShowcaseConsent = z.infer<typeof showcaseConsent>;
export type ShowcaseScope = (typeof SHOWCASE_SCOPES)[number];
