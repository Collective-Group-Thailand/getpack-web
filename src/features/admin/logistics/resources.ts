/** The logistics and claims lists and types, in a plain module so Server Components can prefetch. */

import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type Shipment = Schemas["AdminShipmentDto"];
export type Claim = Schemas["AdminClaimDto"];
/** A fallback carrier's quote for one shipment (`admin.shipments.carrierQuotes`, D-114). */
export type CarrierQuote = Schemas["ShipmentCarrierQuoteDto"];

/** The logistics desk's queues (`admin.shipments.list?queue`, D-229, D-230). */
export const SHIPMENT_QUEUES = [
  "awaiting_pickup",
  "in_transit",
  "exceptions",
  "pod_review",
] as const satisfies readonly Schemas["ShipmentQueue"][];

export const SHIPMENT_STATUSES = [
  "draft",
  "ready",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
] as const satisfies readonly Schemas["ShipmentStatus"][];
export const CLAIM_STATUSES = [
  "submitted",
  "under_review",
  "need_info",
  "factory_review",
  "approved",
  "rejected",
  "resolved",
  "closed",
] as const satisfies readonly Schemas["ClaimStatus"][];
export const CLAIM_TYPES = [
  "damaged",
  "wrong_spec",
  "print_defect",
  "quantity_short",
  "late",
  "other",
] as const satisfies readonly Schemas["ClaimType"][];
export const CLAIM_ORIGINS = [
  "customer",
  "tolerance_auto",
  "staff",
] as const satisfies readonly Schemas["ClaimOrigin"][];

/**
 * The logistics desk (`admin.shipments.list`): its queues, and filters by status, carrier and
 * factory, searched by `q`.
 */
export const shipmentsList = defineList<Shipment>({
  key: "shipment",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/shipments", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.shipmentNo,
  defaults: { filterKeys: ["queue", "status", "carrier", "factoryId"] },
  staleTime: STALE_TIME.live,
});

/**
 * Claims (`admin.claims.list`), by status, type, origin, customer and factory (U-B0.2) and `q`. No SLA
 * on the row (CONTRACT-GAP admin.claims — `slaDueAt` is U2.5).
 */
export const claimsList = defineList<Claim>({
  key: "claim",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/claims", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.claimNo,
  defaults: { filterKeys: ["status", "type", "origin", "customerId", "factoryId"] },
  staleTime: STALE_TIME.live,
});
