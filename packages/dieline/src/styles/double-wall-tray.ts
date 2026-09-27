import { allowancesOf, TRAY_CORNER_FLAP_MAX_MM, TRAY_CORNER_FLAP_SHARE } from "../constants";
import { buildTray } from "../construct/tray";
import { assemble, face, piece } from "../faces";
import { num } from "../params";
import { rectangle } from "../path";
import type { MaterialSpec, ParamValues } from "../types";
import { defineStyle, grainOn, grainParam, sizeParams, t } from "./_shared";

/**
 * Double-wall tray: the front and back walls fold over into inner walls (t shorter), trapping the
 * side walls' corner flaps between the two layers — no glue needed on the corners, stiff rims.
 */
function make(v: ParamValues, m: MaterialSpec) {
  const a = allowancesOf(m);
  const L = num(v, "length", 250) + a.panel;
  const W = num(v, "width", 180) + a.panel;
  const H = num(v, "height", 60) + a.trayDepth;
  const inner = H - m.caliperMm;
  const x0 = H;
  const y1 = H + W;
  const faces = buildTray({
    length: L,
    width: W,
    height: H,
    cornerFlap: Math.min(H * TRAY_CORNER_FLAP_SHARE, TRAY_CORNER_FLAP_MAX_MM),
    wallExtras: {
      "wall-back": () => [
        face("inner-back", "inner_wall", "flap", rectangle(x0, -inner, L, inner, { bottom: "crease" })),
      ],
      "wall-front": () => [
        face("inner-front", "inner_wall", "flap", rectangle(x0, y1 + H, L, inner, { top: "crease" })),
      ],
    },
  });
  return assemble("double-wall-tray", [piece("blank", "blank", faces, grainOn(v, faces, "base"))]);
}

export const doubleWallTray = defineStyle({
  id: "double-wall-tray",
  category: "tray_lid",
  materials: ["paperboard", "corrugated"],
  name: t("ถาดผนังสองชั้น", "Double-wall tray"),
  description: t(
    "ผนังหน้า-หลังพับซ้อนสองชั้นหนีบปีกมุมไว้ ขอบแข็งแรง ไม่ต้องทากาว เหมาะกับผักผลไม้ ถาดโชว์สินค้า",
    "Front and back walls fold over into a second layer that traps the corner flaps — stiff rims, no glue; produce and display trays",
  ),
  params: [...sizeParams({ length: [60, 800], width: [40, 600], height: [20, 250] }), grainParam],
  defaults: { length: 250, width: 180, height: 60, grain: "across" },
  presets: [
    {
      id: "produce",
      label: t("ผักผลไม้ 400 × 300 × 100", "Produce 400 × 300 × 100"),
      values: { length: 400, width: 300, height: 100 },
    },
    {
      id: "display",
      label: t("ถาดโชว์ 250 × 180 × 60", "Display 250 × 180 × 60"),
      values: { length: 250, width: 180, height: 60 },
    },
  ],
  faces3d: { roots: { blank: "base" }, upright: "base", angles: { "inner-back": 180, "inner-front": 180 } },
  make,
  legacy: { patternKeys: [] },
});
