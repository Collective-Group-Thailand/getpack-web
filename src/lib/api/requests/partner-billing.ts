/**
 * Money with Packio from the factory's side (F5 5.3), the partner half of packio-api B5.3:
 * **billing statements** Packio generates from PO + POD (D-090) that the factory confirms or
 * disputes, the **factory's own tax invoice** against a statement (number, date, seller tax id
 * and branch, a PDF or an e-Tax reference; input VAT is claimable only with it), the **payout
 * schedule** per job — the advance on acceptance, the balance after POD and the claim window,
 * the retention and its release date (D-022, D-164) — payouts with remittance advice and WHT
 * certificates (50 ทวิ), and the statement of account.
 *
 * Shapes from schema-design §3.10 (`billing_statements`, `billing_statement_lines`,
 * `vendor_invoices`, `payable_items`, `payout_items`, `vendor_deductions`) and accounting-design
 * §2 (self-billing). Every amount is the API's decimal string; the zone only formats them.
 */

import { z } from "zod";

import { date, dateTime, fileRef, listQuery, money, page, pct, request, userRef, uuid } from "./define";

export const billingStatementStatus = z
  .enum(["generated", "sent", "confirmed", "disputed", "superseded"])
  .meta({ id: "BillingStatementStatus" });
export const inputVatStatus = z.enum(["claimable", "pending_document", "not_claimable"]).meta({ id: "InputVatStatus" });
export const vendorInvoiceStatus = z.enum(["submitted", "validated", "rejected"]).meta({ id: "VendorInvoiceStatus" });
export const payableStatus = z.enum(["open", "eligible", "in_run", "paid", "cancelled"]).meta({ id: "PayableStatus" });
export const payoutItemStatus = z.enum(["included", "paid", "failed", "excluded"]).meta({ id: "PayoutItemStatus" });

const totals = z.object({
  /** Goods received (min(delivered, ordered), D-165) at the PO's price. */
  production: money(),
  shipping: money(),
  /** Claim deductions (negative), D-083. */
  deductions: money(),
  net: money(),
  vat: money(),
  gross: money(),
  /** What the payouts already paid against it (the advance). */
  alreadyPaid: money(),
  /** What remains to be paid on it. */
  remaining: money(),
});

export const vendorInvoice = z
  .object({
    id: uuid(),
    invoiceNo: z.string(),
    invoiceDate: date(),
    sellerTaxId: z.string(),
    sellerBranchCode: z.string(),
    source: z.enum(["pdf_upload", "e_tax", "manual"]),
    file: fileRef().nullable(),
    eTaxReference: z.string().nullable(),
    status: vendorInvoiceStatus,
    /** Why Finance could not accept it (a wrong amount, a missing field). */
    rejectReason: z.string().nullable(),
    recordedAt: dateTime(),
  })
  .meta({ id: "PartnerVendorInvoiceDto" });

export const billingStatementSummary = z
  .object({
    id: uuid(),
    bsNumber: z.string(),
    periodFrom: date(),
    periodTo: date(),
    status: billingStatementStatus,
    generatedAt: dateTime(),
    totals,
    currency: z.literal("THB"),
    /** The factory's tax invoice against it, if any. */
    taxInvoiceStatus: vendorInvoiceStatus.nullable(),
    inputVatStatus,
  })
  .meta({ id: "PartnerBillingStatementSummaryDto" });

export const billingStatement = billingStatementSummary
  .extend({
    lines: z.array(
      z.object({
        id: uuid(),
        kind: z.enum(["production", "shipping", "deduction", "advance_offset"]),
        description: z.string(),
        reference: z.string().nullable(),
        quantity: z.number().int().nullable(),
        amount: money(),
      }),
    ),
    confirmedBy: userRef().nullable(),
    confirmedAt: dateTime().nullable(),
    disputeNote: z.string().nullable(),
    taxInvoices: z.array(vendorInvoice),
    nextActions: z.array(z.enum(["confirm", "dispute", "submit_tax_invoice"])),
  })
  .meta({ id: "PartnerBillingStatementDto" });

export const payoutScheduleJob = z
  .object({
    job: z.object({ id: uuid(), jobNo: z.string(), title: z.string() }),
    poAmount: money(),
    items: z.array(
      z.object({
        kind: z.enum(["advance", "balance", "retention"]),
        pct: pct(),
        amount: money(),
        /** When it becomes payable, from the payout policy version the job snapshot (D-022). */
        eligibleAt: date().nullable(),
        /** What it waits for, when `eligibleAt` is not known yet. */
        waitingFor: z.enum(["acceptance", "pod", "claim_window", "retention_period"]).nullable(),
        status: payableStatus,
        paidOn: date().nullable(),
        payoutId: uuid().nullable(),
      }),
    ),
  })
  .meta({ id: "PartnerPayoutScheduleJobDto" });

export const payoutSummary = z
  .object({
    id: uuid(),
    pvNumber: z.string(),
    paidOn: date().nullable(),
    status: payoutItemStatus,
    gross: money(),
    wht: money(),
    deductions: money(),
    net: money(),
    currency: z.literal("THB"),
    bankLast4: z.string(),
  })
  .meta({ id: "PartnerPayoutDto" });

export const payoutDetail = payoutSummary
  .extend({
    allocations: z.array(
      z.object({
        kind: z.enum(["advance", "balance", "retention", "deduction"]),
        reference: z.string(),
        amount: money(),
      }),
    ),
    remittanceAdvice: fileRef().nullable(),
    /** หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ), where WHT applies. */
    whtCertificate: fileRef().nullable(),
    failureReason: z.string().nullable(),
  })
  .meta({ id: "PartnerPayoutDetailDto" });

export const statementOfAccount = z
  .object({
    from: date(),
    to: date(),
    opening: money(),
    entries: z.array(
      z.object({
        date: date(),
        kind: z.enum(["statement", "payout", "deduction", "adjustment"]),
        reference: z.string(),
        description: z.string(),
        /** What Packio owes more (a confirmed statement). */
        credit: money(),
        /** What Packio paid or deducted. */
        debit: money(),
        balance: money(),
      }),
    ),
    closing: money(),
    currency: z.literal("THB"),
  })
  .meta({ id: "PartnerStatementOfAccountDto" });

const path = "/v1/partner/factories/{factoryId}";

export const partnerBillingRequests = {
  [`GET ${path}/billing-statements` as const]: request({
    request: "partner.billing-statements",
    summary: "My factory's billing statements, generated by Packio from PO + POD (D-090)",
    decisions: ["D-090"],
    query: listQuery({ status: billingStatementStatus.optional() }),
    response: page(billingStatementSummary),
  }),
  [`GET ${path}/billing-statements/{statementId}` as const]: request({
    request: "partner.billing-statements",
    summary: "One statement: its lines (production, shipping, deductions, advance), totals and tax invoices",
    decisions: ["D-090", "D-165"],
    response: billingStatement,
  }),
  [`POST ${path}/billing-statements/{statementId}/actions/confirm` as const]: request({
    request: "partner.billing-statements",
    summary: "Confirm a statement as right; it becomes the basis of the supplier bill (D-090)",
    decisions: ["D-090"],
    body: z.object({ note: z.string().trim().max(1000).optional() }),
    response: billingStatement,
    idempotent: true,
  }),
  [`POST ${path}/billing-statements/{statementId}/actions/dispute` as const]: request({
    request: "partner.billing-statements",
    summary: "Dispute a statement with what is wrong; Finance answers with a new version",
    decisions: ["D-090"],
    body: z.object({ note: z.string().trim().min(3).max(2000), lineIds: z.array(uuid()).optional() }),
    response: billingStatement,
    idempotent: true,
  }),
  [`POST ${path}/billing-statements/{statementId}/tax-invoices` as const]: request({
    request: "partner.billing-statements",
    summary: "Record my factory's own tax invoice against a confirmed statement: a PDF or an e-Tax reference",
    decisions: ["D-090", "D-091"],
    body: z.object({
      invoiceNo: z.string().trim().min(1).max(50),
      invoiceDate: date(),
      sellerTaxId: z.string().regex(/^\d{13}$/),
      sellerBranchCode: z.string().regex(/^\d{5}$/),
      source: z.enum(["pdf_upload", "e_tax"]),
      fileId: uuid().optional(),
      eTaxReference: z.string().trim().max(100).optional(),
    }),
    response: billingStatement,
    status: 201,
    idempotent: true,
  }),
  [`GET ${path}/payout-schedule` as const]: request({
    request: "partner.payouts",
    summary: "What Packio pays per job and when: advance, balance, retention (D-022, D-164)",
    decisions: ["D-022", "D-164", "D-082"],
    response: z.array(payoutScheduleJob),
  }),
  [`GET ${path}/payouts` as const]: request({
    request: "partner.payouts",
    summary: "Payouts made to my factory, newest first",
    decisions: ["D-022", "D-093"],
    query: listQuery({}),
    response: page(payoutSummary),
  }),
  [`GET ${path}/payouts/{payoutId}` as const]: request({
    request: "partner.payouts",
    summary: "One payout: what it paid, the remittance advice and the WHT certificate (50 ทวิ)",
    decisions: ["D-022"],
    response: payoutDetail,
  }),
  [`GET ${path}/statement-of-account` as const]: request({
    request: "partner.payouts",
    summary: "My factory's account with Packio between two dates: statements, payouts, deductions",
    decisions: ["D-022", "D-090"],
    query: z.object({ from: date().optional(), to: date().optional() }),
    response: statementOfAccount,
  }),
} as const;
