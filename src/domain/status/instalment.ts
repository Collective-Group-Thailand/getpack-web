import { defineStatusMap } from "./types";
import type { InstalmentStatus } from "./contract";

/** One instalment of an order group's payment schedule (D-020, D-122). */
export const INSTALMENT_STATUS = defineStatusMap<InstalmentStatus>({
  pending: { tone: "neutral", icon: "clock", labelKey: "instalment.pending" },
  due: { tone: "warning", icon: "clock", labelKey: "instalment.due" },
  partially_paid: { tone: "warning", icon: "wallet", labelKey: "instalment.partiallyPaid" },
  paid: { tone: "success", icon: "check", labelKey: "instalment.paid" },
  overdue: { tone: "danger", icon: "warning", labelKey: "instalment.overdue" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "instalment.cancelled" },
  refunded: { tone: "neutral", icon: "reset", labelKey: "instalment.refunded" },
});
