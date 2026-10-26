import type { CustomerOrderStatus } from "./contract";
import { defineStatusMap } from "./types";

/**
 * The one status a customer reads on an order, everywhere (D-437): overview, list, detail. The API
 * derives it (`OrderDto.customerStatus`) from payment, artwork, production, shipping, receipt and
 * open claims; this only gives each value its tone, icon and words — it never derives one.
 */
export const CUSTOMER_ORDER_STATUS = defineStatusMap<CustomerOrderStatus>({
  awaiting_payment: { tone: "warning", icon: "clock", labelKey: "customerOrder.awaitingPayment" },
  awaiting_artwork: { tone: "warning", icon: "upload", labelKey: "customerOrder.awaitingArtwork" },
  awaiting_approval: { tone: "primary", icon: "stamp", labelKey: "customerOrder.awaitingApproval" },
  in_production: { tone: "primary", icon: "factory", labelKey: "customerOrder.inProduction" },
  shipping: { tone: "primary", icon: "truck", labelKey: "customerOrder.shipping" },
  received: { tone: "info", icon: "package-check", labelKey: "customerOrder.received" },
  claim_in_review: { tone: "warning", icon: "eye", labelKey: "customerOrder.claimInReview" },
  completed: { tone: "success", icon: "success", labelKey: "customerOrder.completed" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "customerOrder.cancelled" },
});
