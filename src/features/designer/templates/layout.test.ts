import { describe, expect, it } from "vitest";
import { allFaces, faceBounds, getStyle, hingeMapOf, pointInPolygon, flattenContour, STYLES } from "@getpack/dieline";

import { uprightAngles } from "../lib/upright";
import type { DesignContent } from "../types";
import { applyBrand, faceForRole, readLayout, reflow, LAYOUT_SCHEMA_VERSION } from "./layout";
import { TEMPLATE_LIBRARY } from "./library";

const PT = 25.4 / 72;
const boxes = STYLES.filter((s) =>
  ["length", "width", "height"].every((k) => s.params.some((p) => p.key === k && p.group === "size")),
);

describe("studio templates (U4.4)", () => {
  it("are at least 20, across all seven use cases, three layouts each, in the current schema", () => {
    expect(TEMPLATE_LIBRARY.length).toBeGreaterThanOrEqual(20);
    expect(new Set(TEMPLATE_LIBRARY.flatMap((t) => t.useCases)).size).toBe(7);
    expect(new Set(TEMPLATE_LIBRARY.map((t) => t.code)).size).toBe(TEMPLATE_LIBRARY.length);
    for (const t of TEMPLATE_LIBRARY) expect(readLayout(t.layoutSchemaVersion, t.layout)).not.toBeNull();
    expect(readLayout(LAYOUT_SCHEMA_VERSION + 1, TEMPLATE_LIBRARY[0]!.layout)).toBeNull();
  });

  it.each(boxes.map((s) => [s.id, s] as const))("re-flow onto %s: every piece on its face, text within its point range", (_id, style) => {
    const preset = style.presets[0]!.values;
    const material = { caliperMm: style.category === "corrugated" ? 3 : 0.45, kind: style.materials[0]! };
    const d = style.build(preset, material);
    const hinges = hingeMapOf(style, preset, material);
    const upright = hinges ? uprightAngles(d, hinges) : {};
    const faces = new Map(allFaces(d).map((f) => [f.id, flattenContour(f.outline, 0.5)]));
    for (const template of TEMPLATE_LIBRARY) {
      const { elements } = reflow(template.layout, d, { locale: "th", safeMm: 3, upright });
      expect(elements.length).toBeGreaterThan(0);
      for (const el of elements) {
        const poly = faces.get(el.clipFaceId!)!;
        const w = "width" in el ? el.width : el.type === "text" ? el.text.length * el.fontSize * 0.55 : 0;
        const h = "height" in el ? el.height : el.type === "text" ? el.fontSize * 1.2 : 0;
        const r = (el.rotation * Math.PI) / 180;
        const centre: [number, number] = [
          el.x + (w / 2) * Math.cos(r) - (h / 2) * Math.sin(r),
          el.y + (w / 2) * Math.sin(r) + (h / 2) * Math.cos(r),
        ];
        expect(pointInPolygon(centre, poly), `${template.code} ${el.name} on ${el.clipFaceId}`).toBe(true);
        if (el.type === "text") {
          const slot = template.layout.slots.find((s) => s.id === el.name)!;
          expect(el.fontSize).toBeGreaterThanOrEqual((slot.minPt ?? 6) * PT - 1e-6);
          expect(el.fontSize).toBeLessThanOrEqual((slot.maxPt ?? 96) * PT + 1e-6);
        }
      }
    }
  });

  it("turns the top's text with its face, and finds faces by role", () => {
    const style = getStyle("tuck-end");
    const values = { length: 70, width: 40, height: 150 };
    const material = { caliperMm: 0.45, kind: "paperboard" as const };
    const d = style.build(values, material);
    expect(faceForRole(d, "front")!.id).toBe("front");
    expect(faceForRole(d, "top")!.id).toBe("lid-top");
    const upright = uprightAngles(d, hingeMapOf(style, values, material)!);
    const { elements } = reflow(TEMPLATE_LIBRARY.find((t) => t.code.endsWith("CLASSIC"))!.layout, d, { locale: "en", safeMm: 3, upright });
    const top = elements.find((e) => e.clipFaceId === "lid-top")!;
    expect(top.rotation).toBe(((upright["lid-top"] ?? 0) % 360 + 360) % 360);
    const box = faceBounds(allFaces(d).find((f) => f.id === "front")!);
    const headline = elements.find((e) => e.name === "headline")!;
    expect(headline.x).toBeGreaterThan(box.x);
  });

  it("applies a brand: colours and fonts by role, the logo into logo slots, the customer's own elements untouched", () => {
    const d = getStyle("tuck-end").build({ length: 70, width: 40, height: 150 }, { caliperMm: 0.45, kind: "paperboard" });
    const t = TEMPLATE_LIBRARY[0]!;
    const { elements, pattern } = reflow(t.layout, d, { locale: "th", safeMm: 3 });
    const mine = { id: "mine", type: "text", text: "ของฉัน", x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, fontSize: 4, fontFamily: "Kanit", fontStyle: "normal", fill: "#123456", align: "left" };
    const content = { elements: [...elements.map((e, i) => ({ ...e, id: `t${i}` })), mine], pattern } as DesignContent;
    const branded = applyBrand(content, {
      palette: { primary: "#ff0000", ink: "#00ff00" },
      fonts: { heading: "Kanit" },
      logo: { src: "data:image/png;base64,AAAA", naturalWidth: 200, naturalHeight: 100 },
    });
    const headline = branded.elements.find((e) => e.name === "headline")!;
    expect(headline.type === "text" && headline.fill).toBe("#ff0000");
    expect(headline.type === "text" && headline.fontFamily).toBe("Kanit");
    const logo = branded.elements.find((e) => e.templateRole?.role === "logo")!;
    expect(logo.type).toBe("image");
    if (logo.type === "image") expect(logo.width / logo.height).toBeCloseTo(2, 5);
    expect(branded.elements.find((e) => e.id === "mine")).toEqual(mine);
  });
});
