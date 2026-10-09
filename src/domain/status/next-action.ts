/**
 * How an action the API has offered is presented — never which actions exist.
 *
 * `00-master-plan.md` §4 and ADR-0005 put authorisation in one place: the API. A screen that
 * decides for itself that "an order in `paid` may start production" has copied a business rule
 * into the browser, where it will drift from the backend and eventually offer a button that
 * 409s. So every entity carries its own list — `nextActions` / `allowedActions` — and this
 * module's only job is turning a key the API sent into a label, a tone and an icon.
 *
 * The consequence worth stating: an action key this table does not know still renders, as its
 * own key with a neutral tone, because hiding an action the API said was available is worse
 * than showing one that reads awkwardly. `pnpm typecheck` cannot catch a missing entry here —
 * the keys are data, not a union — so the fallback is the safety net.
 *
 * Since contract v0.6.0 (`entity.next-actions`) the list is `NextActionDto[]` on orders, jobs, RFQs,
 * shipments, claims, billing statements, payout runs and customer documents. The keys are a plain
 * string in the contract, so `API_ACTION_KEYS` copies packio-api's vocabulary and a test holds
 * every one of them to a presentation of its own.
 */

import type { IconName } from "@/ui/icons";

import type { StatusTone } from "./types";

/** One action the API says this actor may take on this entity, right now. */
export interface NextAction {
  /** Stable, machine-readable, from the API — e.g. `order.approve_slip`. */
  key: string;
  /**
   * Whether taking it needs a typed confirmation that restates the target, and an
   * `Idempotency-Key` (Definition of Done, `00-master-plan.md` §8). The **API** marks this,
   * because whether an act can be undone is a backend fact.
   */
  irreversible?: boolean;
  /** Set by the API when this action is offered but currently blocked, with a reason. */
  disabledReason?: string | null;
}

export interface NextActionMeta {
  tone: StatusTone;
  icon: IconName;
  /** Key inside the `status` message namespace, under `action.`. */
  labelKey: string;
}

/**
 * Presentation for the action keys the product uses so far.
 *
 * Deliberately a flat table rather than one per domain: "approve" should look the same whether
 * it is a slip, a proof or a payout run, and splitting it per feature is how that stops being
 * true. Entries are added here as F2–F6 meet new keys.
 */
const ACTION_META: Record<string, NextActionMeta> = {
  approve: { tone: "success", icon: "check", labelKey: "action.approve" },
  reject: { tone: "danger", icon: "ban", labelKey: "action.reject" },
  cancel: { tone: "danger", icon: "close", labelKey: "action.cancel" },
  submit: { tone: "primary", icon: "send", labelKey: "action.submit" },
  pay: { tone: "primary", icon: "credit-card", labelKey: "action.pay" },
  upload: { tone: "primary", icon: "upload", labelKey: "action.upload" },
  request_changes: { tone: "warning", icon: "edit", labelKey: "action.requestChanges" },
  start_production: { tone: "primary", icon: "factory", labelKey: "action.startProduction" },
  ship: { tone: "primary", icon: "truck", labelKey: "action.ship" },
  confirm_receipt: { tone: "success", icon: "package-check", labelKey: "action.confirmReceipt" },
  reorder: { tone: "neutral", icon: "refresh", labelKey: "action.reorder" },
  claim: { tone: "warning", icon: "flag", labelKey: "action.claim" },
  // Work-queue verbs (F2 2.3 RFQ desk first; the same verbs will serve prepress and claims).
  start_review: { tone: "primary", icon: "eye", labelKey: "action.startReview" },
  assign: { tone: "neutral", icon: "user-plus", labelKey: "action.assign" },
  request_info: { tone: "warning", icon: "help", labelKey: "action.requestInfo" },
  decline: { tone: "danger", icon: "ban", labelKey: "action.decline" },
  create_order: { tone: "primary", icon: "cart", labelKey: "action.createOrder" },
  request_factory_cost: { tone: "primary", icon: "factory", labelKey: "action.requestFactoryCost" },
  compose_quote: { tone: "primary", icon: "edit", labelKey: "action.composeQuote" },
  edit_quote: { tone: "neutral", icon: "edit", labelKey: "action.editQuote" },
  send_quote: { tone: "primary", icon: "send", labelKey: "action.sendQuote" },
  record_acceptance: { tone: "success", icon: "check", labelKey: "action.recordAcceptance" },
  // Prepress (F2 2.4).
  send_template: { tone: "primary", icon: "send", labelKey: "action.sendTemplate" },
  deliver_round: { tone: "primary", icon: "send", labelKey: "action.deliverRound" },
  draw_dieline: { tone: "neutral", icon: "ruler", labelKey: "action.drawDieline" },
  requote_design: { tone: "warning", icon: "refresh", labelKey: "action.requoteDesign" },
  // The customer's own order actions (F3 3.4–3.6).
  "order.pay_instalment": { tone: "primary", icon: "credit-card", labelKey: "action.payInstalment" },
  "order.upload_artwork": { tone: "primary", icon: "upload", labelKey: "action.uploadArtwork" },
  "order.approve_proof": { tone: "primary", icon: "file-check", labelKey: "action.reviewProof" },
  "order.open_claim": { tone: "warning", icon: "flag", labelKey: "action.openClaim" },
  "order.design_brief": { tone: "primary", icon: "edit", labelKey: "action.designBrief" },
  "order.review_design": { tone: "primary", icon: "palette", labelKey: "action.reviewDesign" },
  // packio-api's keys (contract v0.6.0) whose verb has no presentation above, or reads wrongly
  // for the entity ("reject" a job is turning it down, not refusing an approval).
  "order.submit_artwork": { tone: "primary", icon: "upload", labelKey: "action.submitArtwork" },
  "order.add_mockup": { tone: "neutral", icon: "plus", labelKey: "action.addMockup" },
  "order.reprice": { tone: "warning", icon: "refresh", labelKey: "action.reprice" },
  "job.accept": { tone: "success", icon: "check", labelKey: "action.acceptJob" },
  "job.reject": { tone: "danger", icon: "ban", labelKey: "action.rejectJob" },
  "job.update_milestone": { tone: "primary", icon: "checklist", labelKey: "action.updateMilestone" },
  "job.record_qc": { tone: "primary", icon: "clipboard-check", labelKey: "action.recordQc" },
  "job.raise_issue": { tone: "warning", icon: "flag", labelKey: "action.raiseIssue" },
  "job.reassign": { tone: "warning", icon: "factory", labelKey: "action.reassign" },
  "job.hold": { tone: "warning", icon: "pause", labelKey: "action.hold" },
  "job.resume": { tone: "primary", icon: "play", labelKey: "action.resume" },
  "shipment.mark_ready": { tone: "primary", icon: "printer", labelKey: "action.markReady" },
  "shipment.dispatch": { tone: "primary", icon: "truck", labelKey: "action.dispatch" },
  "shipment.request_carrier": { tone: "neutral", icon: "truck", labelKey: "action.requestCarrier" },
  "shipment.update_status": { tone: "neutral", icon: "route", labelKey: "action.updateStatus" },
  "shipment.record_pod": { tone: "primary", icon: "package-check", labelKey: "action.recordPod" },
  "shipment.book_carrier": { tone: "primary", icon: "truck", labelKey: "action.bookCarrier" },
  "shipment.split": { tone: "neutral", icon: "split", labelKey: "action.split" },
  "shipment.resolve_exception": { tone: "warning", icon: "shield-alert", labelKey: "action.resolveException" },
  "shipment.review_pod": { tone: "primary", icon: "eye", labelKey: "action.reviewPod" },
  "claim.answer_info": { tone: "primary", icon: "send", labelKey: "action.answerInfo" },
  "claim.respond": { tone: "primary", icon: "send", labelKey: "action.respondClaim" },
  "claim.review": { tone: "primary", icon: "eye", labelKey: "action.startReview" },
  "claim.send_to_factory": { tone: "primary", icon: "factory", labelKey: "action.sendToFactory" },
  "claim.override_liability": { tone: "warning", icon: "scale", labelKey: "action.overrideLiability" },
  "claim.resolve": { tone: "success", icon: "check", labelKey: "action.resolve" },
  "claim.close": { tone: "neutral", icon: "archive", labelKey: "action.close" },
  "billing_statement.confirm": { tone: "success", icon: "check", labelKey: "action.confirmStatement" },
  "billing_statement.dispute": { tone: "warning", icon: "flag", labelKey: "action.dispute" },
  "billing_statement.submit_tax_invoice": { tone: "primary", icon: "upload", labelKey: "action.submitTaxInvoice" },
  "billing_statement.capture_tax_invoice": { tone: "primary", icon: "edit", labelKey: "action.captureTaxInvoice" },
  "billing_statement.validate_tax_invoice": {
    tone: "primary",
    icon: "file-check",
    labelKey: "action.validateTaxInvoice",
  },
  "payout_run.propose": { tone: "primary", icon: "send", labelKey: "action.propose" },
  "payout_run.generate_bank_file": { tone: "primary", icon: "download", labelKey: "action.generateBankFile" },
  "payout_run.confirm": { tone: "success", icon: "check", labelKey: "action.confirmPayout" },
  "customer_document.resend": { tone: "neutral", icon: "send", labelKey: "action.resend" },
  "customer_document.void": { tone: "danger", icon: "ban", labelKey: "action.void" },
  "rfq.accept": { tone: "success", icon: "check", labelKey: "action.acceptQuote" },
  "rfq.post_message": { tone: "neutral", icon: "chat", labelKey: "action.postMessage" },
  // Packio Factory ERP (packio-api v0.44.0, D-325).
  "erp_po.edit": { tone: "neutral", icon: "edit", labelKey: "action.editPurchaseOrder" },
  "erp_po.issue": { tone: "primary", icon: "send", labelKey: "action.issuePurchaseOrder" },
  "erp_po.receive": { tone: "primary", icon: "package-check", labelKey: "action.receiveGoods" },
  "erp_po.close": { tone: "neutral", icon: "archive", labelKey: "action.closePurchaseOrder" },
  "erp_po.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelPurchaseOrder" },
};

/**
 * Every action key packio-api offers (contract v0.6.0; the `*-actions.ts` rule tables under `src/modules` at the tag).
 * The contract types `NextActionDto.key` as a string, so this list is the vocabulary: the test
 * beside it fails when one of them falls back to `UNKNOWN_ACTION`. Re-check it on each adopt.
 */
export const API_ACTION_KEYS = [
  "order.upload_artwork",
  "order.approve_proof",
  "order.confirm_receipt",
  "order.open_claim",
  "order.reorder",
  "order.start_production",
  "order.submit_artwork",
  "order.add_mockup",
  "order.reprice",
  "order.cancel",
  "job.accept",
  "job.reject",
  "job.update_milestone",
  "job.record_qc",
  "job.raise_issue",
  "job.ship",
  "job.reassign",
  "job.hold",
  "job.resume",
  "shipment.mark_ready",
  "shipment.dispatch",
  "shipment.request_carrier",
  "shipment.update_status",
  "shipment.record_pod",
  "shipment.cancel",
  "shipment.book_carrier",
  "shipment.split",
  "shipment.resolve_exception",
  "shipment.review_pod",
  "claim.answer_info",
  "claim.respond",
  "claim.review",
  "claim.request_info",
  "claim.send_to_factory",
  "claim.override_liability",
  "claim.approve",
  "claim.reject",
  "claim.resolve",
  "claim.close",
  "billing_statement.confirm",
  "billing_statement.dispute",
  "billing_statement.submit_tax_invoice",
  "billing_statement.capture_tax_invoice",
  "billing_statement.validate_tax_invoice",
  "payout_run.propose",
  "payout_run.cancel",
  "payout_run.generate_bank_file",
  "payout_run.confirm",
  "customer_document.resend",
  "customer_document.void",
  "rfq.accept",
  "rfq.post_message",
  "rfq.decline",
  "rfq.assign",
  "rfq.start_review",
  "rfq.request_info",
  "rfq.request_factory_cost",
  "rfq.compose_quote",
  "rfq.send_quote",
  "rfq.record_acceptance",
  "erp_po.edit",
  "erp_po.issue",
  "erp_po.receive",
  "erp_po.close",
  "erp_po.cancel",
] as const;

/** Falls back to something visible and pressable rather than dropping the action. */
export const UNKNOWN_ACTION: NextActionMeta = {
  tone: "neutral",
  icon: "more",
  labelKey: "action.unknown",
};

/**
 * Presentation for one action key.
 *
 * The lookup tries the whole key first (`order.approve_slip`) and then the verb after the last
 * dot (`approve_slip` → `approve`), so a new domain gets sensible presentation for the verbs
 * the product already has without an entry per entity.
 */
export function nextActionMeta(key: string): NextActionMeta {
  const exact = ACTION_META[key];
  if (exact) return exact;

  const verb = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;
  return ACTION_META[verb] ?? ACTION_META[verb.split("_")[0] ?? ""] ?? UNKNOWN_ACTION;
}

/**
 * The single action a header should lead with, or `undefined`.
 *
 * design-system.md §1 allows one primary action per view, and §4 wants "status badge(s) + the
 * single next best action". The API's ordering is respected — it knows the workflow — so this
 * is the first action that is not currently blocked, not a re-ranking.
 */
export function primaryAction(actions: readonly NextAction[] | undefined): NextAction | undefined {
  return actions?.find((action) => !action.disabledReason);
}
