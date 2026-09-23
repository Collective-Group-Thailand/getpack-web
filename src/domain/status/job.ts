import { defineStatusMap } from "./types";
import type { JobStatus } from "./contract";

/** A production job at a partner factory (proposed — see `./contract.ts`; D-074, D-075, D-076). */
export const JOB_STATUS = defineStatusMap<JobStatus>({
  pending_acceptance: { tone: "warning", icon: "clock", labelKey: "job.pendingAcceptance" },
  accepted: { tone: "info", icon: "check", labelKey: "job.accepted" },
  rejected: { tone: "danger", icon: "ban", labelKey: "job.rejected" },
  in_production: { tone: "primary", icon: "factory", labelKey: "job.inProduction" },
  awaiting_qc: { tone: "info", icon: "clipboard-check", labelKey: "job.awaitingQc" },
  ready_to_ship: { tone: "primary", icon: "package", labelKey: "job.readyToShip" },
  shipped: { tone: "primary", icon: "truck", labelKey: "job.shipped" },
  completed: { tone: "success", icon: "success", labelKey: "job.completed" },
  on_hold: { tone: "warning", icon: "pause", labelKey: "job.onHold" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "job.cancelled" },
});
