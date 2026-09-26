import { defineStatusMap } from "./types";
import type { JobStatus } from "./contract";

/** A production job at a partner factory: accept within 1 business day (D-074). Lateness is a property the API reports beside the status, not a status. */
export const JOB_STATUS = defineStatusMap<JobStatus>({
  released: { tone: "warning", icon: "hourglass", labelKey: "job.released" },
  accepted: { tone: "info", icon: "check", labelKey: "job.accepted" },
  rejected: { tone: "danger", icon: "ban", labelKey: "job.rejected" },
  in_progress: { tone: "primary", icon: "factory", labelKey: "job.inProgress" },
  on_hold: { tone: "warning", icon: "pause", labelKey: "job.onHold" },
  completed: { tone: "success", icon: "package-check", labelKey: "job.completed" },
  cancelled: { tone: "neutral", icon: "close", labelKey: "job.cancelled" },
});
