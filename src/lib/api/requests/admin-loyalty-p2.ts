/**
 * Points & Deals P2: the back office — loyalty analytics, campaigns, audience estimate, agent performance, surveys
 * and showcase consents.
 *
 * CONTRACT: API-CHANGES-P2 (Admin). New operations are request definitions until the release is adopted. Published
 * operations that gain fields — `admin.promotions.create|update|get` (conditions v2, display v2),
 * `admin.promotions.report` (`refAgents[]` performance) and `admin.financialReports.profitAndLoss` (`pointsLiability`)
 * — are the `…P2` schemas here, merged at one call site and read back with `safeParse`.
 * CONTRACT-REQUEST admin.loyalty.p2-fields.
 */

import { z } from "zod";

import { date, dateTime, money, pct, request, uuid } from "./define";

const month = () => z.string().regex(/^\d{4}-\d{2}$/);
/** A percentage the API may withhold (k-anonymity: fewer than 10 customers). */
const ratePct = () => pct().nullable();

/* ------------------------------------------------------------------ additions to published shapes */

export const LOYALTY_TIERS = ["member", "silver", "gold"] as const;
export const BUSINESS_TYPES = [
  "food",
  "beverage",
  "cosmetics",
  "apparel",
  "electronics",
  "ecommerce",
  "industrial",
  "other",
] as const;

export const promotionAudience = z
  .object({
    newCustomer: z.boolean().optional(),
    tiers: z.array(z.string()).optional(),
    businessTypes: z.array(z.enum(BUSINESS_TYPES)).optional(),
    inactiveDaysGte: z.number().int().min(1).optional(),
    orderedProductTypeCodes: z.array(z.string()).optional(),
  })
  .meta({ id: "PromotionAudienceDto" });

/** What conditions v2 adds to `PromotionConditionsDto` (`conditionsSchemaVersion: 2`). */
export const conditionsV2Fields = z
  .object({
    audience: promotionAudience.optional(),
    cartProductTypeCountGte: z.number().int().min(2).max(10).optional(),
  })
  .meta({ id: "PromotionConditionsV2Fields" });

export const bundlePresetItem = z
  .object({
    productTypeCode: z.string(),
    /** Validated by the product type's specification schema (as `store.quotes.calculate`). */
    configuration: z.record(z.string(), z.unknown()),
    quantity: z.number().int().min(1),
  })
  .meta({ id: "PromotionBundleItemDto" });

/** What display v2 adds (`displaySchemaVersion: 2`). */
export const displayV2Fields = z
  .object({
    listing: z.enum(["everyone", "matching_only"]).meta({ id: "PromotionListing" }).optional(),
    bundle: z
      .object({ items: z.array(bundlePresetItem).min(2).max(4) })
      .nullable()
      .optional(),
  })
  .meta({ id: "PromotionDisplayV2Fields" });

/** `PromotionDto` from P2 on. */
export const promotionP2Fields = z
  .object({
    conditionsSchemaVersion: z.number().int().optional(),
    conditions: conditionsV2Fields.loose().optional(),
    display: displayV2Fields.loose().nullable().optional(),
  })
  .meta({ id: "PromotionP2Fields" });

/** `admin.promotions.report` `refAgents[]` items from P2 on. */
export const refAgentP2Fields = z
  .object({
    signups: z.number().int(),
    customers: z.number().int(),
    orderGroups: z.number().int(),
    grossAmount: money(),
    discountAmount: money(),
    redemptions: z.number().int(),
  })
  .meta({ id: "RefAgentPerformanceFields" });

/** `admin.financialReports.profitAndLoss` from P2 on: a memo block that never changes `lines` or `totals`. */
export const pointsLiabilityMemo = z
  .object({
    asOf: date(),
    outstandingPoints: z.number().int(),
    faceValue: money(),
    expectedRedemptionRatePct: z.string(),
    rateConfirmation: z.string(),
    estimatedLiability: money(),
    ledgerBalance2330: money(),
    pointsExpenseInPeriod: money(),
    source: z.string(),
  })
  .meta({ id: "PointsLiabilityMemoDto" });

/* ------------------------------------------------------------------------------- new operations */

export const EARN_SOURCES = ["order", "activity", "referral", "bonus"] as const;
export const PROGRAMMES = ["reorder_reminder", "winback", "quote_recovery", "survey"] as const;

export const loyaltyAnalytics = z
  .object({
    from: month(),
    to: month(),
    asOf: dateTime(),
    liability: z.object({
      outstandingPoints: z.number().int(),
      faceValue: money(),
      expectedRedemptionRatePct: z.string(),
      rateConfirmation: z.string(),
      rateSettingVersionId: z.string(),
      estimatedLiability: money(),
      ledgerBalance2330: money(),
      difference: money(),
    }),
    movement: z.array(
      z.object({
        month: month(),
        openingPoints: z.number().int(),
        earned: z.object({
          order: z.number().int(),
          activity: z.number().int(),
          referral: z.number().int(),
          bonus: z.number().int(),
        }),
        redeemed: z.number().int(),
        returned: z.number().int(),
        reversed: z.number().int(),
        expired: z.number().int(),
        adjusted: z.number().int(),
        closingPoints: z.number().int(),
      }),
    ),
    breakage: z.object({
      windowMonths: z.number().int(),
      issuedPoints: z.number().int(),
      expiredPoints: z.number().int(),
      actualPct: ratePct(),
      assumedPct: pct(),
      monthsOfData: z.number().int(),
      reliable: z.boolean(),
    }),
    earnVsRedeem: z.object({
      bySource: z.array(z.object({ source: z.enum(EARN_SOURCES), earned: z.number().int() })),
      byTier: z.array(
        z.object({
          tier: z.string(),
          members: z.number().int(),
          earned: z.number().int(),
          redeemed: z.number().int(),
          redemptionPct: ratePct(),
        }),
      ),
    }),
    retention: z.object({
      repeatOrderRate: z.object({
        windowDays: z.number().int(),
        redeemersPct: ratePct(),
        nonRedeemersPct: ratePct(),
        redeemers: z.number().int(),
        nonRedeemers: z.number().int(),
      }),
      programmes: z.array(
        z.object({
          programme: z.enum(PROGRAMMES),
          sent: z.number().int(),
          converted: z.number().int().nullable(),
          ratePct: ratePct(),
          windowDays: z.number().int(),
        }),
      ),
    }),
    currency: z.literal("THB"),
  })
  .meta({ id: "LoyaltyAnalyticsDto" });

export const agentPerformanceRow = z
  .object({
    agentCode: z.string(),
    agentName: z.string().nullable(),
    promotionId: uuid(),
    promotionName: z.string(),
    visitors: z.number().int(),
    visits: z.number().int(),
  })
  .extend(refAgentP2Fields.shape)
  .meta({ id: "AgentPromotionPerformanceDto" });

export const adminLoyaltyCampaign = z
  .object({
    id: uuid(),
    kind: z.enum(["reorder_bonus", "winback", "admin"]),
    status: z.enum(["active", "ended", "cancelled"]),
    multiplier: z.string(),
    customer: z.object({ id: uuid(), displayName: z.string() }).nullable(),
    productTypeCode: z.string().nullable(),
    startsAt: dateTime(),
    endsAt: dateTime(),
    convertedOrderCode: z.string().nullable(),
    reason: z.string(),
  })
  .meta({ id: "AdminLoyaltyCampaignDto" });

const localized = z.object({ th: z.string(), en: z.string() });

export const surveyTemplateQuestion = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    kind: z.enum(["rating", "single", "multi", "text"]),
    label: localized,
    required: z.boolean(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    options: z.array(z.object({ key: z.string(), label: localized })).optional(),
    maxLength: z.number().int().optional(),
  })
  .meta({ id: "SurveyTemplateQuestionDto" });

export const surveyTemplateInput = z
  .object({
    code: z.string().regex(/^[a-z0-9_]+$/),
    trigger: z.enum(["post_delivery", "quarterly"]),
    rewardEnabled: z.boolean(),
    title: localized,
    questions: z.array(surveyTemplateQuestion).min(3).max(5),
  })
  .meta({ id: "SurveyTemplateInputDto" });

export const surveyTemplate = surveyTemplateInput
  .extend({
    id: uuid(),
    version: z.number().int(),
    status: z.enum(["draft", "published", "retired"]),
    responseRatePct: ratePct(),
    responses: z.number().int(),
    updatedAt: dateTime(),
  })
  .meta({ id: "SurveyTemplateDto" });

export const surveyResults = z
  .object({
    templateId: uuid(),
    completed: z.number().int(),
    opened: z.number().int(),
    completionPct: ratePct(),
    /** Fewer than 10 responses: counts only (averages and free text withheld). */
    countsOnly: z.boolean(),
    questions: z.array(
      z.object({
        key: z.string(),
        kind: z.enum(["rating", "single", "multi", "text"]),
        label: z.string(),
        answered: z.number().int(),
        average: z.string().nullable().optional(),
        options: z.array(z.object({ key: z.string(), label: z.string(), count: z.number().int() })).optional(),
        texts: z
          .array(z.object({ customer: z.string(), orderCode: z.string().nullable(), text: z.string() }))
          .optional(),
      }),
    ),
  })
  .meta({ id: "SurveyResultsDto" });

export const showcaseConsentRow = z
  .object({
    id: uuid(),
    customer: z.object({ id: uuid(), displayName: z.string() }),
    companyName: z.string().nullable(),
    scope: z.array(z.string()),
    status: z.enum(["approved", "withdrawn"]),
    consentTextVersion: z.string(),
    decidedAt: dateTime().nullable(),
    withdrawnAt: dateTime().nullable(),
  })
  .meta({ id: "ShowcaseConsentRowDto" });

const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({ page: z.number().int(), perPage: z.number().int(), total: z.number().int() }),
  });

export const adminLoyaltyP2Requests = {
  "GET /v1/admin/loyalty/analytics": request({
    request: "admin.loyalty.analytics",
    summary:
      "Points liability at the D-480 rate, monthly movement, breakage, earn vs redeem and retention (≤ 24 months)",
    decisions: ["D-480", "D-488", "D-495"],
    query: z.object({ from: month(), to: month() }),
    response: loyaltyAnalytics,
  }),
  "GET /v1/admin/loyalty/campaigns": request({
    request: "admin.loyalty.campaigns",
    summary: "Points campaigns (reorder bonus) with their customer, window and conversion — read-only in P2",
    decisions: ["D-492"],
    query: z.object({
      status: z.enum(["active", "ended", "cancelled"]).optional(),
      kind: z.enum(["reorder_bonus", "winback", "admin"]).optional(),
      customerId: uuid().optional(),
      page: z.coerce.number().int().min(1).optional(),
      perPage: z.coerce.number().int().min(1).max(100).optional(),
    }),
    response: pageOf(adminLoyaltyCampaign),
  }),
  "GET /v1/admin/promotions/{promotionId}/audience-estimate": request({
    request: "admin.promotions.audience",
    summary: "How many customers an (unsaved) audience matches, rounded; null under 10",
    decisions: ["D-494"],
    query: z.object({ audience: z.string().optional() }),
    response: z.object({ customers: z.number().int().nullable(), rounded: z.boolean() }),
  }),
  "GET /v1/admin/promotions/agent-performance": request({
    request: "admin.promotions.agent-performance",
    summary: "Per agent × deal: visitors, sign-ups, customers, order groups, gross, discount, redemptions",
    decisions: ["D-495"],
    query: z.object({
      from: date().optional(),
      to: date().optional(),
      agentCode: z.string().optional(),
      promotionId: uuid().optional(),
      page: z.coerce.number().int().min(1).optional(),
      perPage: z.coerce.number().int().min(1).max(100).optional(),
    }),
    response: pageOf(agentPerformanceRow),
  }),
  "GET /v1/admin/surveys/templates": request({
    request: "admin.surveys",
    summary: "Survey templates with trigger, version, status and response rate",
    decisions: ["D-491"],
    response: z.object({ items: z.array(surveyTemplate) }),
  }),
  "POST /v1/admin/surveys/templates": request({
    request: "admin.surveys",
    summary: "Create a draft template (3–5 questions)",
    decisions: ["D-491"],
    status: 201,
    body: surveyTemplateInput,
    response: surveyTemplate,
  }),
  "GET /v1/admin/surveys/templates/{templateId}": request({
    request: "admin.surveys",
    summary: "One template",
    response: surveyTemplate,
  }),
  "PATCH /v1/admin/surveys/templates/{templateId}": request({
    request: "admin.surveys",
    summary: "Edit a draft (If-Match); 409 surveys.template_published",
    concurrency: true,
    body: surveyTemplateInput.partial(),
    response: surveyTemplate,
  }),
  "POST /v1/admin/surveys/templates/{templateId}/actions/{action}": request({
    request: "admin.surveys",
    summary: "publish | retire | new-version; 409 surveys.trigger_taken",
    response: surveyTemplate,
  }),
  "GET /v1/admin/surveys/templates/{templateId}/results": request({
    request: "admin.surveys",
    summary: "Counts per option, rating averages, completion and masked free text (counts only under 10 responses)",
    response: surveyResults,
  }),
  "GET /v1/admin/showcase-consents": request({
    request: "admin.showcase-consents",
    summary: "Approved or withdrawn showcase consents with their scope; a withdrawn one is flagged ห้ามใช้",
    decisions: ["D-490"],
    query: z.object({ page: z.coerce.number().int().min(1).optional() }),
    response: pageOf(showcaseConsentRow),
  }),
} as const;

export type PromotionAudience = z.infer<typeof promotionAudience>;
export type ConditionsV2Fields = z.infer<typeof conditionsV2Fields>;
export type DisplayV2Fields = z.infer<typeof displayV2Fields>;
export type BundlePresetItem = z.infer<typeof bundlePresetItem>;
export type PromotionP2Fields = z.infer<typeof promotionP2Fields>;
export type RefAgentP2Fields = z.infer<typeof refAgentP2Fields>;
export type PointsLiabilityMemo = z.infer<typeof pointsLiabilityMemo>;
export type LoyaltyAnalytics = z.infer<typeof loyaltyAnalytics>;
export type AgentPerformanceRow = z.infer<typeof agentPerformanceRow>;
export type SurveyTemplate = z.infer<typeof surveyTemplate>;
export type SurveyTemplateInput = z.infer<typeof surveyTemplateInput>;
export type SurveyResults = z.infer<typeof surveyResults>;
