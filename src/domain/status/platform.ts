import { defineStatusMap } from "./types";
import type {
  ApprovalStatus,
  ApprovalStepStatus,
  AuditOutcome,
  ConfigVersionStatus,
  OpsSignalStatus,
  FileScanStatus,
  SettingConfirmation,
  UserStatus,
} from "./contract";

/** A request in the generic approvals engine (ADR-0006). */
export const APPROVAL_STATUS = defineStatusMap<ApprovalStatus>({
  pending: { tone: "warning", icon: "hourglass", labelKey: "approval.pending" },
  approved: { tone: "success", icon: "check", labelKey: "approval.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "approval.rejected" },
  withdrawn: { tone: "neutral", icon: "undo", labelKey: "approval.withdrawn" },
  expired: { tone: "neutral", icon: "clock", labelKey: "approval.expired" },
});

/** One step of an approval request. */
export const APPROVAL_STEP_STATUS = defineStatusMap<ApprovalStepStatus>({
  pending: { tone: "warning", icon: "hourglass", labelKey: "approvalStep.pending" },
  approved: { tone: "success", icon: "check", labelKey: "approvalStep.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "approvalStep.rejected" },
  skipped: { tone: "neutral", icon: "minus", labelKey: "approvalStep.skipped" },
  expired: { tone: "neutral", icon: "clock", labelKey: "approvalStep.expired" },
});

/** A staff, partner or customer account. */
export const USER_STATUS = defineStatusMap<UserStatus>({
  pending_verification: { tone: "warning", icon: "mail", labelKey: "user.pendingVerification" },
  active: { tone: "success", icon: "check", labelKey: "user.active" },
  suspended: { tone: "danger", icon: "lock", labelKey: "user.suspended" },
  inactive: { tone: "neutral", icon: "pause", labelKey: "user.inactive" },
});

/** A version of an effective-dated setting (ADR-0005, D-063). */
export const SETTING_VERSION_STATUS = defineStatusMap<ConfigVersionStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "settingVersion.draft" },
  proposed: { tone: "info", icon: "send", labelKey: "settingVersion.proposed" },
  pending_acceptance: { tone: "warning", icon: "hourglass", labelKey: "settingVersion.pendingAcceptance" },
  approved: { tone: "success", icon: "check", labelKey: "settingVersion.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "settingVersion.rejected" },
  withdrawn: { tone: "neutral", icon: "undo", labelKey: "settingVersion.withdrawn" },
});

/** Whether a decision-backed value is confirmed or still awaiting sign-off (the ⚖ items). */
export const SETTING_CONFIRMATION_STATUS = defineStatusMap<SettingConfirmation>({
  confirmed: { tone: "success", icon: "check", labelKey: "settingConfirmation.confirmed" },
  proposed: { tone: "warning", icon: "help", labelKey: "settingConfirmation.proposed" },
  pending_cpa: { tone: "warning", icon: "scale", labelKey: "settingConfirmation.pendingCpa" },
  pending_business: { tone: "warning", icon: "hourglass", labelKey: "settingConfirmation.pendingBusiness" },
});

/** The outcome recorded for an audited action. */
export const AUDIT_OUTCOME_STATUS = defineStatusMap<AuditOutcome>({
  success: { tone: "success", icon: "check", labelKey: "auditOutcome.success" },
  denied: { tone: "warning", icon: "lock", labelKey: "auditOutcome.denied" },
  failure: { tone: "danger", icon: "error", labelKey: "auditOutcome.failure" },
});

/** The malware scan of an uploaded file; only `clean` downloads. */
export const FILE_SCAN_STATUS = defineStatusMap<FileScanStatus>({
  pending: { tone: "neutral", icon: "clock", labelKey: "fileScan.pending" },
  clean: { tone: "success", icon: "shield", labelKey: "fileScan.clean" },
  infected: { tone: "danger", icon: "shield-alert", labelKey: "fileScan.infected" },
  failed: { tone: "danger", icon: "error", labelKey: "fileScan.failed" },
  skipped: { tone: "neutral", icon: "minus", labelKey: "fileScan.skipped" },
});

/** A launch-monitoring signal (`admin.ops.signals`, B6.3): within, over or unread against its threshold. */
export const OPS_SIGNAL_STATUS = defineStatusMap<OpsSignalStatus>({
  ok: { tone: "success", icon: "check", labelKey: "opsSignal.ok" },
  alert: { tone: "danger", icon: "shield-alert", labelKey: "opsSignal.alert" },
  unknown: { tone: "warning", icon: "help", labelKey: "opsSignal.unknown" },
});
