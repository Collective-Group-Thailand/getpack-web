/**
 * Marketing requests packio-api still has to build (triage `admin.promotions`, `admin.coupons`,
 * verdict `implement`, U-B0.2). Campaigns, promotions and coupon codes themselves are published
 * (`admin.campaigns.*`, `admin.promotions.*`) and called through the contract (U-F0.3).
 *
 * - Reordering promotions in one call: today priority is settable only per promotion.
 * - The coupon batches of a promotion: `admin.promotions.generateCoupons` answers only
 *   `{ batchId, count }`, and nothing lists the batches.
 */

import { z } from "zod";

import { dateTime, request, userRef, uuid } from "./define";

export const promotionKind = z.enum(["coupon", "automatic", "referral"]).meta({ id: "PromotionKind" });
export const couponKind = z.enum(["single", "bulk_unique", "per_customer"]).meta({ id: "CouponKind" });

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

export const adminMarketingRequests = {
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
} as const;
