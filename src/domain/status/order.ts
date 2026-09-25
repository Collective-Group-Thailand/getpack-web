import { defineStatusMap } from "./types";
import type { OrderStatus } from "./contract";

/** A customer order (one configuration). Driven by facts — instalments, artwork, jobs, shipments — not set by hand (B3.1). */
export const ORDER_STATUS = defineStatusMap<OrderStatus>({
  waiting_payment: { tone: "warning", icon: "clock", labelKey: "order.waitingPayment" },
  paid_for_production: { tone: "info", icon: "wallet", labelKey: "order.paidForProduction" },
  artwork_approved: { tone: "info", icon: "file-check", labelKey: "order.artworkApproved" },
  in_production: { tone: "primary", icon: "factory", labelKey: "order.inProduction" },
  shipping: { tone: "primary", icon: "truck", labelKey: "order.shipping" },
  completed: { tone: "success", icon: "success", labelKey: "order.completed" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "order.cancelled" },
});
