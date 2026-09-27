import { allowancesOf, glueWidthFor } from "../constants";
import { buildTube } from "../construct/tube";
import { assemble, piece } from "../faces";
import { num, str } from "../params";
import type { MaterialSpec, ParamValues } from "../types";
import { CARTON_PANELS } from "./_carton";
import {
  defineStyle,
  glueSideParam,
  glueWidthParam,
  grainOn,
  grainParam,
  sizeParams,
  t,
  WINDOW_DEFAULTS,
  windowHole,
  windowIssues,
  windowParams,
} from "./_shared";

/** An open-ended sleeve over a tray or product: four panels and a glue flap, `height` is the band width. */
function make(v: ParamValues, m: MaterialSpec) {
  const a = allowancesOf(m);
  const L = num(v, "length", 120);
  const W = num(v, "width", 80);
  const faces = buildTube({
    panels: [
      { id: "front", label: "front", width: L + a.panel },
      { id: "right", label: "right", width: W + a.panel },
      { id: "back", label: "back", width: L + a.panel },
      { id: "left", label: "left", width: W + a.panel - a.gluePanel },
    ],
    depth: num(v, "height", 60),
    glue: num(v, "glueWidth", glueWidthFor(W, m)),
    glueRight: str(v, "glueSide", "left") === "right",
    holes: (p) => windowHole(v, p.id, p.x0, p.x1, p.y0, p.y1),
  });
  return assemble("sleeve", [piece("blank", "sleeve", faces, grainOn(v, faces, "front"))]);
}

export const sleeve = defineStyle({
  id: "sleeve",
  category: "folding_carton",
  materials: ["paperboard", "corrugated"],
  name: t("ปลอกสวม", "Sleeve"),
  description: t(
    "ปลอกเปิดหัวท้ายสวมทับถาดหรือสินค้า ความสูงคือความกว้างของปลอก",
    "An open-ended band over a tray or product; the height is the band's width",
  ),
  params: [
    ...sizeParams({ length: [20, 500], width: [10, 400], height: [15, 400] }),
    glueWidthParam,
    glueSideParam,
    grainParam,
    ...windowParams(CARTON_PANELS),
  ],
  defaults: {
    length: 120,
    width: 80,
    height: 60,
    glueSide: "left",
    grain: "across",
    windowPanel: "front",
    ...WINDOW_DEFAULTS,
  },
  presets: [
    {
      id: "soap",
      label: t("สบู่ 90 × 60 × 40", "Soap bar 90 × 60 × 40"),
      values: { length: 90, width: 60, height: 40 },
    },
    {
      id: "gift",
      label: t("ของขวัญ 200 × 150 × 80", "Gift 200 × 150 × 80"),
      values: { length: 200, width: 150, height: 80 },
    },
  ],
  faces3d: { roots: { blank: "front" } },
  make,
  check: (v, _m, built) => windowIssues(v, built),
  legacy: { patternKeys: ["pid:3"] },
});
