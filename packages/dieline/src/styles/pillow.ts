import { glueWidthFor } from "../constants";
import { glueFlap } from "../construct/tube";
import { assemble, face, piece } from "../faces";
import { issue, num } from "../params";
import { arc, line } from "../path";
import type { ArcEdge, MaterialSpec, ParamValues, Pt } from "../types";
import { defineStyle, glueWidthParam, grainOn, grainParam, t } from "./_shared";

/** An arc from `a` to `b` (a left of b, on one horizontal line) bulging up (−y) or down by `sagitta`. */
function bulge(a: Pt, b: Pt, sagitta: number, up: boolean, role: ArcEdge["role"]): ArcEdge {
  const c = b[0] - a[0];
  const r = (c * c) / (8 * sagitta) + sagitta / 2;
  const xm = (a[0] + b[0]) / 2;
  const center: Pt = up ? [xm, a[1] - sagitta + r] : [xm, a[1] + sagitta - r];
  // Left to right over the top runs through increasing angles (clockwise on screen); under, decreasing.
  return arc(a, b, center, up, role);
}

const reverse = (e: ArcEdge): ArcEdge => ({ ...e, from: e.to, to: e.from, clockwise: !e.clockwise });

/**
 * Pillow box: two panels whose ends are curved creases; beyond each crease a lens-shaped flap
 * bounded by a deeper cut arc folds in, and the curved creases bow the panels into a pillow.
 * `thickness` is the lens depth (the pillow's thickness at its middle); the creases bow a third
 * of it. ⚠ Curve proportions to be confirmed by prepress.
 */
function make(v: ParamValues, m: MaterialSpec) {
  const T = num(v, "thickness", 30);
  const sc = T / 3;
  // `length` is overall, at the middle: the chords sit inside it by the creases' bow.
  const L = num(v, "length", 150) - 2 * sc;
  const W = num(v, "width", 100) + m.caliperMm;
  const g = num(v, "glueWidth", glueWidthFor(W, m));
  const x = [g, g + W, g + 2 * W];
  const faces = [glueFlap("glue", g, g, L, "left")];
  ["front", "back"].forEach((id, i) => {
    const x0 = x[i];
    const x1 = x[i + 1];
    const topCrease = bulge([x0, 0], [x1, 0], sc, true, "crease");
    const bottomCrease = bulge([x0, L], [x1, L], sc, false, "crease");
    faces.push(
      face(id, id === "front" ? "front" : "back", "panel", [
        topCrease,
        line([x1, 0], [x1, L], i === 0 ? "crease" : "cut"),
        reverse(bottomCrease),
        line([x0, L], [x0, 0], "crease"),
      ]),
      face(`end-${id}-top`, "end_flap", "flap", [bulge([x0, 0], [x1, 0], T, true, "cut"), reverse(topCrease)]),
      face(`end-${id}-bottom`, "end_flap", "flap", [reverse(bulge([x0, L], [x1, L], T, false, "cut")), bottomCrease]),
    );
  });
  return assemble("pillow", [piece("blank", "blank", faces, grainOn(v, faces, "front"))]);
}

export const pillow = defineStyle({
  id: "pillow",
  category: "specialty",
  materials: ["paperboard"],
  name: t("กล่องหมอน", "Pillow box"),
  description: t(
    "ปลายโค้งพับเข้าหากัน ตัวกล่องโป่งเหมือนหมอน สวยสำหรับของชำร่วย เครื่องประดับ",
    "Curved ends fold in and bow the box into a pillow — favours, jewellery, small gifts",
  ),
  params: [
    {
      key: "length",
      kind: "length",
      group: "size",
      label: t("ความยาวรวม (กึ่งกลาง)", "Overall length (at the middle)"),
      min: 60,
      max: 400,
      step: 0.5,
      legacyKey: "l",
    },
    {
      key: "width",
      kind: "length",
      group: "size",
      label: t("ความกว้าง", "Width"),
      min: 40,
      max: 300,
      step: 0.5,
      legacyKey: "w",
    },
    {
      key: "thickness",
      kind: "length",
      group: "size",
      label: t("ความหนาตรงกลาง", "Thickness at the middle"),
      min: 10,
      max: 120,
      step: 0.5,
    },
    glueWidthParam,
    grainParam,
  ],
  defaults: { length: 150, width: 100, thickness: 30, grain: "across" },
  presets: [
    {
      id: "small",
      label: t("เล็ก 120 × 80 × 25", "Small 120 × 80 × 25"),
      values: { length: 120, width: 80, thickness: 25 },
    },
    {
      id: "medium",
      label: t("กลาง 180 × 110 × 35", "Medium 180 × 110 × 35"),
      values: { length: 180, width: 110, thickness: 35 },
    },
  ],
  faces3d: {
    roots: { blank: "front" },
    angles: { back: 180, glue: 180, "end-back-top": -90, "end-back-bottom": -90 },
  },
  closedSize: (v) => ({ length: num(v, "length", 150), width: num(v, "width", 100), height: num(v, "thickness", 30) }),
  make,
  check: (v) =>
    num(v, "thickness", 30) > num(v, "width", 100) / 2
      ? [
          issue(
            "pillow.too_thick",
            t("ความหนาต้องไม่เกินครึ่งหนึ่งของความกว้าง", "Thickness must be at most half the width"),
            "thickness",
          ),
        ]
      : [],
  legacy: { patternKeys: [] },
});
