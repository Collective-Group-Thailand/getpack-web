/**
 * What the storefront's configurator and instant quote need beyond what packio-api has
 * published (F3 3.2, D-100, D-043, D-051, D-072).
 *
 * packio-api B2.3 published `POST /v1/store/quotes/actions/calculate`: a stateless price per
 * quantity for the **folding** calculator, taking catalogue **ids** (pattern, material, ink
 * colours, finishes, die-cut, assemblies, difficulty level). Three things stand between that
 * endpoint and a customer:
 *
 * 1. **The configurator's choices, with ids.** B2.1's store product carries option *codes* and
 *    a free-form `constraints` object; the calculator wants ids and the configurator wants typed
 *    size rules, print presets, swatches and explainers. → `store.configurator`.
 * 2. **The six other instant calculators.** `CalculateQuoteDto.configuration` is
 *    `FoldingConfigurationDto` only. The storefront sends the others one generic shape
 *    (`StoreGenericConfigurationDto` below) on the same published endpoint. → docs-only
 *    `store.quote-configurations`; mocked, and cast in exactly one place
 *    (`features/customer/configurator/pricing.ts`).
 * 3. **Keeping a price** (D-051): a saved quotation with its validity, lines incl. the mockup
 *    add-on (D-072) and a promotion's effect, a share link and a PDF — the save B2.5 promised.
 *    → `store.quotes`, `store.promo-check`.
 *
 * The configurator never computes a price, a date or a discount. It sends a configuration and
 * shows what comes back.
 */

import { z } from "zod";

import { designOption, mockupOption, orderLineType, productTypeRef } from "./admin-orders";
import { currency, date, dateTime, money, nextAction, pct, request, uuid } from "./define";

/* ------------------------------------------------------------------------------------ enums */

export const calculatorKey = z
  .enum(["folding", "corrugate", "label", "tag_sleeve", "pouch", "standard_product", "service"])
  .meta({ id: "CalculatorKey" });
export const quoteStatus = z
  .enum(["calculated", "saved", "shared", "converted", "expired", "superseded"])
  .meta({ id: "QuoteStatus" });
export const quoteSource = z.enum(["instant", "rfq"]).meta({ id: "QuoteSource" });

/* ------------------------------------------------------------------------------ configurator */

/** How a product is sized: a box (L × W × H), a flat item (W × L), a pouch (+ gusset), or not at all. */
export const configuratorSizeKind = z.enum(["box", "flat", "pouch", "none"]).meta({ id: "ConfiguratorSizeKind" });

/**
 * What a choice group is, so the storefront knows which calculator input it fills. One group
 * per kind per product; the API leaves out a kind the product does not offer, and the stepper
 * leaves out a step with nothing in it (the "adaptive" stepper of F3 3.2).
 */
export const configuratorGroupKind = z
  .enum([
    "material",
    "print",
    "coating_front",
    "coating_back",
    "finish",
    "diecut",
    "assembly",
    "shape",
    "pouch_type",
    "closure",
    "window",
    "product",
    "service",
  ])
  .meta({ id: "ConfiguratorGroupKind" });

/** The stepper step a group is shown in. */
export const configuratorStep = z
  .enum(["material", "printing", "finishing", "assembly"])
  .meta({ id: "ConfiguratorStep" });

/** Size rules the configurator checks as the customer types; the API checks them again. */
export const configuratorSizeRules = z
  .object({
    minLengthMm: z.number(),
    maxLengthMm: z.number(),
    minWidthMm: z.number(),
    maxWidthMm: z.number(),
    minHeightMm: z.number().nullable(),
    maxHeightMm: z.number().nullable(),
    minGussetMm: z.number().nullable(),
    maxGussetMm: z.number().nullable(),
    /** The pattern's geometry needs L > W (legacy `l_must_more_than_w`). */
    lengthMustExceedWidth: z.boolean(),
    /** The finest step a factory cuts to, e.g. `1` mm. */
    stepMm: z.number().positive(),
  })
  .meta({ id: "ConfiguratorSizeRulesDto" });

export const configuratorPattern = z
  .object({
    id: uuid(),
    code: z.string(),
    name: z.string(),
    /** `@packio/dieline` style key (`rsc`, `tuck-end`, `tray`) when the 3D preview can draw it. */
    dielineKey: z.string().nullable(),
    imageUrl: z.string().nullable(),
    /** One entry per part (one for single-part patterns): `FoldingPartDto.subPatternId`. */
    parts: z.array(z.object({ subPatternId: uuid().nullable(), name: z.string() })),
    rules: configuratorSizeRules,
  })
  .meta({ id: "ConfiguratorPatternDto" });

export const configuratorStandardSize = z
  .object({
    code: z.string(),
    name: z.string(),
    /** The pattern the size belongs to; `null` = any of the product's patterns. */
    patternId: uuid().nullable(),
    lengthMm: z.number(),
    widthMm: z.number(),
    heightMm: z.number().nullable(),
    gussetMm: z.number().nullable(),
  })
  .meta({ id: "ConfiguratorStandardSizeDto" });

/** A print preset maps to the calculator's colour list: "4 สี" is the process colour four times. */
export const printColour = z.object({ inkColourId: uuid(), percent: z.number().min(0).max(100) });

export const configuratorOption = z
  .object({
    id: uuid(),
    code: z.string(),
    nameTh: z.string(),
    nameEn: z.string(),
    /** The explainer shown with the choice ("ลูกฟูก E-flute คืออะไร?", design-system §1.5). */
    descriptionTh: z.string().nullable(),
    descriptionEn: z.string().nullable(),
    imageUrl: z.string().nullable(),
    /** What the material looks like, for the swatch and the 3D preview — `#RRGGBB`. */
    swatchHex: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable(),
    isDefault: z.boolean(),
    /** `print` groups only: the colours this preset prints on each side. */
    print: z.object({ front: z.array(printColour), back: z.array(printColour) }).nullable(),
    /** Finishes and assemblies placed by area or count (foil, spot UV, window film). */
    area: z
      .object({
        requiresAmount: z.boolean(),
        requiresWidth: z.boolean(),
        requiresLength: z.boolean(),
        maxAmount: z.number().int(),
      })
      .nullable(),
  })
  .meta({ id: "ConfiguratorOptionDto" });

export const configuratorGroup = z
  .object({
    kind: configuratorGroupKind,
    step: configuratorStep,
    nameTh: z.string(),
    nameEn: z.string(),
    helpTh: z.string().nullable(),
    helpEn: z.string().nullable(),
    selection: z.enum(["single", "multiple"]).meta({ id: "ConfiguratorSelection" }),
    /** A single-choice group the customer must answer; a multiple one may be left empty. */
    required: z.boolean(),
    options: z.array(configuratorOption),
  })
  .meta({ id: "ConfiguratorGroupDto" });

export const storeConfigurator = z
  .object({
    slug: z.string(),
    catalogProductId: uuid(),
    productTypeCode: z.string(),
    calculator: calculatorKey,
    /** `ชิ้น`, `ดวง`… in the request's language. */
    unit: z.string(),
    size: z.object({
      kind: configuratorSizeKind,
      patterns: z.array(configuratorPattern),
      standardSizes: z.array(configuratorStandardSize),
      /** The customer may type their own size within the pattern's rules. */
      customAllowed: z.boolean(),
    }),
    groups: z.array(configuratorGroup),
    quantity: z.object({
      presets: z.array(z.number().int().positive()),
      min: z.number().int().positive(),
      max: z.number().int().positive(),
      default: z.number().int().positive(),
      /** How many quantities one calculation may price (`CalculateQuoteDto` allows 10). */
      maxTiers: z.number().int().min(1).max(10),
    }),
    /** The design options this product offers; `free_design` only where a campaign offers it. */
    design: z.object({ options: z.array(designOption), default: designOption }),
    /** D-072: the physical mockup add-on, `none` included, when the product offers one. */
    mockup: z.object({ options: z.array(mockupOption) }),
    /** Calculator inputs the customer does not choose (e.g. `difficultyLevelId` for folding). */
    fixedInputs: z.record(z.string(), z.string()),
    /** D-051, from settings: how long a saved quotation holds its price. */
    quoteValidityDays: z.number().int().positive(),
  })
  .meta({ id: "StoreConfiguratorDto" });

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

/* ---------------------------------------------------------------------- support channels */

export const supportChannels = z
  .object({
    /** The LINE Official Account id, for `line.me/R/oaMessage/{id}` deep links. */
    lineOaId: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    /** Opening hours in words, in the request's language. */
    hours: z.string().nullable(),
  })
  .meta({ id: "StoreSupportChannelsDto" });

/* ----------------------------------------------------------------------------------- requests */

export const storeQuoteRequests = {
  "GET /v1/store/catalog/products/{slug}/configurator": request({
    request: "store.configurator",
    summary:
      "Everything the configurator offers for one product, with the catalogue ids the calculator takes and typed size rules",
    decisions: ["D-100", "D-043", "D-051", "D-072"],
    public: true,
    response: storeConfigurator,
  }),
  "POST /v1/store/promotions/actions/check": request({
    request: "store.promo-check",
    summary:
      "Is this code valid for this product, and what does it give — the amount is applied on the quote and at checkout",
    decisions: ["D-053"],
    public: true,
    body: z.object({
      code: z.string().trim().min(1).max(40),
      productTypeCode: z.string(),
      quantity: z.number().int().positive().optional(),
    }),
    response: z
      .object({
        code: z.string(),
        valid: z.boolean(),
        reason: promotionCheckReason.nullable(),
        title: z.string().nullable(),
        benefit: z.string().nullable(),
      })
      .meta({ id: "PromotionCheckDto" }),
  }),
  "GET /v1/store/support-channels": request({
    request: "store.support-channels",
    summary: "How a customer reaches CS: the LINE Official Account, phone, e-mail and opening hours",
    decisions: ["D-143"],
    public: true,
    response: supportChannels,
  }),
} as const;
