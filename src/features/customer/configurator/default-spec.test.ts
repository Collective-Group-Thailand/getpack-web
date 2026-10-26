// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { createApiClient } from "@/lib/api/client";

import { defaultPatternOf, defaultStandardSizeOf, initialState, type Configurator } from "./state";

/** D-441: the configurator opens on the API's default spec, not on the first pattern and size. */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

async function configurator(slug: string): Promise<Configurator> {
  const { data } = await createApiClient({ baseUrl: "http://api.mock" }).GET(
    "/v1/store/catalog/products/{slug}/configurator",
    { params: { path: { slug } } },
  );
  return data!;
}

describe("the configurator's starting state follows the default spec", () => {
  it("opens on the size the API marks default and on the reference quantity", async () => {
    const base = await configurator("tuck-end-box");
    expect(base.standardSizes.length).toBeGreaterThan(1);
    const second = base.standardSizes[1]!;
    const moved: Configurator = {
      ...base,
      standardSizes: base.standardSizes.map((size) => ({ ...size, isDefault: size.code === second.code })),
      quantity: { ...base.quantity, default: base.quantity.presets[2] ?? base.quantity.default },
    };
    expect(defaultStandardSizeOf(moved)?.code).toBe(second.code);
    const state = initialState(moved);
    expect(state.standardSizeCode).toBe(second.code);
    expect(state.dims).toMatchObject({ l: second.lengthMm, w: second.widthMm, d: second.heightMm });
    expect(state.quantity).toBe(moved.quantity.default);
  });

  it("opens on the pattern the default spec names, else the first", async () => {
    const base = await configurator("tuck-end-box");
    // The mock offers one pattern; a second one stands in for a style the reference configuration picks.
    const other = { ...base.patterns[0]!, id: "0192f3a0-7c1e-7d2a-9b1f-00000000ffff" };
    const withSpec: Configurator = {
      ...base,
      patterns: [...base.patterns, other],
      defaultSpec: { ...base.defaultSpec!, configuration: { ...base.defaultSpec!.configuration, patternId: other.id } },
    };
    expect(defaultPatternOf(withSpec)?.id).toBe(other.id);
    expect(initialState(withSpec).patternId).toBe(other.id);
    expect(defaultPatternOf({ ...base, defaultSpec: null })?.id).toBe(base.patterns[0]!.id);
  });
});
