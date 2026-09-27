import { glueWidthFor, TUCK_CORNER_RADIUS_MM, tuckDepthFor } from "../constants";
import { polygonLid } from "../construct/closures";
import { buildTube, type TubePanel } from "../construct/tube";
import { assemble, piece } from "../faces";
import { issue, num, str } from "../params";
import type { MaterialSpec, ParamValues, Pt } from "../types";
import { defineStyle, glueSideParam, glueWidthParam, grainOn, grainParam, t } from "./_shared";

/**
 * Six panels of side `a` folding at 60° into a hexagonal prism, a hexagonal lid and tuck at each
 * end hinged on the first panel. Compensation: a 60° fold uses about t·tan 30° of board, so each
 * panel is scored at a + 0.58 t; the depth at H + 2t.
 */
function make(v: ParamValues, m: MaterialSpec) {
  const t0 = m.caliperMm;
  const a = num(v, "side", 50) + t0 * Math.tan(Math.PI / 6);
  const h = (a * Math.sqrt(3)) / 2;
  const tuckDepth = num(v, "tuckDepth", tuckDepthFor(2 * a));
  const radius = str(v, "tuckCorners", "rounded") === "rounded" ? Math.min(TUCK_CORNER_RADIUS_MM, tuckDepth / 2) : 0;
  const lid = polygonLid({
    panel: 0,
    points: (s) => {
      const pts: Pt[] = [
        [s.x1 + a / 2, -h],
        [s.x1, -2 * h],
        [s.x0, -2 * h],
        [s.x0 - a / 2, -h],
      ];
      return pts;
    },
    tuckEdge: 1,
    tuckDepth,
    tuckRadius: radius,
  });
  const panels: TubePanel[] = Array.from({ length: 6 }, (_, i) => ({
    id: `side-${i + 1}`,
    label: i === 0 ? "front" : "side",
    width: a,
  }));
  const faces = buildTube({
    panels,
    depth: num(v, "height", 120) + 2 * t0,
    glue: num(v, "glueWidth", glueWidthFor(a, m)),
    glueRight: str(v, "glueSide", "left") === "right",
    top: lid,
    bottom: lid,
  });
  return assemble("hexagonal", [piece("blank", "blank", faces, grainOn(v, faces, "side-1"))]);
}

const sixty = Object.fromEntries(["side-2", "side-3", "side-4", "side-5", "side-6", "glue"].map((id) => [id, 60]));

export const hexagonal = defineStyle({
  id: "hexagonal",
  category: "folding_carton",
  materials: ["paperboard"],
  name: t("กล่องหกเหลี่ยม ฝาเสียบ", "Hexagonal tuck box"),
  description: t(
    "ตัวกล่องหกเหลี่ยม ฝาและก้นเป็นหกเหลี่ยมพร้อมลิ้นเสียบ เหมาะกับของขวัญ ชา ขนม",
    "A hexagonal prism with hexagonal tuck lids — gifts, tea, sweets",
  ),
  params: [
    {
      key: "side",
      kind: "length",
      group: "size",
      label: t("ความยาวด้าน", "Side length"),
      min: 20,
      max: 200,
      step: 0.5,
    },
    {
      key: "height",
      kind: "length",
      group: "size",
      label: t("ความสูง (ด้านใน)", "Inside height"),
      min: 30,
      max: 400,
      step: 0.5,
      legacyKey: "h",
    },
    {
      key: "tuckDepth",
      kind: "length",
      group: "closure",
      label: t("ความลึกลิ้นเสียบ", "Tuck depth"),
      min: 8,
      max: 60,
      step: 0.5,
      legacyKey: "f",
    },
    {
      key: "tuckCorners",
      kind: "enum",
      group: "closure",
      label: t("มุมลิ้นเสียบ", "Tuck corners"),
      options: [
        { value: "rounded", label: t("มุมมน", "Rounded") },
        { value: "square", label: t("มุมเหลี่ยม", "Square") },
      ],
    },
    glueWidthParam,
    glueSideParam,
    grainParam,
  ],
  defaults: { side: 50, height: 120, tuckCorners: "rounded", glueSide: "left", grain: "across" },
  presets: [
    { id: "tea", label: t("ชา ด้าน 40 สูง 100", "Tea, side 40 × 100"), values: { side: 40, height: 100 } },
    { id: "gift", label: t("ของขวัญ ด้าน 60 สูง 150", "Gift, side 60 × 150"), values: { side: 60, height: 150 } },
  ],
  faces3d: { roots: { blank: "side-1" }, angles: sixty },
  closedSize: (v) => {
    const a = num(v, "side", 50);
    return { length: 2 * a, width: Math.sqrt(3) * a, height: num(v, "height", 120) };
  },
  make,
  check: (v) => {
    const a = num(v, "side", 50);
    const tuckDepth = num(v, "tuckDepth", tuckDepthFor(2 * a));
    return tuckDepth >= num(v, "height", 120) - 5
      ? [
          issue(
            "tuck.too_deep",
            t("ลิ้นเสียบลึกเกินความสูงกล่อง", "The tuck is deeper than the box is tall"),
            "tuckDepth",
          ),
        ]
      : [];
  },
  legacy: { patternKeys: [] },
});
