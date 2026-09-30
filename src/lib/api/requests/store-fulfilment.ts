/**
 * After production, from the customer's side (F3 3.6; B4.3, B4.5, D-021, D-080–D-083, D-153):
 * where an order stands, the public tracking page, confirming receipt, claims and reorder.
 *
 * The back office's logistics desk (`admin-logistics.ts`, F2 2.8) holds the same rows: a claim the
 * customer files is the claim Logistics reviews, and its customer-facing messages are the thread
 * here. Liability, the factory and internal notes never leave the back office.
 *
 * The public tracking page is for whoever holds the token (a QR on the carton label): stages,
 * dates and the carrier's progress, never a name, an address beyond the province, an amount or a
 * delivery photo.
 */

import { z } from "zod";

import { carrierCode, claimStatus, claimType, orderStatus, shipmentStatus } from "./admin-orders";
import { claimResolutionKind } from "./admin-logistics";
import { date, dateTime, fileRef, money, request, uuid } from "./define";
import { quoteLine } from "./store-quotes";
import { orderStage, storeOrderDetail } from "./store-orders";

/* ------------------------------------------------------------------------------ public tracking */

export const publicTracking = z
  .object({
    orderCode: z.string(),
    status: orderStatus,
    productName: z.string(),
    quantity: z.number().int(),
    unit: z.string(),
    stages: z.array(orderStage),
    estimatedDeliveryDate: date().nullable(),
    shipments: z.array(
      z.object({
        shipmentNo: z.string(),
        status: shipmentStatus,
        carrier: carrierCode,
        trackingNo: z.string().nullable(),
        trackingUrl: z.string().nullable(),
        /** The province only — no recipient, no street. */
        province: z.string(),
        quantity: z.number().int(),
        cartons: z.number().int(),
        shippedAt: dateTime().nullable(),
        deliveredAt: dateTime().nullable(),
        events: z.array(z.object({ at: dateTime(), status: shipmentStatus, location: z.string().nullable() })),
      }),
    ),
    updatedAt: dateTime(),
  })
  .meta({ id: "PublicTrackingDto" });

/* ------------------------------------------------------------------------------------ claims */

export const claimForm = z
  .object({
    /** D-082: 7 days after receipt; the form is refused after it. */
    windowEndsAt: dateTime(),
    open: z.boolean(),
    types: z.array(claimType),
    resolutions: z.array(claimResolutionKind),
    shipments: z.array(
      z.object({
        id: uuid(),
        shipmentNo: z.string(),
        province: z.string(),
        deliveredQuantity: z.number().int().nullable(),
        deliveredAt: dateTime().nullable(),
      }),
    ),
    /** D-082 evidence: product photos and carton photos, both required — counts from settings. */
    evidence: z.object({
      accept: z.string(),
      maxBytes: z.number().int(),
      minProductPhotos: z.number().int(),
      minCartonPhotos: z.number().int(),
      maxPhotos: z.number().int(),
    }),
  })
  .meta({ id: "StoreClaimFormDto" });

export const storeClaim = z
  .object({
    id: uuid(),
    claimNo: z.string(),
    order: z.object({ id: uuid(), orderCode: z.string() }),
    type: claimType,
    status: claimStatus,
    shipment: z.object({ id: uuid(), shipmentNo: z.string() }).nullable(),
    affectedQuantity: z.number().int().nullable(),
    description: z.string(),
    requestedResolution: claimResolutionKind,
    evidence: z.object({ productPhotos: z.array(fileRef()), cartonPhotos: z.array(fileRef()) }),
    /** Opened by the API itself for a delivery outside tolerance (D-080), not by the customer. */
    automatic: z.boolean(),
    submittedAt: dateTime(),
    /** When the team will answer by, on the business calendar. */
    respondBy: dateTime().nullable(),
    messages: z.array(
      z.object({
        id: z.string(),
        at: dateTime(),
        authorKind: z.enum(["customer", "staff"]).meta({ id: "ClaimMessageAuthor" }),
        /** Staff appear as the team. */
        authorName: z.string(),
        body: z.string(),
        files: z.array(fileRef()),
      }),
    ),
    /** The outcome in words, once decided: what the customer gets and when. */
    outcome: z
      .object({
        decision: z.enum(["approved", "rejected"]).meta({ id: "ClaimOutcomeDecision" }),
        resolution: claimResolutionKind.nullable(),
        amount: money().nullable(),
        note: z.string(),
        at: dateTime(),
      })
      .nullable(),
    /** The team asked for more (status `need_info`) or the claim is still open. */
    canReply: z.boolean(),
  })
  .meta({ id: "StoreClaimDto" });

/* ----------------------------------------------------------------------------------- reorder */

export const reorderPreview = z
  .object({
    source: z.object({ orderId: uuid(), orderCode: z.string(), quantity: z.number().int(), unitPrice: z.string() }),
    product: z.object({ slug: z.string().nullable(), name: z.string(), imageUrl: z.string().nullable() }),
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    /** D-153: same artwork; the proof is skipped when the approved file is reused unchanged. */
    artwork: z.object({
      reused: z.boolean(),
      proofSkipped: z.boolean(),
      approvedProofVersion: z.number().int().nullable(),
      note: z.string().nullable(),
    }),
    quantity: z.number().int(),
    minQuantity: z.number().int(),
    maxQuantity: z.number().int().nullable(),
    unit: z.string(),
    /** Re-priced at today's cost; plates and dies that can be reused come back waived (D-153). */
    lines: z.array(quoteLine),
    unitPrice: z.string().describe("Decimal, up to 6 places"),
    netAmount: money(),
    vatAmount: money(),
    grossAmount: money(),
    /** What today's unit price is against the original order's, when it moved. */
    priceChanged: z.boolean(),
    leadTimeDays: z.number().int(),
    earliestShipDate: date(),
    /** Hands the figures shown to `actions/reorder`; a stale one is refused (409 `reorder.repriced`). */
    previewToken: z.string(),
    expiresAt: dateTime(),
  })
  .meta({ id: "StoreReorderPreviewDto" });

/* ----------------------------------------------------------------------------------- requests */

export const storeFulfilmentRequests = {
  "GET /v1/store/tracking/{token}": request({
    request: "store.tracking",
    summary: "The public tracking page by its token: stages and the carrier's progress, no personal data",
    decisions: ["D-013"],
    response: publicTracking,
    public: true,
  }),
  "POST /v1/store/orders/{orderId}/actions/confirm-receipt": request({
    request: "store.receipt",
    summary:
      "Confirm the order arrived (D-081); otherwise it completes 7 days after delivery. Starts the claim window (D-082)",
    decisions: ["D-081", "D-082"],
    body: z.object({}),
    response: storeOrderDetail,
    idempotent: true,
  }),
  "GET /v1/store/orders/{orderId}/claim-form": request({
    request: "store.claims",
    summary: "What a claim on this order may say: the window, types, resolutions, deliveries, evidence rules",
    decisions: ["D-082"],
    response: claimForm,
  }),
  "POST /v1/store/orders/{orderId}/claims": request({
    request: "store.claims",
    summary: "File a claim within the window with product and carton photos (D-082); liability is set by rule (D-083)",
    decisions: ["D-082", "D-083"],
    body: z.object({
      type: claimType,
      shipmentId: uuid().optional(),
      affectedQuantity: z.number().int().positive().optional(),
      description: z.string().trim().min(10).max(2000),
      requestedResolution: claimResolutionKind,
      productPhotoFileIds: z.array(uuid()).min(1).max(10),
      cartonPhotoFileIds: z.array(uuid()).min(1).max(10),
    }),
    response: storeClaim,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/store/orders/{orderId}/claims/{claimId}": request({
    request: "store.claims",
    summary: "One of the order's claims: evidence, the customer-facing thread, the outcome",
    response: storeClaim,
  }),
  "POST /v1/store/orders/{orderId}/claims/{claimId}/messages": request({
    request: "store.claims",
    summary: "Reply in the claim's thread, with more photos when the team asked for them",
    body: z.object({ body: z.string().trim().min(1).max(2000), fileIds: z.array(uuid()).max(10).optional() }),
    response: storeClaim,
    status: 201,
  }),
  "GET /v1/store/orders/{orderId}/reorder": request({
    request: "store.reorder",
    summary: "Reorder an order: same spec and artwork, re-priced now, reusable one-off costs waived (D-153)",
    decisions: ["D-153"],
    query: z.object({ quantity: z.coerce.number().int().positive().optional() }),
    response: reorderPreview,
  }),
} as const;
