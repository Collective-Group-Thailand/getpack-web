import { allowancesOf, LID_CLEARANCE_MM } from "../../constants";
import { buildTray, cornerFlapOf, lockCornerHoles } from "../../construct/tray";
import { face, piece, prefixFaces } from "../../faces";
import { num, str } from "../../params";
import { rectangle } from "../../path";
import { grainOn, t } from "../../styles/_shared";
import type { HingeMap, ParamValues } from "../../types";
import type { FeatureModule } from "../types";

/* Tray features of style-library wave 1 (U3.4). */

export const lockCorners: FeatureModule = {
  id: "lockCorners",
  slot: "feature",
  status: "implemented",
  fits: ["tray"],
  label: t("มุมล็อก (ไม่ใช้กาว)", "Lock corners (no glue)"),
  params: ["cornerLock"],
  processes: ["die_cut", "hand_assembly"],
  contributes: { kinds: [], roles: ["cut"] },
  trayHoles: (ctx, _cfg, frame) => (str(ctx.v, "cornerLock", "glued") === "lock" ? lockCornerHoles(frame) : {}),
};

/**
 * A header card standing up from a display tray's back wall (PK-DS-01): the back wall carries on
 * `headerHeight` above the rim, with a crease at the rim so it ships flat.
 */
export const displayHeader: FeatureModule = {
  id: "displayHeader",
  slot: "feature",
  status: "implemented",
  fits: ["tray"],
  label: t("แผ่นหัวโชว์", "Display header card"),
  params: ["headerHeight"],
  processes: ["die_cut"],
  contributes: { kinds: ["hanger"], roles: ["cut", "crease"] },
  tray: (ctx, _cfg, f) => {
    const h = num(ctx.v, "headerHeight", 120);
    return {
      "wall-back": [face("header", "header", "hanger", rectangle(f.height, -h, f.length, h, { bottom: "crease" }))],
    };
  },
  hinges: () => ({ angles: { header: 0 } }),
};

/**
 * A telescope lid over a tube body (PK-CT-02, an HSC with a lid): a tray cut as its own piece, its
 * inside the body's outside + `LID_CLEARANCE_MM` each way, `lidDepth` deep (a third of the
 * height, 15 mm at least, by default), put on over the body's open top.
 */
export const telescopeLid: FeatureModule = {
  id: "telescopeLid",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("ฝาครอบ (ชิ้นแยก)", "Telescope lid (separate piece)"),
  params: ["lidDepth"],
  processes: ["die_cut", "folder_gluer_corner"],
  contributes: { kinds: ["base", "wall", "flap"], roles: ["cut", "crease"] },
  constraints: [
    {
      id: "telescopeLid.depth",
      code: "lid.too_deep",
      severity: "error",
      param: "lidDepth",
      require: "(lidDepth ?? max(15, round(height / 3))) <= height",
      message: t("ฝาครอบลึกกว่าตัวกล่อง", "The lid is deeper than the base"),
    },
  ],
  pieces(ctx, cfg) {
    const { v, m } = ctx;
    const a = allowancesOf(m);
    const c = LID_CLEARANCE_MM + m.caliperMm;
    const h = telescopeLidDepth(v) + a.trayDepth;
    const faces = prefixFaces(
      buildTray({
        // `length` / `width` (expressions): the body's inside across, when it is not a rectangle's (an octagon's).
        length: (cfg.length ? ctx.num(cfg.length as string) : num(v, "length", 300)) + 2 * c + a.panel,
        width: (cfg.width ? ctx.num(cfg.width as string) : num(v, "width", 200)) + 2 * c + a.panel,
        height: h,
        cornerFlap: cornerFlapOf(h),
      }),
      "lid-",
    );
    // `end` = `bottom` (a design-style telescope's second cover, U3.4 wave 2): its own piece and face ids.
    const bottom = cfg.end === "bottom";
    const own = bottom ? prefixFaces(faces, "bottom-") : faces;
    return [piece(bottom ? "lid-bottom" : "lid", "lid", own, grainOn(v, own, bottom ? "bottom-lid-base" : "lid-base"))];
  },
  hinges: (ctx, cfg): Partial<HingeMap> =>
    cfg.end === "bottom"
      ? {
          roots: { "lid-bottom": "bottom-lid-base" },
          placement: {
            "lid-bottom": { under: "blank", rotate: [90, 0, 0], sink: telescopeLidDepth(ctx.v), lift: 40 },
          },
        }
      : {
          roots: { lid: "lid-base" },
          placement: {
            lid: { over: "blank", rotate: [90, 0, 0], flip: true, sink: telescopeLidDepth(ctx.v), lift: 40 },
          },
        },
};

export const telescopeLidDepth = (v: ParamValues) =>
  // `lid` = `full` (a bulk bin's lid to the floor, U3.4 wave 3): the whole height.
  str(v, "lid", "partial") === "full"
    ? num(v, "height", 150)
    : num(v, "lidDepth", Math.max(15, Math.round(num(v, "height", 150) / 3)));
