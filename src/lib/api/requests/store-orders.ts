/**
 * The customer's orders and the rest of their account (F3 3.4; B3.1–B3.5, B4.3–B4.5, D-081,
 * D-082, D-130–D-136, D-143, D-144).
 *
 * An order is the customer's view of the same row the back office works on (`admin-orders.ts`):
 * no factory, no buy cost, no margin, no internal timeline entry (D-050, D-141, B4.4 visibility).
 * The detail is one page-shaped aggregate — the order page shows all of it at once — and every
 * action the customer can take arrives as `nextActions`, so the account never re-derives the
 * workflow (entity.next-actions).
 *
 * Money, dates and points are the API's: the account shows balances, expiries and tier progress,
 * it never adds them up.
 */

import { z } from "zod";

import { loyaltyTier, pointsBalance, pointsEntry } from "./admin-customers";
import { referralStatus } from "./admin-marketing";
import {
  addressSnapshot,
  artworkStatus,
  carrierCode,
  claimStatus,
  claimType,
  designOption,
  documentStatus,
  documentType,
  dueTrigger,
  instalmentStatus,
  mockupOption,
  orderLineType,
  orderStatus,
  preflightStatus,
  productTypeRef,
  proofStatus,
  requiredBefore,
  shipmentStatus,
} from "./admin-orders";
import { designServiceStatus } from "./admin-prepress";
import { currency, date, dateTime, fileRef, listQuery, money, nextAction, page, pct, request, uuid } from "./define";
import { signedUrl } from "./store-quotes";

/* ----------------------------------------------------------------------------------- orders */

export const storeOrderView = z.enum(["active", "completed", "cancelled"]).meta({ id: "StoreOrderView" });

const productOf = z.object({ slug: z.string().nullable(), name: z.string(), imageUrl: z.string().nullable() });

export const storeOrderSummary = z
  .object({
    id: uuid(),
    orderCode: z.string(),
    groupCode: z.string(),
    status: orderStatus,
    artworkStatus,
    productType: productTypeRef,
    product: productOf,
    quantity: z.number().int(),
    unit: z.string(),
    grossAmount: money(),
    currency: currency(),
    promisedShipDate: date().nullable(),
    nextActions: z.array(nextAction()),
    createdAt: dateTime(),
  })
  .meta({ id: "StoreOrderSummaryDto" });

export const storeOrderInstalment = z
  .object({
    /** The group instalment — what `POST /v1/store/instalments/{id}/payments` takes. */
    id: uuid(),
    seq: z.number().int(),
    label: z.string(),
    dueTrigger,
    requiredBefore,
    dueAt: dateTime().nullable(),
    /** This order's share of the group instalment. */
    grossAmount: money(),
    paidAmount: money(),
    status: instalmentStatus,
    payable: z.boolean(),
    activePaymentId: uuid().nullable(),
  })
  .meta({ id: "StoreOrderInstalmentDto" });

export const storeOrderDocument = z
  .object({
    id: uuid(),
    /** qt quotation · iv/tr tax invoice–receipt per instalment · rc receipt · cn credit note · dn debit note. */
    type: documentType,
    number: z.string(),
    status: documentStatus,
    issuedAt: dateTime(),
    grossAmount: money(),
    /** The instalment it was issued for, when it was. */
    instalmentSeq: z.number().int().nullable(),
    /** The final tax invoice that nets the deposit invoices (D-020 tax-point note). */
    final: z.boolean(),
  })
  .meta({ id: "StoreOrderDocumentDto" });

export const storeShipment = z
  .object({
    id: uuid(),
    shipmentNo: z.string(),
    status: shipmentStatus,
    carrier: carrierCode,
    trackingNo: z.string().nullable(),
    /** The carrier's own tracking page, when it has one (never the factory's name, D-050). */
    trackingUrl: z.string().nullable(),
    destination: addressSnapshot,
    quantity: z.number().int(),
    cartons: z.number().int(),
    shippedAt: dateTime().nullable(),
    deliveredAt: dateTime().nullable(),
    events: z.array(
      z.object({ at: dateTime(), status: shipmentStatus, location: z.string().nullable(), note: z.string().nullable() }),
    ),
    pod: z
      .object({
        receiverName: z.string(),
        deliveredQuantity: z.number().int(),
        capturedAt: dateTime(),
        photos: z.array(fileRef()),
      })
      .nullable(),
  })
  .meta({ id: "StoreShipmentDto" });

/** D-021, D-080: what the delivered quantity meant, decided by the API. */
export const toleranceOutcome = z
  .object({
    orderedQuantity: z.number().int(),
    deliveredQuantity: z.number().int(),
    shortagePct: pct(),
    overagePct: pct(),
    outcome: z
      .enum(["exact", "shortage_within", "overage_within", "outside_claim_opened"])
      .meta({ id: "ToleranceOutcomeKind" }),
    /** Credited to store credit for a shortage within tolerance (D-080). */
    creditAmount: money().nullable(),
    claimId: uuid().nullable(),
  })
  .meta({ id: "StoreToleranceOutcomeDto" });

export const storeTimelineEntry = z
  .object({
    id: z.string(),
    at: dateTime(),
    /** `<resource>.<verb>`: `order.placed`, `payment.received`, `proof.approved`, `milestone.completed`… */
    kind: z.string(),
    title: z.string(),
    detail: z.string().nullable(),
    /** Promised vs actual (design-system.md §1.4) when the entry is a milestone. */
    promisedAt: dateTime().nullable(),
    /** Customer-visible evidence: milestone photos, the POD. */
    photos: z.array(fileRef()),
  })
  .meta({ id: "StoreOrderTimelineEntryDto" });

export const storeOrderDetail = storeOrderSummary
  .extend({
    group: z.object({ id: uuid(), groupCode: z.string(), orderCount: z.number().int() }),
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    lines: z.array(
      z.object({
        lineType: orderLineType,
        description: z.string(),
        quantity: z.string(),
        unit: z.string(),
        unitPrice: z.string(),
        netAmount: money(),
        vatAmount: money(),
        grossAmount: money(),
        waivedReason: z.string().nullable(),
      }),
    ),
    netAmount: money(),
    discountAmount: money(),
    shippingAmount: money(),
    vatAmount: money(),
    designOption,
    mockupOption,
    tolerance: z.object({ shortagePct: pct(), overagePct: pct() }),
    leadTimeDays: z.number().int(),
    estimatedDeliveryDate: date().nullable(),
    destinations: z.array(addressSnapshot.extend({ id: uuid(), quantity: z.number().int() })),
    taxInvoice: z.object({ name: z.string(), taxId: z.string(), branch: z.string() }).nullable(),
    poNumber: z.string().nullable(),
    instalments: z.array(storeOrderInstalment),
    documents: z.array(storeOrderDocument),
    artwork: z.object({
      status: artworkStatus,
      latestSubmission: z
        .object({ id: uuid(), versionNo: z.number().int(), preflightStatus, submittedAt: dateTime() })
        .nullable(),
      latestProof: z.object({ id: uuid(), versionNo: z.number().int(), status: proofStatus, sentAt: dateTime() }).nullable(),
      designService: z
        .object({ status: designServiceStatus, roundNo: z.number().int(), freeRounds: z.number().int() })
        .nullable(),
    }),
    shipments: z.array(storeShipment),
    toleranceOutcome: toleranceOutcome.nullable(),
    claims: z.array(
      z.object({ id: uuid(), claimNo: z.string(), type: claimType, status: claimStatus, submittedAt: dateTime() }),
    ),
    timeline: z.array(storeTimelineEntry),
    /** The public tracking page's token (`/track/{token}`, no PII). */
    trackingToken: z.string().nullable(),
    /** D-081 / D-082: receipt confirmed or auto-completed, and until when a claim may be opened. */
    receipt: z
      .object({
        confirmedAt: dateTime().nullable(),
        autoCompleteAt: dateTime().nullable(),
        claimWindowEndsAt: dateTime().nullable(),
      })
      .nullable(),
    expiresAt: dateTime().nullable(),
    cancelledAt: dateTime().nullable(),
    cancelReason: z.string().nullable(),
  })
  .meta({ id: "StoreOrderDetailDto" });

/* ---------------------------------------------------------------------------- the account */

export const storePoints = z
  .object({
    balance: pointsBalance,
    /** D-134: tier by 12-month spend, the next tier and what it takes — the API's figures. */
    tier: z.object({
      current: loyaltyTier,
      multiplier: z.string().describe("Decimal, e.g. 1.25"),
      spend12m: money(),
      next: loyaltyTier.nullable(),
      nextThreshold: money().nullable(),
      /** 0–100: how far to the next tier. */
      progressPct: z.number().min(0).max(100),
    }),
    /** D-131 point value, shown as "1 คะแนน = ฿2.50". */
    pointValue: money(),
  })
  .meta({ id: "StorePointsDto" });

export const storeReferral = z
  .object({
    code: z.string(),
    /** The rules in words, from `referral.rules` (D-136). */
    referrerReward: z.string(),
    refereeReward: z.string(),
    monthlyLimit: z.number().int(),
    rewardedThisMonth: z.number().int(),
    referrals: z.array(
      z.object({
        id: uuid(),
        /** Masked: "ส*** ต***" — the customer sees that a friend joined, not who they are. */
        refereeName: z.string(),
        status: referralStatus,
        joinedAt: dateTime(),
        rewardPoints: z.number().int().nullable(),
      }),
    ),
  })
  .meta({ id: "StoreReferralDto" });

export const walletPromotion = z
  .object({
    code: z.string().nullable(),
    title: z.string(),
    benefit: z.string(),
    conditions: z.string().nullable(),
    validUntil: dateTime().nullable(),
    status: z.enum(["available", "used", "expired"]).meta({ id: "WalletPromotionStatus" }),
  })
  .meta({ id: "WalletPromotionDto" });

export const storeWallet = z
  .object({
    promotions: z.array(walletPromotion),
    storeCredit: z.object({
      balance: money(),
      currency: currency(),
      entries: z.array(
        z.object({
          id: uuid(),
          kind: z.enum(["shortage_credit", "refund", "goodwill", "spent", "expired"]).meta({ id: "StoreCreditKind" }),
          amount: money().describe("Signed"),
          order: z.object({ id: uuid(), orderCode: z.string() }).nullable(),
          note: z.string().nullable(),
          createdAt: dateTime(),
        }),
      ),
    }),
  })
  .meta({ id: "StoreWalletDto" });

export const privacyRequest = z
  .object({
    id: uuid(),
    kind: z.enum(["export", "delete"]).meta({ id: "PrivacyRequestKind" }),
    status: z.enum(["received", "in_progress", "completed", "rejected"]).meta({ id: "PrivacyRequestStatus" }),
    /** What the privacy team said, e.g. why a deletion must wait for open orders or tax records. */
    note: z.string().nullable(),
    /** An export's download, while it lasts. */
    download: signedUrl.nullable(),
    requestedAt: dateTime(),
    /** The PDPA response deadline the API computed. */
    dueAt: dateTime(),
  })
  .meta({ id: "PrivacyRequestDto" });

/* ----------------------------------------------------------------------------------- requests */

export const storeOrderRequests = {
  "GET /v1/store/orders": request({
    request: "store.orders",
    summary: "The customer's orders, each with the actions they can take now",
    query: listQuery({ view: storeOrderView.optional() }),
    response: page(storeOrderSummary),
  }),
  "GET /v1/store/orders/{orderId}": request({
    request: "store.orders",
    summary: "One order as the customer sees it; 404 when it is not theirs",
    decisions: ["D-050", "D-081", "D-082"],
    response: storeOrderDetail,
  }),
  "POST /v1/store/orders/{orderId}/documents/{documentId}/actions/download": request({
    request: "store.orders",
    summary: "A short-lived signed URL for one of the order's documents, issued by Collective Group (Thailand)",
    decisions: ["D-010", "D-092"],
    response: signedUrl,
  }),
  "GET /v1/store/me/points": request({
    request: "store.loyalty",
    summary: "Points balance, what expires soon, and progress to the next tier",
    decisions: ["D-130", "D-131", "D-132", "D-134"],
    response: storePoints,
  }),
  "GET /v1/store/me/points/entries": request({
    request: "store.loyalty",
    summary: "The customer's points history, newest first",
    query: listQuery({}),
    response: page(pointsEntry),
  }),
  "GET /v1/store/me/referral": request({
    request: "store.loyalty",
    summary: "The customer's referral code, the rules in words, and the friends it brought",
    decisions: ["D-136"],
    response: storeReferral,
  }),
  "GET /v1/store/me/wallet": request({
    request: "store.wallet",
    summary: "Promotion codes the customer holds, and their store credit with its history",
    decisions: ["D-053", "D-080"],
    response: storeWallet,
  }),
  "GET /v1/store/me/privacy-requests": request({
    request: "store.privacy",
    summary: "The customer's data-export and deletion requests (PDPA)",
    response: z.object({ data: z.array(privacyRequest) }),
  }),
  "POST /v1/store/me/privacy-requests": request({
    request: "store.privacy",
    summary: "Ask for a copy of one's data, or for its deletion; the privacy team answers within the PDPA deadline",
    body: z.object({ kind: z.enum(["export", "delete"]), reason: z.string().trim().max(1000).optional() }),
    response: privacyRequest,
    status: 201,
    idempotent: true,
  }),
  "DELETE /v1/store/me/identities/{provider}": request({
    request: "store.identities",
    summary: "Unlink a sign-in method (LINE, Google, Apple) — refused for the last one left",
    status: 204,
  }),
} as const;
