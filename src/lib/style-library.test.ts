import { MODULES, RECIPES } from "@packio/dieline";
import { describe, expect, it } from "vitest";

import master from "../../docs/design-tool/style-library-master.json" with { type: "json" };

/**
 * The engine's recipes against the style library programme (`style-library-master.json`): a
 * recipe's base is a real row, and the variant it stands for uses that row's axes and values.
 */
describe("recipes and the style library master file", () => {
  const bases = new Map(master.styles.map((s) => [s.code, s]));
  const axes = master.axes as Record<string, string[]>;

  it("map every recipe that names a base to a master row of the same category family", () => {
    for (const r of RECIPES.filter((x) => x.base)) {
      const row = bases.get(r.base!);
      expect(row, `${r.id} → ${r.base}`).toBeDefined();
      for (const [axis, value] of Object.entries(r.variant ?? {})) {
        expect(row!.variant_axes.split(";"), `${r.id}: ${axis} on ${r.base}`).toContain(axis);
        expect(axes[axis], `${r.id}: ${axis}=${value}`).toContain(value);
      }
    }
  });

  it("vary only along axes of their base, with the master file's values", () => {
    for (const r of RECIPES.filter((x) => x.base && x.variants)) {
      const row = bases.get(r.base!)!;
      for (const [axis, options] of Object.entries(r.variants!)) {
        expect(row.variant_axes.split(";"), `${r.id}: ${axis} on ${r.base}`).toContain(axis);
        for (const value of Object.keys(options)) expect(axes[axis], `${r.id}: ${axis}=${value}`).toContain(value);
      }
    }
  });

  it("only pair tuck closures the master file allows", () => {
    const pairs = new Set(master.allowed_tuck_pairs.map(([top, bottom]) => `${top}/${bottom}`));
    for (const r of RECIPES) {
      const v = r.variant ?? {};
      if (v.tuck_top && v.tuck_bottom) expect(pairs, r.id).toContain(`${v.tuck_top}/${v.tuck_bottom}`);
    }
  });

  it("declare a module for every construction the programme names (implemented or planned)", () => {
    const ids = new Set(MODULES.map((m) => m.id));
    for (const id of [
      "tube",
      "tray",
      "ngonTube",
      "taperedPail",
      "pouchWeb",
      "flatShape",
      "cone",
      "tuck",
      "airplaneTuck",
      "seal",
      "snapLock123",
      "crashLock",
      "fourFlapLock",
      "hingedLid",
      "petal",
      "gableHandle",
      "rsc",
      "fol",
      "cssc",
      "window",
      "hangTab",
      "sombreroHeader",
      "thumbNotch",
      "tearStrip",
      "adhesiveStrip",
      "handHoles",
      "vents",
      "dispenser",
      "neckLock",
      "dustFlapLock",
      "slitLock",
      "lidAndBase",
      "sleeveAndDrawer",
      "bodyAndInsert",
      "partitionGrid",
    ])
      expect(ids, id).toContain(id);
  });
});
