import { defineStatusMap } from "./types";
import type {
  BankMatchStatus,
  CreditNoteRequestStatus,
  DunningStatus,
  PayoutRunStatus,
  PurchaseOrderStatus,
  ReceivableStatus,
  SettlementStatus,
  UnidentifiedReceiptStatus,
  VendorBillStatus,
  WhtCertificateStatus,
} from "./contract";

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

/** A factory purchase order (§6). */
export const PURCHASE_ORDER_STATUS = defineStatusMap<PurchaseOrderStatus>({
  issued: { tone: "neutral", icon: "send", labelKey: "purchaseOrder.issued" },
  accepted: { tone: "info", icon: "handshake", labelKey: "purchaseOrder.accepted" },
  received: { tone: "primary", icon: "package-check", labelKey: "purchaseOrder.received" },
  closed: { tone: "success", icon: "check", labelKey: "purchaseOrder.closed" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "purchaseOrder.cancelled" },
});

/** A payout run: Finance proposes, a C-Level other than the proposer approves (D-022, D-166). */
export const PAYOUT_RUN_STATUS = defineStatusMap<PayoutRunStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "payoutRun.draft" },
  proposed: { tone: "warning", icon: "hourglass", labelKey: "payoutRun.proposed" },
  approved: { tone: "info", icon: "stamp", labelKey: "payoutRun.approved" },
  file_generated: { tone: "primary", icon: "spreadsheet", labelKey: "payoutRun.fileGenerated" },
  confirmed: { tone: "success", icon: "wallet", labelKey: "payoutRun.confirmed" },
  partially_failed: { tone: "danger", icon: "warning", labelKey: "payoutRun.partiallyFailed" },
  rejected: { tone: "danger", icon: "ban", labelKey: "payoutRun.rejected" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "payoutRun.cancelled" },
});

/** A tax invoice or vendor bill as recorded (§2). */
export const VENDOR_BILL_STATUS = defineStatusMap<VendorBillStatus>({
  recorded: { tone: "warning", icon: "hourglass", labelKey: "vendorBill.recorded" },
  validated: { tone: "success", icon: "check", labelKey: "vendorBill.validated" },
  rejected: { tone: "danger", icon: "ban", labelKey: "vendorBill.rejected" },
  void: { tone: "neutral", icon: "archive", labelKey: "vendorBill.void" },
});

/** A bank statement line (§6). */
export const BANK_MATCH_STATUS = defineStatusMap<BankMatchStatus>({
  unmatched: { tone: "warning", icon: "help", labelKey: "bankMatch.unmatched" },
  matched: { tone: "success", icon: "link", labelKey: "bankMatch.matched" },
  unidentified: { tone: "info", icon: "inbox", labelKey: "bankMatch.unidentified" },
  ignored: { tone: "neutral", icon: "minus", labelKey: "bankMatch.ignored" },
});

/** A gateway settlement (P04). */
export const SETTLEMENT_STATUS = defineStatusMap<SettlementStatus>({
  imported: { tone: "warning", icon: "hourglass", labelKey: "settlement.imported" },
  posted: { tone: "success", icon: "file-check", labelKey: "settlement.posted" },
});

/** Money nobody has claimed yet (P29). */
export const UNIDENTIFIED_RECEIPT_STATUS = defineStatusMap<UnidentifiedReceiptStatus>({
  open: { tone: "warning", icon: "help", labelKey: "unidentifiedReceipt.open" },
  matched: { tone: "success", icon: "link", labelKey: "unidentifiedReceipt.matched" },
  refunded: { tone: "neutral", icon: "reset", labelKey: "unidentifiedReceipt.refunded" },
});
