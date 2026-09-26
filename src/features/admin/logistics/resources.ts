/** The logistics and claims lists and types, in a plain module so Server Components can prefetch. */

import type { z } from "zod";

import type {
  carrierQuote,
  claimDetail,
  claimRow,
  shipmentDetail,
  shipmentRow,
} from "@/lib/api/requests/admin-logistics";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type ShipmentRow = z.output<typeof shipmentRow>;
export type Shipment = z.output<typeof shipmentDetail>;
export type CarrierQuote = z.output<typeof carrierQuote>;
export type ClaimRow = z.output<typeof claimRow>;
export type Claim = z.output<typeof claimDetail>;

export const SHIPMENT_QUEUES = ["awaiting_pickup", "in_transit", "exceptions", "pod_review"] as const;
export const CLAIM_STATUSES = [
  "submitted",
  "under_review",
  "need_info",
  "factory_review",
  "approved",
  "rejected",
  "resolved",
  "closed",
] as const;

export const shipmentsList = defineList<ShipmentRow>({
  key: "shipment",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/shipments", { query: query as never }),
  getRowId: (row) => row.id,
  getRowName: (row) => row.shipmentNo,
  defaults: { filterKeys: ["queue", "status", "carrier", "factoryId"] },
  staleTime: STALE_TIME.live,
});

export const claimsList = defineList<ClaimRow>({
  key: "claim",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/claims", { query: query as never }),
  getRowId: (row) => row.id,
  getRowName: (row) => row.claimNo,
  defaults: { filterKeys: ["status", "type", "origin"] },
  staleTime: STALE_TIME.live,
});
