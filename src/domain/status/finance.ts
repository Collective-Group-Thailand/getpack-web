import { defineStatusMap } from "./types";
import type { CreditNoteRequestStatus, DunningStatus, ReceivableStatus, WhtCertificateStatus } from "./contract";

/** An open item of customer AR (accounting-design §6). */
export const RECEIVABLE_STATUS = defineStatusMap<ReceivableStatus>({
  open: { tone: "info", icon: "receipt", labelKey: "receivable.open" },
  partially_paid: { tone: "warning", icon: "coins", labelKey: "receivable.partiallyPaid" },
  paid: { tone: "success", icon: "check", labelKey: "receivable.paid" },
  written_off: { tone: "neutral", icon: "archive", labelKey: "receivable.writtenOff" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "receivable.cancelled" },
});

/** A customer's 50 ทวิ for tax withheld from a payment (accounting-design §2). */
export const WHT_CERTIFICATE_STATUS = defineStatusMap<WhtCertificateStatus>({
  pending: { tone: "warning", icon: "hourglass", labelKey: "whtCertificate.pending" },
  received: { tone: "success", icon: "file-check", labelKey: "whtCertificate.received" },
  waived: { tone: "neutral", icon: "minus", labelKey: "whtCertificate.waived" },
});

/** A credit note asked for: issued only once a Finance Manager approves (D-169, §8). */
export const CREDIT_NOTE_REQUEST_STATUS = defineStatusMap<CreditNoteRequestStatus>({
  pending_approval: { tone: "warning", icon: "hourglass", labelKey: "creditNoteRequest.pendingApproval" },
  issued: { tone: "success", icon: "file-check", labelKey: "creditNoteRequest.issued" },
  rejected: { tone: "danger", icon: "ban", labelKey: "creditNoteRequest.rejected" },
  withdrawn: { tone: "neutral", icon: "undo", labelKey: "creditNoteRequest.withdrawn" },
});

/** A payment reminder (D-122). */
export const DUNNING_STATUS = defineStatusMap<DunningStatus>({
  sent: { tone: "success", icon: "send", labelKey: "dunning.sent" },
  failed: { tone: "danger", icon: "warning", labelKey: "dunning.failed" },
});
