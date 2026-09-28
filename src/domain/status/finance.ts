import { defineStatusMap } from "./types";
import type {
  AssetStatus,
  BankMatchStatus,
  CreditNoteRequestStatus,
  DunningStatus,
  JournalStatus,
  PayoutRunStatus,
  PeriodStatus,
  PurchaseOrderStatus,
  ReceivableStatus,
  RecurringJournalStatus,
  SettlementStatus,
  TaxCalendarStatus,
  TaxReportStatus,
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

/** A journal entry: a manual one is drafted, checked by another person, then posted (§8). */
export const JOURNAL_STATUS = defineStatusMap<JournalStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "journal.draft" },
  pending_approval: { tone: "warning", icon: "hourglass", labelKey: "journal.pendingApproval" },
  posted: { tone: "success", icon: "check", labelKey: "journal.posted" },
  rejected: { tone: "danger", icon: "ban", labelKey: "journal.rejected" },
});

/** A fiscal period (§1.4): only an open one takes postings. */
export const PERIOD_STATUS = defineStatusMap<PeriodStatus>({
  open: { tone: "success", icon: "play", labelKey: "period.open" },
  soft_closed: { tone: "warning", icon: "hourglass", labelKey: "period.softClosed" },
  closed: { tone: "info", icon: "lock", labelKey: "period.closed" },
  locked: { tone: "neutral", icon: "lock", labelKey: "period.locked" },
});

/** A recurring journal definition (§8: approved once, posted every month). */
export const RECURRING_JOURNAL_STATUS = defineStatusMap<RecurringJournalStatus>({
  pending_approval: { tone: "warning", icon: "hourglass", labelKey: "recurringJournal.pendingApproval" },
  active: { tone: "success", icon: "calendar", labelKey: "recurringJournal.active" },
  paused: { tone: "neutral", icon: "pause", labelKey: "recurringJournal.paused" },
  ended: { tone: "neutral", icon: "archive", labelKey: "recurringJournal.ended" },
  rejected: { tone: "danger", icon: "ban", labelKey: "recurringJournal.rejected" },
});

/** A tax report or working paper (§7 step 7). */
export const TAX_REPORT_STATUS = defineStatusMap<TaxReportStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "taxReport.draft" },
  final: { tone: "info", icon: "lock", labelKey: "taxReport.final" },
  filed: { tone: "success", icon: "file-check", labelKey: "taxReport.filed" },
});

/** A return on the tax calendar (§6). */
export const TAX_CALENDAR_STATUS = defineStatusMap<TaxCalendarStatus>({
  open: { tone: "warning", icon: "calendar", labelKey: "taxCalendar.open" },
  done: { tone: "success", icon: "check", labelKey: "taxCalendar.done" },
});

/** A fixed asset (D-150). */
export const ASSET_STATUS = defineStatusMap<AssetStatus>({
  active: { tone: "success", icon: "package-check", labelKey: "asset.active" },
  fully_depreciated: { tone: "info", icon: "check", labelKey: "asset.fullyDepreciated" },
  disposed: { tone: "neutral", icon: "archive", labelKey: "asset.disposed" },
  written_off: { tone: "neutral", icon: "trash", labelKey: "asset.writtenOff" },
});
