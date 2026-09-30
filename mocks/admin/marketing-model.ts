/**
 * The shape the fake campaigns, promotions and coupon codes are kept in — a fixture model, not an
 * API type. The handlers turn a row into the contract's DTOs (`CampaignDto`, `PromotionDto`,
 * `CouponCodeDto`, `PromotionReportDto`) on the way out; the rows keep what the API computes
 * (usage, the owner, the batch of a code) because the mock has to compute it from something.
 */

import type { Schemas } from "@/lib/api/types";

export interface CampaignRow {
  id: string;
  code: string;
  name: string;
  status: Schemas["CampaignStatus"];
  startsAt: string;
  endsAt: string | null;
  budgetAmount: string | null;
  spentAmount: string;
  /** Stamped when spend first crosses the alert threshold (D-154). */
  alertedAt: string | null;
  goals: Record<string, unknown>;
  owner: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

/** What a promotion has been used for so far — the report's figures, per promotion. */
export interface PromotionUsage {
  redemptions: number;
  discountAmount: string;
  /** What the margin guard took back (D-053). */
  cappedAmount: string;
}

export interface PromotionRow {
  id: string;
  name: string;
  description: string | null;
  kind: Schemas["PromotionKind"];
  status: Schemas["PromotionStatus"];
  campaignId: string | null;
  priority: number;
  stacking: Schemas["StackingMode"];
  stackGroup: string | null;
  startsAt: string;
  endsAt: string | null;
  conditions: Schemas["PromotionConditionsDto"];
  benefit: Schemas["PromotionBenefitDto"];
  usageLimitTotal: number | null;
  usageLimitPerCustomer: number | null;
  budgetAmount: string | null;
  usage: PromotionUsage;
  updatedAt: string;
}

export interface CouponCodeRow {
  id: string;
  code: string;
  promotionId: string;
  batchId: string | null;
  assignedCustomerId: string | null;
  usageLimit: number | null;
  usedCount: number;
  status: Schemas["CouponStatus"];
}
