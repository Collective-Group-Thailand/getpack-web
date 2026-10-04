import {
  allowancesOf,
  DRAWER_CLEARANCE_MM,
  glueWidthFor,
  LID_CLEARANCE_MM,
  TRAY_CORNER_FLAP_MAX_MM,
  TRAY_CORNER_FLAP_SHARE,
} from "../../constants";
import { buildTray, lockCornerHoles } from "../../construct/tray";
import { buildTube } from "../../construct/tube";
import { assemble, piece, prefixFaces } from "../../faces";
import { bool, num, str } from "../../params";
import { ellipse } from "../../path";
import { grainOn, t, windowHole } from "../../styles/_shared";
import type { Contour, ParamValues } from "../../types";
import { extraPieces } from "../body/tube";
import { HAND_HOLE_HEIGHT_MM, trayHandHoles } from "../feature/features";
import type { PieceSetModule } from "../types";

/** How deep the lid is: the base's height (full telescope) or `lidDepth` (partial, default a third). */
function lidDepthOf(v: ParamValues): number {
  const H = num(v, "height", 60);
  return str(v, "lid", "partial") === "full" ? H : num(v, "lidDepth", Math.max(15, Math.round(H / 3)));
}

/**
 * Two-piece telescope: a base tray, and a lid tray sized from the base — inside = base outside
 * + 2 × clearance, i.e. L + 2t + 2c by W + 2t + 2c — full depth or partial.
 */
export const lidAndBase: PieceSetModule = {
  id: "lidAndBase",
  slot: "pieceSet",
  status: "implemented",
  label: t("ฝาครอบ + ตัวกล่อง (สองชิ้น)", "Lid and base (two pieces)"),
  params: ["lid", "lidDepth", "grain"],
  processes: ["die_cut", "folder_gluer_corner"],
  contributes: { kinds: ["base", "wall", "flap"], roles: ["cut", "crease"] },
  constraints: [
    {
      id: "lidAndBase.lid_depth",
      code: "lid.too_deep",
      severity: "error",
      param: "lidDepth",
      require: "(lid == 'full' ? height : (lidDepth ?? max(15, round(height / 3)))) <= height",
      message: t("ฝาครอบลึกกว่าตัวกล่อง", "The lid is deeper than the base"),
    },
  ],
  build(ctx) {
    const { v, m } = ctx;
    const a = allowancesOf(m);
    const t0 = m.caliperMm;
    const L = num(v, "length", 200);
    const W = num(v, "width", 150);
    const H = num(v, "height", 60);
    const c = LID_CLEARANCE_MM;
    const lock = str(v, "cornerLock", "glued") === "lock";
    const tray = (l: number, w: number, h: number, lid: boolean) => {
      const f = { length: l + a.panel, width: w + a.panel, height: h + a.trayDepth };
      const holes: Record<string, Contour[]> = lock ? lockCornerHoles(f) : {};
      // Hand holes (CT-01): through a full lid and the base under it, 30 mm below the top; under a
      // partial lid, in the base only, 15 mm below the lid's edge. ⚠
      const handles = str(v, "handles", "none");
      const full = str(v, "lid", "partial") === "full";
      const add = (more: Record<string, Contour[]>) => {
        for (const [id, hs] of Object.entries(more)) holes[id] = [...(holes[id] ?? []), ...hs];
      };
      if (handles !== "none" && !lid) add(trayHandHoles(handles, f, full ? 30 : lidDepthOf(v) + 15));
      if (handles !== "none" && lid && full) add(trayHandHoles(handles, f, f.height - 30 - HAND_HOLE_HEIGHT_MM));
      if (lid) {
        // A top window in the lid's top (`windowPanel` = `lid-base`); a finger hole in its front and back walls.
        holes.base = windowHole(v, "lid-base", f.height, f.height + f.length, f.height, f.height + f.width);
        if (bool(v, "fingerHole", false)) {
          const r = Math.min(8, f.height / 4);
          const cx = f.height + f.length / 2;
          holes["wall-back"] = [...(holes["wall-back"] ?? []), ellipse(cx, f.height / 2, r, r)];
          holes["wall-front"] = [...(holes["wall-front"] ?? []), ellipse(cx, f.height + f.width + f.height / 2, r, r)];
        }
      }
      return buildTray({
        ...f,
        cornerFlap: Math.min(f.height * TRAY_CORNER_FLAP_SHARE, TRAY_CORNER_FLAP_MAX_MM),
        holes,
      });
    };
    const base = tray(L, W, H, false);
    const lid = prefixFaces(tray(L + 2 * t0 + 2 * c, W + 2 * t0 + 2 * c, lidDepthOf(v), true), "lid-");
    return assemble(ctx.styleId, [
      piece("base", "base", base, grainOn(v, base, "base")),
      piece("lid", "lid", lid, grainOn(v, lid, "lid-base")),
    ]);
  },
  hinges: (ctx) => ({
    roots: { base: "base", lid: "lid-base" },
    upright: "base",
    placement: { lid: { over: "base", flip: true, sink: lidDepthOf(ctx.v), lift: 40 } },
  }),
};

/**
 * A drawer (four-corner tray, inside L × W × H) and the sleeve it slides in. The sleeve's inside
 * clears the drawer's outside by `DRAWER_CLEARANCE_MM` all round: width W + 2t + 2c, height
 * H + t + 2c (the drawer's walls and base), each panel then scored + t; it is as long as the drawer.
 */
export const sleeveAndDrawer: PieceSetModule = {
  id: "sleeveAndDrawer",
  slot: "pieceSet",
  status: "implemented",
  label: t("ปลอก + ลิ้นชัก (สองชิ้น)", "Sleeve and drawer (two pieces)"),
  params: ["fingerHole", "glueWidth", "grain"],
  processes: ["die_cut", "folder_gluer_straight", "folder_gluer_corner"],
  constraints: [
    {
      id: "sleeveAndDrawer.glue_width",
      code: "mfg.glue_flap_too_wide",
      severity: "error",
      param: "glueWidth",
      require: "(glueWidth ?? glueWidthFor(width)) <= height + t + 2 * C.DRAWER_CLEARANCE_MM + a.panel - a.gluePanel",
      message: t("ปีกกาวกว้างกว่าแผงข้างของปลอก", "The glue flap is wider than the sleeve's side panel it is glued to"),
      stage: "manufacturing",
    },
  ],
  contributes: { kinds: ["panel", "glue_flap", "base", "wall", "flap"], roles: ["cut", "crease", "glue_area"] },
  build(ctx, _cfg, parts) {
    const { v, m } = ctx;
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
      // A window in the sleeve's top (`windowPanel` = `sleeve-top`).
      holes: (p) => windowHole(v, p.id, p.x0, p.x1, p.y0, p.y1),
    });
    return assemble(ctx.styleId, [
      piece("sleeve", "sleeve", sleeve, grainOn(v, sleeve, "sleeve-top")),
      piece("drawer", "drawer", drawer, grainOn(v, drawer, "base")),
      ...extraPieces(ctx, parts),
    ]);
  },
  hinges: (ctx) => ({
    roots: { sleeve: "sleeve-bottom", drawer: "base" },
    upright: "base",
    placement: {
      sleeve: { rotate: [0, 90, 0] },
      drawer: { inside: "sleeve", slide: num(ctx.v, "length", 150) * 0.6 },
    },
  }),
};
