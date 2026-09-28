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
 */

import { z } from "zod";

import { date, dateTime, fileRef, listQuery, page, request, uuid } from "./define";

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
  "GET /v1/admin/credit-note-reasons": request({
    request: "admin.credit-note-reasons",
    summary: "The statutory credit / debit note reasons (the §2 controlled list)",
    decisions: ["D-033"],
    response: z.array(creditNoteReason),
  }),
} as const;
