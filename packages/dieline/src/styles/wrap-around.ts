import { allowancesOf, glueWidthFor } from "../constants";
import { slottedFlaps } from "../construct/closures";
import { buildTube } from "../construct/tube";
import { assemble, piece } from "../faces";
import { num, str } from "../params";
import type { MaterialSpec, ParamValues } from "../types";
import { slotWidth } from "./rsc";
import { defineStyle, glueSideParam, glueWidthParam, grainOn, grainParam, sizeParams, t } from "./_shared";

/**
 * Wrap-around blank: the product is placed on the blank and the panels are wrapped round it along
 * its length, glued at a flap running the full length, and the ends closed by flaps. Panels
 * front H | top W | back H | bottom W, length L; end flaps W/2 on the walls, H/2 on top and bottom.
 */
function make(v: ParamValues, m: MaterialSpec) {
  const a = allowancesOf(m);
  const L = num(v, "length", 300);
  const W = num(v, "width", 200);
  const H = num(v, "height", 100);
  const wall = H + a.panel;
  const top = W + a.panel;
  const flaps = slottedFlaps({
    depths: [top / 2 + a.flap, wall / 2 + a.flap, top / 2 + a.flap, wall / 2 + a.flap],
    slot: slotWidth(m),
    labels: ["end_flap", "end_flap", "end_flap", "end_flap"],
  });
  const faces = buildTube({
    panels: [
      { id: "wall-front", label: "wall_front", width: wall },
      { id: "top", label: "top", width: top },
      { id: "wall-back", label: "wall_back", width: wall },
      { id: "bottom", label: "bottom", width: top - a.gluePanel },
    ],
    depth: L + a.depth,
    glue: num(v, "glueWidth", glueWidthFor(W, m)),
    glueRight: str(v, "glueSide", "left") === "right",
    top: flaps,
    bottom: flaps,
  });
  return assemble("wrap-around", [piece("blank", "blank", faces, grainOn(v, faces, "top"))]);
}

export const wrapAround = defineStyle({
  id: "wrap-around",
  category: "corrugated",
  materials: ["corrugated"],
  name: t("แผ่นห่อรอบสินค้า (Wrap-around)", "Wrap-around blank"),
  description: t(
    "ห่อรอบสินค้าตามแนวยาวแล้วติดกาว ปิดหัวท้ายด้วยปีก แน่นพอดีสินค้า นิยมกับเครื่องบรรจุอัตโนมัติ",
    "Wrapped round the product along its length and glued, ends closed by flaps — a tight fit, common on automatic packers",
  ),
  params: [
    ...sizeParams({ length: [100, 1200], width: [60, 800], height: [30, 600] }),
    glueWidthParam,
    glueSideParam,
    grainParam,
  ],
  defaults: { length: 300, width: 200, height: 100, glueSide: "left", grain: "across" },
  presets: [
    {
      id: "drinks",
      label: t("เครื่องดื่ม 6 ขวด 260 × 180 × 230", "Six bottles 260 × 180 × 230"),
      values: { length: 260, width: 180, height: 230 },
    },
    {
      id: "flat",
      label: t("สินค้าแบน 400 × 300 × 60", "Flat goods 400 × 300 × 60"),
      values: { length: 400, width: 300, height: 60 },
    },
  ],
  faces3d: { roots: { blank: "wall-front" } },
  make,
  legacy: { patternKeys: [] },
});
