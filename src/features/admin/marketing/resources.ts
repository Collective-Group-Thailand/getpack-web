/** The marketing lists and types, in a plain module so Server Components can prefetch. */

import type { z } from "zod";

import type {
  campaignDetail,
  campaignSummary,
  couponBatch,
  couponCode,
  promotionDetail,
  promotionSummary,
} from "@/lib/api/requests/admin-marketing";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type CampaignSummary = z.output<typeof campaignSummary>;
export type Campaign = z.output<typeof campaignDetail>;
export type PromotionSummary = z.output<typeof promotionSummary>;
export type Promotion = z.output<typeof promotionDetail>;
export type CouponBatch = z.output<typeof couponBatch>;
export type CouponCode = z.output<typeof couponCode>;
export type Referral = Schemas["AdminReferralDto"];

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "active", "paused", "exhausted", "ended"] as const;
export const PROMOTION_KINDS = ["coupon", "automatic", "referral"] as const;
export const REFERRAL_STATUSES = [
  "under_review",
  "pending",
  "qualified",
  "rewarded",
  "rejected_fraud",
] as const satisfies readonly Schemas["ReferralStatus"][];

export const campaignsList = defineList<CampaignSummary>({
  key: "campaign",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/campaigns", { query: query as never }),
  getRowId: (row) => row.id,
  getRowName: (row) => row.code,
  defaults: { filterKeys: ["status"] },
});

export const promotionsList = defineList<PromotionSummary>({
  key: "promotion",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/promotions", { query: query as never }),
  getRowId: (row) => row.id,
  getRowName: (row) => row.name,
  defaults: { filterKeys: ["kind", "status", "campaignId"] },
});

export const referralsList = defineList<Referral>({
  key: "referral",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/referrals", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.code,
  // CONTRACT-GAP admin.referrals: no referrerId filter.
  defaults: { filterKeys: ["status"] },
  staleTime: STALE_TIME.live,
});
