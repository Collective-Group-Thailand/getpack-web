import { defineStatusMap } from "./types";
import type { PayableStatus, PayoutStatus } from "./contract";

/** A payout run: Finance proposes, C-Level approves (D-022, D-166). */
export const PAYOUT_STATUS = defineStatusMap<PayoutStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "payout.draft" },
  proposed: { tone: "info", icon: "send", labelKey: "payout.proposed" },
  pending_approval: { tone: "warning", icon: "hourglass", labelKey: "payout.pendingApproval" },
  approved: { tone: "info", icon: "check", labelKey: "payout.approved" },
  file_generated: { tone: "info", icon: "spreadsheet", labelKey: "payout.fileGenerated" },
  sent: { tone: "primary", icon: "send", labelKey: "payout.sent" },
  confirmed: { tone: "success", icon: "wallet", labelKey: "payout.confirmed" },
  partially_failed: { tone: "danger", icon: "warning", labelKey: "payout.partiallyFailed" },
  posted: { tone: "success", icon: "file-check", labelKey: "payout.posted" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "payout.cancelled" },
});

/** Money owed to a factory, before it joins a run (D-022). */
export const PAYABLE_STATUS = defineStatusMap<PayableStatus>({
  open: { tone: "neutral", icon: "clock", labelKey: "payable.open" },
  eligible: { tone: "info", icon: "check", labelKey: "payable.eligible" },
  in_run: { tone: "primary", icon: "layers", labelKey: "payable.inRun" },
  paid: { tone: "success", icon: "wallet", labelKey: "payable.paid" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "payable.cancelled" },
});
