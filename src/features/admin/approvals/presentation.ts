/**
 * How an approval request reads. The approvals engine is generic (ADR-0006): a request carries a
 * policy key and a `payload` frozen at request time. The engine decides who approves; this only
 * decides how the frozen facts are laid out for the person deciding.
 */

import type { Schemas } from "@/lib/api/types";
import type { IconName } from "@/ui/icons";

export type Approval = Schemas["ApprovalRequestDto"];

/** The policies packio-api seeds (`prisma/seed/data/approval-policies.ts`), with an icon each. */
export const POLICY_ICONS: Record<string, IconName> = {
  discount_memo: "percent",
  credit_limit: "credit-card",
  payout_run: "wallet",
  price_proposal: "scale",
  partner_activation: "handshake",
  partner_pricing_mode_change: "factory",
  vendor_bank_account_change: "building",
  company_bank_account_change: "building",
  manual_journal: "document",
  recurring_journal: "calendar",
  credit_note: "receipt",
  refund: "reset",
  write_off: "trash",
  posting_rule_change: "settings",
  coa_change: "settings",
  tax_setting_change: "settings",
  document_series_change: "hash",
  company_order_approval: "cart",
  referral_review: "gift",
};

/**
 * Payload keys the UI knows how to format. Money and percentages are decimal strings formatted
 * without arithmetic; a key not listed here is shown exactly as stored, never guessed at.
 */
export const PAYLOAD_KINDS: Record<string, "money" | "percent" | "number" | "text" | "code"> = {
  orderValue: "money",
  currentLimit: "money",
  requestedLimit: "money",
  requestedPct: "percent",
  resultingMarginPct: "percent",
  maxDeviationPct: "percent",
  paidOrders: "number",
  termDays: "number",
  factories: "number",
  items: "number",
  lines: "number",
  quoteCode: "code",
  orderCode: "code",
  runCode: "code",
  proposalCode: "code",
  accountLast4: "code",
  customerName: "text",
  companyName: "text",
  factoryName: "text",
  vendorName: "text",
  bank: "text",
  reason: "text",
  totalDebit: "money",
  description: "text",
  documentDate: "text",
  reverses: "code",
  rule: "code",
  versionNo: "number",
  effectiveFrom: "text",
  accountCode: "code",
  kind: "text",
  dayOfMonth: "number",
  name: "text",
  ratePct: "percent",
  code: "code",
};

/** Flags the engine sets that the decider must not miss, in the order they matter. */
export const CRITICAL_FLAGS = new Set(["below_margin_floor"]);

export function currentStep(approval: Approval): Schemas["ApprovalStepDto"] | undefined {
  return approval.steps.find((step) => step.stepNo === approval.currentStepNo);
}

/**
 * Why this person may not decide, when that can be said from the request itself — a hint, not
 * the rule: the API enforces maker-checker and may refuse for reasons this cannot see
 * (delegations, SoD action pairs).
 */
export function decisionBlocker(
  approval: Approval,
  actorId: string,
): "not_pending" | "own_request" | "already_acted" | null {
  if (approval.status !== "pending") return "not_pending";
  if (approval.requester.id === actorId) return "own_request";
  if (approval.actions.some((action) => action.actor.id === actorId && action.action === "approve"))
    return "already_acted";
  return null;
}
