import { defineStatusMap } from "./types";
import type { PaymentStatus } from "./contract";

/** One payment attempt against an instalment (B3.2, D-061). */
export const PAYMENT_STATUS = defineStatusMap<PaymentStatus>({
  initiated: { tone: "neutral", icon: "clock", labelKey: "payment.initiated" },
  pending: { tone: "warning", icon: "clock", labelKey: "payment.pending" },
  awaiting_verification: { tone: "info", icon: "hourglass", labelKey: "payment.awaitingVerification" },
  succeeded: { tone: "success", icon: "check", labelKey: "payment.succeeded" },
  failed: { tone: "danger", icon: "error", labelKey: "payment.failed" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "payment.cancelled" },
  expired: { tone: "neutral", icon: "hourglass", labelKey: "payment.expired" },
  refunded: { tone: "neutral", icon: "reset", labelKey: "payment.refunded" },
  partially_refunded: { tone: "warning", icon: "reset", labelKey: "payment.partiallyRefunded" },
});
