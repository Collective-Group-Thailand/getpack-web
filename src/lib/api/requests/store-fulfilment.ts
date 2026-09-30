/**
 * After production, from the customer's side, still waiting on the contract (B4.5, D-082, D-153):
 * what a claim may say (the claim form) and a reorder's price before it is placed. Tracking,
 * receipt, claims and the reorder itself are published (U-F0.2).
 */

import { z } from "zod";

import { claimType } from "./admin-orders";
import { claimResolutionKind } from "./admin-logistics";
import { date, dateTime, money, request, uuid } from "./define";
import { quoteLine } from "./store-quotes";

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
  "GET /v1/store/orders/{orderId}/claim-form": request({
    request: "store.claims",
    summary: "What a claim on this order may say: the window, types, resolutions, deliveries, evidence rules",
    decisions: ["D-082"],
    response: claimForm,
  }),
  "GET /v1/store/orders/{orderId}/reorder": request({
    request: "store.reorder",
    summary: "Reorder an order: same spec and artwork, re-priced now, reusable one-off costs waived (D-153)",
    decisions: ["D-153"],
    query: z.object({ quantity: z.coerce.number().int().positive().optional() }),
    response: reorderPreview,
  }),
} as const;
