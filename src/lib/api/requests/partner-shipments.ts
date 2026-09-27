/**
 * Shipping from the factory (F5 5.2), the partner side of packio-api B4.3: what is ready to ship,
 * shipments per destination (split), packing list and carton labels with a QR, delivery with the
 * factory's own fleet or a request for Packio's carrier fallback (D-013, D-114), and the **proof
 * of delivery the factory must capture** — photo, receiver name, signature, delivered quantity —
 * which drives the tolerance result (D-021, D-080, D-165). Not published; shapes from
 * schema-design §3.8 (`shipments`, `shipment_items`, `shipment_cartons`, `proofs_of_delivery`).
 *
 * The recipient is a snapshot of the order's destination: name, address and phone only (D-142).
 */

import { z } from "zod";

import { toleranceResult } from "./admin-logistics";
import { carrierCode, productTypeRef, shipmentStatus } from "./admin-orders";
import { date, dateTime, fileRef, listQuery, page, request, userRef, uuid } from "./define";
import { partnerDestination } from "./partner-jobs";

export const shipView = z.enum(["open", "in_transit", "delivered", "all"]).meta({ id: "PartnerShipmentView" });

export const partnerShipment = z
  .object({
    id: uuid(),
    shipmentNo: z.string(),
    status: shipmentStatus,
    carrier: carrierCode,
    /** A carrier fallback was asked for and Packio has not booked it yet (D-114). */
    carrierRequested: z.boolean(),
    trackingNo: z.string().nullable(),
    job: z.object({ id: uuid(), jobNo: z.string(), title: z.string(), productType: productTypeRef }),
    destination: partnerDestination.omit({ quantity: true, shippedQuantity: true }),
    quantity: z.number().int(),
    cartons: z.number().int(),
    weightG: z.number().int().nullable(),
    readyAt: dateTime().nullable(),
    pickedUpAt: dateTime().nullable(),
    deliveredAt: dateTime().nullable(),
    promisedShipDate: date().nullable(),
    podRequired: z.boolean(),
    hasPod: z.boolean(),
  })
  .meta({ id: "PartnerShipmentDto" });

export const partnerShipmentDetail = partnerShipment
  .extend({
    /** One label per carton (100 × 150 mm): the code is what its QR encodes — the public tracking link. */
    cartonList: z.array(
      z.object({
        seq: z.number().int(),
        labelCode: z.string(),
        trackingUrl: z.string(),
        weightG: z.number().int().nullable(),
      }),
    ),
    packingList: z.array(z.object({ label: z.string(), quantity: z.number().int() })),
    events: z.array(z.object({ occurredAt: dateTime(), status: shipmentStatus, note: z.string().nullable() })),
    pod: z
      .object({
        receiverName: z.string(),
        deliveredQuantity: z.number().int(),
        capturedAt: dateTime(),
        photos: z.array(fileRef()),
        signature: fileRef().nullable(),
        capturedBy: userRef().nullable(),
        review: z.enum(["pending", "accepted", "rejected"]),
        reviewNote: z.string().nullable(),
      })
      .nullable(),
    tolerance: toleranceResult.nullable(),
    /** A before-shipping instalment is unpaid: the API will not let it leave (B3.2 gate). */
    blockedByPayment: z.boolean(),
    nextActions: z.array(z.enum(["dispatch", "request_carrier", "capture_pod", "cancel"])),
  })
  .meta({ id: "PartnerShipmentDetailDto" });

/** A job ready to ship, with what each destination still needs (split shipments). */
export const shipPlanJob = z
  .object({
    id: uuid(),
    jobNo: z.string(),
    title: z.string(),
    productType: productTypeRef,
    quantityGood: z.number().int(),
    promisedShipDate: date(),
    destinations: z.array(partnerDestination),
    /** Why it cannot leave yet: Packio's inspection pending, a before-shipping instalment unpaid. */
    blockedReason: z.enum(["inspection_pending", "payment_pending"]).nullable(),
  })
  .meta({ id: "PartnerShipPlanJobDto" });

const path = "/v1/partner/factories/{factoryId}";
const clientStamp = { clientRef: uuid(), clientReportedAt: dateTime() };

export const partnerShipmentRequests = {
  [`GET ${path}/ship-plan` as const]: request({
    request: "partner.shipments",
    summary: "Jobs ready to ship with each destination's remaining quantity (split, multi-destination)",
    decisions: ["D-110", "D-142"],
    response: z.array(shipPlanJob),
  }),
  [`GET ${path}/shipments` as const]: request({
    request: "partner.shipments",
    summary: "My factory's shipments by view",
    decisions: ["D-013"],
    query: listQuery({ view: shipView.optional() }),
    response: page(partnerShipment),
  }),
  [`POST ${path}/shipments` as const]: request({
    request: "partner.shipments",
    summary: "Create a shipment for one destination of a job; several make a split (D-110)",
    decisions: ["D-013", "D-110"],
    body: z.object({
      ...clientStamp,
      jobId: uuid(),
      destinationId: uuid(),
      quantity: z.number().int().min(1),
      cartons: z.number().int().min(1).max(500),
      weightG: z.number().int().min(1).optional(),
    }),
    response: partnerShipmentDetail,
    status: 201,
    idempotent: true,
  }),
  [`GET ${path}/shipments/{shipmentId}` as const]: request({
    request: "partner.shipments",
    summary: "One shipment: recipient (D-142), cartons and labels, packing list, events, POD, tolerance",
    decisions: ["D-013", "D-021", "D-142"],
    response: partnerShipmentDetail,
  }),
  [`POST ${path}/shipments/{shipmentId}/actions/dispatch` as const]: request({
    request: "partner.shipments",
    summary: "The factory's own fleet leaves with it (D-013)",
    decisions: ["D-013"],
    body: z.object(clientStamp),
    response: partnerShipmentDetail,
    idempotent: true,
  }),
  [`POST ${path}/shipments/{shipmentId}/actions/request-carrier` as const]: request({
    request: "partner.shipments",
    summary: "Ask Packio to book its carrier fallback where the fleet cannot deliver (D-114)",
    decisions: ["D-013", "D-114"],
    body: z.object({ ...clientStamp, reason: z.string().trim().min(3).max(500) }),
    response: partnerShipmentDetail,
    idempotent: true,
  }),
  [`POST ${path}/shipments/{shipmentId}/pod` as const]: request({
    request: "partner.shipments",
    summary: "Proof of delivery: photos, receiver, signature and delivered quantity — required (D-013)",
    decisions: ["D-013", "D-021", "D-080", "D-165"],
    body: z.object({
      ...clientStamp,
      receiverName: z.string().trim().min(2).max(200),
      deliveredQuantity: z.number().int().min(0),
      capturedAt: dateTime(),
      photoFileIds: z.array(uuid()).min(1).max(10),
      signatureFileId: uuid(),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    }),
    response: partnerShipmentDetail,
    status: 201,
    idempotent: true,
  }),
} as const;
