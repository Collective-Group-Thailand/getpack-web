/**
 * Points & Deals P3: the reward catalogue, tier perks, admin campaigns, credit uplift and capacity-deal shapes, from
 * the generated contract (getpack-api `feat/loyalty-p3-catalogue-tiers`, pinned in `contract.lock.json`).
 *
 * Points are integers, money a decimal string, multipliers the API's decimal strings: the web formats them and never
 * computes one — the confirm sheet's balance after a redeem is `store.rewards.preview`'s `balanceAfter`.
 */

import type { Schemas } from "@/lib/api/types";

/* ---------------------------------------------------------------------------------------------- store */

export type LoyaltyTierP3 = Schemas["LoyaltyTier"];
export type RewardKind = Schemas["RewardItemKind"];
export type RewardBlockedReason = Schemas["RewardBlockedReason"];
export type RewardItem = Schemas["RewardItemDto"];
export type RewardList = Schemas["RewardListDto"];
export type RewardPreview = Schemas["RewardPreviewDto"];
export type RewardRedemption = Schemas["RewardRedemptionDto"];
export type RedemptionStatus = Schemas["RewardRedemptionStatus"];
export type LoyaltyPerk = Schemas["LoyaltyPerkDto"];
export type PerkCode = Schemas["LoyaltyPerkCode"];
export type ActiveMultiplier = Schemas["ActiveMultiplierDto"];
/** `store.loyalty.get` (P3 adds Platinum, perks, next tier's perk codes, active multipliers, open reward coupons). */
export type LoyaltySummaryP3 = Schemas["LoyaltySummaryDto"];

export const REWARD_KINDS = [
  "cash_off",
  "free_shipping",
  "free_sample",
  "free_rush",
  "free_addon",
  "revision_round",
] as const satisfies readonly RewardKind[];
export const LOYALTY_TIERS_P3 = ["member", "silver", "gold", "platinum"] as const satisfies readonly LoyaltyTierP3[];

/* ---------------------------------------------------------------------------------------------- admin */

export type RewardCatalogItem = Schemas["AdminRewardItemDto"];
export type RewardCatalogInput = Schemas["CreateRewardItemDto"];
export type RewardItemStatus = Schemas["RewardItemStatus"];
export type RewardConstraints = Schemas["RewardConstraintsDto"];
export type AdminRedemption = Schemas["AdminRedemptionDto"];
export type PromotionOrigin = Schemas["PromotionOrigin"];
export type CapacityDealRef = Schemas["PromotionCapacityDealDto"];
/** `admin.capacityDeals.list` rows (paginated `{ data, meta }`, API-CHANGES-P3 deviation 5). */
export type CapacityDealRow = Schemas["CapacityDealDto"];
export type AdminLoyaltyCampaign = Schemas["AdminLoyaltyCampaignDto"];
export type AdminLoyaltyCampaignRule = AdminLoyaltyCampaign;
export type LoyaltyCampaignInput = Schemas["CreateLoyaltyCampaignDto"];
export type CampaignAudience = Schemas["PromotionAudienceDto"];
export type CreditUplift = Schemas["CreditUpliftStateDto"];
export type CreditUpliftMode = Schemas["CreditUpliftMode"];
export type CreditOrigin = Schemas["CreditLimitOrigin"];
/** `admin.creditUplifts.list` rows. */
export type CreditUpliftRow = Schemas["CreditUpliftDto"];

/** The kinds benefit schema v2 adds (D-497). A v1 promotion saved with one → 422 `version_required`. */
export const BENEFIT_V2_KINDS = ["free_sample", "free_rush", "free_addon", "revision_round"] as const;
export type BenefitV2Kind = (typeof BENEFIT_V2_KINDS)[number];

/**
 * A v2 benefit as the editor and the reward-item form send it (`benefitSchemaVersion: 2`). The published
 * `PromotionBenefitDto` lists `maxAmount` / `rounds` but not `daysSaved` / `addonCode`; the API accepts both
 * (API-CHANGES-P3 "Benefit schema v2"), so the body is this union and the read of those two fields is
 * {@link benefitV2FieldsOf}.
 */
export type BenefitV2 =
  | { type: "free_shipping"; maxAmount?: string }
  | { type: "free_sample"; maxAmount?: string }
  | { type: "free_rush"; daysSaved: number }
  | { type: "free_addon"; addonCode: string; maxAmount?: string }
  | { type: "revision_round"; rounds: number }
  | { type: "fixed"; amount: string };

/** A benefit's v2 fields the published `PromotionBenefitDto` does not declare (`daysSaved`, `addonCode`). */
export function benefitV2FieldsOf(benefit: object): { daysSaved: number | null; addonCode: string | null } {
  const raw = benefit as Record<string, unknown>;
  return {
    daysSaved: typeof raw.daysSaved === "number" && Number.isInteger(raw.daysSaved) ? raw.daysSaved : null,
    addonCode: typeof raw.addonCode === "string" ? raw.addonCode : null,
  };
}
