import { DUST_FLAP_LENGTH_SHARE, THUMB_NOTCH_RADIUS_MM, TUCK_CORNER_RADIUS_MM, tuckDepthFor } from "../../constants";
import { airplaneClosure, fourFlapClosure } from "../../construct/closures";
import { face } from "../../faces";
import { bool, num, str } from "../../params";
import { line, polygon, rectangle } from "../../path";
import type { Closure } from "../../construct/tube";
import type { Face, Pt } from "../../types";
import { t } from "../../styles/_shared";
import type { ClosureModule, FeatureModule } from "../types";
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
      wingReach: num(
        v,
        "dustFlapDepth",
        Math.min(ctx.dims.depth * 0.4, L * DUST_FLAP_LENGTH_SHARE, ctx.dims.front * 0.45),
      ),
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

/**
 * Hinged flip-top (PK-FT-01): a lid on the back panel reaching one caliper past the front, with
 * dust wings on its sides and a lip that folds down **outside** the front panel — it opens and
 * closes on the lip, no tuck. The lip is a third of the height, 12–25 mm. ⚠ Lip depth and wing
 * cut-backs to be confirmed by Prepress.
 */
export const flipTop: ClosureModule = {
  id: "flipTop",
  slot: "closure",
  status: "implemented",
  fits: ["tube"],
  label: t("ฝาพับเปิดปิด (ลิ้นปิดด้านนอก)", "Hinged flip-top lid (lip outside the front)"),
  params: ["dustFlapDepth"],
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["lid", "flap", "dust_flap"], roles: ["cut", "crease"] },
  tube(ctx, _cfg, end) {
    const { v, m } = ctx;
    const L = num(v, "length", 70);
    const lidDepth = ctx.dims.side + m.caliperMm;
    const lip = lipOf(ctx.dims.depth);
    const reach = num(
      v,
      "dustFlapDepth",
      Math.min(ctx.dims.depth * 0.4, L * DUST_FLAP_LENGTH_SHARE, ctx.dims.front * 0.45),
    );
    const closure: Closure = ({ panels }) => {
      const back = panels[2];
      const y = -lidDepth;
      const lid = face(`lid-${end}`, "lid", "lid", [
        line([back.x0, 0], [back.x0, y], "crease"),
        line([back.x0, y], [back.x1, y], "crease"),
        line([back.x1, y], [back.x1, 0], "crease"),
        line([back.x1, 0], [back.x0, 0], "crease"),
      ]);
      const lipFace = face(
        `lip-${end}`,
        "outer_flap",
        "flap",
        rectangle(back.x0, y - lip, back.x1 - back.x0, lip, { bottom: "crease" }),
      );
      const nearPanel = Math.min(reach * 0.3 + m.caliperMm, lidDepth / 4);
      const nearLip = Math.min(reach * 0.15 + 2 * m.caliperMm, lidDepth / 4);
      const wing = (side: "left" | "right"): Face => {
        const x = side === "left" ? back.x0 : back.x1;
        const out = side === "left" ? x - reach : x + reach;
        const pts: Pt[] =
          side === "left"
            ? [
                [x, 0],
                [out, -nearPanel],
                [out, y + nearLip],
                [x, y],
              ]
            : [
                [x, y],
                [out, y + nearLip],
                [out, -nearPanel],
                [x, 0],
              ];
        return face(`wing-${side}-${end}`, "dust_flap", "dust_flap", polygon(pts, ["cut", "cut", "cut", "crease"]));
      };
      return {
        attachments: [{ face: lid, span: [back.x0, back.x1] }],
        faces: [lipFace, wing("left"), wing("right")],
      };
    };
    return end === "top" ? withLidWindow(ctx, closure, "lid-top") : closure;
  },
};

/** The flip-top's lip: a third of the panel depth, 12–25 mm. */
export const lipOf = (depth: number) => Math.max(12, Math.min(25, depth / 3));

/**
 * Slit lock on a tuck lid (PK-TE-02 `lock` = `slit_lock`): two slits 10 × 1 mm in the lid, 2 mm
 * from the tuck crease at a fifth of its length from each end, that the dust flaps' shoulders
 * catch. `friction` is the plain tuck, held by its shoulders against the dust flaps.
 * ⚠ Slit size and position to be confirmed by Prepress.
 */
export const slitLock: FeatureModule = {
  id: "slitLock",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("ล็อกร่อง", "Slit lock"),
  params: ["lock"],
  processes: ["die_cut"],
  contributes: { kinds: [], roles: ["cut"] },
  wrapClosure: (ctx, _cfg, end, inner) => (c) => {
    const out = inner(c);
    if (str(ctx.v, "lock", "friction") !== "slit") return out;
    const lid = [...out.attachments.map((a) => a.face), ...(out.faces ?? [])].find((f) => f.id === `lid-${end}`);
    if (!lid) return out;
    const xs = lid.outline.flatMap((e) => [e.from[0], e.to[0]]);
    const ys = lid.outline.flatMap((e) => [e.from[1], e.to[1]]);
    const [x0, x1, y] = [Math.min(...xs), Math.max(...xs), Math.min(...ys)];
    const len = Math.min(10, (x1 - x0) / 6);
    const slits = [0.2, 0.8].map((k) => rectangle(x0 + (x1 - x0) * k - len / 2, y + 2, len, 1));
    lid.holes = [...lid.holes, ...slits];
    return out;
  },
};

/**
 * An open end (a sleeve's): nothing hinged, and with `thumbNotch` (the master `thumb` axis) a
 * half-round notch in the front panel's edge to push the product out.
 */
export const openEnd: ClosureModule = {
  id: "openEnd",
  slot: "closure",
  status: "implemented",
  fits: ["tube"],
  label: t("ปลายเปิด", "Open end"),
  params: ["thumbNotch"],
  processes: ["die_cut"],
  contributes: { kinds: [], roles: ["cut"] },
  tube(ctx) {
    const on = bool(ctx.v, "thumbNotch", false);
    return ({ panels }) => {
      const p = panels[0];
      const r = Math.min(THUMB_NOTCH_RADIUS_MM, (p.x1 - p.x0) / 4, ctx.dims.depth / 4);
      return { attachments: [], notches: on ? [{ panel: 0, center: (p.x0 + p.x1) / 2, radius: r }] : [] };
    };
  },
};
