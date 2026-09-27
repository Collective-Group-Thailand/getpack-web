import { allowancesOf, TRAY_CORNER_FLAP_MAX_MM, TRAY_CORNER_FLAP_SHARE } from "../constants";
import { buildTray } from "../construct/tray";
import { assemble, face, piece } from "../faces";
import { num } from "../params";
import { line, polygon, rectangle } from "../path";
import type { Face, MaterialSpec, ParamValues } from "../types";
import { defineStyle, grainOn, grainParam, sizeParams, t } from "./_shared";

/**
 * Six-corner box: a four-corner glued tray with a lid hinged on its back wall; the lid's front
 * lip and side lips are glued at two more corners, so the box ships flat and pops up with a
 * working lid. Lips reach half the wall height, at most 30 mm. ⚠ Lip depth to be confirmed.
 */
function make(v: ParamValues, m: MaterialSpec) {
  const a = allowancesOf(m);
  const L = num(v, "length", 200) + a.panel;
  const W = num(v, "width", 150) + a.panel;
  const H = num(v, "height", 60) + a.trayDepth;
  const x0 = H;
  const x1 = H + L;
  const lip = Math.min(H * 0.5, 30);
  const cf = Math.min(lip * TRAY_CORNER_FLAP_SHARE, TRAY_CORNER_FLAP_MAX_MM, lip - 0.5);
  const lid = (): Face[] => {
    const y = -W;
    const corner = (id: string, xa: number, xb: number, nearFront: "left" | "right"): Face => {
      // Hinged on the side lip's end, cut back at 45° towards the front lip.
      const pts: [number, number][] =
        nearFront === "right"
          ? [
              [xa, y],
              [xa, y - cf],
              [xb - cf, y - cf],
              [xb, y],
            ]
          : [
              [xa, y],
              [xa + cf, y - cf],
              [xb, y - cf],
              [xb, y],
            ];
      return face(id, "corner_flap", "flap", polygon(pts, ["cut", "cut", "cut", "crease"]));
    };
    return [
      face("lid", "lid", "lid", [
        line([x0, 0], [x0, y], "crease"),
        line([x0, y], [x1, y], "crease"),
        line([x1, y], [x1, 0], "crease"),
        line([x1, 0], [x0, 0], "crease"),
      ]),
      face("lip-front", "outer_flap", "flap", rectangle(x0, y - lip, L, lip, { bottom: "crease" })),
      face("lip-left", "outer_flap", "flap", rectangle(x0 - lip, y, lip, W, { top: "crease", right: "crease" })),
      face("lip-right", "outer_flap", "flap", rectangle(x1, y, lip, W, { top: "crease", left: "crease" })),
      corner("lid-corner-left", x0 - lip, x0, "right"),
      corner("lid-corner-right", x1, x1 + lip, "left"),
    ];
  };
  const faces = buildTray({
    length: L,
    width: W,
    height: H,
    cornerFlap: Math.min(H * TRAY_CORNER_FLAP_SHARE, TRAY_CORNER_FLAP_MAX_MM),
    wallExtras: { "wall-back": lid },
  });
  return assemble("tray-6-corner", [piece("blank", "blank", faces, grainOn(v, faces, "base"))]);
}

export const tray6Corner = defineStyle({
  id: "tray-6-corner",
  category: "tray_lid",
  materials: ["paperboard", "corrugated"],
  name: t("กล่องถาดฝาพับ 6 มุม", "Six-corner box (tray with hinged lid)"),
  description: t(
    "ถาดทากาว 4 มุม มีฝาพับติดผนังหลังและขอบฝาทากาวอีก 2 มุม ส่งแบบแบนแล้วกางใช้ได้ทันที",
    "A glued tray with a lid hinged on the back and its lips glued at two more corners — ships flat, pops up ready",
  ),
  params: [...sizeParams({ length: [40, 500], width: [30, 400], height: [15, 150] }), grainParam],
  defaults: { length: 200, width: 150, height: 60, grain: "across" },
  presets: [
    {
      id: "cake",
      label: t("เค้ก 200 × 200 × 80", "Cake 200 × 200 × 80"),
      values: { length: 200, width: 200, height: 80 },
    },
    {
      id: "dessert",
      label: t("ขนม 200 × 150 × 60", "Desserts 200 × 150 × 60"),
      values: { length: 200, width: 150, height: 60 },
    },
  ],
  faces3d: { roots: { blank: "base" }, upright: "base" },
  make,
  legacy: { patternKeys: ["pid:10", "pid:11"] },
});
