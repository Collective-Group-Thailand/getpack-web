import { allowancesOf, LID_CLEARANCE_MM, TRAY_CORNER_FLAP_MAX_MM, TRAY_CORNER_FLAP_SHARE } from "../constants";
import { buildTray } from "../construct/tray";
import { assemble, piece, prefixFaces } from "../faces";
import { issue, num, str } from "../params";
import type { MaterialSpec, ParamValues } from "../types";
import { defineStyle, grainOn, grainParam, sizeParams, t } from "./_shared";

/** How deep the lid is: the base's height (full telescope) or `lidDepth` (partial, default a third). */
function lidDepthOf(v: ParamValues): number {
  const H = num(v, "height", 60);
  return str(v, "lid", "partial") === "full" ? H : num(v, "lidDepth", Math.max(15, Math.round(H / 3)));
}

/**
 * Two-piece telescope box: a base tray, and a lid tray sized from the base — inside = base outside
 * + 2 × clearance, i.e. L + 2t + 2c by W + 2t + 2c — full depth or partial.
 */
function make(v: ParamValues, m: MaterialSpec) {
  const a = allowancesOf(m);
  const t0 = m.caliperMm;
  const L = num(v, "length", 200);
  const W = num(v, "width", 150);
  const H = num(v, "height", 60);
  const c = LID_CLEARANCE_MM;
  const tray = (l: number, w: number, h: number) =>
    buildTray({
      length: l + a.panel,
      width: w + a.panel,
      height: h + a.trayDepth,
      cornerFlap: Math.min((h + a.trayDepth) * TRAY_CORNER_FLAP_SHARE, TRAY_CORNER_FLAP_MAX_MM),
    });
  const base = tray(L, W, H);
  const lid = prefixFaces(tray(L + 2 * t0 + 2 * c, W + 2 * t0 + 2 * c, lidDepthOf(v)), "lid-");
  return assemble("telescope", [
    piece("base", "base", base, grainOn(v, base, "base")),
    piece("lid", "lid", lid, grainOn(v, lid, "lid-base")),
  ]);
}

export const telescope = defineStyle({
  id: "telescope",
  category: "tray_lid",
  materials: ["paperboard", "corrugated", "rigid"],
  name: t("กล่องฝาครอบสองชิ้น (ฝา-ตัว)", "Two-piece telescope box"),
  description: t(
    "ตัวกล่องและฝาครอบแยกชิ้น ฝาครอบลึกเต็มหรือครึ่ง เปิดแล้วดูพรีเมียม เหมาะกับของขวัญ เสื้อผ้า",
    "A base and a separate lid, full or partial depth — a premium opening for gifts and apparel",
  ),
  params: [
    ...sizeParams({ length: [40, 600], width: [30, 450], height: [15, 300] }),
    {
      key: "lid",
      kind: "enum",
      group: "closure",
      label: t("ความลึกฝา", "Lid depth"),
      options: [
        { value: "partial", label: t("ครอบบางส่วน", "Partial") },
        { value: "full", label: t("ครอบเต็ม", "Full") },
      ],
    },
    {
      key: "lidDepth",
      kind: "length",
      group: "closure",
      label: t("ความลึกฝาครอบ", "Lid depth (partial)"),
      min: 10,
      max: 300,
      step: 0.5,
      when: { key: "lid", in: ["partial"] },
    },
    grainParam,
  ],
  defaults: { length: 200, width: 150, height: 60, lid: "partial", grain: "across" },
  presets: [
    {
      id: "gift",
      label: t("ของขวัญ 200 × 150 × 60", "Gift 200 × 150 × 60"),
      values: { length: 200, width: 150, height: 60 },
    },
    {
      id: "apparel",
      label: t("เสื้อผ้า 300 × 250 × 80", "Apparel 300 × 250 × 80"),
      values: { length: 300, width: 250, height: 80, lid: "full" },
    },
  ],
  faces3d: (v) => ({
    roots: { base: "base", lid: "lid-base" },
    upright: "base",
    placement: { lid: { over: "base", flip: true, sink: lidDepthOf(v), lift: 40 } },
  }),
  closedSize: (v, m) => ({
    length: num(v, "length", 200) + 2 * m.caliperMm + 2 * LID_CLEARANCE_MM,
    width: num(v, "width", 150) + 2 * m.caliperMm + 2 * LID_CLEARANCE_MM,
    height: num(v, "height", 60),
  }),
  make,
  check: (v) =>
    lidDepthOf(v) > num(v, "height", 60)
      ? [issue("lid.too_deep", t("ฝาครอบลึกกว่าตัวกล่อง", "The lid is deeper than the base"), "lidDepth")]
      : [],
  legacy: { patternKeys: ["pid:4", "pid:32", "mapping:11", "folding-cover-box", "pid:29"] },
});
