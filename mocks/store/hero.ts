/**
 * The homepage Studio hero (D-310), as packio-api builds it on `feat/ux-r2-p4-hero-presets`: the
 * presets read against the mock catalogue's configurators, and a preview priced by the mock's own
 * `store.quotes.calculate` (`inputsOf` / `stepOf`) — the mock adds no price of its own either.
 * The mock catalogue has no 350 gsm kraft, so `kraft350` is offered by no shape here.
 */

import { buildCalculateBody } from "@/features/customer/configurator/build";
import { initialState, seedFromDesign } from "@/features/customer/configurator/state";
import type { HeroSelection, HeroShapePreset } from "@/lib/api/requests/store-hero";

import { mockRequest } from "../route";
import { problem } from "../support";
import { catalogProducts } from "./catalog";
import { configuratorOf, inputsOf, stepOf, toStoreConfiguratorDto } from "./quotes";

/** The mock's `catalog.hero_presets`. */
const PRESETS = {
  shapes: [
    { id: "mailer", productSlug: "mailer-box" },
    { id: "lid", productSlug: "shipping-box" },
    { id: "tuck", productSlug: "tuck-end-box" },
  ],
  boards: { kraft350: ["kraft-350"], art350: ["art-card-350"], corrE: ["E"] },
  prints: { one: ["black"], full: ["cmyk"] },
  quantities: [300, 500, 1000, 2000],
} as const;

const BOARDS = ["kraft350", "art350", "corrE"] as const;
const PRINTS = ["none", "one", "full"] as const;

function configuratorOfSlug(slug: string) {
  const product = catalogProducts().find((row) => row.slug === slug);
  const configurator = product ? configuratorOf(product) : null;
  return configurator ? toStoreConfiguratorDto(configurator) : null;
}

type Entry = { shape: HeroShapePreset; configurator: NonNullable<ReturnType<typeof configuratorOfSlug>> };

function presets(): Entry[] {
  return PRESETS.shapes.flatMap((entry): Entry[] => {
    const configurator = configuratorOfSlug(entry.productSlug);
    const pattern = configurator?.patterns[0];
    if (!configurator?.instant || !pattern || configurator.standardSizes.length === 0) return [];
    const options = (kind: string) => configurator.optionGroups.find((group) => group.kind === kind)?.options ?? [];
    const boards = BOARDS.flatMap((id) => {
      const option = options("material").find((o) => (PRESETS.boards[id] as readonly string[]).includes(o.code));
      return option ? [{ id, optionId: option.id }] : [];
    });
    const prints = PRINTS.flatMap((id): HeroShapePreset["prints"] => {
      if (id === "none") return [{ id, inkOptionIds: [] }];
      const ids = options("ink_colour")
        .filter((o) => (PRESETS.prints[id] as readonly string[]).includes(o.code))
        .map((o) => o.id);
      return ids.length ? [{ id, inkOptionIds: ids }] : [];
    });
    const { min, max } = configurator.quantity;
    const quantities = PRESETS.quantities.filter((q) => (min === null || q >= min) && (max === null || q <= max));
    if (boards.length === 0 || quantities.length === 0) return [];
    return [
      {
        configurator,
        shape: {
          id: entry.id,
          productSlug: configurator.slug,
          catalogProductId: configurator.catalogProductId,
          patternId: pattern.id,
          dielineKey: pattern.dielineKey ?? null,
          sizes: configurator.standardSizes.slice(0, 3).map((size) => ({
            code: size.code,
            lengthMm: size.lengthMm,
            widthMm: size.widthMm,
            heightMm: size.heightMm,
          })),
          boards,
          prints,
          quantities: [...quantities],
          quoteValidityDays: configurator.quoteValidityDays,
        },
      },
    ];
  });
}

function preview(selection: HeroSelection) {
  const found = presets().find((entry) => entry.shape.id === selection.shape);
  const shape = found?.shape;
  const offered =
    shape &&
    shape.sizes.some((size) => size.code === selection.sizeCode) &&
    shape.boards.some((board) => board.id === selection.board) &&
    shape.prints.some((print) => print.id === selection.print) &&
    shape.quantities.includes(selection.quantity);
  if (!found || !shape || !offered) return null;
  const inks = shape.prints.find((print) => print.id === selection.print)!.inkOptionIds;
  const state = initialState(
    found.configurator,
    seedFromDesign(found.configurator, {
      pattern: shape.patternId,
      material: shape.boards.find((board) => board.id === selection.board)!.optionId,
      size: selection.sizeCode,
      qty: String(selection.quantity),
      ink: inks.length ? inks.join(",") : "none",
    }),
  );
  const body = buildCalculateBody(found.configurator, { ...state, quantity: selection.quantity });
  const configuration = body.configuration as unknown as Record<string, unknown>;
  const inputs = inputsOf(body.productTypeCode, { ...configuration, quantities: [selection.quantity] });
  if (inputs instanceof Response) return null;
  return {
    selection,
    productTypeCode: body.productTypeCode,
    configuration: { ...configuration, quantities: [selection.quantity] },
    calculation: {
      calculationId: null,
      calculatorVersion: "mock-0.0.0",
      dimensions: inputs.dimensions,
      target: null,
      steps: [stepOf(inputs, selection.quantity, undefined)],
    },
  };
}

export const heroHandlers = [
  // CONTRACT-REQUEST store.public-config — the mock catalogue's made-to-order floor is 100; 300 here is
  // the figure the Main board review names, as an admin catalogue would state it.
  mockRequest("GET /v1/store/public-config", () => ({
    minOrderQty: { custom: 300, readyStock: 1 },
    priceLockDays: 15,
    claimWindowDays: 7,
    proofSlaBusinessDays: null,
    supportHours: null,
    supportReplyMinutes: null,
    templateCount: 105,
    factoryCount: null,
    contact: { phone: "020000000", lineOaId: "@packio-mock", email: "support@example.invalid" },
  })),
  // CONTRACT-REQUEST store.catalog.hero-presets
  mockRequest("GET /v1/store/catalog/hero-presets", () => {
    const shapes = presets().map((entry) => entry.shape);
    const first = shapes[0];
    const print = first?.prints.find((p) => p.id === "one") ?? first?.prints[0];
    return {
      shapes,
      default:
        first && print
          ? {
              shape: first.id,
              sizeCode: first.sizes[0]!.code,
              board: first.boards[0]!.id,
              print: print.id,
              quantity: first.quantities[0]!,
            }
          : null,
    };
  }),
  // CONTRACT-REQUEST store.quotes.preview
  mockRequest("POST /v1/store/quotes/actions/preview", ({ body }) => {
    const result = preview(body);
    return (
      result ??
      problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "shape", code: "not_offered", message: "not offered by the hero presets" },
      ])
    );
  }),
];
