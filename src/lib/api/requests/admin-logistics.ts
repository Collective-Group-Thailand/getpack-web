/**
 * Logistics and claims as the back office runs them (F2 2.8) — packio-api B4.3 and B4.5, not
 * published yet. Shaped by schema-design §3 "Shipments" (`shipments`, `shipment_items`,
 * `shipment_cartons`, `shipment_events`, `proofs_of_delivery`) and "Claims" (`claims`,
 * `claim_resolutions`).
 *
 * The factory delivers with its own fleet; a Packio-booked carrier is the fallback where it
 * cannot (D-013, D-114). A factory delivery needs a POD, which unlocks the payout (B5). The
 * tolerance result on delivery (D-021, D-080, D-165) and the liability a claim gets by rule
 * (D-083) are the API's; staff see them and, with permission, override liability with a reason.
 */

import { z } from "zod";

import {
  addressSnapshot,
  carrierCode,
  claimStatus,
  claimType,
  customerRef,
  factoryRef,
  shipmentStatus,
} from "./admin-orders";
import { dateTime, fileRef, listQuery, money, page, request, userRef, uuid } from "./define";

/* -------------------------------------------------------------------------------- shipments */

export const shipmentQueue = z
  .enum(["awaiting_pickup", "in_transit", "exceptions", "pod_review"])
  .meta({ id: "ShipmentQueue" });
export const podReview = z.enum(["pending", "accepted", "rejected"]).meta({ id: "PodReviewStatus" });

/** Delivered against ordered, with the order's tolerance snapshot (D-021, D-080). */
export const toleranceResult = z
  .object({
    ordered: z.number().int(),
    delivered: z.number().int(),
    shortagePct: z.string(),
    overagePct: z.string(),
    /** within = pro-rata credit for a shortage, nothing for an overage; outside = automatic claim. */
    outcome: z.enum(["exact", "short_within", "over_within", "short_outside", "over_outside"]),
    claimId: uuid().nullable(),
  })
  .meta({ id: "ToleranceResultDto" });

export const shipmentRow = z
  .object({
    id: uuid(),
    shipmentNo: z.string(),
    status: shipmentStatus,
    carrier: carrierCode,
    trackingNo: z.string().nullable(),
    order: z.object({ id: uuid(), orderCode: z.string() }),
    factory: factoryRef,
    destination: z.object({ recipientName: z.string(), province: z.string(), postcode: z.string() }),
    quantity: z.number().int(),
    cartons: z.number().int(),
    /** The latest carrier or factory event. */
    lastEvent: z.object({ status: shipmentStatus, occurredAt: dateTime(), location: z.string().nullable() }).nullable(),
    /** Why the row is in the exceptions queue: a failed attempt, a return, a stale scan. */
    exception: z.string().nullable(),
    podReview: podReview.nullable(),
    promisedShipDate: z.string().nullable(),
    readyAt: dateTime().nullable(),
  })
  .meta({ id: "ShipmentRowDto" });

export const shipmentAction = z
  .enum(["split", "book-carrier", "resolve-exception"])
  .meta({ id: "ShipmentAction" });

export const shipmentDetail = shipmentRow
  .extend({
    destination: addressSnapshot,
    items: z.array(
      z.object({ orderId: uuid(), orderCode: z.string(), destinationLabel: z.string(), quantity: z.number().int() }),
    ),
    cartonList: z.array(
      z.object({ seq: z.number().int(), labelCode: z.string(), weightG: z.number().int().nullable() }),
    ),
    weightG: z.number().int().nullable(),
    events: z.array(
      z.object({
        occurredAt: dateTime(),
        status: shipmentStatus,
        source: z.enum(["factory", "carrier_webhook", "carrier_poll", "staff"]),
        location: z.string().nullable(),
        note: z.string().nullable(),
      }),
    ),
    pod: z
      .object({
        kind: z.enum(["factory_photo_signature", "carrier_pod"]),
        receiverName: z.string(),
        deliveredQuantity: z.number().int(),
        capturedAt: dateTime(),
        photos: z.array(fileRef()),
        signature: fileRef().nullable(),
        review: podReview,
        reviewedBy: userRef().nullable(),
        reviewNote: z.string().nullable(),
      })
      .nullable(),
    tolerance: toleranceResult.nullable(),
    /** A before-shipping instalment is unpaid: the API will not let it leave (B3.2 gate). */
    blockedByPayment: z.boolean(),
    /** Customer charge vs factory payout vs a fallback carrier's cost (D-013), for roles with margin.read. */
    economics: z
      .object({ customerCharge: money(), factoryPayout: money().nullable(), carrierCost: money().nullable() })
      .nullable()
      .optional(),
    allowedActions: z.array(shipmentAction),
  })
  .meta({ id: "ShipmentDetailDto" });

export const carrierQuote = z
  .object({
    quoteId: z.string(),
    carrier: carrierCode,
    service: z.string(),
    amount: money(),
    etaDays: z.number().int(),
    validUntil: dateTime(),
  })
  .meta({ id: "CarrierQuoteDto" });

/* ----------------------------------------------------------------------------------- claims */

export const claimOrigin = z.enum(["customer", "tolerance_auto", "staff"]).meta({ id: "ClaimOrigin" });
export const claimLiability = z
  .enum(["factory", "customer", "carrier", "packio", "undetermined"])
  .meta({ id: "ClaimLiability" });
export const claimResolutionKind = z
  .enum(["reprint", "partial_refund", "full_refund", "credit"])
  .meta({ id: "ClaimResolutionKind" });
export const claimActionKey = z
  .enum(["start-review", "request-info", "send-to-factory", "approve", "reject", "close"])
  .meta({ id: "ClaimActionKey" });
export const claimResolutionAction = z
  .enum(["reproduction_job", "refund", "credit_note", "store_credit", "factory_deduction", "carrier_recovery"])
  .meta({ id: "ClaimResolutionAction" });

export const claimRow = z
  .object({
    id: uuid(),
    claimNo: z.string(),
    type: claimType,
    origin: claimOrigin,
    status: claimStatus,
    order: z.object({ id: uuid(), orderCode: z.string() }),
    customer: customerRef,
    factory: factoryRef.nullable(),
    requestedResolution: claimResolutionKind,
    claimedAmount: money().nullable(),
    liability: claimLiability,
    submittedAt: dateTime(),
    /** The SLA of the current step on the business calendar. */
    slaDueAt: dateTime().nullable(),
  })
  .meta({ id: "ClaimRowDto" });

export const claimDetail = claimRow
  .extend({
    shipment: z.object({ id: uuid(), shipmentNo: z.string() }).nullable(),
    description: z.string(),
    receivedAt: dateTime(),
    windowEndsAt: dateTime(),
    claimedQuantity: z.number().int().nullable(),
    evidence: z.object({ productPhotos: z.array(fileRef()), cartonPhotos: z.array(fileRef()) }),
    /** What D-083 gives by rule, and whether a person overrode it. */
    liabilityByRule: claimLiability,
    liabilityRule: z.string(),
    liabilityOverride: z.object({ by: userRef(), reason: z.string(), at: dateTime() }).nullable(),
    /** The artwork the customer approved, when liability may turn on it (D-083). */
    approvedProof: z.object({ id: uuid(), versionNo: z.number().int(), approvedAt: dateTime() }).nullable(),
    factoryResponse: z
      .object({ response: z.enum(["accepted", "disputed"]), note: z.string().nullable(), at: dateTime() })
      .nullable(),
    decision: z.object({ by: userRef(), at: dateTime(), reason: z.string() }).nullable(),
    resolutions: z.array(
      z.object({
        action: claimResolutionAction,
        amount: money().nullable(),
        reference: z.string().nullable(),
        executedAt: dateTime(),
        executedBy: userRef(),
      }),
    ),
    messages: z.array(
      z.object({
        at: dateTime(),
        author: z.string(),
        audience: z.enum(["customer", "factory", "internal"]),
        body: z.string(),
      }),
    ),
    allowedActions: z.array(claimActionKey),
    allowedResolutions: z.array(claimResolutionAction),
  })
  .meta({ id: "ClaimDetailDto" });

/* ----------------------------------------------------------------------------------- requests */

export const adminLogisticsRequests = {
  "GET /v1/admin/shipments": request({
    request: "admin.shipments",
    summary: "Shipments, optionally one logistics queue (awaiting pick-up, in transit, exceptions, POD review)",
    decisions: ["D-013", "D-114"],
    query: listQuery({
      queue: shipmentQueue.optional(),
      status: shipmentStatus.optional(),
      carrier: carrierCode.optional(),
      factoryId: uuid().optional(),
    }),
    response: page(shipmentRow),
  }),
  "GET /v1/admin/shipments/{shipmentId}": request({
    request: "admin.shipments",
    summary: "One shipment: items, cartons, events, POD with the tolerance result, allowed actions (ETag)",
    decisions: ["D-013", "D-021", "D-080", "D-165"],
    response: shipmentDetail,
  }),
  "POST /v1/admin/shipments/{shipmentId}/actions/split": request({
    request: "admin.shipments",
    summary: "Move part of a shipment's quantity to a new shipment (a second truck, a later batch)",
    body: z.object({ quantity: z.number().int().positive(), reason: z.string().min(3).max(500) }),
    response: z.object({ shipment: shipmentDetail, created: z.object({ id: uuid(), shipmentNo: z.string() }) }),
    concurrency: true,
    idempotent: true,
  }),
  "POST /v1/admin/shipments/{shipmentId}/carrier-quotes": request({
    request: "admin.shipments",
    summary: "Fallback carrier quotes where the factory cannot deliver (D-013, D-114)",
    decisions: ["D-114"],
    response: z.array(carrierQuote),
  }),
  "POST /v1/admin/shipments/{shipmentId}/actions/book-carrier": request({
    request: "admin.shipments",
    summary: "Book the chosen fallback carrier; the booking reference and tracking number come back",
    decisions: ["D-114"],
    body: z.object({ quoteId: z.string(), reason: z.string().min(3).max(500) }),
    response: shipmentDetail,
    concurrency: true,
    idempotent: true,
  }),
  "POST /v1/admin/shipments/{shipmentId}/actions/resolve-exception": request({
    request: "admin.shipments",
    summary: "Resolve a delivery exception: retry delivery, return to the factory, or cancel",
    body: z.object({ resolution: z.enum(["retry", "return", "cancel"]), reason: z.string().min(3).max(500) }),
    response: shipmentDetail,
    concurrency: true,
  }),
  "POST /v1/admin/shipments/{shipmentId}/documents": request({
    request: "admin.shipments",
    summary: "The carton labels (100×150 mm, QR to public tracking) or the packing list as a signed URL",
    body: z.object({ kind: z.enum(["labels", "packing_list"]) }),
    response: z.object({ url: z.string(), expiresAt: dateTime() }),
  }),
  "POST /v1/admin/shipments/{shipmentId}/pod/actions/{decision}": request({
    request: "admin.shipments",
    summary: "Accept or reject a POD; an accepted factory POD makes the payout eligible (B5)",
    decisions: ["D-013"],
    body: z.object({ note: z.string().max(500).nullable() }),
    response: shipmentDetail,
  }),
  "GET /v1/admin/claims": request({
    request: "admin.claims",
    summary: "Claims by status, type and origin, with the current step's SLA",
    decisions: ["D-082"],
    query: listQuery({ status: claimStatus.optional(), type: claimType.optional(), origin: claimOrigin.optional() }),
    response: page(claimRow),
  }),
  "GET /v1/admin/claims/{claimId}": request({
    request: "admin.claims",
    summary: "One claim: evidence, liability by rule and any override, factory response, resolutions (ETag)",
    decisions: ["D-082", "D-083"],
    response: claimDetail,
  }),
  "POST /v1/admin/claims/{claimId}/actions/{action}": request({
    request: "admin.claims",
    summary: "Move a claim: start review, ask for information, send to the factory, approve, reject, close",
    body: z.object({ reason: z.string().min(3).max(2000) }),
    response: claimDetail,
    concurrency: true,
  }),
  "POST /v1/admin/claims/{claimId}/liability": request({
    request: "admin.claims",
    summary: "Override the liability the rule gave (permission claims.override_liability), with a reason",
    decisions: ["D-083"],
    body: z.object({ liability: claimLiability, reason: z.string().min(3).max(1000) }),
    response: claimDetail,
    concurrency: true,
  }),
  "POST /v1/admin/claims/{claimId}/resolutions": request({
    request: "admin.claims",
    summary: "Execute a resolution through an existing mechanism: re-production, refund, credit note, deduction",
    decisions: ["D-083"],
    body: z.object({
      action: claimResolutionAction,
      amount: money().nullable(),
      note: z.string().min(3).max(1000),
    }),
    response: claimDetail,
    idempotent: true,
  }),
} as const;
