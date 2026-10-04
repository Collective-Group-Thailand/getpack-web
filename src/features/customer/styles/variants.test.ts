import { describe, expect, it } from "vitest";

import { change, keyOf, optionsOf, selectionOf, variantOf, type Axis, type Variant } from "./variants";

const v = (code: string, options: Record<string, unknown>): Variant => ({
  code,
  options,
  configurationPatches: [],
  pricePath: "instant",
  priceReasons: [],
});

const axes: Axis[] = [
  { axis: "tuck_top", multiSelect: false, values: ["straight_tuck", "reverse_tuck", "seal"] },
  { axis: "hang", multiSelect: false, values: ["none", "euro_slot"] },
];
const variants = [
  v("A", { tuck_top: "straight_tuck", hang: "none" }),
  v("B", { tuck_top: "reverse_tuck", hang: "none" }),
  v("C", { tuck_top: "reverse_tuck", hang: "euro_slot" }),
  v("D", { tuck_top: "seal", hang: "none" }),
];

describe("the variant picker", () => {
  it("offers only published combinations, and says what an option conflicts with", () => {
    const selection = selectionOf(variants[0], axes);
    expect(optionsOf(axes[1], selection, variants)).toEqual([
      { value: "none", available: true },
      { value: "euro_slot", available: false, conflicts: ["tuck_top"] },
    ]);
    const reverse = change(selection, axes[0], "reverse_tuck");
    expect(optionsOf(axes[1], reverse, variants).every((o) => o.available)).toBe(true);
    expect(variantOf(variants, change(reverse, axes[1], "euro_slot"))?.code).toBe("C");
  });

  it("treats a multi-select axis as a set, keyed like packio-api", () => {
    const pouch: Axis = { axis: "pouch_feat", multiSelect: true, values: ["zipper", "window"] };
    const list = [
      v("P0", { pouch_feat: [] }),
      v("P1", { pouch_feat: ["zipper"] }),
      v("P2", { pouch_feat: ["window", "zipper"] }),
    ];
    const empty = selectionOf(list[0], [pouch]);
    expect(empty).toEqual({ pouch_feat: [] });
    expect(optionsOf(pouch, empty, list)).toEqual([
      { value: "zipper", available: true },
      { value: "window", available: false, conflicts: [] },
    ]);
    const zip = change(empty, pouch, "zipper");
    expect(optionsOf(pouch, zip, list).map((o) => o.available)).toEqual([true, true]);
    expect(keyOf(["zipper", "window"])).toBe("window+zipper");
    expect(keyOf([])).toBe("none");
  });
});
