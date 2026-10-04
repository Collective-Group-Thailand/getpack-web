import { describe, expect, it } from "vitest";

import { REFERENCE_BY_CATEGORY, REFERENCE_MATERIALS } from "../materials";
import { ALL_RECIPES as RECIPES } from "../library";
import { buildFromRecipe, defaultsOf, outerSizeOf, presetsOf } from "../recipes";
import { resolveParam } from "../recipes/params";
import type { StyleRecipe } from "../recipes/types";
import { isBuildable, validRanges } from "../solver";
import type { MaterialSpec, ParamValues } from "../types";
import { collisions } from "./collide";
import { foldModel, modelBounds } from "./thickness";

/**
 * U3.3 virtual fold test: for the smallest, a typical and the largest size each recipe allows, on
 * two calipers of its category, the closed thick model is the expected outer size ± 1 mm on every
 * axis, and no face passes through another.
 */

/** The size parameters pushed to their smallest or largest valid value one after another. */
function extreme(r: StyleRecipe, m: MaterialSpec, end: "min" | "max"): ParamValues {
  let v: ParamValues = { ...defaultsOf(r), ...presetsOf(r)[0].values };
  const size = new Set(
    r.params
      .map((p) => resolveParam(p))
      .filter((p) => p.group === "size" && p.kind === "length")
      .map((p) => p.key),
  );
  for (const range of validRanges(r, m, v).filter((x) => size.has(x.param))) {
    const now = validRanges(r, m, v).find((x) => x.param === range.param)!;
    if (!now.intervals.length) continue;
    const x = end === "min" ? now.intervals[0][0] : now.intervals[now.intervals.length - 1][1];
    const next = { ...v, [range.param]: Math.round(x * 100) / 100 };
    if (isBuildable(r, next, m)) v = next;
  }
  return v;
}

const foldable = RECIPES.filter(
  (r) => buildFromRecipe(r, presetsOf(r)[0].values, REFERENCE_MATERIALS["board-350"]).hinges,
);

describe.each(foldable.map((r) => ({ r })))("fold gate · $r.id", ({ r }) => {
  const calipers = REFERENCE_BY_CATEGORY[r.category].slice(0, 2);
  const cases = calipers.flatMap((id) => {
    const m = REFERENCE_MATERIALS[id];
    return [
      { size: "min", id, m, v: extreme(r, m, "min") },
      { size: "typical", id, m, v: { ...defaultsOf(r), ...presetsOf(r)[0].values } },
      { size: "max", id, m, v: extreme(r, m, "max") },
    ];
  });

  it.each(cases)("$size on $id: closes to its outer size ± 1 mm, nothing passing through", ({ m, v }) => {
    const built = buildFromRecipe(r, v, m);
    const b = modelBounds(built.dieline, foldModel(built.dieline, built.hinges!, m));
    const size = [0, 1, 2].map((i) => b.max[i] - b.min[i]).sort((p, q) => p - q);
    const o = outerSizeOf(r, v, m);
    const expected = [o.length, o.width, o.height].sort((p, q) => p - q);
    size.forEach((s, i) =>
      expect(Math.abs(s - expected[i]), `axis ${i}: ${s} vs ${expected[i]}`).toBeLessThanOrEqual(1),
    );
    expect(collisions(built.dieline, built.hinges!)).toEqual([]);
  });
});
