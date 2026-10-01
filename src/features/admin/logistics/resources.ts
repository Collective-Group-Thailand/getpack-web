/** The logistics and claims lists and types, in a plain module so Server Components can prefetch. */

import type { z } from "zod";

import type { carrierQuote } from "@/lib/api/requests/admin-logistics";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type Shipment = Schemas["AdminShipmentDto"];
export type Claim = Schemas["AdminClaimDto"];
/** A fallback carrier's price for one shipment (CONTRACT-REQUEST admin.shipments, carrier quotes). */
export type CarrierQuote = z.output<typeof carrierQuote>;

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
 * The logistics desk (`admin.shipments.list`). The published list filters by status, order and
 * `q` only — no queues (awaiting pick-up, exceptions, POD review), carrier or factory
 * (CONTRACT-GAP admin.shipments) — so the desk's tabs are the statuses.
 */
export const shipmentsList = defineList<Shipment>({
  key: "shipment",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/shipments", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.shipmentNo,
  defaults: { filterKeys: ["status"] },
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
