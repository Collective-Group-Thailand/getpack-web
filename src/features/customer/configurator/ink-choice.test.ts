// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { createApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import { buildConfiguration } from "./build";
import { groupsOf, isProcessInk, normaliseInks, optionsById, toggleChoice } from "./model";
import { initialState, type Configurator } from "./state";

/**
 * UAT ฿17.26 was size 00 priced with two inks (ดำ + CMYK): the API's `ink_colour` group says
 * `selection: null`, the web treated it as a free multi-select. One ink choice is one ink.
 */
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

async function setup() {
  const { data } = await createApiClient({ baseUrl: "http://api.mock" }).GET(
    "/v1/store/catalog/products/{slug}/configurator",
    { params: { path: { slug: "tuck-end-box" } } },
  );
  const configurator = data as Configurator;
  const group = groupsOf(configurator).find((g) => g.kind === "print_front")!;
  const process = group.options.find(isProcessInk)!;
  const black = group.options.find((o) => !isProcessInk(o))!;
  return { configurator, group, process, black, byId: optionsById(configurator) };
}

describe("one ink choice sends one ink", () => {
  it("toggling CMYK after ดำ yields exactly [CMYK], and back", async () => {
    const { group, process, black, byId } = await setup();
    const withBlack = toggleChoice(group, byId, [], black.id, true);
    expect(withBlack).toEqual([black.id]);
    expect(toggleChoice(group, byId, withBlack, process.id, true)).toEqual([process.id]);
    expect(toggleChoice(group, byId, [process.id], black.id, true)).toEqual([black.id]);
    expect(toggleChoice(group, byId, [process.id], process.id, false)).toEqual([]);
  });

  it("builds CMYK as its four passes only, and ดำ as exactly one entry", async () => {
    const { configurator, process, black } = await setup();
    const base = initialState(configurator);
    const build = (ids: string[]) =>
      (
        buildConfiguration(configurator, {
          ...base,
          choices: { ...base.choices, print_front: ids },
        }) as Schemas["FoldingConfigurationDto"]
      ).parts[0]!.printFront;
    expect(build([process.id])).toEqual(Array(4).fill({ inkColourId: process.id, percent: 100 }));
    expect(build([black.id])).toEqual([{ inkColourId: black.id, percent: 100 }]);
  });

  it("normalises a seed or default that has both ids", async () => {
    const { configurator, process, black, byId } = await setup();
    expect(normaliseInks(byId, [black.id, process.id])).toEqual([process.id]);
    expect(normaliseInks(byId, [process.id, black.id, process.id])).toEqual([process.id]);
    const state = initialState(configurator, {
      choices: { print_front: [black.id, process.id], print_back: [process.id, black.id] },
      partPrints: { p1: { print_front: [black.id, process.id], print_back: [] } },
    });
    expect(state.choices.print_front).toEqual([process.id]);
    expect(state.choices.print_back).toEqual([process.id]);
    expect(state.partPrints["p1"]!.print_front).toEqual([process.id]);
    // A catalogue that defaults both never starts on both.
    const both: Configurator = {
      ...configurator,
      optionGroups: configurator.optionGroups.map((g) =>
        g.kind === "ink_colour" ? { ...g, options: g.options.map((o) => ({ ...o, isDefault: true })) } : g,
      ),
    };
    for (const side of ["print_front", "print_back"] as const) expect(initialState(both).choices[side]).toHaveLength(1);
  });
});
