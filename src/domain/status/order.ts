import { defineStatusMap } from "./types";
import type { OrderStatus } from "./contract";

/**
 * How an order's status reads and looks, in every zone (source: legacy `order_status` — see
 * `./contract.ts` for provenance).
 *
 * A customer, a CS agent and an export all read the same row of this table, which is the
 * point: "รอตรวจสอบการชำระเงิน" must not become "รอสลิป" because a different screen wrote its
 * own copy.
 */
export const ORDER_STATUS = defineStatusMap<OrderStatus>({
  waiting_payment: { tone: "warning", icon: "clock", labelKey: "order.waitingPayment" },
  // The customer has paid and uploaded a slip; Finance (or the slip-verification adapter,
  // D-061) has not confirmed it yet. Not a warning to the customer — they have done their part.
  waiting_payment_review: { tone: "info", icon: "hourglass", labelKey: "order.waitingPaymentReview" },
  paid: { tone: "success", icon: "check", labelKey: "order.paid" },
  in_production: { tone: "primary", icon: "factory", labelKey: "order.inProduction" },
  shipping: { tone: "primary", icon: "truck", labelKey: "order.shipping" },
  completed: { tone: "success", icon: "success", labelKey: "order.completed" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "order.cancelled" },
});
