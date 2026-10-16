import { MODULES } from "@getpack/dieline";
import { ALL_RECIPES as RECIPES } from "@getpack/dieline/library";
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
        for (const value of Object.keys(options))
          // A multi-select axis (`pouch_feat`) is keyed by its sorted set joined by `+`, `none` for none.
          for (const part of value === "none" && !axes[axis].includes("none") ? [] : value.split("+"))
            expect(axes[axis], `${r.id}: ${axis}=${value}`).toContain(part);
      }
    }
  });

  it("name every axis of their base when the base has several recipes (getpack-api reads an unnamed axis as any value)", () => {
    const byBase = new Map<string, typeof RECIPES>();
    for (const r of RECIPES.filter((x) => x.base)) byBase.set(r.base!, [...(byBase.get(r.base!) ?? []), r]);
    for (const [base, recipes] of byBase) {
      if (recipes.length < 2) continue;
      const wanted = bases.get(base)!.variant_axes.split(";").filter(Boolean);
      for (const r of recipes)
        expect(Object.keys({ ...r.variant, ...r.variants }).sort(), `${r.id} on ${base}`).toEqual([...wanted].sort());
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
      // The sombrero header is a hang tab's hole (`hangHole` = `sombrero`, U3.4).
      "hangTab",
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
      // Body and insert: the insert is a feature cut as its own piece (U3.4).
      "dieCutInsert",
      "lockCorners",
      // The partition grid is a set of slotted strips, cut flat (U3.4).
      "partitionSet",
    ])
      expect(ids, id).toContain(id);
  });
});
