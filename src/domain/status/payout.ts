import { defineStatusMap } from "./types";
import type { PayoutStatus } from "./contract";

/** Money owed to a factory (proposed — see `./contract.ts`; D-022 schedule, D-093 bank files). */
export const PAYOUT_STATUS = defineStatusMap<PayoutStatus>({
  scheduled: { tone: "neutral", icon: "clock", labelKey: "payout.scheduled" },
  pending_approval: { tone: "warning", icon: "hourglass", labelKey: "payout.pendingApproval" },
  approved: { tone: "info", icon: "check", labelKey: "payout.approved" },
  processing: { tone: "primary", icon: "refresh", labelKey: "payout.processing" },
  paid: { tone: "success", icon: "wallet", labelKey: "payout.paid" },
  failed: { tone: "danger", icon: "error", labelKey: "payout.failed" },
  on_hold: { tone: "warning", icon: "pause", labelKey: "payout.onHold" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "payout.cancelled" },
});
