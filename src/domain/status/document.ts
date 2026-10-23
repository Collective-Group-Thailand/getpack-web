import { defineStatusMap } from "./types";
import type { DocumentCorrectionStatus, DocumentStatus, ETaxStatus, ETaxSubmissionStatus } from "./contract";

/** A customer document — tax invoice, receipt, credit note. A voided document keeps its number (accounting-design §5). */
export const DOCUMENT_STATUS = defineStatusMap<DocumentStatus>({
  issued: { tone: "success", icon: "file-check", labelKey: "document.issued" },
  void: { tone: "neutral", icon: "ban", labelKey: "document.void" },
});

/** e-Tax Invoice by Email of a tax document (D-430): queued, e-mailed to the buyer and ETDA, or failed. */
export const ETAX_STATUS = defineStatusMap<ETaxStatus>({
  not_applicable: { tone: "neutral", icon: "minus", labelKey: "eTax.not_applicable" },
  pending: { tone: "info", icon: "hourglass", labelKey: "eTax.pending" },
  submitted: { tone: "success", icon: "send", labelKey: "eTax.submitted" },
  accepted: { tone: "success", icon: "check", labelKey: "eTax.accepted" },
  rejected: { tone: "danger", icon: "ban", labelKey: "eTax.rejected" },
  failed: { tone: "danger", icon: "warning", labelKey: "eTax.failed" },
});

/** One e-Tax e-mail (D-430). */
export const ETAX_SUBMISSION_STATUS = defineStatusMap<ETaxSubmissionStatus>({
  queued: { tone: "info", icon: "hourglass", labelKey: "eTaxSubmission.queued" },
  sent: { tone: "success", icon: "send", labelKey: "eTaxSubmission.sent" },
  failed: { tone: "danger", icon: "warning", labelKey: "eTaxSubmission.failed" },
});

/** A correction request on a tax document (D-431). */
export const DOCUMENT_CORRECTION_STATUS = defineStatusMap<DocumentCorrectionStatus>({
  pending: { tone: "warning", icon: "hourglass", labelKey: "documentCorrection.pending" },
  approved: { tone: "success", icon: "check", labelKey: "documentCorrection.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "documentCorrection.rejected" },
  withdrawn: { tone: "neutral", icon: "undo", labelKey: "documentCorrection.withdrawn" },
});
