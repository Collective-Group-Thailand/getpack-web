import { defineStatusMap } from "./types";
import type { InstalmentStatus } from "./contract";

/** One instalment of an order's schedule (proposed — see `./contract.ts`). */
export const INSTALMENT_STATUS = defineStatusMap<InstalmentStatus>({
  scheduled: { tone: "neutral", icon: "clock", labelKey: "instalment.scheduled" },
  due: { tone: "warning", icon: "credit-card", labelKey: "instalment.due" },
  overdue: { tone: "danger", icon: "warning", labelKey: "instalment.overdue" },
  paid: { tone: "success", icon: "check", labelKey: "instalment.paid" },
  waived: { tone: "info", icon: "info", labelKey: "instalment.waived" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "instalment.cancelled" },
});
