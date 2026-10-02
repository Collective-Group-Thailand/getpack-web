import { describe, expect, it } from "vitest";

import { allowancesOf } from "./constants";
import { checkDieline } from "./checks";
import { assemble, face, piece } from "./faces";
import { REFERENCE_BY_CATEGORY, REFERENCE_MATERIALS } from "./materials";
import { rectangle } from "./path";
import { buildFromRecipe, defaultsOf, presetsOf, RECIPES } from "./recipes";
import { fitsEnvelope, recipeProcesses } from "./rules/envelope";
import { dielineManufacturing } from "./rules/manufacturing";
import { MATERIAL_CLASSES, materialClassOf, materialRules } from "./rules/materials";
import { explain, isBuildable, sizeRanges, validRanges } from "./solver";
import { getStyle } from "./styles";
import type { MaterialSpec } from "./types";

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const board = REFERENCE_MATERIALS["board-350"];
const fluteB = REFERENCE_MATERIALS["flute-b"];

describe("material classes", () => {
  it("follow the kind unless the catalogue names a finer class", () => {
    expect(materialClassOf(board)).toBe("paperboard");
    expect(materialClassOf(REFERENCE_MATERIALS["label-film"])).toBe("label_stock");
    expect(materialClassOf({ ...board, class: "food_board" })).toBe("food_board");
  });

  it("give every reference board a caliper inside its class's range, and every class its rules", () => {
    for (const [id, m] of Object.entries(REFERENCE_MATERIALS)) {
      const [lo, hi] = materialRules(m).caliper;
      expect(m.caliperMm, id).toBeGreaterThanOrEqual(lo);
      expect(m.caliperMm, id).toBeLessThanOrEqual(hi);
    }
    for (const c of MATERIAL_CLASSES) {
      const r = materialRules({ caliperMm: 1, kind: "paperboard", class: c });
      expect(r.minPanel, c).toBeGreaterThan(0);
      expect(r.caliper[0], c).toBeLessThan(r.caliper[1]);
    }
  });

  it("scale corrugated rules with the flute", () => {
    const e = materialRules(REFERENCE_MATERIALS["flute-e"]);
    const bc = materialRules(REFERENCE_MATERIALS["flute-bc"]);
    expect(bc.minPanel).toBeGreaterThan(e.minPanel);
    expect(bc.minSlot).toBeCloseTo(13, 9);
  });
});

describe("explain", () => {
  it("returns codes and numbers the UI can translate", () => {
    const gable = recipe("gable");
    const v = explain(gable, { length: 40, width: 80, height: 100 }, board);
    const handle = v.find((x) => x.code === "handle.too_narrow")!;
    expect(handle).toMatchObject({ rule: "constraint", constraintId: "gableHandle.width", param: "length" });
    expect(handle.expected).toEqual({ min: 60 });
    expect(handle.actual).toBeCloseTo(40 + allowancesOf(board).panel, 9);

    const range = explain(recipe("tuck-end"), { length: 500 }, board)[0];
    expect(range).toMatchObject({ code: "size.out_of_range", rule: "schema", param: "length", actual: 500 });
    expect(range.expected).toEqual({ min: 20, max: 400 });
  });

  it("names every parameter a rule reads", () => {
    const deep = explain(recipe("tuck-end"), { length: 70, width: 40, height: 30, tuckDepth: 40 }, board).find(
      (x) => x.code === "tuck.too_deep",
    )!;
    expect(deep.params).toEqual(expect.arrayContaining(["tuckDepth", "height"]));
    expect(deep.expected?.max).toBeCloseTo(30 + allowancesOf(board).depth - 5, 9);
  });

  it("adds the material class's manufacturing rules, which validate() leaves to it", () => {
    const rsc = recipe("rsc");
    const values = { length: 250, width: 180, height: 120, glueWidth: 10 };
    const v = explain(rsc, values, fluteB);
    expect(v.find((x) => x.code === "mfg.glue_flap_too_narrow")).toMatchObject({
      rule: "manufacturing",
      param: "glueWidth",
    });
    expect(
      getStyle("rsc")
        .validate(values, fluteB)
        .filter((i) => i.severity === "error"),
    ).toEqual([]);
  });

  it("keeps warnings without failing the size", () => {
    const rsc = recipe("rsc");
    const values = { length: 150, width: 200, height: 120 };
    expect(explain(rsc, values, fluteB).map((x) => x.code)).toContain("size.width_exceeds_length");
    expect(isBuildable(rsc, values, fluteB)).toBe(true);
  });

  /**
   * Presets the manufacturing rules show cannot be made as drawn — findings for prepress (PROGRESS
   * U3.3), kept visible here rather than hidden by changing a preset customers already use.
   */
  const KNOWN_FINDINGS: Record<string, string> = {
    // The 35 mm corrugated glue flap is wider than the 33.6 mm sleeve side it is glued inside.
    "sleeve-drawer · jewellery · flute-e": "mfg.glue_flap_too_wide",
  };

  it("finds no rule broken by any preset on any reference board of its category, but the known findings", () => {
    for (const r of RECIPES)
      for (const id of REFERENCE_BY_CATEGORY[r.category])
        for (const p of presetsOf(r)) {
          const key = `${r.id} · ${p.id} · ${id}`;
          const errors = explain(r, p.values, REFERENCE_MATERIALS[id]).filter((x) => x.severity === "error");
          expect(
            errors.map((x) => x.code),
            key,
          ).toEqual(KNOWN_FINDINGS[key] ? [KNOWN_FINDINGS[key]] : []);
        }
  });
});

describe("validRanges", () => {
  it("finds a constraint's boundary to 0.01 mm", () => {
    const [length] = validRanges(recipe("gable"), board);
    expect(length.param).toBe("length");
    expect(length.intervals).toHaveLength(1);
    expect(length.intervals[0][0]).toBeCloseTo(60 - allowancesOf(board).panel, 2);
    expect(length.intervals[0][1]).toBe(400);
  });

  it("narrows by material: a tray on B flute needs taller walls than on board", () => {
    const height = (m: MaterialSpec) => validRanges(recipe("tray"), m).find((r) => r.param === "height")!;
    expect(height(board).intervals[0][0]).toBe(10);
    // Four calipers (material.too_thick) and five less the tray allowance (mfg.panel_too_narrow) coincide.
    expect(height(fluteB).intervals[0][0]).toBeCloseTo(4 * fluteB.caliperMm, 2);
  });

  it("summarises per material as the widest span around any preset", () => {
    const ranges = sizeRanges(recipe("gable"), board);
    expect(ranges.length.min).toBeCloseTo(60 - allowancesOf(board).panel, 2);
    expect(ranges.height).toEqual({ min: 20, max: 450 });
  });
});

/** mulberry32: a seeded generator, so a failure is reproducible. */
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe.each(RECIPES.map((r) => ({ r })))("property · $r.id", ({ r }) => {
  const rnd = random(r.id.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7));
  const STEP = 0.05;
  it.each(REFERENCE_BY_CATEGORY[r.category].map((id) => ({ id })))(
    "on $id: any size inside validRanges builds clean; just outside fails with a reason code",
    ({ id }) => {
      const m = REFERENCE_MATERIALS[id];
      const base = { ...defaultsOf(r), ...presetsOf(r)[0].values };
      for (const range of validRanges(r, m, base)) {
        for (const [a, b] of range.intervals) {
          for (let k = 0; k < 3; k++) {
            const x = b - a > 2 * STEP ? a + STEP + rnd() * (b - a - 2 * STEP) : (a + b) / 2;
            const values = { ...base, [range.param]: x };
            expect(isBuildable(r, values, m), `${range.param}=${x}`).toBe(true);
            expect(checkDieline(buildFromRecipe(r, values, m).dieline), `${range.param}=${x}`).toEqual([]);
          }
          for (const x of [a - STEP, b + STEP]) {
            if (range.intervals.some(([p, q]) => x >= p && x <= q)) continue;
            const errors = explain(r, { ...base, [range.param]: x }, m).filter((v) => v.severity === "error");
            expect(errors.length, `${range.param}=${x}`).toBeGreaterThan(0);
            expect(errors.every((v) => v.code.length > 0)).toBe(true);
          }
        }
      }
    },
  );
});

describe("machine envelopes", () => {
  const rsc = recipe("rsc");
  const d = buildFromRecipe(rsc, { length: 350, width: 250, height: 200 }, fluteB).dieline;

  it("fits a blank either way round, and says why it does not", () => {
    const [big, turned, small, thin] = fitsEnvelope(d, fluteB, [
      { ref: "a", maxSheet: { width: 2000, height: 1500 } },
      { ref: "b", maxSheet: { width: d.height + 1, height: d.width + 1 } },
      { ref: "c", maxSheet: { width: 600, height: 400 } },
      { ref: "d", maxSheet: { width: 2000, height: 1500 }, maxCaliperMm: 2 },
    ]);
    expect(big).toMatchObject({ fits: true, rotated: false, reasons: [] });
    expect(turned).toMatchObject({ fits: true, rotated: true });
    expect(small).toMatchObject({ fits: false, reasons: ["sheet.too_large"] });
    expect(thin).toMatchObject({ fits: false, reasons: ["caliper.too_thick"] });
    const [tiny] = fitsEnvelope(d, fluteB, [
      { ref: "e", maxSheet: { width: 5000, height: 5000 }, minSheet: { width: 3000, height: 3000 } },
    ]);
    expect(tiny.reasons).toEqual(["sheet.too_small"]);
  });

  it("checks the processes a recipe's modules need", () => {
    const crash = recipeProcesses(recipe("crash-lock-bottom"));
    expect(crash).toContain("folder_gluer_crash_lock");
    expect(recipeProcesses(recipe("tuck-end"))).toContain("window_patching");
    const dl = buildFromRecipe(recipe("crash-lock-bottom"), {}, board).dieline;
    const [fit] = fitsEnvelope(
      dl,
      board,
      [{ ref: "x", maxSheet: { width: 1000, height: 700 }, processes: ["die_cut"] }],
      crash,
    );
    expect(fit.fits).toBe(false);
    expect(fit.missing).toContain("folder_gluer_crash_lock");
  });

  it("checks each separately cut piece, not the sheet they are drawn on", () => {
    const tele = buildFromRecipe(recipe("telescope"), {}, board).dieline;
    const widest = Math.max(...tele.pieces.map((p) => Math.max(p.bounds.width, p.bounds.height)));
    const [fit] = fitsEnvelope(tele, board, [{ ref: "x", maxSheet: { width: widest + 1, height: widest + 1 } }]);
    expect(tele.width).toBeGreaterThan(widest + 1);
    expect(fit.fits).toBe(true);
  });
});

describe("dieline-wide manufacturing rules", () => {
  const sheet = (gap: number) => {
    // A 40 × 40 panel creased on its right edge, with a slit cut `gap` mm inside it, parallel.
    const p = face("p", "panel", "panel", rectangle(0, 0, 40, 40, { right: "crease" }), {
      holes: [rectangle(40 - gap - 0.2, 5, 0.2, 30)],
    });
    return assemble("probe", [piece("blank", "blank", [p])]);
  };

  it("refuses a cut running closer beside a crease than the class allows", () => {
    const min = materialRules(board).cutToCrease;
    expect(dielineManufacturing(sheet(min / 2), board).map((i) => i.code)).toEqual(["mfg.cut_near_crease"]);
    expect(dielineManufacturing(sheet(min * 2), board)).toEqual([]);
  });

  it("refuses a caliper its class is not made in", () => {
    expect(dielineManufacturing(sheet(10), { caliperMm: 3, kind: "paperboard" }).map((i) => i.code)).toEqual([
      "mfg.caliper_out_of_range",
    ]);
  });
});
