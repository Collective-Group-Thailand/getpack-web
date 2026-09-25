import { defineStatusMap } from "./types";
import type { PodReviewStatus, ShipmentStatus } from "./contract";

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

/** The review of a proof of delivery (D-013). */
export const POD_REVIEW_STATUS = defineStatusMap<PodReviewStatus>({
  pending: { tone: "warning", icon: "eye", labelKey: "podReview.pending" },
  accepted: { tone: "success", icon: "check", labelKey: "podReview.accepted" },
  rejected: { tone: "danger", icon: "ban", labelKey: "podReview.rejected" },
});
