import { defineStatusMap } from "./types";
import type { PaymentStatus } from "./contract";

/** A payment against an order (source: legacy `payment_status`, extended — see `./contract.ts`). */
export const PAYMENT_STATUS = defineStatusMap<PaymentStatus>({
  pending: { tone: "warning", icon: "clock", labelKey: "payment.pending" },
  awaiting_verification: { tone: "info", icon: "hourglass", labelKey: "payment.awaitingVerification" },
  paid: { tone: "success", icon: "check", labelKey: "payment.paid" },
  // Distinct from "pending": something was attempted and refused, so the next action is the
  // customer's, not the clock's.
  failed: { tone: "danger", icon: "error", labelKey: "payment.failed" },
  refunded: { tone: "neutral", icon: "refresh", labelKey: "payment.refunded" },
});
