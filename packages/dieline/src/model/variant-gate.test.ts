import { describe, expect, it } from "vitest";

import { checkDieline } from "../checks";
import { ALL_RECIPES } from "../library";
import { REFERENCE_BY_CATEGORY, REFERENCE_MATERIALS } from "../materials";
import { buildFromRecipe, defaultsOf, outerSizeOf, presetsOf, styleFromRecipe, variantsOf } from "../recipes";
import { materialClassOf } from "../rules/materials";
import type { StyleRecipe } from "../recipes/types";
import { collisions } from "./collide";
import { foldModel, modelBounds } from "./thickness";

/**
 * U3.4 §1: **every structural variant** passes the U3.2 + U3.3 gates, not only a recipe's
 * presets — at the first of the recipe's presets the variant is valid at (a front window does not
 * fit the smallest cosmetics carton, and need not), on the first reference board of its category
 * that the recipe allows: a clean blank (closed loops, no overlaps, no dangling cuts),
 * and, when it folds, the thick model closes to its outer size ± 1 mm with nothing passing through.
 * The size extremes are the fold gate's (`fold-gate.test.ts`).
 */

function boardFor(r: StyleRecipe) {
  const ids = REFERENCE_BY_CATEGORY[r.category];
  const id =
    ids.find((x) => r.materials.includes(REFERENCE_MATERIALS[x].kind)) ??
    // A material the category's boards do not cover (rigid greyboard): any reference board of that kind.
    Object.keys(REFERENCE_MATERIALS).find((x) => r.materials.includes(REFERENCE_MATERIALS[x].kind)) ??
    ids[0];
  return { id, m: REFERENCE_MATERIALS[id] };
}

const cases = ALL_RECIPES.flatMap((r) =>
  variantsOf(r).map((variant) => ({ r, variant, key: `${r.id} · ${variant.key}` })),
);

describe("variant gate", () => {
  it("covers every variant of every recipe once", () => {
    expect(new Set(cases.map((c) => c.key)).size).toBe(cases.length);
  });

  it.each(cases)("$key", ({ r, variant }) => {
    const { m } = boardFor(r);
    const style = styleFromRecipe(r);
    const errors = (v: Record<string, unknown>) => style.validate(v as never, m).filter((i) => i.severity === "error");
    const at = presetsOf(r).map((p) => ({ ...defaultsOf(r), ...p.values, ...variant.values }));
    const values = at.find((v) => errors(v).length === 0);
    expect(values, `${materialClassOf(m)}: ${JSON.stringify(errors(at[0]).map((i) => i.code))}`).toBeDefined();
    if (!values) return;
    const built = buildFromRecipe(r, values, m);
    expect(checkDieline(built.dieline)).toEqual([]);
    if (!built.hinges) return;
    const b = modelBounds(built.dieline, foldModel(built.dieline, built.hinges, m));
    const size = [0, 1, 2].map((i) => b.max[i] - b.min[i]).sort((p, q) => p - q);
    const o = outerSizeOf(r, values, m);
    const expected = [o.length, o.width, o.height].sort((p, q) => p - q);
    size.forEach((s, i) =>
      expect(Math.abs(s - expected[i]), `axis ${i}: ${s} vs ${expected[i]}`).toBeLessThanOrEqual(1),
    );
    expect(collisions(built.dieline, built.hinges)).toEqual([]);
  });
});

/** Variants that share a base must not repeat a key: packio-api picks the one recipe whose variants match. */
describe("variant keys per base", () => {
  it("are unique across the recipes of one base", () => {
    const seen = new Map<string, string>();
    for (const r of ALL_RECIPES) {
      if (!r.base) continue;
      for (const v of variantsOf(r)) {
        const key = `${r.base}|${v.key}`;
        expect(seen.get(key), `${key} in ${r.id}`).toBeUndefined();
        seen.set(key, r.id);
      }
    }
  });
});
