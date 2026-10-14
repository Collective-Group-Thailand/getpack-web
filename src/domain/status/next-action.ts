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
  // packio-api v0.45.0 (D-336 – D-341).
  "erp_pr.edit": { tone: "neutral", icon: "edit", labelKey: "action.editPurchaseRequest" },
  "erp_pr.submit": { tone: "primary", icon: "send", labelKey: "action.submitPurchaseRequest" },
  "erp_pr.approve": { tone: "success", icon: "check", labelKey: "action.approvePurchaseRequest" },
  "erp_pr.reject": { tone: "danger", icon: "ban", labelKey: "action.rejectPurchaseRequest" },
  "erp_pr.convert": { tone: "primary", icon: "cart", labelKey: "action.convertPurchaseRequest" },
  "erp_pr.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelPurchaseRequest" },
  "erp_ap.approve": { tone: "success", icon: "check", labelKey: "action.approveSupplierInvoice" },
  "erp_ap.pay": { tone: "primary", icon: "coins", labelKey: "action.paySupplier" },
  "erp_ap.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelSupplierInvoice" },
  "erp_pay.reverse": { tone: "danger", icon: "undo", labelKey: "action.reversePayment" },
  "erp_mo.edit": { tone: "neutral", icon: "edit", labelKey: "action.editProductionOrder" },
  "erp_mo.release": { tone: "primary", icon: "send", labelKey: "action.releaseProductionOrder" },
  "erp_mo.issue": { tone: "primary", icon: "package", labelKey: "action.issueMaterials" },
  "erp_mo.return": { tone: "neutral", icon: "undo", labelKey: "action.returnMaterials" },
  "erp_mo.complete": { tone: "success", icon: "check", labelKey: "action.completeProductionOrder" },
  "erp_mo.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelProductionOrder" },
  // packio-api v0.46.0 (D-348, D-350, D-355).
  "erp_gr.add_charge": { tone: "neutral", icon: "plus", labelKey: "action.addLandedCharge" },
  "erp_rfq.edit": { tone: "neutral", icon: "edit", labelKey: "action.editRfq" },
  "erp_rfq.send": { tone: "primary", icon: "send", labelKey: "action.sendRfq" },
  "erp_rfq.record": { tone: "primary", icon: "receipt", labelKey: "action.recordQuotes" },
  "erp_rfq.award": { tone: "success", icon: "check", labelKey: "action.awardRfq" },
  "erp_rfq.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelRfq" },
  "erp_mt.schedule": { tone: "neutral", icon: "calendar", labelKey: "action.scheduleMaintenance" },
  "erp_mt.start": { tone: "primary", icon: "wrench", labelKey: "action.startMaintenance" },
  "erp_mt.parts": { tone: "neutral", icon: "package", labelKey: "action.issueSpareParts" },
  "erp_mt.finish": { tone: "success", icon: "check", labelKey: "action.finishMaintenance" },
  "erp_mt.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelMaintenance" },
  // packio-api v0.47.0 (D-359 – D-366).
  "erp_lead.edit": { tone: "neutral", icon: "edit", labelKey: "action.editLead" },
  "erp_lead.convert": { tone: "success", icon: "user-plus", labelKey: "action.convertLead" },
  "erp_lead.lose": { tone: "danger", icon: "ban", labelKey: "action.loseLead" },
  "erp_opportunity.edit": { tone: "neutral", icon: "edit", labelKey: "action.editOpportunity" },
  "erp_opportunity.quote": { tone: "primary", icon: "document", labelKey: "action.quoteOpportunity" },
  "erp_opportunity.win": { tone: "success", icon: "check", labelKey: "action.winOpportunity" },
  "erp_opportunity.lose": { tone: "danger", icon: "ban", labelKey: "action.loseOpportunity" },
  "erp_quote.edit": { tone: "neutral", icon: "edit", labelKey: "action.editQuotation" },
  "erp_quote.send": { tone: "primary", icon: "send", labelKey: "action.sendQuotation" },
  "erp_quote.revise": { tone: "neutral", icon: "copy", labelKey: "action.reviseQuotation" },
  "erp_quote.accept": { tone: "success", icon: "check", labelKey: "action.acceptQuotation" },
  "erp_quote.reject": { tone: "danger", icon: "ban", labelKey: "action.rejectQuotation" },
  "erp_quote.order": { tone: "primary", icon: "cart", labelKey: "action.orderQuotation" },
  "erp_quote.cancel": { tone: "danger", icon: "close", labelKey: "action.cancelQuotation" },
  "erp_quote.pdf": { tone: "neutral", icon: "printer", labelKey: "action.quotationPdf" },
  "erp_so.edit": { tone: "neutral", icon: "edit", labelKey: "action.editSalesOrder" },
  "erp_so.confirm": { tone: "primary", icon: "check", labelKey: "action.confirmSalesOrder" },
  "erp_so.deliver": { tone: "primary", icon: "truck", labelKey: "action.deliverSalesOrder" },
  "erp_so.invoice": { tone: "primary", icon: "receipt", labelKey: "action.invoiceSalesOrder" },
  "erp_so.close": { tone: "neutral", icon: "archive", labelKey: "action.closeSalesOrder" },
  "erp_so.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelSalesOrder" },
  "erp_so.pdf": { tone: "neutral", icon: "printer", labelKey: "action.salesOrderPdf" },
  "erp_do.issue": { tone: "primary", icon: "truck", labelKey: "action.issueDelivery" },
  "erp_do.deliver": { tone: "success", icon: "package-check", labelKey: "action.deliverDelivery" },
  "erp_do.invoice": { tone: "primary", icon: "receipt", labelKey: "action.invoiceDelivery" },
  "erp_do.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelDelivery" },
  "erp_do.pdf": { tone: "neutral", icon: "printer", labelKey: "action.deliveryPdf" },
  "erp_iv.edit": { tone: "neutral", icon: "edit", labelKey: "action.editInvoice" },
  "erp_iv.issue": { tone: "primary", icon: "receipt", labelKey: "action.issueInvoice" },
  "erp_iv.receive": { tone: "success", icon: "coins", labelKey: "action.receiveInvoice" },
  "erp_iv.credit": { tone: "neutral", icon: "minus", labelKey: "action.creditInvoice" },
  "erp_iv.debit": { tone: "neutral", icon: "plus", labelKey: "action.debitInvoice" },
  "erp_iv.void": { tone: "danger", icon: "ban", labelKey: "action.voidInvoice" },
  "erp_iv.delete": { tone: "danger", icon: "trash", labelKey: "action.deleteInvoice" },
  "erp_iv.pdf": { tone: "neutral", icon: "printer", labelKey: "action.invoicePdf" },
  "erp_note.issue": { tone: "primary", icon: "check", labelKey: "action.issueNote" },
  "erp_note.void": { tone: "danger", icon: "ban", labelKey: "action.voidNote" },
  "erp_note.delete": { tone: "danger", icon: "trash", labelKey: "action.deleteNote" },
  "erp_note.pdf": { tone: "neutral", icon: "printer", labelKey: "action.notePdf" },
  "erp_rc.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelReceipt" },
  "erp_rc.pdf": { tone: "neutral", icon: "printer", labelKey: "action.receiptPdf" },
  "erp_bn.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelBillingNote" },
  "erp_bn.pdf": { tone: "neutral", icon: "printer", labelKey: "action.billingNotePdf" },
  "erp_wht.void": { tone: "danger", icon: "ban", labelKey: "action.voidWht" },
  "erp_wht.pdf": { tone: "neutral", icon: "printer", labelKey: "action.whtPdf" },
  "erp_template.edit": { tone: "neutral", icon: "edit", labelKey: "action.editTemplate" },
  "erp_template.use": { tone: "primary", icon: "clipboard-check", labelKey: "action.useTemplate" },
  "erp_qc.record": { tone: "primary", icon: "clipboard-check", labelKey: "action.recordCheck" },
  "erp_qc.override": { tone: "warning", icon: "flag", labelKey: "action.overrideCheck" },
  "erp_qc.coa": { tone: "neutral", icon: "printer", labelKey: "action.coaPdf" },
  "erp_ncr.edit": { tone: "neutral", icon: "edit", labelKey: "action.workNcr" },
  "erp_ncr.dispose": { tone: "primary", icon: "split", labelKey: "action.disposeNcr" },
  "erp_ncr.verify": { tone: "success", icon: "shield-check", labelKey: "action.verifyNcr" },
  "erp_ncr.close": { tone: "success", icon: "check", labelKey: "action.closeNcr" },
  "erp_ncr.cancel": { tone: "danger", icon: "ban", labelKey: "action.cancelNcr" },
  "erp_support.revoke": { tone: "danger", icon: "lock", labelKey: "action.revokeSupport" },
  "erp_ledger.configure": { tone: "neutral", icon: "settings", labelKey: "action.configureLedger" },
  "erp_ledger.catch_up": { tone: "primary", icon: "refresh", labelKey: "action.catchUpLedger" },
  "erp_account.propose": { tone: "neutral", icon: "edit", labelKey: "action.proposeAccount" },
  "erp_account_change.approve": { tone: "success", icon: "check", labelKey: "action.approveAccountChange" },
  "erp_account_change.reject": { tone: "danger", icon: "ban", labelKey: "action.rejectAccountChange" },
  "erp_rule.propose": { tone: "neutral", icon: "edit", labelKey: "action.proposeRule" },
  "erp_rule_version.approve": { tone: "success", icon: "check", labelKey: "action.approveRuleVersion" },
  "erp_rule_version.reject": { tone: "danger", icon: "ban", labelKey: "action.rejectRuleVersion" },
  "erp_rule_version.withdraw": { tone: "neutral", icon: "undo", labelKey: "action.withdrawRuleVersion" },
  "erp_period.soft_close": { tone: "neutral", icon: "lock", labelKey: "action.softClosePeriod" },
  "erp_period.close": { tone: "primary", icon: "lock", labelKey: "action.closePeriod" },
  "erp_period.lock": { tone: "danger", icon: "lock", labelKey: "action.lockPeriod" },
  "erp_period.reopen": { tone: "neutral", icon: "undo", labelKey: "action.reopenPeriod" },
  "erp_period.close_year": { tone: "danger", icon: "lock", labelKey: "action.closeYear" },
  "erp_journal.edit": { tone: "neutral", icon: "edit", labelKey: "action.editJournal" },
  "erp_journal.submit": { tone: "primary", icon: "send", labelKey: "action.submitJournal" },
  "erp_journal.approve": { tone: "success", icon: "check", labelKey: "action.approveJournal" },
  "erp_journal.reject": { tone: "danger", icon: "ban", labelKey: "action.rejectJournal" },
  "erp_journal.delete": { tone: "danger", icon: "trash", labelKey: "action.deleteJournal" },
  "erp_journal.reverse": { tone: "danger", icon: "undo", labelKey: "action.reverseJournal" },
  "erp_recurring.edit": { tone: "neutral", icon: "edit", labelKey: "action.editRecurring" },
  "erp_recurring.run": { tone: "primary", icon: "play", labelKey: "action.runRecurring" },
  "erp_asset.dispose": { tone: "danger", icon: "archive", labelKey: "action.disposeAsset" },
  "erp_bank.edit": { tone: "neutral", icon: "edit", labelKey: "action.editBank" },
  "erp_bank.import": { tone: "primary", icon: "upload", labelKey: "action.importStatement" },
  "erp_bank_line.match": { tone: "primary", icon: "link", labelKey: "action.matchBankLine" },
  "erp_bank_line.ignore": { tone: "neutral", icon: "ban", labelKey: "action.ignoreBankLine" },
  "erp_bank_line.unmatch": { tone: "danger", icon: "undo", labelKey: "action.unmatchBankLine" },
  "erp_tax.mark_filed": { tone: "success", icon: "file-check", labelKey: "action.markTaxFiled" },
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
  "erp_pr.edit",
  "erp_pr.submit",
  "erp_pr.approve",
  "erp_pr.reject",
  "erp_pr.convert",
  "erp_pr.cancel",
  "erp_ap.approve",
  "erp_ap.pay",
  "erp_ap.cancel",
  "erp_pay.reverse",
  "erp_mo.edit",
  "erp_mo.release",
  "erp_mo.issue",
  "erp_mo.return",
  "erp_mo.complete",
  "erp_mo.cancel",
  "erp_gr.add_charge",
  "erp_rfq.edit",
  "erp_rfq.send",
  "erp_rfq.record",
  "erp_rfq.award",
  "erp_rfq.cancel",
  "erp_mt.schedule",
  "erp_mt.start",
  "erp_mt.parts",
  "erp_mt.finish",
  "erp_mt.cancel",
  "erp_lead.edit",
  "erp_lead.convert",
  "erp_lead.lose",
  "erp_opportunity.edit",
  "erp_opportunity.quote",
  "erp_opportunity.win",
  "erp_opportunity.lose",
  "erp_quote.edit",
  "erp_quote.send",
  "erp_quote.revise",
  "erp_quote.accept",
  "erp_quote.reject",
  "erp_quote.order",
  "erp_quote.cancel",
  "erp_quote.pdf",
  "erp_so.edit",
  "erp_so.confirm",
  "erp_so.deliver",
  "erp_so.invoice",
  "erp_so.close",
  "erp_so.cancel",
  "erp_so.pdf",
  "erp_do.issue",
  "erp_do.deliver",
  "erp_do.invoice",
  "erp_do.cancel",
  "erp_do.pdf",
  "erp_iv.edit",
  "erp_iv.issue",
  "erp_iv.receive",
  "erp_iv.credit",
  "erp_iv.debit",
  "erp_iv.void",
  "erp_iv.delete",
  "erp_iv.pdf",
  "erp_note.issue",
  "erp_note.void",
  "erp_note.delete",
  "erp_note.pdf",
  "erp_rc.cancel",
  "erp_rc.pdf",
  "erp_bn.cancel",
  "erp_bn.pdf",
  "erp_wht.void",
  "erp_wht.pdf",
  "erp_template.edit",
  "erp_template.use",
  "erp_qc.record",
  "erp_qc.override",
  "erp_qc.coa",
  "erp_ncr.edit",
  "erp_ncr.dispose",
  "erp_ncr.verify",
  "erp_ncr.close",
  "erp_ncr.cancel",
  "erp_support.revoke",
  "erp_ledger.configure",
  "erp_ledger.catch_up",
  "erp_account.propose",
  "erp_account_change.approve",
  "erp_account_change.reject",
  "erp_rule.propose",
  "erp_rule_version.approve",
  "erp_rule_version.reject",
  "erp_rule_version.withdraw",
  "erp_period.soft_close",
  "erp_period.close",
  "erp_period.lock",
  "erp_period.reopen",
  "erp_period.close_year",
  "erp_journal.edit",
  "erp_journal.submit",
  "erp_journal.approve",
  "erp_journal.reject",
  "erp_journal.delete",
  "erp_journal.reverse",
  "erp_recurring.edit",
  "erp_recurring.run",
  "erp_asset.dispose",
  "erp_bank.edit",
  "erp_bank.import",
  "erp_bank_line.match",
  "erp_bank_line.ignore",
  "erp_bank_line.unmatch",
  "erp_tax.mark_filed",
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
