import { describe, expect, it } from "vitest";

import { dielineToDxf } from "../export/dxf";
import { ALL_RECIPES } from "../library";
import { REFERENCE_MATERIALS } from "../materials";
import { buildFromRecipe, defaultsOf, presetsOf } from "../recipes";
import { deviationFrom, parseDxf } from "./dxf";

const m = REFERENCE_MATERIALS["board-350"];
const build = (id: string, over: Record<string, unknown> = {}) => {
  const r = ALL_RECIPES.find((x) => x.id === id)!;
  return buildFromRecipe(r, { ...defaultsOf(r), ...presetsOf(r)[0].values, ...over } as never, m).dieline;
};

describe("reading a DXF and matching it to a recipe (U3.6)", () => {
  it.each(["tuck-end", "hexagonal", "mailer", "pizza-box", "te-airplane-crash"])(
    "%s: its own DXF reads back within 0.05 mm",
    (id) => {
      const d = build(id);
      const drawing = parseDxf(dielineToDxf(d));
      expect(drawing.polylines.length).toBeGreaterThan(4);
      const dev = deviationFrom(drawing, d);
      expect(dev.max).toBeLessThan(0.05);
      expect(dev.matches).toBe(true);
      expect(Math.abs(dev.sizeDelta[0])).toBeLessThan(0.05);
    },
  );

  it("finds the same drawing mirrored (drawn from the unprinted side)", () => {
    const d = build("tuck-end");
    const text = dielineToDxf(d)
      .replace(/\n10\n(-?[\d.]+)/g, (_m, x) => `\n10\n${-Number(x)}`)
      .replace(/\n11\n(-?[\d.]+)/g, (_m, x) => `\n11\n${-Number(x)}`);
    // Arcs mirror too: their angles are reflected (180 − a, swapped).
    const mirrored = text.replace(
      /\n50\n([\d.]+)\n51\n([\d.]+)/g,
      (_m, a, b) => `\n50\n${(540 - Number(b)) % 360}\n51\n${(540 - Number(a)) % 360}`,
    );
    const dev = deviationFrom(parseDxf(mirrored), d);
    expect(dev.mirrored).toBe(true);
    expect(dev.max).toBeLessThan(0.05);
  });

  it("does not match a drawing 3 mm longer", () => {
    const dev = deviationFrom(
      parseDxf(dielineToDxf(build("tuck-end", { length: 73 }))),
      build("tuck-end", { length: 70 }),
    );
    expect(dev.matches).toBe(false);
    expect(dev.max).toBeGreaterThan(1);
  });

  it("reads LWPOLYLINE with bulges, CIRCLE and inches", () => {
    const text = [
      "0",
      "SECTION",
      "2",
      "HEADER",
      "9",
      "$INSUNITS",
      "70",
      "1",
      "0",
      "ENDSEC",
      "0",
      "SECTION",
      "2",
      "ENTITIES",
      "0",
      "LWPOLYLINE",
      "8",
      "CUT",
      "90",
      "4",
      "70",
      "1",
      "10",
      "0",
      "20",
      "0",
      "10",
      "2",
      "20",
      "0",
      "42",
      "1",
      "10",
      "2",
      "20",
      "1",
      "10",
      "0",
      "20",
      "1",
      "0",
      "CIRCLE",
      "8",
      "CUT",
      "10",
      "1",
      "20",
      "0.5",
      "40",
      "0.25",
      "0",
      "TEXT",
      "8",
      "0",
      "1",
      "note",
      "0",
      "ENDSEC",
      "0",
      "EOF",
    ].join("\n");
    const d = parseDxf(text);
    expect(d.polylines).toHaveLength(2);
    expect(d.skipped).toBe(1);
    // 2 in wide plus the half-round bulge of 0.5 in: 2.5 in = 63.5 mm.
    expect(d.width).toBeCloseTo(63.5, 1);
    expect(d.height).toBeCloseTo(25.4, 1);
  });
});
