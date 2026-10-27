// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { createApiClient } from "@/lib/api/client";

import { groupsOf, type Configurator } from "./model";
import { initialState, NO_DIMS, type ConfiguratorState } from "./state";
import { LEGACY_PARAMS, PARAMS, queryOf, searchWith, seedFromDesign } from "./url-state";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

async function configuratorOf(slug: string): Promise<Configurator> {
  const { data } = await createApiClient({ baseUrl: "http://api.mock" }).GET(
    "/v1/store/catalog/products/{slug}/configurator",
    { params: { path: { slug } } },
  );
  return data!;
}

/** What a link brings back: the link is read the way the page reads it, then the starting state is built. */
const roundTrip = (configurator: Configurator, state: ConfiguratorState) => {
  const search = new URLSearchParams(queryOf(configurator, state));
  const query = Object.fromEntries(search);
  return initialState(configurator, seedFromDesign(configurator, query));
};

const essentials = (state: ConfiguratorState) => ({
  patternId: state.patternId,
  sizeMode: state.sizeMode,
  standardSizeCode: state.standardSizeCode,
  dims: state.dims,
  basis: state.basis,
  material: state.choices.material,
  front: state.choices.print_front,
  back: state.choices.print_back,
  quantity: state.quantity,
  designOption: state.designOption,
});

describe("the configurator's address", () => {
  it("names every parameter once, and the older ones are only read", () => {
    expect(new Set(Object.values(PARAMS)).size).toBe(Object.values(PARAMS).length);
    expect(Object.values(PARAMS)).not.toContain("postcode");
    expect(Object.values(PARAMS)).not.toContain("target");
    for (const legacy of Object.values(LEGACY_PARAMS)) expect(Object.values(PARAMS)).not.toContain(legacy);
  });

  it("leaves the defaults out: an untouched configurator has a clean address", async () => {
    const configurator = await configuratorOf("shipping-box");
    expect(queryOf(configurator, initialState(configurator))).toEqual({});
  });

  it("round-trips a standard size, board, print on both sides, quantity and artwork path", async () => {
    const configurator = await configuratorOf("shipping-box");
    const start = initialState(configurator);
    const groups = groupsOf(configurator);
    const material = groups.find((group) => group.kind === "material")!.options.at(-1)!;
    const size = configurator.standardSizes.at(-1)!;
    const changed: ConfiguratorState = {
      ...start,
      sizeMode: "standard",
      standardSizeCode: size.code,
      dims: { ...NO_DIMS, l: size.lengthMm, w: size.widthMm, d: size.heightMm },
      basis: "internal",
      choices: { ...start.choices, material: [material.id] },
      quantities: [...new Set([...start.quantities, 2500])].sort((a, b) => a - b),
      quantity: 2500,
      designOption: "hired_design",
    };
    const query = queryOf(configurator, changed);
    expect(query[PARAMS.material]).toBe(material.id);
    expect(query[PARAMS.quantity]).toBe("2500");
    expect(query[PARAMS.design]).toBe("hired_design");
    expect(essentials(roundTrip(configurator, changed))).toEqual(essentials(changed));
  });

  it("round-trips a custom size, with the basis it was entered on", async () => {
    const configurator = await configuratorOf("shipping-box");
    const start = initialState(configurator);
    const custom = (basis: ConfiguratorState["basis"]): ConfiguratorState => ({
      ...start,
      sizeMode: "custom",
      standardSizeCode: null,
      basis,
      dims: { ...NO_DIMS, l: 300, w: 200.5, d: 120 },
    });
    const inside = queryOf(configurator, custom("internal"));
    expect(inside[PARAMS.size]).toBe("300x200.5x120");
    expect(inside[PARAMS.basis]).toBeUndefined();
    expect(essentials(roundTrip(configurator, custom("internal")))).toEqual(essentials(custom("internal")));

    const outside = queryOf(configurator, custom("external"));
    expect(outside[PARAMS.basis]).toBe("external");
    expect(essentials(roundTrip(configurator, custom("external")))).toEqual(essentials(custom("external")));
    // A size whose basis is not chosen yet cannot be said in a link.
    expect(queryOf(configurator, custom(null))[PARAMS.size]).toBeUndefined();
  });

  it("round-trips the print of each side, including an explicit 'no print'", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const start = initialState(configurator);
    const front = groupsOf(configurator).find((group) => group.kind === "print_front")!;
    const other = front.options.find((option) => !start.choices.print_front?.includes(option.id))!;
    const state: ConfiguratorState = { ...start, choices: { ...start.choices, print_front: [other.id], print_back: [] } };
    const query = queryOf(configurator, state);
    expect(query[PARAMS.printFront]).toBe(other.id);
    expect(roundTrip(configurator, state).choices.print_front).toEqual([other.id]);
    expect(roundTrip(configurator, state).choices.print_back).toEqual([]);
  });

  it("never carries the postcode, the target price or the promotion code", async () => {
    const configurator = await configuratorOf("shipping-box");
    const state: ConfiguratorState = { ...initialState(configurator), postcode: "10110", target: "12.5", promoCode: "SAVE" };
    expect(JSON.stringify(queryOf(configurator, state))).not.toMatch(/10110|12\.5|SAVE/);
  });
});

describe("reading an address", () => {
  it("ignores garbled parameters instead of guessing", async () => {
    const configurator = await configuratorOf("shipping-box");
    for (const query of [
      { size: "x" },
      { size: "10x" },
      { size: "1e9x2e9" },
      { size: "10x20x30x40" },
      { qty: "abc" },
      { qty: "-5" },
      { qty: "99999999999" },
      { material: "not-a-board" },
      { pf: "nope,nada" },
      { pb: "%%%" },
      { pattern: "../../etc" },
      { design: "own_file,hired_design" },
      { design: "nonsense" },
      { basis: "sideways", size: "5x5x5" },
    ]) {
      expect(seedFromDesign(configurator, query)?.designOption).toBeUndefined();
      expect(seedFromDesign(configurator, query)?.choices).toBeUndefined();
    }
    expect(seedFromDesign(configurator, { qty: "abc" })).toBeUndefined();
    expect(seedFromDesign(configurator, { size: "x", material: "not-a-board", pf: "nope", design: "nonsense" })).toBeUndefined();
  });

  it("does not throw on a repeated parameter (an array) or an empty one", async () => {
    const configurator = await configuratorOf("shipping-box");
    expect(seedFromDesign(configurator, { qty: ["1000", "2000"], size: ["00"], design: ["own_file"], pf: "" })).toBeUndefined();
  });

  it("ignores what this product does not offer: a size code, a board, an ink, a quantity beyond its bounds", async () => {
    const configurator = await configuratorOf("shipping-box");
    expect(seedFromDesign(configurator, { size: "ZZZ-NOT-A-SIZE" })).toBeUndefined();
    const { min, max } = configurator.quantity;
    if (max !== null) expect(seedFromDesign(configurator, { qty: String(max + 1) })).toBeUndefined();
    if (min !== null && min > 1) expect(seedFromDesign(configurator, { qty: String(min - 1) })).toBeUndefined();
  });

  it("still reads the older links: l / w / d and the home page's ink", async () => {
    const configurator = await configuratorOf("tuck-end-box");
    const front = groupsOf(configurator).find((group) => group.kind === "print_front")!;
    const seed = seedFromDesign(configurator, { l: "150", w: "100", d: "50", ink: front.options[0]!.id });
    expect(seed?.dims).toMatchObject({ l: 150, w: 100, d: 50 });
    expect(seed?.choices?.print_front).toEqual([front.options[0]!.id]);
  });

  it("reads LxWxH and LxW", async () => {
    const configurator = await configuratorOf("shipping-box");
    expect(seedFromDesign(configurator, { size: "140x97.5x60" })?.dims).toMatchObject({ l: 140, w: 97.5, d: 60 });
    expect(seedFromDesign(configurator, { size: "140x97.5" })?.dims).toMatchObject({ l: 140, w: 97.5, d: null });
  });
});

describe("writing the address", () => {
  it("replaces the configurator's parameters and keeps every other one (?from, ?quote, ?calc)", () => {
    const next = searchWith("from=home&qty=100&size=00&l=1&w=2&ink=none&calc=abc&quote=q1", { qty: "500" });
    const params = new URLSearchParams(next);
    expect(Object.fromEntries(params)).toEqual({ from: "home", calc: "abc", quote: "q1", qty: "500" });
  });

  it("is empty when nothing differs from the defaults", () => {
    expect(searchWith("size=00&qty=100&design=own_file", {})).toBe("");
  });
});
