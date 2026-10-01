/**
 * Shapes the storefront's configurator and instant quote still describe beyond packio-api's
 * contract (F3 3.2, D-100, D-043, D-051, D-072). No endpoint is requested here any more.
 *
 * - **The configurator's choices** moved onto the published `store.catalog.getConfigurator`
 *   (U-F0.5): `features/customer/configurator/from-contract.ts` reads it into the view the
 *   screens use, until U2.F1 rebuilds them on the contract.
 * - **The five other instant calculators.** `CalculateQuoteDto.configuration` is
 *   `FoldingConfigurationDto` or `CorrugateConfigurationDto`. The storefront sends the others one
 *   generic shape (`StoreGenericConfigurationDto` below) on the same published endpoint. →
 *   docs-only `store.quote-configurations`; mocked, and cast in exactly one place
 *   (`features/customer/configurator/pricing.ts`).
 * - **The mock's saved quotation** (`storeQuote`): the shape the cart, checkout, RFQ and reorder
 *   mocks share their records in.
 *
 * The configurator never computes a price, a date or a discount. It sends a configuration and
 * shows what comes back.
 */

import { z } from "zod";

import { designOption, mockupOption, orderLineType, productTypeRef } from "./admin-orders";
import { currency, date, dateTime, money, nextAction, pct, uuid } from "./define";

/* ------------------------------------------------------------------------------------ enums */

export const quoteStatus = z
  .enum(["calculated", "saved", "shared", "converted", "expired", "superseded"])
  .meta({ id: "QuoteStatus" });
export const quoteSource = z.enum(["instant", "rfq"]).meta({ id: "QuoteSource" });

/* ----------------------------------------------------------- the six other calculators */

/**
 * CONTRACT-REQUEST store.quote-configurations — the configuration the storefront sends
 * `POST /v1/store/quotes/actions/calculate` for every instant calculator that is not folding:
 * the configurator's selection by group kind, which the API maps onto its own calculator.
 * Proposed as a second member of `CalculateQuoteDto.configuration` (`oneOf`, by
 * `productTypeCode`). Not an endpoint, so it is not in the registry; it types the one call and
 * the mock.
 */
export const storeGenericConfiguration = z
  .object({
    catalogProductId: uuid(),
    patternId: uuid().optional(),
    standardSizeCode: z.string().optional(),
    l: z.number().positive().optional(),
    w: z.number().positive().optional(),
    d: z.number().positive().optional(),
    gusset: z.number().nonnegative().optional(),
    /** Group kind → the chosen option id (single) or ids (multiple). */
    options: z.record(z.string(), z.union([uuid(), z.array(uuid())])),
    /** Per option id: count and sizes of placed finishes/assemblies. */
    areas: z
      .array(
        z.object({
          optionId: uuid(),
          amount: z.number().int().min(1).optional(),
          w: z.array(z.number().nonnegative()).optional(),
          l: z.array(z.number().nonnegative()).optional(),
        }),
      )
      .optional(),
    quantities: z.array(z.number().int().min(1).max(10_000_000)).min(1).max(10),
    design: z.object({ graphic: z.boolean(), structure: z.boolean() }),
  })
  .meta({ id: "StoreGenericConfigurationDto" });

/* ----------------------------------------------------------------------------- saved quotes */

export const quoteLine = z
  .object({
    lineType: orderLineType,
    description: z.string(),
    quantity: z.string().describe("Decimal quantity"),
    unit: z.string(),
    unitPrice: z.string().describe("Decimal, up to 6 places"),
    netAmount: money(),
    vatAmount: money(),
    grossAmount: money(),
    /** Charged once per order, not per piece — plates, die blocks, design, mockup. */
    oneOff: z.boolean(),
    /** Why a line costs nothing: a reusable die on a reorder (D-153), a free-design campaign. */
    waivedReason: z.string().nullable(),
  })
  .meta({ id: "StoreQuoteLineDto" });

export const promotionCheckReason = z
  .enum(["not_found", "not_started", "expired", "not_applicable", "used_up", "min_not_met", "sign_in_required"])
  .meta({ id: "PromotionCheckReason" });

export const quotePromotion = z
  .object({
    code: z.string(),
    applied: z.boolean(),
    reason: promotionCheckReason.nullable(),
    /** The promotion's name and what it gives, in the request's language. */
    title: z.string().nullable(),
    discountAmount: money(),
    /** D-053 margin guard: the benefit was reduced to keep the order above the floor. */
    capped: z.boolean(),
  })
  .meta({ id: "StoreQuotePromotionDto" });

export const storeQuote = z
  .object({
    id: uuid(),
    quoteCode: z.string(),
    status: quoteStatus,
    productType: productTypeRef,
    product: z.object({ slug: z.string(), name: z.string(), imageUrl: z.string().nullable() }),
    /** The configuration in words, rendered by the API. */
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    quantity: z.number().int(),
    unit: z.string(),
    lines: z.array(quoteLine),
    /** Per piece, VAT included — the figure the dock headlines. */
    unitPrice: z.string().describe("Decimal, up to 6 places"),
    netAmount: money(),
    discountAmount: money(),
    shippingAmount: money(),
    vatAmount: money(),
    grossAmount: money(),
    currency: currency(),
    promotion: quotePromotion.nullable(),
    designOption,
    mockupOption,
    leadTimeDays: z.number().int(),
    earliestShipDate: date(),
    /** When it should reach the delivery postcode, on the business calendar (D-101, D-161). */
    estimatedDeliveryDate: date().nullable(),
    deliveryPostcode: z.string().nullable(),
    /** D-021: the tolerance of the factory that priced it, frozen in the quote. */
    tolerance: z.object({ shortagePct: pct(), overagePct: pct() }),
    /** D-051: the price holds until then; after it the quote is re-priced. */
    validUntil: dateTime(),
    /** What the configurator sent, so the quote can be reopened and changed. */
    configuration: z.record(z.string(), z.unknown()),
    source: quoteSource,
    nextActions: z.array(nextAction()),
    createdAt: dateTime(),
  })
  .meta({ id: "StoreQuoteDto" });

export const signedUrl = z.object({ url: z.string(), expiresAt: dateTime() }).meta({ id: "SignedUrlDto" });
