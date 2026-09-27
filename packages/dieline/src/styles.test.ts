import { describe, expect, it } from "vitest";

import { checkDieline } from "./checks";
import { dielineToDxf } from "./export/dxf";
import { dielineToSvg } from "./export/svg";
import { allFaces } from "./faces";
import { foldedBounds } from "./fold";
import { faceLabel, pieceLabel } from "./labels";
import { REFERENCE_BY_CATEGORY, REFERENCE_MATERIALS } from "./materials";
import { hingeMapOf, resolveValues, STYLES } from "./styles";
import type { BoxStyleDef, MaterialSpec } from "./types";

/**
 * Part E quality gate: every style × preset × reference material. A new style is covered the
 * moment it joins the registry — nothing to add here.
 */

const materialsOf = (s: BoxStyleDef): [string, MaterialSpec][] =>
  REFERENCE_BY_CATEGORY[s.category].map((id) => [id, REFERENCE_MATERIALS[id]] as [string, MaterialSpec]);

const cases = STYLES.flatMap((style) =>
  style.presets.flatMap((preset) =>
    materialsOf(style).map(([materialId, material]) => ({ style, preset, materialId, material })),
  ),
);

describe("registry", () => {
  it("has unique ids and names in both languages", () => {
    expect(new Set(STYLES.map((s) => s.id)).size).toBe(STYLES.length);
    for (const s of STYLES) {
      expect(s.name.th && s.name.en && s.description.th && s.description.en, s.id).toBeTruthy();
      expect(s.presets.length, s.id).toBeGreaterThan(0);
      expect(new Set(s.params.map((p) => p.key)).size, s.id).toBe(s.params.length);
    }
  });

  it("every enum default is one of its options", () => {
    for (const s of STYLES) {
      for (const p of s.params.filter((q) => q.kind === "enum")) {
        const value = s.defaults[p.key];
        if (value === undefined) continue;
        expect(
          p.options?.map((o) => o.value),
          `${s.id}.${p.key}`,
        ).toContain(value);
      }
    }
  });
});

describe.each(cases)("$style.id · $preset.id · $materialId", ({ style, preset, material }) => {
  const values = resolveValues(style, preset.values);
  const d = style.build(values, material);

  it("is a cuttable, foldable blank: closed loops (≤ 0.01 mm), free edges cut, no overlaps, no dangling cuts", () => {
    expect(checkDieline(d)).toEqual([]);
  });

  it("is anchored at the origin, with a size that matches its pieces", () => {
    const right = Math.max(...d.pieces.map((p) => p.bounds.x + p.bounds.width));
    const bottom = Math.max(...d.pieces.map((p) => p.bounds.y + p.bounds.height));
    expect(Math.min(...d.pieces.map((p) => p.bounds.x))).toBeCloseTo(0, 6);
    expect(Math.min(...d.pieces.map((p) => p.bounds.y))).toBeCloseTo(0, 6);
    expect(d.width).toBeCloseTo(right, 6);
    expect(d.height).toBeCloseTo(bottom, 6);
  });

  it("labels every face and piece with words in both languages", () => {
    for (const f of allFaces(d)) expect(faceLabel(f.label).en, f.id).not.toBe(f.label);
    for (const p of d.pieces) expect(pieceLabel(p.label).en, p.id).not.toBe(p.label);
  });

  it("validate() accepts the preset", () => {
    expect(style.validate(preset.values, material).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("validate() rejects a size beyond the style's range", () => {
    const length = style.params.find((p) => p.key === "length");
    if (length?.max === undefined) return;
    const issues = style.validate({ ...preset.values, length: length.max + 100 }, material);
    expect(issues.some((i) => i.code === "size.out_of_range" && i.param === "length")).toBe(true);
    const tooSmall = style.validate({ ...preset.values, length: (length.min ?? 1) - 1 }, material);
    expect(tooSmall.some((i) => i.severity === "error")).toBe(true);
  });

  const hinges = hingeMapOf(style, values, material);
  it.runIf(hinges)("folds into a closed box: bounding box = inside L × W × H within caliper allowances ± 1 mm", () => {
    const b = foldedBounds(d, hinges!);
    const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]].sort((p, q) => p - q);
    const inside = [values.length, values.width, values.height].map(Number).sort((p, q) => p - q);
    const allowance = 2 * material.caliperMm + 1;
    size.forEach((s, i) => {
      expect(s, `axis ${i}`).toBeGreaterThanOrEqual(inside[i] - 1);
      expect(s, `axis ${i}`).toBeLessThanOrEqual(inside[i] + allowance + (style.fold3dSlack ?? 0));
    });
  });
});

describe.each(STYLES.map((s) => ({ style: s })))("snapshots · $style.id", ({ style }) => {
  const [materialId, material] = materialsOf(style)[0];
  it.each(style.presets.map((p) => ({ preset: p })))("SVG and DXF are stable for $preset.id", async ({ preset }) => {
    const d = style.build(resolveValues(style, preset.values), material);
    await expect(dielineToSvg(d)).toMatchFileSnapshot(`../fixtures/svg/${style.id}--${preset.id}--${materialId}.svg`);
    await expect(dielineToDxf(d)).toMatchFileSnapshot(`../fixtures/dxf/${style.id}--${preset.id}--${materialId}.dxf`);
  });
});
