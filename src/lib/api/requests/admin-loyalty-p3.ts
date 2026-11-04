/**
 * Points & Deals P3: the back office — reward catalogue, admin loyalty campaigns, benefit kinds v2, the credit-limit
 * tier uplift (Finance) and capacity-driven deals.
 *
 * CONTRACT: API-CHANGES-P3 (Admin). New operations are request definitions until the release is adopted. Published
 * operations that gain fields — `admin.promotions.create|update|get|list` (benefit v2, `origin`, `capacityDeal`),
 * `admin.loyaltyCampaigns.list` (`name`, `productTypeCodes`, `audience`, `createdBy`) and `admin.companyCredit.get`
 * (version `origin` …, `uplift`) — are the `…P3` schemas here, sent at one call site with a single cast and read
 * back once (`features/shared/loyalty-p3/read.ts`). CONTRACT-REQUEST admin.loyalty.p3-fields.
 *
 * Capacity is aggregated per product type: nothing here names, counts or identifies a factory (GLOBAL-RULES §1, D-481).
 */

import { z } from "zod";

import { dateTime, date, money, page, pct, request, userRef, uuid } from "./define";
import { LOYALTY_TIERS_P3, REDEMPTION_SOURCES, REDEMPTION_STATUSES, REWARD_KINDS } from "./store-loyalty-p3";

/* ---------------------------------------------------------------------------------- benefit v2 */

/** The kinds benefit schema v2 adds (D-497). A v1 promotion saved with one → 422 `version_required`. */
export const BENEFIT_V2_KINDS = ["free_sample", "free_rush", "free_addon", "revision_round"] as const;

/** A v2 benefit's own fields; v1 fields keep their published shape (`PromotionBenefitDto`). */
export const benefitV2 = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("free_shipping"), maxAmount: money().optional() }),
    z.object({ type: z.literal("free_sample"), maxAmount: money().optional() }),
    z.object({ type: z.literal("free_rush"), daysSaved: z.number().int().min(1).max(5) }),
    z.object({
      type: z.literal("free_addon"),
      addonCode: z.string().regex(/^[a-z0-9_]{2,40}$/),
      maxAmount: money().optional(),
    }),
    z.object({ type: z.literal("revision_round"), rounds: z.number().int().min(1).max(3) }),
    z.object({ type: z.literal("fixed"), amount: money() }),
  ])
  .meta({ id: "PromotionBenefitV2Dto" });

export const PROMOTION_ORIGINS = ["manual", "system", "capacity_deal"] as const;
export const APPROVAL_STATES = ["pending", "approved", "rejected", "withdrawn"] as const;

export const capacityDealRef = z
  .object({
    weekStart: date(),
    productTypeCode: z.string(),
    /** Free capacity of the product type next week, all sources together. */
    freePct: pct(),
    approval: z.object({ id: uuid(), status: z.enum(APPROVAL_STATES) }).nullable(),
  })
  .meta({ id: "PromotionCapacityDealDto" });

/** `PromotionDto` from P3 on. */
export const promotionP3Fields = z
  .object({
    benefitSchemaVersion: z.union([z.literal(1), z.literal(2)]),
    origin: z.enum(PROMOTION_ORIGINS).meta({ id: "PromotionOrigin" }),
    capacityDeal: capacityDealRef.nullable(),
  })
  .meta({ id: "PromotionP3Fields" });

/* ------------------------------------------------------------------------------ reward catalogue */

const localized = () => z.object({ th: z.string().min(1).max(120), en: z.string().min(1).max(120) });
const localizedText = () => z.object({ th: z.string().max(300), en: z.string().max(300) });
export const REWARD_ITEM_STATUSES = ["draft", "active", "paused", "archived"] as const;

export const rewardConstraints = z
  .object({
    minOrderValue: money().nullable(),
    productTypeCodes: z.array(z.string()).nullable(),
    perUserEveryMonths: z.number().int().min(1).max(24).nullable(),
  })
  .meta({ id: "RewardConstraintsDto" });

export const rewardCatalogInput = z
  .object({
    code: z.string().regex(/^[a-z0-9_]{3,40}$/),
    kind: z.enum(REWARD_KINDS),
    name: localized(),
    description: localizedText().nullable(),
    costPoints: z.number().int().min(1).max(100_000),
    /** A benefit v2 of the item's kind (`cash_off` → `{ type: "fixed", amount }`). */
    value: benefitV2,
    constraints: rewardConstraints,
    tierRequired: z.enum(LOYALTY_TIERS_P3).nullable(),
    validityDays: z.number().int().min(7).max(365),
    activeFrom: dateTime().nullable(),
    activeTo: dateTime().nullable(),
    sortOrder: z.number().int().min(0).max(9999),
  })
  .meta({ id: "RewardCatalogItemInput" });

export const rewardCatalogItem = rewardCatalogInput
  .extend({
    id: uuid(),
    status: z.enum(REWARD_ITEM_STATUSES).meta({ id: "RewardItemStatus" }),
    /** The hidden system promotion behind the item (`systemKey = reward.<code>`). */
    promotionId: uuid(),
    redemptions30d: z.number().int().min(0),
    openCoupons: z.number().int().min(0),
    updatedAt: dateTime(),
  })
  .meta({ id: "RewardCatalogItemDto" });

export const adminRedemption = z
  .object({
    id: uuid(),
    customer: z.object({ id: uuid(), displayName: z.string(), code: z.string() }),
    item: z.object({ code: z.string(), name: z.string(), kind: z.enum(REWARD_KINDS) }),
    source: z.enum(REDEMPTION_SOURCES),
    pointsSpent: z.number().int().min(0),
    status: z.enum(REDEMPTION_STATUSES),
    couponCode: z.string(),
    expiresAt: dateTime(),
    usedOrderCode: z.string().nullable(),
    cancelledAt: dateTime().nullable(),
    cancelReason: z.string().nullable(),
    createdAt: dateTime(),
  })
  .meta({ id: "AdminRewardRedemptionDto" });

/* ------------------------------------------------------------------------- admin loyalty campaigns */

export const campaignAudience = z
  .object({
    newCustomer: z.boolean().optional(),
    tiers: z.array(z.enum(LOYALTY_TIERS_P3)).optional(),
    businessTypes: z.array(z.string()).optional(),
    inactiveDaysGte: z.number().int().min(1).optional(),
    orderedProductTypeCodes: z.array(z.string()).optional(),
  })
  .meta({ id: "LoyaltyCampaignAudienceDto" });

export const loyaltyCampaignInput = z
  .object({
    name: z.string().min(3).max(120),
    kind: z.literal("admin_rule"),
    multiplier: z.string().regex(/^\d\.\d{2}$/),
    startsAt: dateTime(),
    endsAt: dateTime(),
    /** Null = every product type. */
    productTypeCodes: z.array(z.string()).nullable(),
    audience: campaignAudience,
    reason: z.string().regex(/^[a-z0-9_]{3,40}$/),
  })
  .meta({ id: "LoyaltyCampaignInput" });

export const LOYALTY_CAMPAIGN_KINDS_P3 = ["reorder_bonus", "winback", "admin", "admin_rule", "anniversary"] as const;

export const adminLoyaltyCampaign = loyaltyCampaignInput
  .extend({
    id: uuid(),
    status: z.enum(["scheduled", "active", "ended", "cancelled"]),
    createdBy: userRef().nullable(),
    cancelledAt: dateTime().nullable(),
  })
  .meta({ id: "AdminLoyaltyCampaignRuleDto" });

/** `admin.loyaltyCampaigns.list` items from P3 on. */
export const loyaltyCampaignListP3Fields = z
  .object({
    kind: z.enum(LOYALTY_CAMPAIGN_KINDS_P3),
    name: z.string().nullable(),
    productTypeCodes: z.array(z.string()).nullable(),
    audience: campaignAudience.nullable(),
    createdBy: userRef().nullable(),
  })
  .partial()
  .meta({ id: "AdminLoyaltyCampaignP3Fields" });

/* --------------------------------------------------------------------------- credit-limit uplift */

export const CREDIT_ORIGINS = ["request", "tier_uplift", "tier_uplift_override"] as const;
export const UPLIFT_MODES = ["auto", "frozen", "off"] as const;

/** `CreditLimitVersionDto` from P3 on. */
export const creditVersionP3Fields = z
  .object({
    origin: z.enum(CREDIT_ORIGINS).meta({ id: "CreditLimitOrigin" }),
    baseVersionId: uuid().nullable(),
    upliftFactor: z.string().nullable(),
    companyTier: z.enum(LOYALTY_TIERS_P3).nullable(),
  })
  .meta({ id: "CreditLimitVersionP3Fields" });

export const creditUplift = z
  .object({
    mode: z.enum(UPLIFT_MODES).meta({ id: "CreditUpliftMode" }),
    modeReason: z.string().nullable(),
    /** Null when the company has no approved permanent `request` version (not eligible). */
    baseLimit: money().nullable(),
    companyTier: z.enum(LOYALTY_TIERS_P3).nullable(),
    companySpend12m: money(),
    target: money().nullable(),
    capped: z.boolean(),
    aboveCapTarget: money().nullable(),
  })
  .meta({ id: "CreditUpliftDto" });

/** `AdminCompanyCreditDto` from P3 on. */
export const companyCreditP3Fields = z
  .object({ uplift: creditUplift.nullable() })
  .meta({ id: "AdminCompanyCreditP3Fields" });

export const creditUpliftRow = z
  .object({
    versionId: uuid(),
    company: z.object({ id: uuid(), legalName: z.string() }),
    companyTier: z.enum(LOYALTY_TIERS_P3),
    companySpend12m: money(),
    baseLimit: money(),
    factor: z.string(),
    target: money(),
    newLimit: money(),
    previousLimit: money(),
    capped: z.boolean(),
    aboveCapTarget: money().nullable(),
    effectiveFrom: dateTime(),
    mode: z.enum(UPLIFT_MODES),
    /** The Finance request for the full amount, once filed. */
    pendingRequest: z.object({ approvalId: uuid(), limitAmount: money() }).nullable(),
  })
  .meta({ id: "CreditUpliftRowDto" });

/* ----------------------------------------------------------------------------------- capacity deals */

export const capacityDealRow = z
  .object({
    promotionId: uuid(),
    productTypeCode: z.string(),
    productTypeName: z.string(),
    weekStart: date(),
    freePct: pct(),
    discountPct: z.string(),
    visibility: z.enum(["hidden", "unlisted", "public"]),
    status: z.enum(["draft", "active", "paused", "ended"]),
    approval: z.object({ id: uuid(), status: z.enum(APPROVAL_STATES) }).nullable(),
    createdAt: dateTime(),
  })
  .meta({ id: "CapacityDealDto" });

/* ------------------------------------------------------------------------------- new operations */

export const adminLoyaltyP3Requests = {
  "GET /v1/admin/loyalty/rewards": request({
    request: "admin.reward-catalog",
    summary: "The reward catalogue (every status) with redemptions in the last 30 days",
    decisions: ["D-479", "D-498"],
    query: z.object({ status: z.enum(REWARD_ITEM_STATUSES).optional() }),
    response: z.object({ items: z.array(rewardCatalogItem) }),
  }),
  "POST /v1/admin/loyalty/rewards": request({
    request: "admin.reward-catalog",
    summary:
      "Create a draft item and its hidden system promotion (reward.<code>); 422 cap_floor / kind_mismatch / unknown_addon, 409 rewards.code_taken",
    decisions: ["D-498"],
    status: 201,
    body: rewardCatalogInput,
    response: rewardCatalogItem,
  }),
  "GET /v1/admin/loyalty/rewards/{itemId}": request({
    request: "admin.reward-catalog",
    summary: "One item",
    response: rewardCatalogItem,
  }),
  "PATCH /v1/admin/loyalty/rewards/{itemId}": request({
    request: "admin.reward-catalog",
    summary: "Edit (If-Match); code and kind are refused while active (409 rewards.item_active)",
    decisions: ["D-498"],
    concurrency: true,
    body: rewardCatalogInput.partial(),
    response: rewardCatalogItem,
  }),
  "POST /v1/admin/loyalty/rewards/{itemId}/actions/{action}": request({
    request: "admin.reward-catalog",
    summary: "activate | pause | archive",
    response: rewardCatalogItem,
  }),
  "GET /v1/admin/loyalty/reward-redemptions": request({
    request: "admin.reward-redemptions",
    summary: "Redemptions (catalogue and tier perks) by item, status and customer — loyalty.read",
    decisions: ["D-498", "D-500"],
    query: z.object({
      itemCode: z.string().optional(),
      status: z.enum(REDEMPTION_STATUSES).optional(),
      q: z.string().optional(),
      page: z.coerce.number().int().min(1).optional(),
      perPage: z.coerce.number().int().min(1).max(100).optional(),
    }),
    response: page(adminRedemption),
  }),
  "POST /v1/admin/loyalty/reward-redemptions/{redemptionId}/actions/cancel": request({
    request: "admin.reward-redemptions",
    summary: "Cancel any unused catalogue redemption with a reason (≥ 10 chars), audited — loyalty.adjust",
    decisions: ["D-498"],
    body: z.object({ reason: z.string().min(10).max(500) }),
    response: adminRedemption,
  }),
  "POST /v1/admin/loyalty/campaigns": request({
    request: "admin.loyalty.campaign-rules",
    summary: "Create an admin_rule points campaign (window ≤ 92 days, ×1.01–5.00; the ×3.00 cap holds at earning)",
    decisions: ["D-499"],
    status: 201,
    body: loyaltyCampaignInput,
    response: adminLoyaltyCampaign,
  }),
  "GET /v1/admin/loyalty/campaigns/{campaignId}": request({
    request: "admin.loyalty.campaign-rules",
    summary: "One campaign",
    response: adminLoyaltyCampaign,
  }),
  "PATCH /v1/admin/loyalty/campaigns/{campaignId}": request({
    request: "admin.loyalty.campaign-rules",
    summary: "Edit before startsAt (If-Match); 409 loyalty.campaign_started",
    decisions: ["D-499"],
    concurrency: true,
    body: loyaltyCampaignInput.partial(),
    response: adminLoyaltyCampaign,
  }),
  "POST /v1/admin/loyalty/campaigns/{campaignId}/actions/cancel": request({
    request: "admin.loyalty.campaign-rules",
    summary: "Cancel a campaign (scheduled or running) with a reason",
    body: z.object({ reason: z.string().min(10).max(500) }),
    response: adminLoyaltyCampaign,
  }),
  "PUT /v1/admin/companies/{companyId}/credit/uplift": request({
    request: "admin.credit-uplift",
    summary:
      "Finance override of the tier uplift: auto | frozen | off (off writes a version back to the base now); reason ≥ 10 chars",
    decisions: ["D-485", "D-501"],
    body: z.object({ mode: z.enum(UPLIFT_MODES), reason: z.string().min(10).max(500) }),
    response: z.object({ uplift: creditUplift }),
  }),
  "GET /v1/admin/credit-uplifts": request({
    request: "admin.credit-uplift",
    summary: "Uplift versions written by b2b.credit_tier_uplift: base → new, capped, above-cap target, mode",
    decisions: ["D-501"],
    query: z.object({
      from: date().optional(),
      to: date().optional(),
      companyId: uuid().optional(),
      aboveCap: z.enum(["true", "false"]).optional(),
      page: z.coerce.number().int().min(1).optional(),
      perPage: z.coerce.number().int().min(1).max(100).optional(),
    }),
    response: z.object({ items: z.array(creditUpliftRow) }),
  }),
  "GET /v1/admin/promotions/capacity-deals": request({
    request: "admin.capacity-deals",
    summary: "Capacity-deal drafts per product type × week with their capacity_deal_publish approval; no factory data",
    decisions: ["D-502"],
    response: z.object({ items: z.array(capacityDealRow), provider: z.string() }),
  }),
} as const;

export type BenefitV2 = z.infer<typeof benefitV2>;
export type BenefitV2Kind = (typeof BENEFIT_V2_KINDS)[number];
export type PromotionP3Fields = z.infer<typeof promotionP3Fields>;
export type PromotionOrigin = (typeof PROMOTION_ORIGINS)[number];
export type CapacityDealRef = z.infer<typeof capacityDealRef>;
export type RewardCatalogItem = z.infer<typeof rewardCatalogItem>;
export type RewardCatalogInput = z.infer<typeof rewardCatalogInput>;
export type RewardItemStatus = (typeof REWARD_ITEM_STATUSES)[number];
export type RewardConstraints = z.infer<typeof rewardConstraints>;
export type AdminRedemption = z.infer<typeof adminRedemption>;
export type CampaignAudience = z.infer<typeof campaignAudience>;
export type LoyaltyCampaignInput = z.infer<typeof loyaltyCampaignInput>;
export type AdminLoyaltyCampaignRule = z.infer<typeof adminLoyaltyCampaign>;
export type LoyaltyCampaignListP3Fields = z.infer<typeof loyaltyCampaignListP3Fields>;
export type CreditVersionP3Fields = z.infer<typeof creditVersionP3Fields>;
export type CreditUplift = z.infer<typeof creditUplift>;
export type CreditUpliftMode = (typeof UPLIFT_MODES)[number];
export type CreditOrigin = (typeof CREDIT_ORIGINS)[number];
export type CreditUpliftRow = z.infer<typeof creditUpliftRow>;
export type CapacityDealRow = z.infer<typeof capacityDealRow>;
