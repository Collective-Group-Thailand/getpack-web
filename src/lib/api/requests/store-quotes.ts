/**
 * The mock's saved quotation (`storeQuote`): the shape the cart, checkout, RFQ and reorder mocks
 * share their records in. No endpoint is requested here any more — the configurator reads the
 * published `store.catalog.getConfigurator` and sends every calculator its own published
 * configuration (U2.F1, contract v0.41.0).
 */

import { z } from "zod";

import { designOption, mockupOption, orderLineType, productTypeRef } from "./admin-orders";
import { currency, date, dateTime, money, nextAction, pct, uuid } from "./define";

/* ------------------------------------------------------------------------------------ enums */

export const quoteStatus = z
  .enum(["calculated", "saved", "shared", "converted", "expired", "superseded", "declined", "routed_to_rfq"])
  .meta({ id: "QuoteStatus" });
export const quoteSource = z.enum(["instant", "rfq"]).meta({ id: "QuoteSource" });

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
