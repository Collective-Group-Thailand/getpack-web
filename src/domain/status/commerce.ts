import { defineStatusMap } from "./types";
import type {
  CompanyStatus,
  CreditStatus,
  MemoStatus,
  OrderGroupStatus,
  QuoteStatus,
  RefundStatus,
  SlipStatus,
} from "./contract";

/** One checkout: a group of orders with one payment schedule (B3.1). */
export const ORDER_GROUP_STATUS = defineStatusMap<OrderGroupStatus>({
  pending_company_approval: { tone: "warning", icon: "stamp", labelKey: "orderGroup.pendingCompanyApproval" },
  waiting_payment: { tone: "warning", icon: "clock", labelKey: "orderGroup.waitingPayment" },
  in_progress: { tone: "primary", icon: "refresh", labelKey: "orderGroup.inProgress" },
  completed: { tone: "success", icon: "success", labelKey: "orderGroup.completed" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "orderGroup.cancelled" },
});

/** A bank-transfer slip: verified automatically, only failures reach Finance (D-061). */
export const SLIP_STATUS = defineStatusMap<SlipStatus>({
  pending: { tone: "neutral", icon: "clock", labelKey: "slip.pending" },
  passed: { tone: "success", icon: "check", labelKey: "slip.passed" },
  failed: { tone: "danger", icon: "error", labelKey: "slip.failed" },
  manual_review: { tone: "warning", icon: "eye", labelKey: "slip.manualReview" },
  manual_approved: { tone: "success", icon: "stamp", labelKey: "slip.manualApproved" },
  manual_rejected: { tone: "danger", icon: "ban", labelKey: "slip.manualRejected" },
});

/** A refund, which needs approval (B3.2, D-169). */
export const REFUND_STATUS = defineStatusMap<RefundStatus>({
  requested: { tone: "info", icon: "send", labelKey: "refund.requested" },
  pending_approval: { tone: "warning", icon: "hourglass", labelKey: "refund.pendingApproval" },
  approved: { tone: "info", icon: "check", labelKey: "refund.approved" },
  processing: { tone: "primary", icon: "refresh", labelKey: "refund.processing" },
  succeeded: { tone: "success", icon: "wallet", labelKey: "refund.succeeded" },
  failed: { tone: "danger", icon: "error", labelKey: "refund.failed" },
  rejected: { tone: "neutral", icon: "ban", labelKey: "refund.rejected" },
});

/** A saved instant or CS quote, valid 15 days with the price locked (D-051). */
export const QUOTE_STATUS = defineStatusMap<QuoteStatus>({
  calculated: { tone: "neutral", icon: "calculator", labelKey: "quote.calculated" },
  saved: { tone: "info", icon: "save", labelKey: "quote.saved" },
  shared: { tone: "primary", icon: "link", labelKey: "quote.shared" },
  converted: { tone: "success", icon: "check", labelKey: "quote.converted" },
  expired: { tone: "neutral", icon: "hourglass", labelKey: "quote.expired" },
  superseded: { tone: "neutral", icon: "history", labelKey: "quote.superseded" },
});

/** A discount memo, above the CS limit (D-052, D-162). */
export const MEMO_STATUS = defineStatusMap<MemoStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "memo.draft" },
  pending_approval: { tone: "warning", icon: "hourglass", labelKey: "memo.pendingApproval" },
  approved: { tone: "success", icon: "check", labelKey: "memo.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "memo.rejected" },
  withdrawn: { tone: "neutral", icon: "undo", labelKey: "memo.withdrawn" },
  expired: { tone: "neutral", icon: "clock", labelKey: "memo.expired" },
  applied: { tone: "success", icon: "receipt", labelKey: "memo.applied" },
});

/** A B2B company account (D-120). */
export const COMPANY_STATUS = defineStatusMap<CompanyStatus>({
  applied: { tone: "info", icon: "inbox", labelKey: "company.applied" },
  kyc_review: { tone: "warning", icon: "eye", labelKey: "company.kycReview" },
  active: { tone: "success", icon: "check", labelKey: "company.active" },
  suspended: { tone: "danger", icon: "pause", labelKey: "company.suspended" },
  closed: { tone: "neutral", icon: "archive", labelKey: "company.closed" },
});

/** A company's credit standing (D-121, D-122). */
export const CREDIT_STATUS = defineStatusMap<CreditStatus>({
  prepaid: { tone: "neutral", icon: "wallet", labelKey: "credit.prepaid" },
  eligible: { tone: "info", icon: "star", labelKey: "credit.eligible" },
  credit: { tone: "success", icon: "credit-card", labelKey: "credit.credit" },
  blocked_overdue: { tone: "danger", icon: "lock", labelKey: "credit.blockedOverdue" },
});
