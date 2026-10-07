/**
 * The homepage Studio hero (D-310, Main board review): its presets from the catalogue and the price
 * of one selection by the `store.quotes.calculate` path. Built in packio-api on
 * `feat/ux-r2-p4-hero-presets`; this entry retires itself when a tagged contract carries both.
 */

import { z } from "zod";

import { request, uuid } from "./define";

export const heroShape = z.enum(["mailer", "lid", "tuck"]).meta({ id: "HeroShape" });
export const heroBoard = z.enum(["kraft350", "art350", "corrE"]).meta({ id: "HeroBoard" });
export const heroPrint = z.enum(["none", "one", "full"]).meta({ id: "HeroPrint" });

export const heroSelection = z
  .object({
    shape: heroShape,
    sizeCode: z.string().max(60),
    board: heroBoard,
    print: heroPrint,
    quantity: z.number().int().min(1),
  })
  .meta({ id: "HeroSelectionDto" });

export const heroShapePreset = z
  .object({
    id: heroShape,
    productSlug: z.string(),
    catalogProductId: uuid(),
    patternId: uuid(),
    dielineKey: z.string().nullable(),
    /** Inside sizes, mm (D-182). */
    sizes: z.array(z.object({ code: z.string(), lengthMm: z.number(), widthMm: z.number(), heightMm: z.number() })),
    /** The boards this product offers; `optionId` is the configurator's `material`. */
    boards: z.array(z.object({ id: heroBoard, optionId: uuid() })),
    /** The prints this product offers; empty ink ids for `none`. */
    prints: z.array(z.object({ id: heroPrint, inkOptionIds: z.array(uuid()) })),
    quantities: z.array(z.number().int()),
    quoteValidityDays: z.number().int(),
  })
  .meta({ id: "HeroShapePresetDto" });

export const heroPresets = z
  .object({
    shapes: z.array(heroShapePreset),
    /** The first selection that prices instantly; null when none does. */
    default: heroSelection.nullable(),
  })
  .meta({ id: "HeroPresetsDto" });

/** The parts of `QuoteCalculationDto` the hero reads — the full object is what packio-api returns. */
const heroStep = z.object({
  quantity: z.number().int(),
  instant: z.boolean(),
  unitPrice: z.string().nullable(),
  productAmount: z.string().nullable(),
  leadTimeDays: z.number().int().nullable(),
});

export const heroPreview = z
  .object({
    selection: heroSelection,
    productTypeCode: z.string(),
    /** What `store.quotes.calculate` takes: the configurator continues from exactly this price. */
    configuration: z.record(z.string(), z.unknown()),
    calculation: z.object({ steps: z.array(heroStep) }).passthrough(),
  })
  .meta({ id: "HeroPreviewDto" });

export const heroPreviewRequest = heroSelection
  .extend({
    deliveryPostcode: z
      .string()
      .regex(/^\d{5}$/)
      .optional(),
  })
  .meta({ id: "HeroPreviewRequestDto" });

export const storeHeroRequests = {
  "GET /v1/store/catalog/hero-presets": request({
    request: "store.catalog.hero-presets",
    summary: "The homepage Studio hero's shapes, boards, prints, sizes and quantities, read against the catalogue",
    decisions: ["D-310", "D-043"],
    response: heroPresets,
    public: true,
  }),
  "POST /v1/store/quotes/actions/preview": request({
    request: "store.quotes.preview",
    summary: "Price one hero selection by the store.quotes.calculate path (reference configuration + selection)",
    decisions: ["D-310", "D-220"],
    body: heroPreviewRequest,
    response: heroPreview,
    public: true,
  }),
} as const;

export type HeroPresets = z.infer<typeof heroPresets>;
export type HeroShapePreset = z.infer<typeof heroShapePreset>;
export type HeroSelection = z.infer<typeof heroSelection>;
export type HeroPreview = z.infer<typeof heroPreview>;
