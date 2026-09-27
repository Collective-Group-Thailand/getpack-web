import { describe, expect, it } from "vitest";

import { contourGap } from "./path";
import { resolveStyleId, STYLE_ALIASES, STYLES, stylesByCategory } from "./styles";
import { parseSvgPath } from "./svgpath";

describe("parseSvgPath", () => {
  it("reads absolute and relative commands into closed contours", () => {
    const [c] = parseSvgPath("M0 0 h40 v20 l-40 0 z");
    expect(c).toHaveLength(4);
    expect(contourGap(c)).toBeLessThan(1e-9);
    expect(c[1].to).toEqual([40, 20]);
  });

  it("keeps circular arcs as arcs and turns elliptical arcs and quadratics into Béziers", () => {
    const [circle] = parseSvgPath("M10 0 A10 10 0 0 1 -10 0 A10 10 0 0 1 10 0 Z");
    expect(circle.map((e) => e.kind)).toEqual(["arc", "arc"]);
    const [oval] = parseSvgPath("M20 0 A20 10 0 0 1 -20 0 A20 10 0 0 1 20 0 Z");
    expect(oval.every((e) => e.kind === "bezier")).toBe(true);
    const [quad] = parseSvgPath("M0 0 Q10 10 20 0 T40 0 L40 10 L0 10 Z");
    expect(quad[0].kind).toBe("bezier");
    expect(quad[1].kind).toBe("bezier");
  });

  it("closes an open subpath and reads several", () => {
    const shapes = parseSvgPath("M0 0 L10 0 L10 10 M20 0 L30 0 L30 10 Z");
    expect(shapes).toHaveLength(2);
    expect(shapes.every((c) => contourGap(c) < 1e-9)).toBe(true);
  });

  it("refuses garbage", () => {
    expect(() => parseSvgPath("0 0 L10 10")).toThrow();
  });
});

describe("the library", () => {
  it("covers every category and the whole reference set", () => {
    expect(stylesByCategory().map((g) => g.category)).toEqual([
      "folding_carton",
      "corrugated",
      "tray_lid",
      "specialty",
      "flat",
    ]);
    const ids = new Set(STYLES.map((s) => s.id));
    for (const id of [
      "tuck-end",
      "reverse-tuck-end",
      "snap-lock-bottom",
      "crash-lock-bottom",
      "seal-end",
      "hang-tab-tuck",
      "sleeve",
      "sleeve-drawer",
      "pillow",
      "gable",
      "hexagonal",
      "rsc",
      "hsc",
      "fol",
      "cssc",
      "mailer",
      "wrap-around",
      "tray",
      "tray-6-corner",
      "double-wall-tray",
      "telescope",
      "flat-rect",
      "flat-rounded-rect",
      "flat-circle",
      "flat-oval",
      "flat-custom",
      "hang-tag",
      "cup-sleeve",
      "band",
      "pouch",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("resolves every alias, including the legacy drawing-service names, to a real style", () => {
    for (const [alias, id] of Object.entries(STYLE_ALIASES)) expect(resolveStyleId(alias), alias).toBe(id);
    expect(resolveStyleId("RTE")).toBe("reverse-tuck-end");
    expect(resolveStyleId("folding-truck-end-snap-lock-bottom")).toBe("snap-lock-bottom");
    expect(resolveStyleId("nonsense")).toBeNull();
  });

  it("lists legacy pattern keys only on styles that exist, each key once", () => {
    const seen = new Map<string, string>();
    for (const s of STYLES) {
      for (const key of s.legacy?.patternKeys ?? []) {
        // A legacy key may map to two styles only where the mapping says it is ambiguous.
        if (seen.has(key) && !["pid:10"].includes(key)) throw new Error(`${key} on ${seen.get(key)} and ${s.id}`);
        seen.set(key, s.id);
      }
    }
  });
});
