/**
 * The logistics desk's actions packio-api still has to build (U-B0.2, `logistics`): splitting a
 * shipment, quoting the fallback carriers, resolving a failed delivery and reviewing a POD. The
 * shipments themselves, carrier booking, the documents and every claim operation are published
 * (`admin.shipments.*`, `admin.files.download`, `admin.claims.*`, U-F0.3).
 *
 * `shipmentDetail` is the shape these requests answer with; the screens read the published
 * `AdminShipmentDto` and refetch it after each one. `toleranceResult` and `claimResolutionKind`
 * are shared with the partner and store request files.
 */

import { z } from "zod";

import { addressSnapshot, carrierCode, factoryRef, shipmentStatus } from "./admin-orders";
import { dateTime, fileRef, money, request, userRef, uuid } from "./define";

/* -------------------------------------------------------------------------------- shipments */

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

export const shipmentAction = z.enum(["split", "book-carrier", "resolve-exception"]).meta({ id: "ShipmentAction" });

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

export const claimResolutionKind = z
  .enum(["reprint", "partial_refund", "full_refund", "credit"])
  .meta({ id: "ClaimResolutionKind" });

/* ----------------------------------------------------------------------------------- requests */

export const adminLogisticsRequests = {
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
  "POST /v1/admin/shipments/{shipmentId}/actions/resolve-exception": request({
    request: "admin.shipments",
    summary: "Resolve a delivery exception: retry delivery, return to the factory, or cancel",
    body: z.object({ resolution: z.enum(["retry", "return", "cancel"]), reason: z.string().min(3).max(500) }),
    response: shipmentDetail,
    concurrency: true,
  }),
  "POST /v1/admin/shipments/{shipmentId}/pod/actions/{decision}": request({
    request: "admin.shipments",
    summary: "Accept or reject a POD; an accepted factory POD makes the payout eligible (B5)",
    decisions: ["D-013"],
    body: z.object({ note: z.string().max(500).nullable() }),
    response: shipmentDetail,
  }),
} as const;
