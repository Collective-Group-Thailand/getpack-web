import { defineStatusMap } from "./types";
import type { CampaignStatus, CouponStatus, PromotionStatus, ReferralStatus } from "./contract";

/** A campaign with a THB budget; auto-stops when exhausted (D-154). */
export const CAMPAIGN_STATUS = defineStatusMap<CampaignStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "campaign.draft" },
  scheduled: { tone: "info", icon: "calendar", labelKey: "campaign.scheduled" },
  active: { tone: "success", icon: "play", labelKey: "campaign.active" },
  paused: { tone: "warning", icon: "pause", labelKey: "campaign.paused" },
  exhausted: { tone: "danger", icon: "coins", labelKey: "campaign.exhausted" },
  ended: { tone: "neutral", icon: "archive", labelKey: "campaign.ended" },
});

/** A coupon, automatic or referral promotion (D-053). */
export const PROMOTION_STATUS = defineStatusMap<PromotionStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "promotion.draft" },
  active: { tone: "success", icon: "play", labelKey: "promotion.active" },
  paused: { tone: "warning", icon: "pause", labelKey: "promotion.paused" },
  ended: { tone: "neutral", icon: "archive", labelKey: "promotion.ended" },
});

/** One coupon code (D-053). */
export const COUPON_STATUS = defineStatusMap<CouponStatus>({
  active: { tone: "success", icon: "ticket", labelKey: "coupon.active" },
  used_up: { tone: "neutral", icon: "check", labelKey: "coupon.usedUp" },
  disabled: { tone: "neutral", icon: "ban", labelKey: "coupon.disabled" },
});

/** One referral, rewarded only after the referee's first order passes the claim window (D-136). */
export const REFERRAL_STATUS = defineStatusMap<ReferralStatus>({
  pending: { tone: "neutral", icon: "clock", labelKey: "referral.pending" },
  qualified: { tone: "info", icon: "check", labelKey: "referral.qualified" },
  rewarded: { tone: "success", icon: "gift", labelKey: "referral.rewarded" },
  rejected_fraud: { tone: "danger", icon: "shield-alert", labelKey: "referral.rejectedFraud" },
  under_review: { tone: "warning", icon: "eye", labelKey: "referral.underReview" },
});
