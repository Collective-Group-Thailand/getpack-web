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
  in_production: { tone: "primary", icon: "layers", labelKey: "customerOrder.inProduction" },
  shipping: { tone: "info", icon: "truck", labelKey: "customerOrder.shipping" },
  received: { tone: "info", icon: "package-check", labelKey: "customerOrder.received" },
  claim_in_review: { tone: "warning", icon: "eye", labelKey: "customerOrder.claimInReview" },
  completed: { tone: "success", icon: "success", labelKey: "customerOrder.completed" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "customerOrder.cancelled" },
});

/** The six stages of the orders list's tracker (account pack Phase 2): ชำระเงิน → ไฟล์งาน → อนุมัติแบบ → ผลิต → จัดส่ง → รับของ. */
export const ORDER_STAGES = ["payment", "artwork", "approval", "production", "delivery", "receipt"] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

/**
 * Where each customer status stands on the tracker: the index of the current stage (every stage before it is
 * done), `ORDER_STAGES.length` when all six are done, `null` for none (cancelled). A reading of the API's status,
 * never a status of its own.
 */
export const CUSTOMER_ORDER_STAGE: Record<CustomerOrderStatus, number | null> = {
  awaiting_payment: 0,
  awaiting_artwork: 1,
  awaiting_approval: 2,
  in_production: 3,
  shipping: 4,
  received: 6,
  claim_in_review: 6,
  completed: 6,
  cancelled: null,
};
