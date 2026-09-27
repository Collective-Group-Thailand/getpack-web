import { allowancesOf, TRAY_CORNER_FLAP_MAX_MM, TRAY_CORNER_FLAP_SHARE } from "../constants";
import { buildTray } from "../construct/tray";
import { assemble, piece } from "../faces";
import { num } from "../params";
import type { MaterialSpec, ParamValues } from "../types";
import { defineStyle, grainOn, grainParam, sizeParams, t } from "./_shared";

/**
 * Four-corner glued tray. Compensation: base L + a × W + a (a = t or the flute's col_a), walls
 * H + t (open top: one closure layer, the base). Corner flaps reach 85 % of the wall, at most
 * 25 mm, and are glued inside the front and back walls.
 */
function make(v: ParamValues, m: MaterialSpec) {
  const a = allowancesOf(m);
  const H = num(v, "height", 60) + a.trayDepth;
  const faces = buildTray({
    length: num(v, "length", 200) + a.panel,
    width: num(v, "width", 150) + a.panel,
    height: H,
    cornerFlap: num(v, "cornerFlap", Math.min(H * TRAY_CORNER_FLAP_SHARE, TRAY_CORNER_FLAP_MAX_MM)),
  });
  return assemble("tray", [piece("blank", "blank", faces, grainOn(v, faces, "base"))]);
}

export const tray = defineStyle({
  id: "tray",
  category: "tray_lid",
  materials: ["paperboard", "corrugated"],
  name: t("ถาดทากาว 4 มุม", "Four-corner glued tray"),
  description: t(
    "ถาด 4 ผนัง มีปีกกาวที่มุม เหมาะกับเบเกอรี่ ของขวัญ และเป็นตัวฐานของกล่องสองชิ้น",
    "Four walls with glued corner flaps — bakery, gifts, and the base of two-piece boxes",
  ),
  params: [
    ...sizeParams({ length: [30, 600], width: [30, 400], height: [10, 200] }),
    {
      key: "cornerFlap",
      kind: "length",
      group: "construction",
      label: t("ความยาวปีกกาวมุม", "Corner flap reach"),
      help: t(
        "เว้นว่างเพื่อใช้ค่าแนะนำ (85% ของความสูง ไม่เกิน 25 มม.)",
        "Leave empty for the recommended reach (85 % of the height, at most 25 mm)",
      ),
      min: 5,
      max: 60,
      step: 0.5,
    },
    grainParam,
  ],
  defaults: { length: 200, width: 150, height: 60, grain: "across" },
  presets: [
    {
      id: "small",
      label: t("ถาดเล็ก 120 × 120 × 50", "Small 120 × 120 × 50"),
      values: { length: 120, width: 120, height: 50 },
    },
    {
      id: "medium",
      label: t("ถาดกลาง 200 × 150 × 60", "Medium 200 × 150 × 60"),
      values: { length: 200, width: 150, height: 60 },
    },
    {
      id: "large",
      label: t("ถาดใหญ่ 300 × 220 × 80", "Large 300 × 220 × 80"),
      values: { length: 300, width: 220, height: 80 },
    },
  ],
  faces3d: { roots: { blank: "base" }, upright: "base" },
  make,
  legacy: { patternKeys: ["pid:2", "pid:38", "tray"] },
});
