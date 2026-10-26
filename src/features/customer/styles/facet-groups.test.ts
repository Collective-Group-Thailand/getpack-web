import { describe, expect, it } from "vitest";

import { foldedItems, foldedSubGroups, groupFacets, splitOption } from "./facet-groups";
import { readParams } from "./query";

const facets = {
  category: [{ value: "folding_carton", count: 40 }],
  pricePath: [{ value: "instant", count: 16 }],
  closure: [
    { value: "tuck_bottom:crash_lock", count: 12 },
    { value: "tuck_top:reverse_tuck", count: 9 },
    { value: "tuck_bottom:snap_lock", count: 7 },
    { value: "lock:slot", count: 0 },
  ],
  feature: [
    { value: "hang:euro_slot", count: 4 },
    { value: "window:front_window", count: 6 },
  ],
  useCase: [
    { value: "gift", count: 8 },
    { value: "food", count: 0 },
  ],
  materialClass: [],
  family: [{ value: "tuck_end", count: 5 }],
};

describe("the sidebar's facet groups (styles redesign §c)", () => {
  it("splits option values at the axis, so the prefix heads its values once", () => {
    expect(splitOption("tuck_bottom:crash_lock")).toEqual(["tuck_bottom", "crash_lock"]);
    expect(splitOption("plain")).toEqual(["", "plain"]);
    const closure = groupFacets(facets, readParams({})).find((g) => g.key === "closure")!;
    expect(closure.subGroups.map((s) => s.axis)).toEqual(["tuck_top", "tuck_bottom"]);
    expect(closure.subGroups[1].items.map((i) => i.option)).toEqual(["crash_lock", "snap_lock"]);
  });

  it("orders axes as the variants grid does: top, bottom, window, hang", () => {
    const feature = groupFacets(facets, readParams({})).find((g) => g.key === "feature")!;
    expect(feature.subGroups.map((s) => s.axis)).toEqual(["window", "hang"]);
  });

  it("hides empty values and empty facets, but never a selected value", () => {
    const groups = groupFacets(facets, readParams({ close: "lock:slot", use: "candle_fragrance" }));
    expect(groups.map((g) => g.key)).toEqual(["closure", "feature", "useCase", "family"]);
    const closure = groups.find((g) => g.key === "closure")!;
    expect(closure.selected).toBe(1);
    expect(closure.subGroups.flatMap((s) => s.items).find((i) => i.value === "lock:slot")).toMatchObject({
      count: 0,
      selected: true,
    });
    const useCase = groups.find((g) => g.key === "useCase")!;
    expect(useCase.subGroups[0].items.map((i) => i.value)).toEqual(["gift", "candle_fragrance"]);
  });

  it("folds long lists to five, keeping selected values in view", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ value: `v${i}`, count: 1, selected: i === 7 }));
    const { shown, hidden } = foldedItems(items);
    expect(shown.map((i) => i.value)).toEqual(["v0", "v1", "v2", "v3", "v4", "v7"]);
    expect(hidden).toBe(3);
    expect(foldedItems(items.slice(0, 4)).hidden).toBe(0);
  });

  it("shows the six sub-groups with the highest total count, in their own order, and counts the rest", () => {
    const sub = (axis: string, ...counts: number[]) => ({
      axis,
      items: counts.map((count, i) => ({ value: `${axis}:${i}`, count, selected: false })),
    });
    const subs = [
      sub("a", 1),
      sub("b", 9),
      sub("c", 2, 2),
      sub("d", 3),
      sub("e", 1),
      sub("f", 8),
      sub("g", 5),
      sub("h", 4),
    ];
    const { shown, hidden } = foldedSubGroups(subs);
    expect(shown.map((s) => s.axis)).toEqual(["b", "c", "d", "f", "g", "h"]);
    expect(hidden).toBe(2);
    expect(foldedSubGroups(subs.slice(0, 6)).hidden).toBe(0);
  });

  it("keeps a sub-group that holds a selected value even when it is not in the top six", () => {
    const sub = (axis: string, count: number, selected = false) => ({
      axis,
      items: [{ value: axis, count, selected }],
    });
    const subs = [sub("a", 1, true), ...["b", "c", "d", "e", "f", "g"].map((axis) => sub(axis, 5))];
    const { shown, hidden } = foldedSubGroups(subs);
    expect(shown.map((s) => s.axis)).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect(hidden).toBe(0);
  });
});
