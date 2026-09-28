/**
 * The finance workspace (F6) is built on packio-api's published B5 surface. These are the few
 * things it needs that the surface does not carry yet, each a row in `docs/contract-requests.md`:
 *
 * - `admin.slip-file` — `SlipQueueItemDto` has the amounts and the automatic check, but not the
 *   slip image, so Finance would approve a transfer without seeing it (D-061).
 * - `admin.document-resend` — "resend" is in F6.1; `CustomerDocumentDto` has no way to send a
 *   document to the customer again, nor a record of where it was sent.
 * - `admin.dunning-log` — B5.2 sends reminders (D-122, `receivables.dunning`), but no endpoint
 *   lists what was sent, when, and whether it arrived.
 * - `admin.credit-note-reasons` — the statutory reason list (§2 "controlled list") is seeded in
 *   packio-api (`prisma/seed/data/receivables.ts`) and required by `IssueDebitNoteDto.reasonCode`,
 *   but not published, so a person cannot pick one.
 * - `admin.document-payment-filter` — `GET /v1/admin/customer-documents` has no `paymentId`
 *   filter, so a payment cannot list the TR / RC it produced (drill-down).
 * - `admin.payout-documents` (F6.2) — a paid payout item has a PV number and a 50 ทวิ, but the
 *   remittance advice and the certificate cannot be downloaded.
 * - `admin.bank-line-suggestions`, `admin.bank-line-split` (F6.2) — the matching workbench needs
 *   the candidates the auto-match considered, and one line may settle several targets (a
 *   customer paying two order groups in one transfer); `ManualMatchDto` takes one target.
 * - `admin.gateway-settlements` (F6.2) — settlements can be imported but not listed, so an
 *   imported one waiting for its bank line cannot be found.
 * - `admin.depreciation-preview` (F6.3) — `POST /v1/admin/depreciation-runs` posts the month's
 *   FA02 at once; F6.3 asks for "monthly depreciation preview → post" (D-150).
 */

import { z } from "zod";

import { date, dateTime, fileRef, listQuery, money, page, request, uuid } from "./define";

export const documentChannel = z.enum(["email", "line"]).meta({ id: "DocumentDeliveryChannel" });

export const documentDelivery = z
  .object({
    channel: documentChannel,
    /** The address or LINE display name it went to. */
    to: z.string(),
    sentAt: dateTime(),
    kind: z.enum(["issued", "resent"]),
  })
  .meta({ id: "DocumentDeliveryDto" });

export const dunningEntry = z
  .object({
    id: uuid(),
    documentId: uuid(),
    docNumber: z.string(),
    customerId: uuid(),
    companyId: uuid().nullable(),
    /** Which reminder of D-122 it was: 7 days before, on the due date, or after. */
    kind: z.enum(["before_due", "on_due", "overdue"]).meta({ id: "DunningKind" }),
    channel: z.enum(["email", "line", "sms"]),
    recipient: z.string(),
    sentAt: dateTime(),
    status: z.enum(["sent", "failed"]).meta({ id: "DunningStatus" }),
  })
  .meta({ id: "DunningEntryDto" });

export const creditNoteReason = z
  .object({
    code: z.string(),
    /** The Revenue Code category it maps to (§2). */
    statutoryCategory: z.enum([
      "cancellation",
      "defective_or_short",
      "returns",
      "price_reduction",
      "post_sale_discount",
      "other",
    ]),
    nameTh: z.string(),
    nameEn: z.string(),
    appliesTo: z.enum(["item", "service", "both"]),
    /** Credit notes use `credit`; debit notes (`additional_charge`, `price_increase`) `debit`. */
    direction: z.enum(["credit", "debit"]),
  })
  .meta({ id: "CreditNoteReasonDto" });

const downloadUrl = () => z.object({ url: z.string(), expiresAt: dateTime() });

export const payoutDocuments = z
  .object({
    remittanceAdvice: downloadUrl(),
    whtCertificates: z.array(
      z.object({
        wtNumber: z.string(),
        whtForm: z.enum(["pnd3", "pnd53"]),
        base: money(),
        amount: money(),
        url: z.string(),
        expiresAt: dateTime(),
      }),
    ),
  })
  .meta({ id: "PayoutItemDocumentsDto" });

export const bankMatchTarget = z
  .enum(["payment", "gateway_settlement", "payout_run", "refund", "unidentified_receipt", "tax_payment"])
  .meta({ id: "BankMatchTargetRequest" });

export const bankLineSuggestion = z
  .object({
    targetType: bankMatchTarget,
    targetId: uuid(),
    /** What a person recognises it by: a payment reference, a run number, a settlement date. */
    label: z.string(),
    amount: money(),
    date: date(),
    /** Why it was suggested: the amount, the reference, the date window (`banking.auto_match`). */
    reasons: z.array(z.enum(["amount", "reference", "date_window"])),
  })
  .meta({ id: "BankLineSuggestionDto" });

export const settlementSummary = z
  .object({
    id: uuid(),
    provider: z.enum(["scb", "twoc2p"]),
    settlementDate: date(),
    grossAmount: money(),
    feeAmount: money(),
    vatOnFee: money(),
    netAmount: money(),
    lineCount: z.number().int(),
    unmatchedLines: z.number().int(),
    status: z.enum(["imported", "posted"]),
    companyBankAccountId: uuid(),
  })
  .meta({ id: "GatewaySettlementSummaryDto" });

export const depreciationPreview = z
  .object({
    period: z.string(),
    periodStatus: z.enum(["open", "soft_closed", "closed", "locked"]),
    /** The month's run exists already (one per month). */
    alreadyRun: z.boolean(),
    assetCount: z.number().int(),
    totalAmount: money(),
    lines: z.array(
      z.object({
        assetId: uuid(),
        assetNo: z.string(),
        name: z.string(),
        categoryCode: z.string(),
        amount: money(),
        accumulatedAfter: money(),
        netBookValueAfter: money(),
        fullyDepreciated: z.boolean(),
      }),
    ),
  })
  .meta({ id: "DepreciationPreviewDto" });

export const adminFinanceRequests = {
  "GET /v1/admin/slips/{slipId}/file": request({
    request: "admin.slip-file",
    summary: "The slip image, as a short-lived signed URL, for the Finance review (D-061)",
    decisions: ["D-061"],
    response: z.object({ file: fileRef(), expiresAt: dateTime() }),
  }),
  "POST /v1/admin/customer-documents/{documentId}/actions/resend": request({
    request: "admin.document-resend",
    summary: "Send an issued document to the customer again, by e-mail and / or LINE (D-143)",
    decisions: ["D-143", "D-092"],
    body: z.object({
      channels: z.array(documentChannel).min(1),
      /** Another address than the customer's own, for their accountant. */
      email: z.string().email().optional(),
    }),
    response: z.object({
      documentId: uuid(),
      sent: z.array(z.object({ channel: documentChannel, to: z.string(), sentAt: dateTime() })),
    }),
    idempotent: true,
  }),
  "GET /v1/admin/customer-documents/{documentId}/deliveries": request({
    request: "admin.document-resend",
    summary: "Where and when a document was sent: on issue and on every resend",
    response: z.object({ data: z.array(documentDelivery) }),
  }),
  "GET /v1/admin/dunning-log": request({
    request: "admin.dunning-log",
    summary: "Payment reminders sent for receivables, newest first (D-122)",
    decisions: ["D-122"],
    query: listQuery({
      companyId: uuid().optional(),
      customerId: uuid().optional(),
      documentId: uuid().optional(),
      from: date().optional(),
    }),
    response: page(dunningEntry),
  }),
  "GET /v1/admin/payout-runs/{runId}/items/{itemId}/documents": request({
    request: "admin.payout-documents",
    summary: "A paid payout item's remittance advice and 50 ทวิ, as short-lived signed URLs (D-022)",
    decisions: ["D-022", "D-033"],
    response: payoutDocuments,
  }),
  "GET /v1/admin/bank-statement-lines/{lineId}/suggestions": request({
    request: "admin.bank-line-suggestions",
    summary: "What an unmatched bank line could be: candidates by amount, reference and date window",
    decisions: ["D-061", "D-093"],
    response: z.array(bankLineSuggestion),
  }),
  "POST /v1/admin/bank-statement-lines/{lineId}/actions/split": request({
    request: "admin.bank-line-split",
    summary: "Match one bank line to several targets; the parts must add up to the line (§6)",
    decisions: ["D-093"],
    body: z.object({
      parts: z.array(z.object({ targetType: bankMatchTarget, targetId: uuid(), amount: money() })).min(2),
    }),
    response: z.object({ id: uuid(), matchStatus: z.enum(["unmatched", "matched", "unidentified", "ignored"]) }),
    idempotent: true,
  }),
  "GET /v1/admin/gateway-settlements": request({
    request: "admin.gateway-settlements",
    summary: "Imported gateway settlements and whether each has met its bank line (P04)",
    query: listQuery({
      status: z.enum(["imported", "posted"]).optional(),
      provider: z.enum(["scb", "twoc2p"]).optional(),
    }),
    response: page(settlementSummary),
  }),
  "GET /v1/admin/depreciation-runs/preview": request({
    request: "admin.depreciation-preview",
    summary: "What the month's depreciation run would post, per asset, without posting it (D-150)",
    decisions: ["D-150"],
    query: z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }),
    response: depreciationPreview,
  }),
  "GET /v1/admin/credit-note-reasons": request({
    request: "admin.credit-note-reasons",
    summary: "The statutory credit / debit note reasons (the §2 controlled list)",
    decisions: ["D-033"],
    response: z.array(creditNoteReason),
  }),
} as const;
