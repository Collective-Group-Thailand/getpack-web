import { describe, expect, it } from "vitest";

import {
  dimensionLabelKey,
  dimensionSources,
  fitChanged,
  formOf,
  sizeSearchApplies,
  toCommercial,
  type Commercial,
} from "./commercial-form";

const EMPTY: Commercial = {
  fitMinLMm: null,
  fitMaxLMm: null,
  fitMinWMm: null,
  fitMaxWMm: null,
  fitMinHMm: null,
  fitMaxHMm: null,
  moqUnits: null,
  recyclable: null,
  plasticFree: null,
  certifications: [],
};
const RANGE: Commercial = { ...EMPTY, fitMinLMm: 60, fitMaxLMm: 400, fitMinWMm: 51, fitMaxWMm: 300, fitMinHMm: 25, fitMaxHMm: 35 };
const recipe = { source: "recipe" as const, basis: ["recipe_size_range" as const] };
const presets = { source: "standard_sizes" as const, basis: ["recipe_presets" as const] };

describe("style commercial form (C1c)", () => {
  it("round-trips the contract shape, unknowns as null", () => {
    const form = formOf({ ...RANGE, moqUnits: 500, recyclable: true, plasticFree: null, certifications: ["fsc"] });
    expect(form.recyclable).toBe("yes");
    expect(form.plasticFree).toBe("unknown");
    expect(toCommercial(form)).toEqual({
      value: { ...RANGE, moqUnits: 500, recyclable: true, plasticFree: null, certifications: ["fsc"] },
      errors: [],
    });
    expect(toCommercial(formOf(EMPTY)).value).toEqual(EMPTY);
  });

  it("refuses what the API would: decimals, out of range, min above max, bad codes", () => {
    const form = formOf(EMPTY);
    form.fit.fitMinLMm = "12.5";
    form.fit.fitMinWMm = "300";
    form.fit.fitMaxWMm = "200";
    form.fit.fitMaxHMm = "6000";
    form.moqUnits = "0";
    form.certifications = ["FSC"];
    expect(toCommercial(form).errors).toEqual([
      { field: "fitMinLMm", code: "whole" },
      { field: "width", code: "order" },
      { field: "fitMaxHMm", code: "range" },
      { field: "moqUnits", code: "range" },
      { field: "certifications", code: "code" },
    ]);
  });

  it("tells when a save changes the range (it then becomes business data)", () => {
    const form = formOf(RANGE);
    expect(fitChanged(form, RANGE)).toBe(false);
    form.moqUnits = "100";
    expect(fitChanged(form, RANGE)).toBe(false);
    form.fit.fitMaxHMm = "40";
    expect(fitChanged(form, RANGE)).toBe(true);
  });

  it("shows each dimension's source: per-bound record, summary, business, none", () => {
    expect(
      dimensionSources({
        commercial: RANGE,
        fitRangeSource: "combined",
        fitRangeBounds: { fitMinLMm: recipe, fitMaxLMm: recipe, fitMinWMm: recipe, fitMaxWMm: presets, fitMinHMm: presets, fitMaxHMm: presets },
      }),
    ).toEqual({
      length: { source: "recipe", basis: ["recipe_size_range"] },
      width: { source: "combined", basis: ["recipe_size_range", "recipe_presets"] },
      height: { source: "standard_sizes", basis: ["recipe_presets"] },
    });
    expect(dimensionSources({ commercial: RANGE, fitRangeSource: "recipe", fitRangeBounds: null }).height).toEqual({
      source: "recipe",
      basis: [],
    });
    expect(dimensionSources({ commercial: RANGE, fitRangeSource: "business", fitRangeBounds: null }).length.source).toBe("business");
    expect(dimensionSources({ commercial: EMPTY, fitRangeSource: null, fitRangeBounds: null }).length.source).toBeNull();
  });
});

describe("size classes in the commercial tab (C1e, DECISIONS-STAGE-A §13.2)", () => {
  it("names a bag's dimensions width × gusset × height and a round style's diameter × height", () => {
    expect(["length", "width", "height"].map((d) => dimensionLabelKey("bag", d as never))).toEqual([
      "bag.length",
      "bag.width",
      "height",
    ]);
    expect(["length", "width", "height"].map((d) => dimensionLabelKey("cylinder", d as never))).toEqual([
      "cylinder.diameter",
      "cylinder.diameter",
      "height",
    ]);
    expect(dimensionLabelKey("box", "width")).toBe("width");
  });

  it("has no size search for a not-applicable style", () => {
    expect(sizeSearchApplies("not_applicable")).toBe(false);
    expect(sizeSearchApplies("bag")).toBe(true);
    expect(sizeSearchApplies(undefined)).toBe(true);
  });
});
