import { defineStatusMap } from "./types";
import type { ShipmentStatus } from "./contract";

/** A delivery — by the factory's own fleet with mandatory POD, or a fallback carrier (D-013, D-114). */
export const SHIPMENT_STATUS = defineStatusMap<ShipmentStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "shipment.draft" },
  ready: { tone: "info", icon: "package", labelKey: "shipment.ready" },
  picked_up: { tone: "primary", icon: "truck", labelKey: "shipment.pickedUp" },
  in_transit: { tone: "primary", icon: "route", labelKey: "shipment.inTransit" },
  out_for_delivery: { tone: "primary", icon: "map-pin", labelKey: "shipment.outForDelivery" },
  delivered: { tone: "success", icon: "package-check", labelKey: "shipment.delivered" },
  failed: { tone: "danger", icon: "error", labelKey: "shipment.failed" },
  returned: { tone: "warning", icon: "undo", labelKey: "shipment.returned" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "shipment.cancelled" },
});
