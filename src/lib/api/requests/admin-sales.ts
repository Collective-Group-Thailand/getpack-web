/**
 * The CS sales desk (F2 2.2): the seven instant calculators (D-100), CS quotations (D-051),
 * discount memos (D-052), and creating an order on a customer's behalf (B3.1).
 *
 * The calculator endpoints are the ones B2.3 names — `GET /v1/admin/cs/{type}/input-data` and
 * `POST /v1/admin/cs/{type}/calculate` — and the inputs are one typed schema per calculator
 * (the legacy Vue calculators' fields, F2 A.2.3), so the backend receives something it can
 * validate rather than a bag of keys. The maths stays on the backend (B2.3: "calculators are
 * pure services"); this only asks and shows.
 */

import { z } from "zod";

import {
  currency,
  date,
  dateTime,
  fileRef,
  listQuery,
  money,
  nextAction,
  page,
  pct,
  request,
  userRef,
  uuid,
} from "./define";
import { customerRef, designOption, factoryRef, mockupOption, productTypeRef } from "./admin-orders";

export const calculatorKey = z
  .enum(["folding", "corrugate", "label", "tag_sleeve", "pouch", "standard_product", "service"])
  .meta({ id: "CalculatorKey" });

/* ------------------------------------------------------------------------------- input data */

export const csOption = z
  .object({
    code: z.string(),
    name: z.string(),
    /** For grouping in a select (paper family, finish kind). */
    group: z.string().nullable(),
    /** Anything the form needs to decide what to show: `gsm` list, `needsArea`, `unit`. */
    meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.number())])),
  })
  .meta({ id: "CsOptionDto" });

export const csPattern = z
  .object({
    code: z.string(),
    name: z.string(),
    subPatterns: z.array(z.object({ code: z.string(), name: z.string() })),
    /** Size rules the legacy form enforced (`l_must_more_than_w` …). The API re-checks. */
    constraints: z.object({
      minLengthMm: z.number(),
      maxLengthMm: z.number(),
      minWidthMm: z.number(),
      maxWidthMm: z.number(),
      minHeightMm: z.number().nullable(),
      maxHeightMm: z.number().nullable(),
      lengthMustExceedWidth: z.boolean(),
    }),
    standardSizes: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        lengthMm: z.number(),
        widthMm: z.number(),
        heightMm: z.number().nullable(),
      }),
    ),
  })
  .meta({ id: "CsPatternDto" });

export const csInputData = z
  .object({
    type: calculatorKey,
    factories: z.array(factoryRef),
    printTypes: z.array(z.object({ code: z.string(), name: z.string() })),
    patterns: z.array(csPattern),
    /**
     * Option lists by name: `materials`, `finishes`, `colourGroups`, `difficultyLevels`,
     * `diecutGroups`, `assemblies`, `flutes`, `paperGrades`, `microns`, `shapes`, `pouchTypes`,
     * `products` (standard products), `services`. A calculator uses the ones it needs.
     */
    options: z.record(z.string(), z.array(csOption)),
    quantityPresets: z.array(z.number().int()),
    /**
     * D-052: the discount CS may give without a memo. From the setting `discounts.cs_limit_pct`,
     * sent here because CS cannot read settings — the UI never hard-codes 5 %.
     */
    discountPolicy: z.object({ directLimitPct: pct() }),
  })
  .meta({ id: "CsInputDataDto" });

/* ---------------------------------------------------------------------------------- inputs */

const sides = z.object({ colours: z.number().int().min(0).max(8), coveragePct: z.number().min(0).max(100).optional() });
const area = z.object({
  code: z.string(),
  widthMm: z.number().positive().optional(),
  lengthMm: z.number().positive().optional(),
});
const dims = { lengthMm: z.number().positive(), widthMm: z.number().positive() };

export const csInput = z
  .discriminatedUnion("calculator", [
    z.object({
      calculator: z.literal("folding"),
      pattern: z.string(),
      subPattern: z.string().optional(),
      ...dims,
      heightMm: z.number().positive(),
      material: z.string(),
      gsm: z.number().int(),
      printType: z.string(),
      front: sides,
      back: sides,
      finishes: z.array(area),
      diecutGroup: z.string().optional(),
      assembly: z.string().optional(),
      difficulty: z.string().optional(),
    }),
    z.object({
      calculator: z.literal("corrugate"),
      pattern: z.string(),
      ...dims,
      heightMm: z.number().positive(),
      flute: z.string(),
      paperGrade: z.string(),
      printType: z.string(),
      colours: z.number().int().min(0).max(6),
      /** Combine mode: several parts priced as one job (legacy `cs-combine.vue`). */
      parts: z.array(z.object({ pattern: z.string(), ...dims, heightMm: z.number().positive() })).optional(),
    }),
    z.object({
      calculator: z.literal("label"),
      shape: z.string(),
      ...dims,
      material: z.string(),
      printType: z.string(),
      colours: z.number().int().min(0).max(8),
      finishes: z.array(area),
    }),
    z.object({
      calculator: z.literal("tag_sleeve"),
      kind: z.enum(["tag", "sleeve"]),
      ...dims,
      material: z.string(),
      gsm: z.number().int(),
      printType: z.string(),
      front: sides,
      back: sides,
      finishes: z.array(area),
    }),
    z.object({
      calculator: z.literal("pouch"),
      pouchType: z.string(),
      ...dims,
      gussetMm: z.number().nonnegative().optional(),
      material: z.string(),
      micron: z.number().int(),
      printType: z.string(),
      colours: z.number().int().min(0).max(10),
      zipper: z.boolean(),
      window: z.boolean(),
    }),
    z.object({ calculator: z.literal("standard_product"), productCode: z.string() }),
    z.object({
      calculator: z.literal("service"),
      services: z.array(z.object({ code: z.string(), quantity: z.number().int().positive() })).min(1),
    }),
  ])
  .meta({ id: "CsCalculatorInputDto" });

/* ---------------------------------------------------------------------------------- results */

export const csResult = z
  .object({
    id: z.string(),
    factory: factoryRef,
    printType: z.object({ code: z.string(), name: z.string() }),
    quantity: z.number().int(),
    unitPrice: z.string().describe("Decimal, up to 6 places"),
    perPieceWithDelivery: z.string().describe("Decimal, up to 6 places"),
    netAmount: money(),
    plateAmount: money(),
    dieBlockAmount: money(),
    shippingAmount: money(),
    designFeeAmount: money(),
    vatAmount: money(),
    grossAmount: money(),
    currency: currency(),
    leadTimeDays: z.number().int(),
    earliestShipDate: date(),
    toleranceShortagePct: pct(),
    toleranceOveragePct: pct(),
    /** The API marks the best rows; the UI does not compare money itself. */
    cheapest: z.boolean(),
    fastest: z.boolean(),
    /** D-141: margin only for roles that may see it while discounting. */
    marginPct: pct().nullable().optional(),
    belowMarginFloor: z.boolean().nullable().optional(),
  })
  .meta({ id: "CsResultDto" });

export const csCalculation = z
  .object({
    calculationId: uuid(),
    type: calculatorKey,
    validUntil: dateTime(),
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    results: z.array(csResult),
    /** Why a factory or a quantity produced no row — "outside capacity", "no price path" (D-043). */
    notes: z.array(z.string()),
    /** No instant path covers this configuration: route to RFQ (D-043, D-100). */
    routeToRfq: z.boolean(),
  })
  .meta({ id: "CsCalculationDto" });

/* ------------------------------------------------------------------------------- quotations */

export const quoteStatus = z
  .enum(["calculated", "saved", "shared", "converted", "expired", "superseded"])
  .meta({ id: "QuoteStatus" });

export const quotationSummary = z
  .object({
    id: uuid(),
    quoteCode: z.string(),
    customer: customerRef,
    productType: productTypeRef,
    quantities: z.array(z.number().int()),
    grossAmount: money(),
    currency: currency(),
    status: quoteStatus,
    channel: z.enum(["web", "cs", "line", "b2b"]),
    validUntil: dateTime(),
    createdBy: userRef().nullable(),
    createdAt: dateTime(),
  })
  .meta({ id: "QuotationSummaryDto" });

export const quotationDetail = quotationSummary
  .extend({
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    options: z.array(
      z.object({
        quantity: z.number().int(),
        unitPrice: z.string(),
        netAmount: money(),
        discountAmount: money(),
        vatAmount: money(),
        grossAmount: money(),
        leadTimeDays: z.number().int(),
        earliestShipDate: date(),
      }),
    ),
    discount: z.object({ pct: pct(), memo: z.object({ id: uuid(), status: z.string() }).nullable() }).nullable(),
    pdf: fileRef().nullable(),
    nextActions: z.array(nextAction()),
  })
  .meta({ id: "QuotationDetailDto" });

/* ------------------------------------------------------------------------------ discount memos */

export const memoStatus = z
  .enum(["draft", "pending_approval", "approved", "rejected", "withdrawn", "expired", "applied"])
  .meta({ id: "MemoStatus" });

export const discountMemo = z
  .object({
    id: uuid(),
    memoCode: z.string(),
    status: memoStatus,
    customer: customerRef,
    requestedBy: userRef(),
    orderValue: money(),
    requestedPct: pct(),
    requestedAmount: money(),
    approvedPct: pct().nullable(),
    resultingMarginPct: pct().nullable().optional(),
    belowMarginFloor: z.boolean(),
    reason: z.string(),
    evidence: z.array(fileRef()),
    approvalRequestId: uuid().nullable(),
    validUntil: dateTime(),
    createdAt: dateTime(),
  })
  .meta({ id: "DiscountMemoDto" });

/* ------------------------------------------------------------------------------------ requests */

export const adminSalesRequests = {
  "GET /v1/admin/cs/{type}/input-data": request({
    request: "admin.cs-calculators",
    summary:
      "Everything a CS calculator form offers: factories, patterns with size rules, option lists, the discount policy",
    decisions: ["D-100", "D-052"],
    response: csInputData,
  }),
  "POST /v1/admin/cs/{type}/calculate": request({
    request: "admin.cs-calculators",
    summary:
      "Price a configuration for every quantity, factory and print type (B2.3); results are valid until `validUntil`",
    decisions: ["D-043", "D-051", "D-101"],
    body: z.object({
      customerId: uuid().optional(),
      postcode: z.string().regex(/^\d{5}$/),
      quantities: z.array(z.number().int().positive()).min(1).max(6),
      input: csInput,
    }),
    response: csCalculation,
  }),
  "GET /v1/admin/quotations": request({
    request: "admin.quotations",
    summary: "Quotations from every channel",
    query: listQuery({ status: quoteStatus.optional(), channel: z.string().optional(), customerId: uuid().optional() }),
    response: page(quotationSummary),
  }),
  "POST /v1/admin/quotations": request({
    request: "admin.quotations",
    summary:
      "Save a CS quotation from a calculation row, with a direct discount up to the CS limit or an approved memo",
    decisions: ["D-051", "D-052"],
    body: z.object({
      calculationId: uuid(),
      resultId: z.string(),
      customerId: uuid(),
      discountPct: pct().optional(),
      discountMemoId: uuid().optional(),
      note: z.string().max(1000).optional(),
    }),
    response: quotationDetail,
    status: 201,
  }),
  "GET /v1/admin/quotations/{quoteId}": request({
    request: "admin.quotations",
    summary: "One quotation with its options",
    response: quotationDetail,
  }),
  "POST /v1/admin/quotations/{quoteId}/actions/export-pdf": request({
    request: "admin.quotations",
    summary: "The quotation PDF in the name of Collective Group (Thailand), as a short-lived signed URL",
    decisions: ["D-010", "D-092"],
    response: z.object({ url: z.string(), expiresAt: dateTime() }),
  }),
  "POST /v1/admin/discount-memos": request({
    request: "admin.discount-memos",
    summary: "Ask for a discount above the CS limit; routed to the matching tier only (D-052, D-162)",
    decisions: ["D-052", "D-162"],
    body: z.object({
      calculationId: uuid(),
      resultId: z.string(),
      customerId: uuid(),
      requestedPct: pct(),
      reason: z.string().min(3).max(2000),
      evidenceFileIds: z.array(uuid()).max(10),
    }),
    response: discountMemo,
    status: 201,
  }),
  "GET /v1/admin/discount-memos": request({
    request: "admin.discount-memos",
    summary: "Discount memos and where they stand",
    query: listQuery({ status: memoStatus.optional(), requestedBy: uuid().optional() }),
    response: page(discountMemo),
  }),
  "GET /v1/admin/discount-memos/{memoId}": request({
    request: "admin.discount-memos",
    summary: "One discount memo",
    response: discountMemo,
  }),
  "POST /v1/admin/orders": request({
    request: "admin.cs-create-order",
    summary: "CS places an order on a customer's behalf from a saved quotation (B3.1)",
    decisions: ["D-020", "D-050"],
    body: z.object({
      quoteId: uuid(),
      quantity: z.number().int().positive(),
      customerId: uuid(),
      destinations: z.array(z.object({ addressId: uuid(), quantity: z.number().int().positive() })).min(1),
      taxProfileId: uuid().nullable(),
      designOption,
      mockupOption,
      poNumber: z.string().max(60).optional(),
      ccEmails: z.array(z.string().email()).max(5),
      csRemarks: z.string().max(2000).optional(),
    }),
    response: z.object({
      groupId: uuid(),
      groupCode: z.string(),
      orders: z.array(z.object({ id: uuid(), orderCode: z.string() })),
    }),
    status: 201,
    idempotent: true,
  }),
} as const;
