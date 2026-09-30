/**
 * The request-for-quotation form (F3 3.2, B2.5, D-100), still waiting on the contract: the
 * category's `rfqSpecSchema` rendered as typed fields — the storefront does not interpret a JSON
 * Schema itself. The RFQs themselves are published (`store.rfqs.*`, U-F0.2).
 */

import { z } from "zod";

import { request } from "./define";

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

/* ----------------------------------------------------------------------------------- requests */

export const storeRfqRequests = {
  "GET /v1/store/rfq-forms/{productTypeCode}": request({
    request: "store.rfq-forms",
    summary: "The request-for-quotation form of one product type: typed fields from its rfqSpecSchema, files, SLA",
    decisions: ["D-100"],
    public: true,
    response: storeRfqForm,
  }),
} as const;
