import { defineStatusMap } from "./types";
import type {
  JobIssueStatus,
  QcResult,
  DesignRoundStatus,
  DesignServiceStatus,
  DrawingStatus,
  InspectionStatus,
  MilestoneStatus,
  PreflightStatus,
  SubmissionStatus,
} from "./contract";

/** The automated preflight of an artwork submission: blocks on size or bleed, warns on resolution or RGB (D-070). */
export const PREFLIGHT_STATUS = defineStatusMap<PreflightStatus>({
  pending: { tone: "neutral", icon: "clock", labelKey: "preflight.pending" },
  running: { tone: "info", icon: "refresh", labelKey: "preflight.running" },
  passed: { tone: "success", icon: "check", labelKey: "preflight.passed" },
  passed_with_warnings: { tone: "warning", icon: "warning", labelKey: "preflight.passedWithWarnings" },
  blocked: { tone: "danger", icon: "ban", labelKey: "preflight.blocked" },
  error: { tone: "danger", icon: "error", labelKey: "preflight.error" },
});

/** One version of the artwork a customer submitted (B4.1). */
export const SUBMISSION_STATUS = defineStatusMap<SubmissionStatus>({
  submitted: { tone: "info", icon: "inbox", labelKey: "submission.submitted" },
  superseded: { tone: "neutral", icon: "history", labelKey: "submission.superseded" },
  accepted_for_proof: { tone: "success", icon: "check", labelKey: "submission.acceptedForProof" },
  rejected: { tone: "danger", icon: "ban", labelKey: "submission.rejected" },
});

/** Drawing a dieline with `@packio/dieline` (B4.1). */
export const DRAWING_STATUS = defineStatusMap<DrawingStatus>({
  queued: { tone: "neutral", icon: "clock", labelKey: "drawing.queued" },
  running: { tone: "info", icon: "refresh", labelKey: "drawing.running" },
  succeeded: { tone: "success", icon: "check", labelKey: "drawing.succeeded" },
  failed: { tone: "danger", icon: "error", labelKey: "drawing.failed" },
  engine_unavailable: { tone: "warning", icon: "warning", labelKey: "drawing.engineUnavailable" },
});

/** A hired design job: 3 free revision rounds, then paid (D-071). */
export const DESIGN_SERVICE_STATUS = defineStatusMap<DesignServiceStatus>({
  brief_pending: { tone: "warning", icon: "edit", labelKey: "designService.briefPending" },
  in_progress: { tone: "primary", icon: "palette", labelKey: "designService.inProgress" },
  delivered: { tone: "info", icon: "send", labelKey: "designService.delivered" },
  revision_requested: { tone: "warning", icon: "reset", labelKey: "designService.revisionRequested" },
  approved: { tone: "success", icon: "check", labelKey: "designService.approved" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "designService.cancelled" },
  requoted: { tone: "info", icon: "receipt", labelKey: "designService.requoted" },
});

/** One round of a hired design; a paid round waits for payment (D-071). */
export const DESIGN_ROUND_STATUS = defineStatusMap<DesignRoundStatus>({
  awaiting_payment: { tone: "warning", icon: "wallet", labelKey: "designRound.awaitingPayment" },
  in_progress: { tone: "primary", icon: "palette", labelKey: "designRound.inProgress" },
  delivered: { tone: "info", icon: "send", labelKey: "designRound.delivered" },
  approved: { tone: "success", icon: "check", labelKey: "designRound.approved" },
  changes_requested: { tone: "warning", icon: "edit", labelKey: "designRound.changesRequested" },
});

/** One stage of a job's route (D-075). */
export const MILESTONE_STATUS = defineStatusMap<MilestoneStatus>({
  pending: { tone: "neutral", icon: "clock", labelKey: "milestone.pending" },
  in_progress: { tone: "primary", icon: "refresh", labelKey: "milestone.inProgress" },
  completed: { tone: "success", icon: "check", labelKey: "milestone.completed" },
  skipped: { tone: "neutral", icon: "minus", labelKey: "milestone.skipped" },
});

/** A Packio QC inspection, chosen by risk-based sampling (D-076). */
export const INSPECTION_STATUS = defineStatusMap<InspectionStatus>({
  planned: { tone: "neutral", icon: "calendar", labelKey: "inspection.planned" },
  in_progress: { tone: "primary", icon: "eye", labelKey: "inspection.inProgress" },
  passed: { tone: "success", icon: "check", labelKey: "inspection.passed" },
  failed: { tone: "danger", icon: "error", labelKey: "inspection.failed" },
  waived: { tone: "neutral", icon: "minus", labelKey: "inspection.waived" },
});

/** The factory's own QC of a job, with photos (D-076). */
export const QC_RESULT = defineStatusMap<QcResult>({
  pass: { tone: "success", icon: "check", labelKey: "qcResult.pass" },
  conditional: { tone: "warning", icon: "warning", labelKey: "qcResult.conditional" },
  fail: { tone: "danger", icon: "ban", labelKey: "qcResult.fail" },
});

/** An issue a factory raised on a job; Packio sees it on the production board. */
export const JOB_ISSUE_STATUS = defineStatusMap<JobIssueStatus>({
  open: { tone: "warning", icon: "flag", labelKey: "jobIssue.open" },
  resolved: { tone: "success", icon: "check", labelKey: "jobIssue.resolved" },
});
