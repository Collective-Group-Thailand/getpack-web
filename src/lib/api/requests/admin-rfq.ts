/**
 * Requests for the RFQ workspace in the back office (F2 2.3, B2.5, D-100, D-043, D-102).
 *
 * Shapes follow packio-api's approved schema design §3.5: `rfqs`, `rfq_quantity_tiers`,
 * `rfq_messages`, `rfq_factory_consultations`, `rfq_quotes` / `rfq_quote_lines` and the
 * `unmet_demand_reasons` lookup, with the §4 enums verbatim. Staff-only columns follow D-141:
 * a factory's buy price and the margin are optional, so the API leaves them out for a role that
 * may not see them — CS prices an RFQ from the **suggested sell price** the API derives from the
 * factory's answer, never from the cost behind it.
 *
 * U-F0.3: the list, the detail (messages, consultations and quotations inline), the thread, assign,
 * request-info, decline, consultations and the quotation draft / discard / send are published
 * (`admin.rfqs.*`) and the desk calls them. What stays here is what packio-api still has to build
 * (triage verdict `implement`): start-review, candidate factories, remind, the draft edit and
 * record-acceptance, plus the unmet-demand reasons. The aggregate below is only what those
 * requests answer; the desk reads the published RFQ again after each of them.
 */

import { z } from "zod";

import { customerRef, factoryRef, productTypeRef, salesChannel, urgency } from "./admin-orders";
import { currency, date, dateTime, fileRef, money, nextAction, pct, request, userRef, uuid } from "./define";

/* ------------------------------------------------------------------------------------ enums */

export const rfqStatus = z
  .enum(["submitted", "in_review", "need_info", "quoted", "accepted", "declined", "expired"])
  .meta({ id: "RfqStatus" });
export const rfqQuoteStatus = z
  .enum(["draft", "sent", "accepted", "superseded", "expired"])
  .meta({ id: "RfqQuoteStatus" });
export const consultationStatus = z
  .enum(["requested", "responded", "declined", "expired"])
  .meta({ id: "ConsultationStatus" });

/** D-043: A = full price list, B = partial envelope, C = quote on request only. */
export const participationTier = z.enum(["A", "B", "C"]).meta({ id: "ParticipationTier" });

/* ---------------------------------------------------------------------------------- pieces */

const dimensions = z
  .object({
    lengthMm: z.number().int().nullable(),
    widthMm: z.number().int().nullable(),
    heightMm: z.number().int().nullable(),
  })
  .meta({ id: "RfqDimensionsDto" });

/** A quote version as a list row shows it. */
const quoteHeadline = z
  .object({ id: uuid(), versionNo: z.number().int(), status: rfqQuoteStatus, validUntil: date() })
  .meta({ id: "RfqQuoteHeadlineDto" });

/* ----------------------------------------------------------------------------------- list */

export const rfqSummary = z
  .object({
    id: uuid(),
    rfqCode: z.string(),
    channel: salesChannel,
    status: rfqStatus,
    productType: productTypeRef,
    customer: customerRef,
    /** `rfq_quantity_tiers`, ascending. */
    quantities: z.array(z.number().int()),
    dimensions: dimensions.nullable(),
    targetDate: date().nullable(),
    province: z.string().nullable(),
    assignee: userRef().nullable(),
    /** The category's SLA (a setting per product type, B2.5), in business hours — shown, never applied. */
    slaTargetHours: z.number().int(),
    /** Deadline for the first response, on the business calendar (D-161). */
    slaDueAt: dateTime().nullable(),
    firstResponseAt: dateTime().nullable(),
    urgency,
    consultationCounts: z.object({ requested: z.number().int(), responded: z.number().int() }),
    latestQuote: quoteHeadline.nullable(),
    /** The configurator or a CS calculator found no instant price path and sent it here (D-043). */
    routedFromCalculator: z.boolean(),
    submittedAt: dateTime(),
  })
  .meta({ id: "RfqSummaryDto" });

/* --------------------------------------------------------------------------------- detail */

export const consultationTier = z
  .object({
    quantity: z.number().int(),
    /** Sell price per unit the API derives from the buy price and the sell-margin table. */
    suggestedUnitPrice: z.string().describe("Decimal, up to 6 places"),
    /** The factory's own price — D-141 roles only. */
    buyUnitPrice: z.string().optional(),
  })
  .meta({ id: "RfqConsultationTierDto" });

export const consultation = z
  .object({
    id: uuid(),
    factory: factoryRef,
    tier: participationTier.nullable(),
    status: consultationStatus,
    note: z.string().nullable(),
    requestedBy: userRef(),
    requestedAt: dateTime(),
    dueAt: dateTime(),
    respondedAt: dateTime().nullable(),
    response: z
      .object({ leadTimeDays: z.number().int(), notes: z.string().nullable(), tiers: z.array(consultationTier) })
      .nullable(),
    declineNote: z.string().nullable(),
  })
  .meta({ id: "RfqConsultationDto" });

export const rfqQuoteLine = z
  .object({
    quantity: z.number().int(),
    unitPrice: z.string().describe("Decimal, up to 6 places"),
    netAmount: money(),
    vatAmount: money(),
    grossAmount: money(),
    leadTimeDays: z.number().int(),
    /** Copied from the consultation the line was priced from, for comparison. */
    suggestedUnitPrice: z.string().nullable(),
    consultationId: uuid().nullable(),
    factory: factoryRef.nullable().optional(),
    buyUnitPrice: z.string().optional(),
    /** Full-cost roles always; CS only when the line is priced under the suggestion (D-141). */
    marginPct: pct().optional(),
    belowMarginFloor: z.boolean(),
  })
  .meta({ id: "RfqQuoteLineDto" });

export const rfqQuote = z
  .object({
    id: uuid(),
    versionNo: z.number().int(),
    status: rfqQuoteStatus,
    validUntil: date(),
    customerNote: z.string().nullable(),
    lines: z.array(rfqQuoteLine),
    currency: currency(),
    createdBy: userRef(),
    createdAt: dateTime(),
    sentAt: dateTime().nullable(),
    acceptedAt: dateTime().nullable(),
  })
  .meta({ id: "RfqQuoteDto" });

export const rfqEvent = z
  .object({
    id: z.string(),
    at: dateTime(),
    /** `rfq.<verb>`, e.g. `rfq.assigned`, `rfq.consultation_responded`, `rfq.quote_sent`. */
    kind: z.string(),
    title: z.string(),
    actor: userRef().nullable(),
  })
  .meta({ id: "RfqEventDto" });

export const rfqDetail = rfqSummary
  .extend({
    contact: z.object({ phone: z.string().nullable(), email: z.string().nullable() }),
    /** The spec, rendered by the API from the category's `rfqSpecSchema` at the RFQ's version. */
    spec: z.array(z.object({ label: z.string(), value: z.string() })),
    specSchemaVersion: z.number().int(),
    notes: z.string().nullable(),
    deliveryPostcode: z.string(),
    files: z.array(fileRef()),
    routedFrom: z.object({ reason: z.string(), calculator: z.string().nullable() }).nullable(),
    declineReason: z.object({ code: z.string(), name: z.string() }).nullable(),
    declineNote: z.string().nullable(),
    /** Customer acceptance creates a quotation (`quotes.source = rfq`) that flows like any other. */
    acceptedQuotation: z
      .object({ id: uuid(), quoteCode: z.string(), versionNo: z.number().int(), quantity: z.number().int() })
      .nullable(),
    consultations: z.array(consultation),
    /** Every version, newest first. At most one is a draft. */
    quotes: z.array(rfqQuote),
    /** What a new draft starts from — validity per D-051, from settings. */
    quoteDefaults: z.object({ validUntil: date() }),
    events: z.array(rfqEvent),
    nextActions: z.array(nextAction()),
  })
  .meta({ id: "RfqDetailDto" });

export const candidateFactory = z
  .object({
    factory: factoryRef,
    tier: participationTier.nullable(),
    /** Capability for the category and the spec, judged by the API. */
    capable: z.boolean(),
    reason: z.string().nullable(),
    alreadyConsulted: z.boolean(),
    onTimeRatePct: pct().nullable(),
  })
  .meta({ id: "RfqCandidateFactoryDto" });

export const unmetDemandReason = z.object({ code: z.string(), name: z.string() }).meta({ id: "UnmetDemandReasonDto" });

const quoteLineInput = z.object({
  quantity: z.number().int().min(1),
  unitPrice: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/)
    .describe("Decimal, up to 6 places"),
  leadTimeDays: z.number().int().min(1).max(365),
  consultationId: uuid().optional(),
});

const quoteInput = z.object({
  validUntil: date(),
  customerNote: z.string().max(2000).optional(),
  lines: z.array(quoteLineInput).min(1).max(12),
});

/* ----------------------------------------------------------------------------------- requests */

export const adminRfqRequests = {
  "POST /v1/admin/rfqs/{rfqId}/actions/start-review": request({
    request: "admin.rfq-actions",
    summary: "submitted → in_review",
    response: rfqDetail,
  }),
  "GET /v1/admin/unmet-demand-reasons": request({
    request: "admin.unmet-demand-reasons",
    summary: "Why an RFQ can be declined — the unmet-demand reason codes (D-102)",
    response: z.object({ data: z.array(unmetDemandReason) }),
  }),
  "GET /v1/admin/rfqs/{rfqId}/candidate-factories": request({
    request: "admin.rfq-consultations",
    summary: "Factories that could price this RFQ, with their participation tier for the category (D-043)",
    decisions: ["D-043"],
    response: z.object({ data: z.array(candidateFactory) }),
  }),
  "POST /v1/admin/rfqs/{rfqId}/consultations/{consultationId}/actions/remind": request({
    request: "admin.rfq-consultations",
    summary: "Remind a factory that has not answered",
    status: 204,
  }),
  "PUT /v1/admin/rfqs/{rfqId}/quotes/{quoteId}": request({
    request: "admin.rfq-quotes",
    summary: "Replace a draft's lines, validity and note",
    body: quoteInput,
    response: rfqQuote,
  }),
  "POST /v1/admin/rfqs/{rfqId}/quotes/{quoteId}/actions/record-acceptance": request({
    request: "admin.rfq-quotes",
    summary: "Record that the customer accepted a sent version by phone or LINE; creates the quotation it orders from",
    body: z.object({ quantity: z.number().int().min(1), note: z.string().min(3).max(1000) }),
    response: rfqDetail,
    idempotent: true,
  }),
} as const;
