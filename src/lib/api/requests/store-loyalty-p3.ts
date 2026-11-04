/**
 * Points & Deals P3 (loyalty earn expansion): the reward catalogue, tier perks and the "แลกด้วยแต้ม" tab — the store side.
 *
 * CONTRACT: API-CHANGES-P3 — `docs/design/loyalty-earn-expansion/API-CHANGES-P3.md` is the contract getpack-api builds
 * on `feat/loyalty-p3-catalogue-tiers`. Until that release is adopted (`pnpm gen:api --adopt`), the new operations
 * below are request definitions; `registry.test.ts` then names them for deletion.
 *
 * `store.loyalty.get` is published and gains fields in P3 (Platinum, perks, active multipliers, open reward coupons);
 * a published path cannot be a request definition, so those are the `loyaltySummaryP3Fields` schema here, read from
 * the published response once (`features/shared/loyalty-p3/read.ts`) — a response without them reads as "nothing
 * new". CONTRACT-REQUEST store.loyalty.p3-fields.
 *
 * Points are integers, money a decimal string; the web never computes either (the confirm sheet's "คงเหลือ" is the
 * one exception, recorded in WEB-P3-NOTES §3: a preview of two integers the API sent, replaced by `balanceAfter`).
 */

import { z } from "zod";

import { dateTime, page, request, uuid } from "./define";

/* ------------------------------------------------------------------------------------ vocabularies */

/** `LoyaltyTier` from P3 on: Platinum is added (D-478). */
export const LOYALTY_TIERS_P3 = ["member", "silver", "gold", "platinum"] as const;
export const REWARD_KINDS = [
  "cash_off",
  "free_shipping",
  "free_sample",
  "free_rush",
  "free_addon",
  "revision_round",
] as const;
export const REWARD_BLOCKED_REASONS = ["insufficient_points", "tier", "frequency", "open_limit", "held"] as const;
export const REDEMPTION_STATUSES = ["issued", "used", "cancelled", "expired"] as const;
export const REDEMPTION_SOURCES = ["catalogue", "tier_perk"] as const;
export const PERK_CODES = [
  "quarterly_free_shipping",
  "free_shipping_every_order",
  "priority_support",
  "quarterly_free_rush",
  "priority_production_slot",
] as const;
export const PERK_STATUSES = ["active", "granted", "used", "next_quarter"] as const;
export const MULTIPLIER_SOURCES = ["tier", "anniversary", "campaign", "reorder", "payment"] as const;

const tierP3 = () => z.enum(LOYALTY_TIERS_P3).meta({ id: "LoyaltyTierP3" });
const quarter = () => z.string().regex(/^\d{4}-Q[1-4]$/);

/* ------------------------------------------------------------------ additions to published shapes */

export const loyaltyPerk = z
  .object({
    code: z.enum(PERK_CODES).meta({ id: "LoyaltyPerkCode" }),
    status: z.enum(PERK_STATUSES).meta({ id: "LoyaltyPerkStatus" }),
    /** For a quarterly perk: the quarter it was granted for. */
    period: quarter().optional(),
    redemptionId: uuid().optional(),
    couponExpiresAt: dateTime().optional(),
  })
  .meta({ id: "LoyaltyPerkDto" });

export const activeMultiplier = z
  .object({
    source: z.enum(MULTIPLIER_SOURCES).meta({ id: "ActiveMultiplierSource" }),
    /** A decimal string, the API's own ("2.00"). Informational: the web never multiplies. */
    multiplier: z.string(),
    /** A campaign's name in the request locale. */
    name: z.string().optional(),
    /** Anniversary: the last calendar day of the month. */
    endsOn: z.string().optional(),
    endsAt: dateTime().optional(),
  })
  .meta({ id: "ActiveMultiplierDto" });

/** `store.loyalty.get` from P3 on. `tier` / `nextTier` may also be `platinum`. */
export const loyaltySummaryP3Fields = z
  .object({
    perks: z.array(loyaltyPerk),
    nextTierPerks: z.array(loyaltyPerk),
    activeMultipliers: z.array(activeMultiplier),
    maxCombinedMultiplier: z.string(),
    anniversaryMonth: z.number().int().min(1).max(12).nullable(),
    rewardCoupons: z.number().int().min(0),
  })
  .meta({ id: "LoyaltySummaryP3Fields" });

/* ------------------------------------------------------------------------------- new operations */

export const rewardItem = z
  .object({
    id: uuid(),
    code: z.string(),
    kind: z.enum(REWARD_KINDS).meta({ id: "RewardItemKind" }),
    /** Texts in the request locale. */
    name: z.string(),
    description: z.string().nullable(),
    costPoints: z.number().int().min(1),
    /** The benefit in words ("ส่งฟรี", "ลด ฿50") — the coupon's own stub text. */
    valueText: z.string(),
    /** Each a short line, display-ready ("ขั้นต่ำ ฿2,000", "1 ครั้งต่อ 3 เดือน", "ตามคิวการผลิต"). */
    conditions: z.array(z.string()),
    tierRequired: tierP3().nullable(),
    validityDays: z.number().int().min(7).max(365),
    /** Null for an anonymous caller. */
    canRedeem: z.boolean().nullable(),
    blockedReason: z.enum(REWARD_BLOCKED_REASONS).meta({ id: "RewardBlockedReason" }).nullable(),
    /** With `insufficient_points`. */
    missingPoints: z.number().int().min(0),
    /** With `frequency`. */
    nextAvailableAt: dateTime().nullable(),
  })
  .meta({ id: "RewardItemDto" });

export const rewardList = z
  .object({
    /** Null for an anonymous caller. */
    balance: z.number().int().min(0).nullable(),
    items: z.array(rewardItem),
  })
  .meta({ id: "RewardListDto" });

export const rewardRedemption = z
  .object({
    id: uuid(),
    item: z.object({
      code: z.string(),
      name: z.string(),
      kind: z.enum(REWARD_KINDS),
      valueText: z.string().optional(),
    }),
    source: z.enum(REDEMPTION_SOURCES).meta({ id: "RewardRedemptionSource" }),
    /** 0 for a tier perk. */
    pointsSpent: z.number().int().min(0),
    /** Only on the redeem answer. */
    balanceAfter: z.number().int().min(0).optional(),
    status: z.enum(REDEMPTION_STATUSES).meta({ id: "RewardRedemptionStatus" }),
    coupon: z.object({ code: z.string(), expiresAt: dateTime() }),
    /** Null for a tier perk; after it the redemption cannot be cancelled. */
    cancellableUntil: dateTime().nullable(),
    usedOrderCode: z.string().nullable(),
    /** A tier perk's quarter. */
    perkPeriod: quarter().nullable().optional(),
    createdAt: dateTime(),
  })
  .meta({ id: "RewardRedemptionDto" });

export const storeLoyaltyP3Requests = {
  "GET /v1/store/rewards": request({
    request: "store.rewards",
    summary:
      "The active reward catalogue with my balance and, per item, whether I can redeem it and why not — public (costs only for guests)",
    decisions: ["D-479", "D-498"],
    public: true,
    response: rewardList,
  }),
  "POST /v1/store/rewards/{itemId}/actions/redeem": request({
    request: "store.rewards",
    summary:
      "Spend the item's points (FIFO lots) and receive one single-use coupon valid validityDays; 409 rewards.cost_changed when expectedCostPoints differs",
    decisions: ["D-498"],
    idempotent: true,
    status: 201,
    body: z.object({ expectedCostPoints: z.number().int().min(1).optional() }),
    response: rewardRedemption,
  }),
  "GET /v1/store/rewards/redemptions": request({
    request: "store.rewards",
    summary: "My reward coupons (catalogue and tier perks), newest first",
    decisions: ["D-498", "D-500"],
    query: z.object({
      status: z.enum(REDEMPTION_STATUSES).optional(),
      page: z.coerce.number().int().min(1).optional(),
      perPage: z.coerce.number().int().min(1).max(100).optional(),
    }),
    response: page(rewardRedemption),
  }),
  "POST /v1/store/rewards/redemptions/{redemptionId}/actions/cancel": request({
    request: "store.rewards",
    summary:
      "Cancel an unused catalogue coupon within 7 days; the points return to their lots (expired lots are not revived)",
    decisions: ["D-498"],
    response: rewardRedemption,
  }),
} as const;

export type LoyaltyTierP3 = (typeof LOYALTY_TIERS_P3)[number];
export type RewardKind = (typeof REWARD_KINDS)[number];
export type RewardBlockedReason = (typeof REWARD_BLOCKED_REASONS)[number];
export type RewardItem = z.infer<typeof rewardItem>;
export type RewardList = z.infer<typeof rewardList>;
export type RewardRedemption = z.infer<typeof rewardRedemption>;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];
export type LoyaltyPerk = z.infer<typeof loyaltyPerk>;
export type PerkCode = (typeof PERK_CODES)[number];
export type ActiveMultiplier = z.infer<typeof activeMultiplier>;
export type LoyaltySummaryP3Fields = z.infer<typeof loyaltySummaryP3Fields>;
