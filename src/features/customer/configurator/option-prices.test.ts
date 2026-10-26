// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { createApiClient } from "@/lib/api/client";

import type { CorrugateConfiguration } from "./build";
import { batchBodyOf, deltaView, MAX_VARIANTS, planVariants, printKey, sizeKey, materialKey } from "./option-prices";
import { initialState, type Configurator } from "./state";

/**
 * The option cards' variants: each is the current state with ONE change, the current option is
 * the baseline and is priced once, and the request stays inside the endpoint's limit.
 */
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

async function shippingBox() {
  const { data } = await createApiClient({ baseUrl: "http://api.mock" }).GET(
    "/v1/store/catalog/products/{slug}/configurator",
    { params: { path: { slug: "shipping-box" } } },
  );
  return data as Configurator;
}

const partOf = (configuration: unknown) => (configuration as CorrugateConfiguration).parts[0]!;

describe("planVariants", () => {
  it("builds one variant per card with deterministic keys, the current option as the baseline", async () => {
    const configurator = await shippingBox();
    const state = initialState(configurator);
    const plan = planVariants(configurator, state)!;
    const keys = plan.variants.map((variant) => variant.key);

    expect(plan.baselineKey).toBe(sizeKey(state.standardSizeCode!));
    expect(keys[0]).toBe(plan.baselineKey);
    expect(keys).toContain(sizeKey("M"));
    for (const material of configurator.optionGroups.find((g) => g.kind === "material")!.options)
      if (material.id !== state.choices.material![0]) expect(keys).toContain(materialKey(material.id));
    expect(keys).toContain("print:outside:none");
    // The default spec prints the outside in CMYK and not the inside: those two are the current options.
    expect(keys).not.toContain("print:outside:cmyk");
    expect(keys).not.toContain("print:inside:none");
    expect(keys).toContain("print:inside:cmyk");
    expect(keys.some((key) => key.startsWith("print:outside:spot:"))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeLessThanOrEqual(MAX_VARIANTS);
  });

  it("prices the option that is already selected once: its other cards are aliases of the baseline", async () => {
    const configurator = await shippingBox();
    const state = initialState(configurator);
    const plan = planVariants(configurator, state)!;
    const currentMaterial = materialKey(state.choices.material![0]!);
    expect(plan.variants.map((variant) => variant.key)).not.toContain(currentMaterial);
    expect(plan.aliases[currentMaterial]).toBe(plan.baselineKey);
    expect(plan.aliases[printKey("print_front", "cmyk")]).toBe(plan.baselineKey);
    expect(plan.aliases[printKey("print_back", "none")]).toBe(plan.baselineKey);
  });

  it("changes exactly one thing per variant, at the one quantity on screen", async () => {
    const configurator = await shippingBox();
    const state = initialState(configurator);
    const plan = planVariants(configurator, state)!;
    const body = batchBodyOf(configurator, state, plan);
    expect(body.quantities).toEqual([state.quantity]);
    expect(body.baselineKey).toBe(plan.baselineKey);
    const byKey = new Map(
      body.variants.map((variant) => [variant.key, variant.configuration as CorrugateConfiguration]),
    );
    const baseline = byKey.get(plan.baselineKey)!;

    const bigger = byKey.get(sizeKey("M"))!;
    expect(bigger.l).not.toBe(baseline.l);
    expect({ ...bigger, l: 0, w: 0, d: 0 }).toEqual({ ...baseline, l: 0, w: 0, d: 0 });

    const noPrint = byKey.get("print:outside:none")!;
    expect(partOf(noPrint).printFront).toEqual([]);
    expect(noPrint.materialId).toBe(baseline.materialId);
    expect(partOf(noPrint).printBack).toEqual(partOf(baseline).printBack);

    const insideCmyk = byKey.get("print:inside:cmyk")!;
    expect(partOf(insideCmyk).printBack).toHaveLength(1);
    expect(partOf(insideCmyk).printFront).toEqual(partOf(baseline).printFront);
  });

  it("offers no size variants on the custom tab, and none at all when nothing is selected to compare", async () => {
    const configurator = await shippingBox();
    const custom = { ...initialState(configurator), sizeMode: "custom" as const, standardSizeCode: null };
    const plan = planVariants(configurator, custom)!;
    expect(plan.variants.some((variant) => variant.key.startsWith("size:"))).toBe(false);
    expect(plan.baselineKey.startsWith("material:")).toBe(true);
  });
});

describe("deltaView", () => {
  it("reads the sign from the string and never computes", () => {
    expect(deltaView("+0.86")).toEqual({ kind: "up", amount: "0.86" });
    expect(deltaView("0.86")).toEqual({ kind: "up", amount: "0.86" });
    expect(deltaView("-0.86")).toEqual({ kind: "down", amount: "0.86" });
    expect(deltaView("−0.86")).toEqual({ kind: "down", amount: "0.86" });
    expect(deltaView("0.00")).toEqual({ kind: "same" });
    expect(deltaView("-0.00")).toEqual({ kind: "same" });
    expect(deltaView(null)).toBeNull();
    expect(deltaView("n/a")).toBeNull();
  });
});
