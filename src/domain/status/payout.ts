import { defineStatusMap } from "./types";
import type {
  BillingStatementStatus,
  FactoryUserStatus,
  InputVatStatus,
  PayableStatus,
  PayoutItemStatus,
  PayoutStatus,
  VendorInvoiceStatus,
} from "./contract";

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

/** A billing statement Packio generates from PO + POD for the factory to confirm (D-090). */
export const BILLING_STATEMENT_STATUS = defineStatusMap<BillingStatementStatus>({
  generated: { tone: "neutral", icon: "document", labelKey: "billingStatement.generated" },
  sent: { tone: "warning", icon: "send", labelKey: "billingStatement.sent" },
  confirmed: { tone: "success", icon: "check", labelKey: "billingStatement.confirmed" },
  disputed: { tone: "danger", icon: "flag", labelKey: "billingStatement.disputed" },
  superseded: { tone: "neutral", icon: "history", labelKey: "billingStatement.superseded" },
});

/** The factory's tax invoice as Finance checks it (accounting-design §2). */
export const VENDOR_INVOICE_STATUS = defineStatusMap<VendorInvoiceStatus>({
  submitted: { tone: "info", icon: "hourglass", labelKey: "vendorInvoice.submitted" },
  validated: { tone: "success", icon: "check", labelKey: "vendorInvoice.validated" },
  rejected: { tone: "danger", icon: "ban", labelKey: "vendorInvoice.rejected" },
});

/** Input VAT on the factory's bill: claimable only with a valid tax invoice (accounting-design §2). */
export const INPUT_VAT_STATUS = defineStatusMap<InputVatStatus>({
  claimable: { tone: "success", icon: "check", labelKey: "inputVat.claimable" },
  pending_document: { tone: "warning", icon: "document", labelKey: "inputVat.pendingDocument" },
  not_claimable: { tone: "neutral", icon: "minus", labelKey: "inputVat.notClaimable" },
});

/** One payout to a factory (D-022). */
export const PAYOUT_ITEM_STATUS = defineStatusMap<PayoutItemStatus>({
  included: { tone: "info", icon: "hourglass", labelKey: "payoutItem.included" },
  paid: { tone: "success", icon: "check", labelKey: "payoutItem.paid" },
  failed: { tone: "danger", icon: "warning", labelKey: "payoutItem.failed" },
  excluded: { tone: "neutral", icon: "minus", labelKey: "payoutItem.excluded" },
});

/** A factory's user, as the owner manages them (D-140). */
export const FACTORY_USER_STATUS = defineStatusMap<FactoryUserStatus>({
  invited: { tone: "info", icon: "mail", labelKey: "factoryUser.invited" },
  active: { tone: "success", icon: "check", labelKey: "factoryUser.active" },
  deactivated: { tone: "neutral", icon: "pause", labelKey: "factoryUser.deactivated" },
});
