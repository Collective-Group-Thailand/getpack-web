import { GLUE_AREA_INSET_MM } from "../constants";
import { issue, num } from "../params";
import { arc, line, polygon, rectangle } from "../path";
import type { Edge, ParamValues, Pt } from "../types";
import { flatDieline } from "./_flat";
import { defineStyle, t } from "./_shared";

/**
 * Cup sleeve — legacy "ปลอกแก้ว": a band round a tapered cup. A frustum unrolls into an annular
 * sector: slant s = √(h² + ((D − d)/2)²), inner radius s·d/(D − d), outer s·D/(D − d), and the
 * sector's outer arc is the top circumference π·D plus the glue overlap. A straight cup (D = d)
 * unrolls into a rectangle.
 */
function build(v: ParamValues) {
  const D = num(v, "topDiameter", 90);
  const d = num(v, "bottomDiameter", 60);
  const h = num(v, "height", 70);
  const overlap = num(v, "overlap", 10);
  if (D - d < 0.5) {
    const w = Math.PI * D + overlap;
    const inset = Math.min(GLUE_AREA_INSET_MM, overlap / 4);
    return flatDieline("cup-sleeve", rectangle(0, 0, w, h), "band", {
      marks: polygon(
        [
          [w - overlap + inset, inset],
          [w - inset, inset],
          [w - inset, h - inset],
          [w - overlap + inset, h - inset],
        ],
        "glue_area",
      ),
    });
  }
  const s = Math.sqrt(h * h + ((D - d) / 2) ** 2);
  const inner = (s * d) / (D - d);
  const outer = inner + s;
  const sweep = (Math.PI * D + overlap) / outer;
  // Centred on "up" (−π/2 in the y-down frame); the outer arc runs clockwise from a0 to a1.
  const a0 = -Math.PI / 2 - sweep / 2;
  const a1 = -Math.PI / 2 + sweep / 2;
  const at = (r: number, a: number): Pt => [r * Math.cos(a), r * Math.sin(a)];
  const outline: Edge[] = [
    arc(at(outer, a0), at(outer, a1), [0, 0], true),
    line(at(outer, a1), at(inner, a1)),
    arc(at(inner, a1), at(inner, a0), [0, 0], false),
    line(at(inner, a0), at(outer, a0)),
  ];
  // Glue on the overlap at the a1 end.
  const g = overlap / outer;
  const gi = GLUE_AREA_INSET_MM;
  const marks = polygon(
    [at(outer - gi, a1 - g), at(outer - gi, a1 - gi / outer), at(inner + gi, a1 - gi / inner), at(inner + gi, a1 - g)],
    "glue_area",
  );
  return flatDieline("cup-sleeve", outline, "band", { marks });
}

export const cupSleeve = defineStyle({
  id: "cup-sleeve",
  category: "flat",
  materials: ["paperboard"],
  name: t("ปลอกแก้ว", "Cup sleeve"),
  description: t(
    "ปลอกกระดาษสวมแก้วทรงกรวย คำนวณส่วนโค้งจากเส้นผ่านศูนย์กลางปากและก้นแก้ว",
    "A band round a tapered cup, its curve worked out from the rim and base diameters",
  ),
  params: [
    {
      key: "topDiameter",
      kind: "length",
      group: "size",
      label: t("เส้นผ่านศูนย์กลางด้านบน", "Top diameter"),
      min: 30,
      max: 200,
      step: 0.5,
    },
    {
      key: "bottomDiameter",
      kind: "length",
      group: "size",
      label: t("เส้นผ่านศูนย์กลางด้านล่าง", "Bottom diameter"),
      min: 20,
      max: 200,
      step: 0.5,
    },
    {
      key: "height",
      kind: "length",
      group: "size",
      label: t("ความสูงปลอก", "Sleeve height"),
      min: 20,
      max: 200,
      step: 0.5,
    },
    {
      key: "overlap",
      kind: "length",
      group: "construction",
      label: t("ระยะทับกาว", "Glue overlap"),
      min: 5,
      max: 30,
      step: 0.5,
    },
  ],
  defaults: { topDiameter: 90, bottomDiameter: 60, height: 70, overlap: 10 },
  // ⚠ Indicative cup sizes, not a supplier's; the customer measures their cup.
  presets: [
    {
      id: "cup-12oz",
      label: t("แก้ว 12 ออนซ์ (⌀90 → ⌀60, สูง 70)", "12 oz cup (⌀90 → ⌀60, 70 high)"),
      values: { topDiameter: 90, bottomDiameter: 60, height: 70 },
    },
    {
      id: "cup-16oz",
      label: t("แก้ว 16 ออนซ์ (⌀90 → ⌀60, สูง 85)", "16 oz cup (⌀90 → ⌀60, 85 high)"),
      values: { topDiameter: 90, bottomDiameter: 60, height: 85 },
    },
    {
      id: "straight",
      label: t("แก้วทรงตรง ⌀75 สูง 75", "Straight cup ⌀75, 75 high"),
      values: { topDiameter: 75, bottomDiameter: 75, height: 75 },
    },
  ],
  make: (v) => build(v),
  check: (v) =>
    num(v, "bottomDiameter", 60) > num(v, "topDiameter", 90)
      ? [
          issue(
            "sleeve.inverted",
            t("ก้นแก้วใหญ่กว่าปากแก้ว สลับค่ากัน", "The base is wider than the rim — swap them"),
            "bottomDiameter",
          ),
        ]
      : [],
  legacy: { patternKeys: ["pid:36", "mapping:60"] },
});
