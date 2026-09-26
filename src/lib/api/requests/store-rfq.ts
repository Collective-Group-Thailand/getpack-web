/**
 * Requests for quotation from the storefront (F3 3.2, B2.5, D-100, D-043, D-051).
 *
 * The back office's side (`admin-rfq.ts`, F2 2.3) already describes an RFQ; this is the
 * customer's view of the same rows. The form is the category's `rfqSpecSchema` (B2.5) rendered
 * as typed fields — the storefront does not interpret a JSON Schema itself — and a quote the
 * customer accepts becomes a quotation (`quotes.source = rfq`) that goes to the cart like any
 * other (`StoreQuoteDto`, `store-quotes.ts`).
 *
 * Customers never see a factory, a buy price or a margin (D-050, D-141); nothing here has one.
 */

import { z } from "zod";

import { productTypeRef } from "./admin-orders";
import { rfqQuoteStatus, rfqStatus } from "./admin-rfq";
import { date, dateTime, fileRef, listQuery, money, nextAction, page, request, uuid } from "./define";
import { storeQuote } from "./store-quotes";

/* ------------------------------------------------------------------------------------ form */

export const rfqFieldType = z
  .enum(["text", "textarea", "number", "select", "multiselect", "boolean"])
  .meta({ id: "RfqFieldType" });

export const rfqField = z
  .object({
    /** The key the answer is sent under in `spec`. */
    key: z.string(),
    type: rfqFieldType,
    labelTh: z.string(),
    labelEn: z.string(),
    helpTh: z.string().nullable(),
    helpEn: z.string().nullable(),
    /** `mm`, `kg`, `ชั้น`… shown after a number. */
    unit: z.string().nullable(),
    required: z.boolean(),
    min: z.number().nullable(),
    max: z.number().nullable(),
    options: z.array(z.object({ value: z.string(), labelTh: z.string(), labelEn: z.string() })),
  })
  .meta({ id: "RfqFieldDto" });

export const storeRfqForm = z
  .object({
    productTypeCode: z.string(),
    nameTh: z.string(),
    nameEn: z.string(),
    /** Sent back with the answers, so a later schema change cannot misread them. */
    specSchemaVersion: z.number().int(),
    fields: z.array(rfqField),
    /** Whether the category asks for outside dimensions, and whether it has a height. */
    dimensions: z.object({ asked: z.boolean(), required: z.boolean(), height: z.boolean() }),
    quantity: z.object({ min: z.number().int().positive(), maxTiers: z.number().int().min(1).max(6) }),
    files: z.object({
      /** An `accept` string for the file picker; the presign endpoint is the authority. */
      accept: z.string(),
      maxBytes: z.number().int(),
      maxFiles: z.number().int(),
    }),
    /** The first-response SLA of the category (B2.5 setting), in business hours — shown, never applied. */
    slaTargetHours: z.number().int(),
  })
  .meta({ id: "StoreRfqFormDto" });

export const rfqSpecValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

/* ------------------------------------------------------------------------------------- rfq */

export const storeRfqQuote = z
  .object({
    id: uuid(),
    versionNo: z.number().int(),
    status: rfqQuoteStatus,
    validUntil: date(),
    customerNote: z.string().nullable(),
    lines: z.array(
      z.object({
        quantity: z.number().int(),
        unitPrice: z.string().describe("Decimal, up to 6 places"),
        netAmount: money(),
        vatAmount: money(),
        grossAmount: money(),
        leadTimeDays: z.number().int(),
      }),
    ),
    sentAt: dateTime().nullable(),
    acceptedAt: dateTime().nullable(),
  })
  .meta({ id: "StoreRfqQuoteDto" });

export const storeRfqSummary = z
  .object({
    id: uuid(),
    rfqCode: z.string(),
    status: rfqStatus,
    productType: productTypeRef,
    quantities: z.array(z.number().int()),
    targetDate: date().nullable(),
    /** The first-response deadline promised to the customer, on the business calendar. */
    respondBy: dateTime().nullable(),
    latestQuote: storeRfqQuote.pick({ versionNo: true, status: true, validUntil: true }).nullable(),
    submittedAt: dateTime(),
  })
  .meta({ id: "StoreRfqSummaryDto" });

export const storeRfq = storeRfqSummary
  .extend({
    /** The answers in words, rendered by the API from the schema version they were given in. */
    spec: z.array(z.object({ label: z.string(), value: z.string() })),
    dimensions: z
      .object({
        lengthMm: z.number().int().nullable(),
        widthMm: z.number().int().nullable(),
        heightMm: z.number().int().nullable(),
      })
      .nullable(),
    deliveryPostcode: z.string(),
    notes: z.string().nullable(),
    files: z.array(fileRef()),
    /** Sent versions only, newest first — a draft is the team's, not the customer's. */
    quotes: z.array(storeRfqQuote),
    /** The quotation an acceptance created; it goes to the cart like an instant one. */
    acceptedQuote: z.object({ id: uuid(), quoteCode: z.string(), quantity: z.number().int() }).nullable(),
    declineReason: z.string().nullable(),
    nextActions: z.array(nextAction()),
  })
  .meta({ id: "StoreRfqDto" });

export const storeRfqMessage = z
  .object({
    id: uuid(),
    authorKind: z.enum(["customer", "staff"]),
    /** Staff are shown as the team, never by name. */
    authorName: z.string(),
    body: z.string(),
    files: z.array(fileRef()),
    createdAt: dateTime(),
  })
  .meta({ id: "StoreRfqMessageDto" });

/* ----------------------------------------------------------------------------------- requests */

export const storeRfqRequests = {
  "GET /v1/store/rfq-forms/{productTypeCode}": request({
    request: "store.rfq-forms",
    summary: "The request-for-quotation form of one product type: typed fields from its rfqSpecSchema, files, SLA",
    decisions: ["D-100"],
    public: true,
    response: storeRfqForm,
  }),
  "POST /v1/store/rfqs": request({
    request: "store.rfqs",
    summary: "Submit a request for quotation; CS answers within the category's SLA",
    decisions: ["D-100", "D-043", "D-102"],
    body: z.object({
      productTypeCode: z.string(),
      specSchemaVersion: z.number().int(),
      spec: z.record(z.string(), rfqSpecValue),
      dimensions: z
        .object({
          lengthMm: z.number().int().positive(),
          widthMm: z.number().int().positive(),
          heightMm: z.number().int().positive().optional(),
        })
        .optional(),
      quantities: z.array(z.number().int().positive()).min(1).max(6),
      targetDate: date().optional(),
      deliveryPostcode: z.string().regex(/^\d{5}$/),
      fileIds: z.array(uuid()).max(20),
      notes: z.string().max(4000).optional(),
      /** The configurator found no instant price and sent the customer here (D-043). */
      routedFrom: z
        .object({
          catalogProductSlug: z.string(),
          reason: z.string(),
          configuration: z.record(z.string(), z.unknown()),
        })
        .optional(),
    }),
    response: storeRfq,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/store/rfqs": request({
    request: "store.rfqs",
    summary: "The customer's requests for quotation, newest first",
    query: listQuery({ status: rfqStatus.optional() }),
    response: page(storeRfqSummary),
  }),
  "GET /v1/store/rfqs/{rfqId}": request({
    request: "store.rfqs",
    summary: "One of the customer's RFQs with the quotes sent to them; 404 when it is not theirs",
    response: storeRfq,
  }),
  "GET /v1/store/rfqs/{rfqId}/messages": request({
    request: "store.rfqs",
    summary: "The thread with CS, oldest first — internal notes never appear",
    response: z.object({ data: z.array(storeRfqMessage) }),
  }),
  "POST /v1/store/rfqs/{rfqId}/messages": request({
    request: "store.rfqs",
    summary: "Write to CS, e.g. to answer a request for information (need_info → in_review)",
    body: z.object({ body: z.string().min(1).max(4000), fileIds: z.array(uuid()).max(10).optional() }),
    response: storeRfqMessage,
    status: 201,
  }),
  "POST /v1/store/rfqs/{rfqId}/quotes/{quoteId}/actions/accept": request({
    request: "store.rfqs",
    summary: "Accept one quantity of a sent quote; creates the quotation (source rfq) it is ordered from",
    decisions: ["D-051"],
    body: z.object({ quantity: z.number().int().positive() }),
    response: z.object({ rfq: storeRfq, quote: storeQuote }).meta({ id: "RfqAcceptanceDto" }),
    idempotent: true,
  }),
} as const;
