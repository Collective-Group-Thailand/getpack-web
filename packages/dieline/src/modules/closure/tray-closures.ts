import { TRAY_CORNER_FLAP_MAX_MM, TRAY_CORNER_FLAP_SHARE, TUCK_CORNER_RADIUS_MM, tuckDepthFor } from "../../constants";
import { tuckOnEdge } from "../../construct/closures";
import { face } from "../../faces";
import { bool, num, str } from "../../params";
import { ellipse, line, polygon, rectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Face, Pt } from "../../types";
import type { BuildContext, ClosureModule, ModuleConfig, TrayExtras, TrayFrame } from "../types";

/**
 * Six-corner lid: hinged on the back wall, its front lip and side lips glued at two more corners,
 * so the box ships flat and pops up with a working lid. Lips reach half the wall height, at most
 * 30 mm. ⚠ Lip depth to be confirmed.
 */
function gluedLipsLid(f: TrayFrame): Face[] {
  const { length: L, width: W, height: H } = f;
  const x0 = H;
  const x1 = H + L;
  const lip = Math.min(H * 0.5, 30);
  const cf = Math.min(lip * TRAY_CORNER_FLAP_SHARE, TRAY_CORNER_FLAP_MAX_MM, lip - 0.5);
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
}

/**
 * Tuck-front lid of a roll-end mailer: hinged on the back wall, dust flaps (ears) on its sides,
 * a front flap and a tuck. ⚠ Simplified locks (no lock tabs/slots) — prepress to confirm.
 */
function tuckFrontLid(ctx: BuildContext, f: TrayFrame): Face[] {
  const { length: L, width: W, height: H } = f;
  const t0 = ctx.m.caliperMm;
  const tuckDepth = num(ctx.v, "tuckDepth", tuckDepthFor(L));
  const x0 = H;
  const x1 = H + L;
  const lidW = W + t0;
  const ear = Math.min(H * 0.9, lidW / 2 - 1);
  const earInset = Math.min(ear * 0.35, lidW / 4);
  const yLid = -lidW;
  const yFront = yLid - H;
  const earFace = (id: string, side: "left" | "right"): Face => {
    const x = side === "left" ? x0 : x1;
    const out = side === "left" ? x0 - ear : x1 + ear;
    const pts: Pt[] =
      side === "left"
        ? [
            [x, 0],
            [out, -earInset],
            [out, yLid + earInset],
            [x, yLid],
          ]
        : [
            [x, yLid],
            [out, yLid + earInset],
            [out, -earInset],
            [x, 0],
          ];
    return face(id, "dust_flap", "dust_flap", polygon(pts, ["cut", "cut", "cut", "crease"]));
  };
  return [
    face("lid", "lid", "lid", [
      line([x0, 0], [x0, yLid], "crease"),
      line([x0, yLid], [x1, yLid], "crease"),
      line([x1, yLid], [x1, 0], "crease"),
      line([x1, 0], [x0, 0], "crease"),
    ]),
    earFace("ear-left", "left"),
    earFace("ear-right", "right"),
    face("lid-front", "front", "flap", rectangle(x0, yFront, L, H, { top: "crease", bottom: "crease" }), {
      // `fingerHole` (the master `thumb` axis): a finger hole in the front flap to lift the lid. ⚠
      holes: bool(ctx.v, "fingerHole", false)
        ? [ellipse(x0 + L / 2, yFront + H / 2, Math.min(10, H / 4), Math.min(10, H / 4))]
        : [],
    }),
    // Walked left to right, so the tuck lies on its upper side, away from the front flap.
    tuckOnEdge(
      "tuck",
      [x0, yFront],
      [x1, yFront],
      tuckDepth,
      str(ctx.v, "tuckCorners", "rounded") === "square" ? 0 : Math.min(TUCK_CORNER_RADIUS_MM, tuckDepth / 2),
    ),
  ];
}

/** A lid hinged on a tray's back wall: `front` is `glued_lips` (six-corner box) or `tuck` (mailer). */
export const hingedLid: ClosureModule = {
  id: "hingedLid",
  slot: "closure",
  status: "implemented",
  fits: ["tray"],
  label: t("ฝาพับติดผนังหลัง", "Lid hinged on the back wall"),
  params: ["tuckDepth"],
  processes: ["die_cut", "folder_gluer_corner"],
  contributes: { kinds: ["lid", "flap", "dust_flap", "tuck"], roles: ["cut", "crease"] },
  constraints: (cfg: ModuleConfig) =>
    cfg.front === "tuck"
      ? [
          {
            id: "hingedLid.tuck_depth",
            code: "tuck.too_deep",
            severity: "error",
            param: "tuckDepth",
            require: "(tuckDepth ?? tuckDepthFor(length)) < height + t",
            message: t("ลิ้นเสียบลึกเกินความสูงกล่อง", "The tuck is deeper than the box is tall"),
          },
          {
            id: "hingedLid.tuck_min_depth",
            code: "mfg.tuck_too_shallow",
            severity: "error",
            param: "tuckDepth",
            require: "(tuckDepth ?? tuckDepthFor(length + a.panel)) >= rule.minTuck",
            message: t("ลิ้นเสียบตื้นเกินไปสำหรับวัสดุนี้", "The tuck is too shallow to hold in this material"),
            stage: "manufacturing",
          },
        ]
      : [],
  tray: (ctx, cfg, frame): TrayExtras => ({
    "wall-back": cfg.front === "tuck" ? tuckFrontLid(ctx, frame) : gluedLipsLid(frame),
  }),
};
