/**
 * Points & Deals P4: factory co-funding of capacity deals — the partner portal (D-506).
 *
 * CONTRACT: API-CHANGES-P4 "Co-funding". The factory sees its own offers only: the deal (from the terms snapshot), the
 * terms, its accrued share and the orders counted by order and job code — never a customer, another factory, another
 * offer, the free-capacity figure or getpack's margin. Statement lines and account entries of kind `cofunding` are fields
 * on published reads (`partner.payables.*`), read in `features/shared/loyalty-p4/read.ts`.
 */

import { z } from "zod";

import { date, dateTime, money, page, pct, request, uuid } from "./define";

export const COFUNDING_SHARE_MODES = ["pct_of_discount", "fixed_per_order"] as const;
export const COFUNDING_OFFER_STATUSES = ["proposed", "accepted", "declined", "withdrawn", "expired", "ended"] as const;
export const COFUNDING_CONTRIBUTION_STATUSES = ["accrued", "netted", "reversed", "refunded"] as const;
export const COFUNDING_REVERSE_REASONS = [
  "order_cancelled",
  "order_refunded",
  "job_reassigned",
  "job_rejected",
  "offer_withdrawn_before_job",
] as const;
export const COFUNDING_PARTNER_ACTIONS = ["accept", "decline"] as const;

const shareModeSchema = z.enum(COFUNDING_SHARE_MODES).meta({ id: "CofundingShareMode" });
export const shareMode = () => shareModeSchema;
const offerStatusSchema = z.enum(COFUNDING_OFFER_STATUSES).meta({ id: "CofundingOfferStatus" });
export const offerStatus = () => offerStatusSchema;
const contributionStatusSchema = z.enum(COFUNDING_CONTRIBUTION_STATUSES).meta({ id: "CofundingContributionStatus" });
export const contributionStatus = () => contributionStatusSchema;

/** The offer's terms and its running total — the part admin and partner share. */
export const offerTerms = {
  id: uuid(),
  promotionId: uuid(),
  factory: z.object({ id: uuid(), name: z.string() }),
  mode: shareMode(),
  sharePct: pct().nullable(),
  fixedAmount: money().nullable(),
  capAmount: money(),
  validFrom: dateTime(),
  validTo: dateTime(),
  respondBy: dateTime(),
  status: offerStatus(),
  accruedAmount: money(),
  capRemaining: money(),
  capReached: z.boolean(),
  ordersCount: z.number().int().min(0),
  note: z.string().nullable(),
  proposedAt: dateTime(),
  answeredAt: dateTime().nullable(),
  declineReason: z.string().nullable(),
  withdrawReason: z.string().nullable(),
  /** The terms in Thai, composed by the API ("40 % ของส่วนลดดีล สูงสุด ฿20,000"). The web never composes terms. */
  termsText: z.string(),
};

export const cofundingDeal = z
  .object({
    name: z.string(),
    productTypeCode: z.string(),
    productTypeName: z.string(),
    weekStart: date(),
    discountPct: pct(),
    startsAt: dateTime(),
    endsAt: dateTime(),
    status: z.string(),
  })
  .meta({ id: "CofundingDealSnapshotDto" });

export const partnerOffer = z
  .object({
    ...offerTerms,
    deal: cofundingDeal,
    nextActions: z.array(z.enum(COFUNDING_PARTNER_ACTIONS)),
  })
  .meta({ id: "CofundingOfferPartnerDto" });

export const partnerOfferOrder = z
  .object({
    orderCode: z.string(),
    jobNumber: z.string(),
    discountAmount: money(),
    shareAmount: money(),
    status: contributionStatus(),
    billingStatementNumber: z.string().nullable(),
    capped: z.boolean(),
  })
  .meta({ id: "CofundingOfferOrderDto" });

export const partnerOfferDetail = partnerOffer
  .extend({ orders: z.array(partnerOfferOrder) })
  .meta({ id: "CofundingOfferPartnerDetailDto" });

export const partnerLoyaltyP4Requests = {
  "GET /v1/partner/cofunding-offers": request({
    request: "partner.cofunding-offers",
    summary: "My factories' co-funding offers on capacity deals, newest first",
    decisions: ["D-506"],
    query: z.object({
      factoryId: uuid().optional(),
      status: offerStatus().optional(),
      page: z.coerce.number().int().min(1).optional(),
      perPage: z.coerce.number().int().min(1).max(100).optional(),
    }),
    response: page(partnerOffer),
  }),
  "GET /v1/partner/cofunding-offers/{offerId}": request({
    request: "partner.cofunding-offers",
    summary: "One offer with the latest 50 orders counted (order and job codes, amounts); another factory's → 404",
    decisions: ["D-506"],
    response: partnerOfferDetail,
  }),
  "POST /v1/partner/cofunding-offers/{offerId}/actions/accept": request({
    request: "partner.cofunding-offers",
    summary:
      "Accept a proposed offer before respondBy (factory_cofunding.decide); orders placed from then count when the factory accepts their job",
    decisions: ["D-506"],
    idempotent: true,
    body: z.object({}),
    response: partnerOffer,
  }),
  "POST /v1/partner/cofunding-offers/{offerId}/actions/decline": request({
    request: "partner.cofunding-offers",
    summary: "Decline a proposed offer with a reason (≥ 5 chars); routing is never affected",
    decisions: ["D-506"],
    idempotent: true,
    body: z.object({ reason: z.string().trim().min(5).max(500) }),
    response: partnerOffer,
  }),
} as const;

export type CofundingShareMode = (typeof COFUNDING_SHARE_MODES)[number];
export type CofundingOfferStatus = (typeof COFUNDING_OFFER_STATUSES)[number];
export type CofundingContributionStatus = (typeof COFUNDING_CONTRIBUTION_STATUSES)[number];
export type CofundingReverseReason = (typeof COFUNDING_REVERSE_REASONS)[number];
export type PartnerCofundingOffer = z.infer<typeof partnerOffer>;
export type PartnerCofundingOfferDetail = z.infer<typeof partnerOfferDetail>;
export type PartnerCofundingOrder = z.infer<typeof partnerOfferOrder>;
