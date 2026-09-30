/**
 * Marketing (F2 2.7): campaigns, promotions and their coupon codes, and the referral review
 * queue — packio-api B3.3, not published yet. Shaped by schema-design §3 "Promotions, campaigns,
 * referral" (`campaigns`, `promotions`, `coupon_batches`, `coupon_codes`,
 * `promotion_redemptions`, `referral_attributions`) and the D-053 engine note.
 *
 * The engine evaluates promotions on the API; these requests only configure them. Conditions
 * and the benefit are the D-053 lists as typed objects (schema version 1), so the editor never
 * writes free JSON. Budget alerts (D-154) and the referral rules (D-136) are settings the API
 * applies; the UI shows what the API reports.
 */

import { z } from "zod";

import { customerRef, salesChannel } from "./admin-orders";
import { dateTime, listQuery, money, page, pct, request, userRef, uuid } from "./define";

/* -------------------------------------------------------------------------------- campaigns */

export const campaignStatus = z
  .enum(["draft", "scheduled", "active", "paused", "exhausted", "ended"])
  .meta({ id: "CampaignStatus" });
export const campaignAction = z.enum(["activate", "pause", "resume", "end"]).meta({ id: "CampaignAction" });

/** What a campaign has earned so far: from redemptions on paid orders (D-053 reports). */
export const campaignPerformance = z.object({
  redemptionsCount: z.number().int(),
  ordersCount: z.number().int(),
  discountAmount: money(),
  revenueAmount: money(),
  newCustomersCount: z.number().int(),
});

export const campaignSummary = z
  .object({
    id: uuid(),
    code: z.string(),
    name: z.string(),
    status: campaignStatus,
    startsAt: dateTime(),
    endsAt: dateTime(),
    budgetAmount: money(),
    spentAmount: money(),
    /** spent ÷ budget × 100, from the API. */
    spentPct: pct(),
    /** The alert threshold in force for this campaign (setting `campaigns.budget_alert_pct`, D-154). */
    alertThresholdPct: pct(),
    /** When Marketing was alerted; `null` until the threshold is crossed. */
    alertedAt: dateTime().nullable(),
    owner: userRef(),
    promotionsCount: z.number().int(),
    createdAt: dateTime(),
  })
  .meta({ id: "CampaignSummaryDto" });

export const campaignDetail = campaignSummary
  .extend({
    goals: z.string().nullable(),
    performance: campaignPerformance,
    /** Actions the actor may take now (`entity.next-actions`). */
    allowedActions: z.array(campaignAction),
  })
  .meta({ id: "CampaignDetailDto" });

export const campaignBody = z
  .object({
    code: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/),
    name: z.string().min(1).max(200),
    startsAt: dateTime(),
    endsAt: dateTime(),
    budgetAmount: money(),
    goals: z.string().max(2000).nullable().optional(),
  })
  .meta({ id: "CreateCampaignDto" });

/* ------------------------------------------------------------------------------- promotions */

export const promotionKind = z.enum(["coupon", "automatic", "referral"]).meta({ id: "PromotionKind" });
export const promotionStatus = z.enum(["draft", "active", "paused", "ended"]).meta({ id: "PromotionStatus" });
export const stackingMode = z.enum(["exclusive", "stackable", "best_of"]).meta({ id: "StackingMode" });
export const promotionAction = z.enum(["activate", "pause", "resume", "end"]).meta({ id: "PromotionAction" });
export const customerSegment = z.enum(["new", "returning", "b2b_company"]).meta({ id: "CustomerSegment" });

/** D-053 conditions, schema version 1. An empty list means "any". */
export const promotionConditions = z
  .object({
    schemaVersion: z.literal(1),
    channels: z.array(salesChannel),
    segments: z.array(customerSegment),
    productTypeCodes: z.array(z.string()),
    minOrderValue: money().nullable(),
    minQuantity: z.number().int().positive().nullable(),
    firstOrderOnly: z.boolean(),
    paymentMethods: z.array(z.string()),
    provinceIds: z.array(uuid()),
  })
  .meta({ id: "PromotionConditionsDto" });

export const benefitType = z
  .enum([
    "percent",
    "fixed",
    "tiered_percent",
    "free_shipping",
    "free_design_rounds",
    "free_mockup",
    "points_multiplier",
    "bonus_points",
  ])
  .meta({ id: "BenefitType" });

/** D-053 benefits, schema version 1: the fields used depend on `type`. */
export const promotionBenefit = z
  .object({
    schemaVersion: z.literal(1),
    type: benefitType,
    pct: pct().nullable(),
    amount: money().nullable(),
    /** Cap of a percentage benefit. */
    maxAmount: money().nullable(),
    /** `tiered_percent`: from an order value, this percentage. */
    tiers: z.array(z.object({ minOrderValue: money(), pct: pct() })),
    rounds: z.number().int().positive().nullable(),
    multiplier: pct().nullable(),
    points: z.number().int().positive().nullable(),
  })
  .meta({ id: "PromotionBenefitDto" });

export const promotionUsage = z.object({
  redemptionsCount: z.number().int(),
  discountAmount: money(),
  /** What the margin guard took back (D-053): the API caps, never the UI. */
  cappedAmount: money(),
});

export const promotionSummary = z
  .object({
    id: uuid(),
    name: z.string(),
    kind: promotionKind,
    status: promotionStatus,
    campaign: z.object({ id: uuid(), code: z.string(), name: z.string() }).nullable(),
    priority: z.number().int(),
    stacking: stackingMode,
    startsAt: dateTime(),
    endsAt: dateTime().nullable(),
    /** One line the API writes from the benefit, e.g. "ลด 10 % สูงสุด ฿500". */
    benefitSummary: z.string(),
    usage: promotionUsage,
    updatedAt: dateTime(),
  })
  .meta({ id: "PromotionSummaryDto" });

export const promotionDetail = promotionSummary
  .extend({
    stackGroup: z.string().nullable(),
    conditions: promotionConditions,
    benefit: promotionBenefit,
    usageLimitTotal: z.number().int().positive().nullable(),
    usageLimitPerCustomer: z.number().int().positive().nullable(),
    budgetAmount: money().nullable(),
    allowedActions: z.array(promotionAction),
  })
  .meta({ id: "PromotionDetailDto" });

export const promotionBody = z
  .object({
    name: z.string().min(1).max(200),
    kind: promotionKind,
    campaignId: uuid().nullable(),
    stacking: stackingMode,
    stackGroup: z.string().max(60).nullable(),
    startsAt: dateTime(),
    endsAt: dateTime().nullable(),
    conditions: promotionConditions,
    benefit: promotionBenefit,
    usageLimitTotal: z.number().int().positive().nullable(),
    usageLimitPerCustomer: z.number().int().positive().nullable(),
    budgetAmount: money().nullable(),
  })
  .meta({ id: "CreatePromotionDto" });

/* ---------------------------------------------------------------------------------- coupons */

export const couponKind = z.enum(["single", "bulk_unique", "per_customer"]).meta({ id: "CouponKind" });
export const couponStatus = z.enum(["active", "used_up", "disabled"]).meta({ id: "CouponStatus" });

export const couponBatch = z
  .object({
    id: uuid(),
    promotionId: uuid(),
    kind: couponKind,
    count: z.number().int(),
    prefix: z.string().nullable(),
    usageLimitPerCode: z.number().int().positive().nullable(),
    generatedAt: dateTime(),
    generatedBy: userRef(),
  })
  .meta({ id: "CouponBatchDto" });

export const couponCode = z
  .object({
    id: uuid(),
    code: z.string(),
    batchId: uuid().nullable(),
    assignedCustomer: customerRef.nullable(),
    usageLimit: z.number().int().positive().nullable(),
    usedCount: z.number().int(),
    status: couponStatus,
  })
  .meta({ id: "CouponCodeDto" });

/* ----------------------------------------------------------------------------------- requests */

export const adminMarketingRequests = {
  "GET /v1/admin/campaigns": request({
    request: "admin.campaigns",
    summary: "Campaigns with budget used and the D-154 alert state",
    decisions: ["D-053", "D-154"],
    query: listQuery({ status: campaignStatus.optional() }),
    response: page(campaignSummary),
  }),
  "POST /v1/admin/campaigns": request({
    request: "admin.campaigns",
    summary: "Create a campaign (draft) with its THB budget",
    decisions: ["D-154"],
    body: campaignBody,
    response: campaignDetail,
    status: 201,
  }),
  "GET /v1/admin/campaigns/{campaignId}": request({
    request: "admin.campaigns",
    summary: "One campaign with its performance and allowed actions (ETag)",
    response: campaignDetail,
  }),
  "PATCH /v1/admin/campaigns/{campaignId}": request({
    request: "admin.campaigns",
    summary: "Edit a campaign's name, window, budget or goals",
    body: campaignBody.omit({ code: true }).partial(),
    response: campaignDetail,
    concurrency: true,
  }),
  "POST /v1/admin/campaigns/{campaignId}/actions/{action}": request({
    request: "admin.campaigns",
    summary: "Activate, pause, resume or end a campaign; ending stops its promotions",
    decisions: ["D-154"],
    body: z.object({ reason: z.string().min(3).max(500) }),
    response: campaignDetail,
    concurrency: true,
  }),
  "GET /v1/admin/promotions": request({
    request: "admin.promotions",
    summary: "Promotions of every kind, in priority order by default",
    decisions: ["D-053"],
    query: listQuery({
      kind: promotionKind.optional(),
      status: promotionStatus.optional(),
      campaignId: uuid().optional(),
    }),
    response: page(promotionSummary),
  }),
  "POST /v1/admin/promotions": request({
    request: "admin.promotions",
    summary: "Create a promotion (draft); coupon codes are generated afterwards",
    decisions: ["D-053"],
    body: promotionBody,
    response: promotionDetail,
    status: 201,
  }),
  "GET /v1/admin/promotions/{promotionId}": request({
    request: "admin.promotions",
    summary: "One promotion with its conditions, benefit, limits and usage (ETag)",
    response: promotionDetail,
  }),
  "PATCH /v1/admin/promotions/{promotionId}": request({
    request: "admin.promotions",
    summary: "Edit a promotion; the API refuses to change the benefit of one already redeemed",
    body: promotionBody.omit({ kind: true }).partial(),
    response: promotionDetail,
    concurrency: true,
  }),
  "POST /v1/admin/promotions/{promotionId}/actions/{action}": request({
    request: "admin.promotions",
    summary: "Activate, pause, resume or end a promotion",
    body: z.object({ reason: z.string().min(3).max(500) }),
    response: promotionDetail,
    concurrency: true,
  }),
  "PUT /v1/admin/promotions/priority": request({
    request: "admin.promotions",
    summary: "Reorder promotions: the first id gets the highest priority (A.2.5 priority)",
    decisions: ["D-053"],
    body: z.object({ promotionIds: z.array(uuid()).min(1) }),
    response: z.object({ updated: z.number().int() }),
  }),
  "GET /v1/admin/promotions/{promotionId}/coupon-batches": request({
    request: "admin.coupons",
    summary: "The coupon batches generated for a promotion",
    response: z.array(couponBatch),
  }),
  "POST /v1/admin/promotions/{promotionId}/coupon-batches": request({
    request: "admin.coupons",
    summary: "Generate one named code or a batch of unique codes (D-053)",
    decisions: ["D-053"],
    body: z.object({
      kind: z.enum(["single", "bulk_unique"]),
      /** `single`: the code customers type. */
      code: z
        .string()
        .regex(/^[A-Z0-9-]{4,30}$/)
        .optional(),
      /** `bulk_unique`: how many, and an optional prefix. */
      count: z.number().int().min(1).max(10000).optional(),
      prefix: z
        .string()
        .regex(/^[A-Z0-9]{0,10}$/)
        .optional(),
      usageLimitPerCode: z.number().int().positive().nullable().optional(),
    }),
    response: couponBatch,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/admin/promotions/{promotionId}/coupon-codes": request({
    request: "admin.coupons",
    summary: "A promotion's codes with their use",
    query: listQuery({ batchId: uuid().optional(), status: couponStatus.optional() }),
    response: page(couponCode),
  }),
  "POST /v1/admin/coupon-codes/{codeId}/actions/disable": request({
    request: "admin.coupons",
    summary: "Disable one code (leaked, misused); redemptions already made stay",
    body: z.object({ reason: z.string().min(3).max(500) }),
    response: couponCode,
  }),
} as const;
