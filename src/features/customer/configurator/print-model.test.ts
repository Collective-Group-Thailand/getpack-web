// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { createApiClient } from "@/lib/api/client";

import { buildConfiguration, type CorrugateConfiguration } from "./build";
import { isProcessInk, normaliseInks, optionsById } from "./model";
import {
  beyondPriced,
  choiceOf,
  defaultIds,
  idsOfChoice,
  methodOf,
  normaliseSide,
  withExtraInks,
  type PrintSide,
} from "./print-model";
import { initialState, type Configurator } from "./state";

/**
 * D-443: a corrugate side is ONE method — none, spot or CMYK — built from the product's `printModel`.
 * UAT ฿17.26 was ดำ + CMYK as two inks on one side; the calculator now refuses that
 * (`pricing.print_combination_invalid` / `cmyk_with_spot`), so the web must never send it.
 */
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

async function setup(slug = "shipping-box") {
  const { data } = await createApiClient({ baseUrl: "http://api.mock" }).GET(
    "/v1/store/catalog/products/{slug}/configurator",
    { params: { path: { slug } } },
  );
  const configurator = data as Configurator;
  const model = configurator.printModel!;
  const byId = optionsById(configurator);
  return {
    configurator,
    model,
    byId,
    cmyk: model?.outside.cmyk!.inkColourId ?? "",
    spot: model?.outside.spot!.inkColourIds[0] ?? "",
  };
}

const sides = (configurator: Configurator, choices: Record<string, string[]>) => {
  const base = initialState(configurator);
  const part = (
    buildConfiguration(configurator, { ...base, choices: { ...base.choices, ...choices } }) as CorrugateConfiguration
  ).parts[0]!;
  return { front: part.printFront, back: part.printBack };
};

describe("print model: one method per side", () => {
  it("opens on the API's defaults per side: outside CMYK, inside none", async () => {
    const { configurator, model, cmyk } = await setup();
    expect(model.outside.default.method).toBe("cmyk");
    expect(model.inside.default.method).toBe("none");
    const state = initialState(configurator);
    expect(state.choices.print_front).toEqual([cmyk]);
    expect(state.choices.print_back).toEqual([]);
    const { front, back } = sides(configurator, {});
    expect(front).toHaveLength(1);
    expect(front![0]).toMatchObject({ inkColourId: cmyk });
    expect(back).toEqual([]);
  });

  it("sends exactly one cmyk entry for CMYK, one entry for a spot colour, [] for none", async () => {
    const { configurator, cmyk, spot, model } = await setup();
    const side = model.outside;
    const area = configurator.printAreas[0]!;
    for (const kind of ["print_front", "print_back"] as const) {
      const key = kind === "print_front" ? "front" : "back";
      const other = key === "front" ? "back" : "front";
      const keep = { print_front: [] as string[], print_back: [] as string[] };
      expect(sides(configurator, { ...keep, [kind]: idsOfChoice(side, "cmyk", []) })[key]).toEqual([
        { inkColourId: cmyk, area },
      ]);
      expect(sides(configurator, { ...keep, [kind]: idsOfChoice(side, `spot:${spot}`, []) })[key]).toEqual([
        { inkColourId: spot, area },
      ]);
      expect(sides(configurator, { ...keep, [kind]: idsOfChoice(side, "none", []) })[key]).toEqual([]);
      // Nothing leaks to the other side.
      expect(sides(configurator, { ...keep, [kind]: [cmyk] })[other]).toEqual([]);
    }
  });

  it("offers only the methods the API offers", async () => {
    const { model } = await setup();
    const side = { ...model.outside, methods: ["none", "cmyk"] as PrintSide["methods"] };
    expect(normaliseSide(side, [model.outside.spot!.inkColourIds[0]!])).toEqual(defaultIds(side));
    expect(choiceOf(model.outside, [])).toBe("none");
    expect(choiceOf(model.outside, [model.outside.cmyk!.inkColourId])).toBe("cmyk");
  });

  it("normalises a draft or seed in the old shape to one valid choice, never CMYK + spot", async () => {
    // A model with nothing beyond the instant price (`quote: null`): the pre-C0b behaviour.
    const { configurator: withQuote, cmyk, spot } = await setup();
    const strip = (side: PrintSide) => ({ ...side, quote: null });
    const configurator = {
      ...withQuote,
      printModel: { outside: strip(withQuote.printModel!.outside), inside: strip(withQuote.printModel!.inside) },
    } as Configurator;
    const state = initialState(configurator, {
      choices: { print_front: [spot, cmyk], print_back: [cmyk, spot] },
      partPrints: { p1: { print_front: [spot, cmyk], print_back: [spot, spot] } },
    });
    expect(state.choices.print_front).toEqual([cmyk]);
    expect(state.choices.print_back).toEqual([cmyk]);
    expect(state.partPrints["p1"]).toEqual({ print_front: [cmyk], print_back: [spot] });
    // An ink the model does not offer falls back to the side's default.
    const stray = initialState(configurator, { choices: { print_front: ["not-an-ink"], print_back: ["not-an-ink"] } });
    expect(stray.choices.print_front).toEqual([cmyk]);
    expect(stray.choices.print_back).toEqual([]);
  });

  it("never produces cmyk_with_spot, whatever is picked", async () => {
    const { configurator, model, cmyk } = await setup();
    const side = { ...model.outside, quote: null, spot: { ...model.outside.spot!, maxColours: 3 } } as PrintSide;
    for (const choice of ["none", "cmyk", "spot", `spot:${side.spot!.inkColourIds[0]}`]) {
      for (const current of [[], [cmyk], side.spot!.inkColourIds]) {
        const ids = idsOfChoice(side, choice, current);
        expect(ids.includes(cmyk) && ids.length > 1).toBe(false);
        expect(methodOf(side, ids) === "cmyk" && ids.some((id) => id !== cmyk)).toBe(false);
      }
    }
    // Add-on off: extra inks beside CMYK are dropped; on: only offered spot colours, at most M.
    expect(withExtraInks(side, [cmyk], [side.spot!.inkColourIds[0]!])).toEqual([cmyk]);
    const withAddOn = { ...side, cmyk: { ...side.cmyk!, addOn: { enabled: true, minColours: 0, maxColours: 1 } } };
    expect(withExtraInks(withAddOn, [cmyk], side.spot!.inkColourIds)).toEqual([cmyk, side.spot!.inkColourIds[0]]);
    expect(normaliseSide(withAddOn, [cmyk, side.spot!.inkColourIds[0]!, side.spot!.inkColourIds[1] ?? "x"])).toEqual([
      cmyk,
      side.spot!.inkColourIds[0],
    ]);
    // Several spot colours only up to N.
    expect(normaliseSide({ ...side, spot: { ...side.spot!, maxColours: 1 } }, side.spot!.inkColourIds)).toHaveLength(1);
    expect(sides(configurator, { print_front: [cmyk] }).front).toHaveLength(1);
  });

  it("without a printModel: one ink per side (CMYK wins), inside none", async () => {
    const { configurator, cmyk, spot } = await setup();
    const legacy: Configurator = { ...configurator, printModel: null };
    const state = initialState(legacy);
    expect(state.choices.print_back).toEqual([]);
    expect(state.choices.print_front?.length ?? 0).toBeLessThanOrEqual(1);
    const seeded = initialState(legacy, { choices: { print_front: [spot, cmyk], print_back: [spot, cmyk] } });
    expect(seeded.choices.print_front).toEqual([cmyk]);
    expect(seeded.choices.print_back).toEqual([cmyk]);
    const spots = initialState(legacy, { choices: { print_front: [spot, spot], print_back: [] } });
    expect(spots.choices.print_front).toEqual([spot]);
    expect(sides(legacy, { print_front: [cmyk], print_back: [] }).front).toHaveLength(1);
  });

  it("keeps the process-ink rule for calculators with no per-side model yet", async () => {
    const { configurator, byId } = await setup("tuck-end-box");
    const group = configurator.optionGroups.find((g) => g.kind === "ink_colour")!;
    const process = group.options.find(isProcessInk)!;
    const black = group.options.find((o) => !isProcessInk(o))!;
    expect(normaliseInks(byId, [black.id, process.id])).toEqual([process.id]);
  });
});

describe("C0b: more colours than priced go to the quote path, never trimmed (DECISIONS-STAGE-A §9.5)", () => {
  it("keeps the customer's extra colours up to the API's quote counts and marks them beyond the instant price", async () => {
    const { configurator, model, cmyk } = await setup();
    const side = model.outside;
    const inks = side.spot!.inkColourIds;
    expect(side.quote).not.toBeNull();
    expect(inks.length).toBeGreaterThan(1);
    // Two spot colours on a side priced for one: kept (a quotation), not trimmed to one.
    const two = normaliseSide(side, inks.slice(0, 2), true);
    expect(two).toEqual(inks.slice(0, 2));
    expect(beyondPriced(side, two)).toBe(true);
    expect(beyondPriced(side, inks.slice(0, 1))).toBe(false);
    // The configurator's state keeps them too; the Studio's derived inks (no quote) keep only what is priced.
    const state = initialState(configurator, { choices: { print_front: inks.slice(0, 2) } });
    expect(state.choices.print_front).toEqual(inks.slice(0, 2));
    expect(normaliseSide(side, inks.slice(0, 2))).toHaveLength(1);
    // CMYK beside spot colours: the add-on beyond the instant price, also a quotation.
    expect(beyondPriced(side, normaliseSide(side, [cmyk, inks[0]!], true))).toBe(true);
    // The limits themselves are untouched: the instant price still covers one spot colour.
    expect(side.spot!.maxColours).toBe(1);
  });
});
