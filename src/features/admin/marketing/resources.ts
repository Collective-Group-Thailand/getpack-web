/** The marketing lists and types, in a plain module so Server Components can prefetch. */

import type { z } from "zod";

import type { couponBatch } from "@/lib/api/requests/admin-marketing";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type Campaign = Schemas["CampaignDto"];
export type Promotion = Schemas["PromotionDto"];
export type PromotionReport = Schemas["PromotionReportDto"];
export type CouponCode = Schemas["CouponCodeDto"];
export type CouponBatch = z.output<typeof couponBatch>;
export type Referral = Schemas["AdminReferralDto"];

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "exhausted",
  "ended",
] as const satisfies readonly Schemas["CampaignStatus"][];
export const PROMOTION_KINDS = [
  "coupon",
  "automatic",
  "referral",
] as const satisfies readonly Schemas["PromotionKind"][];
export const REFERRAL_STATUSES = [
  "under_review",
  "pending",
  "qualified",
  "rewarded",
  "rejected_fraud",
] as const satisfies readonly Schemas["ReferralStatus"][];

export const campaignsList = defineList<Campaign>({
  key: "campaign",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/campaigns", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.code,
  defaults: { filterKeys: ["status"] },
});

export const promotionsList = defineList<Promotion>({
  key: "promotion",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/promotions", { params: { query: query as never } })).data!,
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
