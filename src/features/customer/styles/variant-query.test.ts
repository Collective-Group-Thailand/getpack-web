import { describe, expect, it } from "vitest";

import { readVariantParams, toVariantQuery, variantsHref } from "./variant-query";

describe("the variants grid's URL (D-410)", () => {
  it("keeps valid options, repeated or comma-separated, and drops the rest", () => {
    const params = readVariantParams({
      view: "variants",
      option: ["window:front_window,hang:euro_slot", "bad option", "window:front_window"],
      sort: "nope",
      category: "folding_carton",
    });
    expect(params).toEqual({ option: ["window:front_window", "hang:euro_slot"], category: "folding_carton" });
    expect(toVariantQuery(params, 24)).toEqual({
      option: ["window:front_window", "hang:euro_slot"],
      category: "folding_carton",
      limit: 24,
    });
  });

  it("toggles one option and keeps the URL stable", () => {
    const params = readVariantParams({ option: "window:front_window" });
    expect(variantsHref(params, { toggle: "hang:euro_slot" })).toBe(
      "/styles?view=variants&option=hang%3Aeuro_slot&option=window%3Afront_window",
    );
    expect(variantsHref(params, { toggle: "window:front_window" })).toBe("/styles?view=variants");
  });
});
