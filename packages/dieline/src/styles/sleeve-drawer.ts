import {
  allowancesOf,
  DRAWER_CLEARANCE_MM,
  glueWidthFor,
  TRAY_CORNER_FLAP_MAX_MM,
  TRAY_CORNER_FLAP_SHARE,
} from "../constants";
import { buildTray } from "../construct/tray";
import { buildTube } from "../construct/tube";
import { assemble, piece } from "../faces";
import { bool, num } from "../params";
import { ellipse } from "../path";
import type { MaterialSpec, ParamValues } from "../types";
import { defineStyle, glueWidthParam, grainOn, grainParam, sizeParams, t } from "./_shared";

/**
 * A drawer (four-corner tray, inside L × W × H) and the sleeve it slides in. The sleeve's inside
 * clears the drawer's outside by `DRAWER_CLEARANCE_MM` all round: width W + 2t + 2c, height
 * H + t + 2c (the drawer's walls and base), each panel then scored + t; it is as long as the drawer.
 */
function make(v: ParamValues, m: MaterialSpec) {
  const a = allowancesOf(m);
  const t0 = m.caliperMm;
  const L = num(v, "length", 150);
  const W = num(v, "width", 100);
  const H = num(v, "height", 40);
  const c = DRAWER_CLEARANCE_MM;
  const drawerH = H + a.trayDepth;
  const drawerL = L + a.panel;
  const holes = bool(v, "fingerHole", true)
    ? {
        "wall-front": [
          ellipse(
            drawerH + drawerL / 2,
            drawerH + W + a.panel + drawerH / 2,
            Math.min(10, drawerH / 3),
            Math.min(10, drawerH / 3),
          ),
        ],
      }
    : {};
  const drawer = buildTray({
    length: drawerL,
    width: W + a.panel,
    height: drawerH,
    cornerFlap: Math.min(drawerH * TRAY_CORNER_FLAP_SHARE, TRAY_CORNER_FLAP_MAX_MM),
    holes,
  });
  const sw = W + 2 * t0 + 2 * c + a.panel;
  const sh = H + t0 + 2 * c + a.panel;
  const sleeve = buildTube({
    panels: [
      { id: "sleeve-bottom", label: "bottom", width: sw },
      { id: "sleeve-right", label: "right", width: sh },
      { id: "sleeve-top", label: "top", width: sw },
      { id: "sleeve-left", label: "left", width: sh - a.gluePanel },
    ],
    depth: drawerL + 2 * t0,
    glue: num(v, "glueWidth", glueWidthFor(W, m)),
    glueId: "sleeve-glue",
  });
  return assemble("sleeve-drawer", [
    piece("sleeve", "sleeve", sleeve, grainOn(v, sleeve, "sleeve-top")),
    piece("drawer", "drawer", drawer, grainOn(v, drawer, "base")),
  ]);
}

export const sleeveDrawer = defineStyle({
  id: "sleeve-drawer",
  category: "folding_carton",
  materials: ["paperboard", "corrugated"],
  name: t("กล่องลิ้นชัก (ปลอก + ถาด)", "Sleeve and drawer (two pieces)"),
  description: t(
    "ถาดลิ้นชักเลื่อนเข้าออกในปลอก ให้ความรู้สึกพรีเมียม เหมาะกับเครื่องประดับ ของขวัญ",
    "A drawer sliding in a sleeve — a premium reveal for jewellery and gifts",
  ),
  params: [
    ...sizeParams({ length: [40, 500], width: [30, 400], height: [10, 200] }),
    { key: "fingerHole", kind: "boolean", group: "options", label: t("รูดึงลิ้นชัก", "Finger hole in the drawer") },
    glueWidthParam,
    grainParam,
  ],
  defaults: { length: 150, width: 100, height: 40, fingerHole: true, grain: "across" },
  presets: [
    {
      id: "jewellery",
      label: t("เครื่องประดับ 100 × 80 × 30", "Jewellery 100 × 80 × 30"),
      values: { length: 100, width: 80, height: 30 },
    },
    {
      id: "gift",
      label: t("ของขวัญ 200 × 150 × 60", "Gift 200 × 150 × 60"),
      values: { length: 200, width: 150, height: 60 },
    },
  ],
  faces3d: (v) => ({
    roots: { sleeve: "sleeve-bottom", drawer: "base" },
    upright: "base",
    placement: { sleeve: { rotate: [0, 90, 0] }, drawer: { inside: "sleeve", slide: num(v, "length", 150) * 0.6 } },
  }),
  closedSize: (v, m) => ({
    length: num(v, "length", 150) + 2 * m.caliperMm,
    width: num(v, "width", 100) + 2 * m.caliperMm + 2 * DRAWER_CLEARANCE_MM,
    height: num(v, "height", 40) + m.caliperMm + 2 * DRAWER_CLEARANCE_MM,
  }),
  make,
  legacy: { patternKeys: ["pid:31", "mapping:10", "folding-slide-box", "pid:30", "mapping:56", "corrugate-slide"] },
});
