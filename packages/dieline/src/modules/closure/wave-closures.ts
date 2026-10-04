import { DUST_FLAP_LENGTH_SHARE, TUCK_CORNER_RADIUS_MM, tuckDepthFor } from "../../constants";
import { airplaneClosure, fourFlapClosure } from "../../construct/closures";
import { num, str } from "../../params";
import { t } from "../../styles/_shared";
import type { ClosureModule } from "../types";
import { TUCK_CONSTRAINTS, withLidWindow } from "./tube-closures";

/* The closures wave 1 of the style library adds to the tuck-end family (U3.4). */

const PANEL_INDEX: Record<string, number> = { front: 0, right: 1, back: 2, left: 3 };

/**
 * Airplane-style tuck end (master `tuck_top` = `airplane_tuck`): the lid on `lid` (front | back)
 * carries its own dust flaps ("wings"), so the side panels end square. A top lid can take a window.
 */
export const airplaneTuck: ClosureModule = {
  id: "airplaneTuck",
  slot: "closure",
  status: "implemented",
  fits: ["tube"],
  label: t("ฝาเสียบแบบเครื่องบิน (ปีกกันฝุ่นติดฝา)", "Airplane tuck (dust wings on the lid)"),
  params: ["tuckDepth", "tuckCorners", "dustFlapDepth"],
  constraints: TUCK_CONSTRAINTS,
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["lid", "tuck", "dust_flap"], roles: ["cut", "crease"] },
  tube(ctx, cfg, end) {
    const { v, m } = ctx;
    const L = num(v, "length", 70);
    const tuckDepth = num(v, "tuckDepth", tuckDepthFor(L));
    const closure = airplaneClosure({
      lidPanel: PANEL_INDEX[(cfg.lid as string) ?? "back"],
      lidDepth: ctx.dims.side,
      tuckDepth,
      tuckRadius: str(v, "tuckCorners", "rounded") === "rounded" ? Math.min(TUCK_CORNER_RADIUS_MM, tuckDepth / 2) : 0,
      wingReach: num(v, "dustFlapDepth", Math.min(ctx.dims.depth * 0.4, L * DUST_FLAP_LENGTH_SHARE, ctx.dims.front * 0.45)),
      caliper: m.caliperMm,
    });
    return end === "top" ? withLidWindow(ctx, closure, "lid-top") : closure;
  },
};

/** Four-flap lock end (master `tuck_bottom` = `four_flap_lock`): four 45°-cut flaps folded in turn. */
export const fourFlapLock: ClosureModule = {
  id: "fourFlapLock",
  slot: "closure",
  status: "implemented",
  fits: ["tube"],
  label: t("ก้นล็อก 4 ปีก", "Four-flap lock bottom"),
  params: [],
  processes: ["die_cut", "hand_assembly"],
  contributes: { kinds: ["lock"], roles: ["cut", "crease"] },
  tube: () => fourFlapClosure(),
  hinges: (_ctx, _cfg, end) => ({
    stages: {
      [`lock-front-${end}`]: 1,
      [`lock-right-${end}`]: 2,
      [`lock-back-${end}`]: 3,
      [`lock-left-${end}`]: 4,
    },
  }),
};
