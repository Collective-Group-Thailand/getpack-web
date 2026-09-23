import { defineStatusMap } from "./types";
import type { ShipmentStatus } from "./contract";

/**
 * A delivery, whether the factory's own fleet or a carrier (proposed — see `./contract.ts`).
 *
 * D-013 makes the producing factory the usual shipper and D-114 adds a carrier fallback, so
 * one vocabulary has to fit both a van and a parcel network.
 */
export const SHIPMENT_STATUS = defineStatusMap<ShipmentStatus>({
  pending: { tone: "neutral", icon: "clock", labelKey: "shipment.pending" },
  booked: { tone: "info", icon: "check", labelKey: "shipment.booked" },
  picked_up: { tone: "info", icon: "package", labelKey: "shipment.pickedUp" },
  in_transit: { tone: "primary", icon: "truck", labelKey: "shipment.inTransit" },
  out_for_delivery: { tone: "primary", icon: "truck", labelKey: "shipment.outForDelivery" },
  delivered: { tone: "success", icon: "package-check", labelKey: "shipment.delivered" },
  failed: { tone: "danger", icon: "error", labelKey: "shipment.failed" },
  returned: { tone: "warning", icon: "refresh", labelKey: "shipment.returned" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "shipment.cancelled" },
});
