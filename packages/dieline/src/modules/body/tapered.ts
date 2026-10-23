import { assemble, face, piece } from "../../faces";
import { num, str } from "../../params";
import { ellipse, polygon, roundedRectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Contour, Pt } from "../../types";
import type { BodyModule, BuildContext, ModuleConfig } from "../types";

/**
 * A tapered tray (PK-SP-11 popcorn box, PK-SP-08 food pail): a flat base `length` × `width`, four
 * walls flaring out by `taper` on every side over the height `height` (leaning in when it is negative: a
 * tapered gift box), glued at the corners by
 * flaps on the front and back walls that fold inside the end walls — the cross layout of a glued
 * tray with trapezoid walls. With `top` = `flaps` (the pail) each wall carries a top flap folded in
 * flat: the end walls' first, as dust flaps, then the long walls' meeting at the centre over them.
 * `pailHandle` = `die_cut` cuts a finger slot near each long flap's meeting edge (together, a carry
 * slot); `insert` two round holes high in the end walls for a wire handle.
 * ⚠ Glue flap width, flap depths, slot and hole positions to be confirmed by Prepress.
 */

interface Geometry {
  L: number;
  W: number;
  H: number;
  taper: number;
  /** The walls' slant height. */
  s: number;
  /** The glue flaps' width. */
  g: number;
  /** End walls' and long walls' top flap depth (0 when the top is open). */
  dEnd: number;
  dLong: number;
}

function geometry(ctx: BuildContext, cfg: ModuleConfig): Geometry {
  const L = num(ctx.v, "length", 120);
  const W = num(ctx.v, "width", 90);
  const H = num(ctx.v, "height", 100);
  const taper = num(ctx.v, "taper", 15);
  const s = Math.hypot(H, taper);
  // Narrower than a quarter of the narrowest wall edge, base or rim, so two flaps never meet inside one end wall.
  const g = Math.min(15, s / 4, Math.min(L, W, L + 2 * taper, W + 2 * taper) / 4);
  const flaps = cfg.top === "flaps";
  const topL = L + 2 * taper;
  const topW = W + 2 * taper;
  return {
    L,
    W,
    H,
    taper,
    s,
    g,
    dEnd: flaps ? Math.min(topL * 0.4, topW * 0.6) : 0,
    dLong: flaps ? topW / 2 - 1 : 0,
  };
}

/** A flap on edge p → q of a face, on the side away from `inside`, `depth` deep with 45° shoulders (or `inset`). */
function flapOn(p: Pt, q: Pt, inside: Pt, depth: number, inset = depth): Pt[] {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const u: Pt = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
  let n: Pt = [-u[1], u[0]];
  const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  if ((inside[0] - mid[0]) * n[0] + (inside[1] - mid[1]) * n[1] > 0) n = [-n[0], -n[1]];
  const k = Math.min(inset, len / 2 - 1);
  return [
    p,
    q,
    [q[0] + n[0] * depth - u[0] * k, q[1] + n[1] * depth - u[1] * k],
    [p[0] + n[0] * depth + u[0] * k, p[1] + n[1] * depth + u[1] * k],
  ];
}

export const taperedTray: BodyModule = {
  id: "taperedTray",
  slot: "body",
  kind: "special",
  status: "implemented",
  folds: true,
  label: t("ถาด/ถังทรงสอบ", "Tapered tray or pail"),
  params: ["length", "width", "height", "taper", "pailHandle"],
  processes: ["die_cut", "folder_gluer_corner"],
  contributes: { kinds: ["base", "wall", "glue_flap", "flap", "dust_flap"], roles: ["cut", "crease"] },
  constraints: [
    {
      id: "taperedTray.taper",
      code: "size.taper_too_steep",
      severity: "error",
      param: "taper",
      require: "abs(taper) <= height / 2",
      message: t("ความสอบต้องไม่เกินครึ่งหนึ่งของความสูง", "The taper may be at most half the height either way"),
    },
  ],
  build(ctx, cfg) {
    const { L, W, taper: k, s, g, dEnd, dLong } = geometry(ctx, cfg);
    const handle = str(ctx.v, "pailHandle", "none");
    const centre: Pt = [L / 2, W / 2];
    // The walls' top corners, sheet frame (y down): back above the base, front below, left and right beside.
    const back: Pt[] = [
      [L, 0],
      [0, 0],
      [-k, -s],
      [L + k, -s],
    ];
    const front: Pt[] = [
      [0, W],
      [L, W],
      [L + k, W + s],
      [-k, W + s],
    ];
    const left: Pt[] = [
      [0, 0],
      [0, W],
      [-s, W + k],
      [-s, -k],
    ];
    const right: Pt[] = [
      [L, W],
      [L, 0],
      [L + s, -k],
      [L + s, W + k],
    ];
    const top = dEnd > 0;
    const wall = (
      id: string,
      label: "wall_back" | "wall_front" | "wall_left" | "wall_right",
      pts: Pt[],
      holes: Contour[] = [],
    ) =>
      // Base crease, a side edge (creased where a glue flap hangs), the top edge (creased under a top flap), the other side.
      face(
        id,
        label,
        "wall",
        polygon(pts, [
          "crease",
          label === "wall_back" || label === "wall_front" ? "crease" : "cut",
          top ? "crease" : "cut",
          label === "wall_back" || label === "wall_front" ? "crease" : "cut",
        ]),
        { holes },
      );
    // Wire-handle holes 15 mm below the end walls' rim, at their middle.
    const pin = (x: number) => (handle === "insert" ? [ellipse(x, W / 2, 2.5, 2.5)] : []);
    const faces = [
      face(
        "base",
        "base",
        "base",
        polygon(
          [
            [0, 0],
            [L, 0],
            [L, W],
            [0, W],
          ],
          "crease",
        ),
      ),
      wall("wall-back", "wall_back", back),
      wall("wall-front", "wall_front", front),
      wall("wall-left", "wall_left", left, pin(-s + 15)),
      wall("wall-right", "wall_right", right, pin(L + s - 15)),
      // Glue flaps on the long walls' side edges, folded inside the end walls.
      face(
        "glue-back-left",
        "glue_flap",
        "glue_flap",
        polygon(flapOn([0, 0], [-k, -s], [L / 2, -s / 2], g), ["crease", "cut", "cut", "cut"]),
      ),
      face(
        "glue-back-right",
        "glue_flap",
        "glue_flap",
        polygon(flapOn([L, 0], [L + k, -s], [L / 2, -s / 2], g), ["crease", "cut", "cut", "cut"]),
      ),
      face(
        "glue-front-left",
        "glue_flap",
        "glue_flap",
        polygon(flapOn([0, W], [-k, W + s], [L / 2, W + s / 2], g), ["crease", "cut", "cut", "cut"]),
      ),
      face(
        "glue-front-right",
        "glue_flap",
        "glue_flap",
        polygon(flapOn([L, W], [L + k, W + s], [L / 2, W + s / 2], g), ["crease", "cut", "cut", "cut"]),
      ),
    ];
    if (top) {
      // A finger slot 10 mm in from each long flap's meeting edge.
      const slot = (y: number) => (handle === "die_cut" ? [roundedRectangle(L / 2 - 30, y - 6, 60, 12, 6)] : []);
      const backFlap = flapOn([-k, -s], [L + k, -s], centre, dLong, dLong * 0.25);
      const frontFlap = flapOn([L + k, W + s], [-k, W + s], centre, dLong, dLong * 0.25);
      faces.push(
        face("top-back", "top_flap", "flap", polygon(backFlap, ["crease", "cut", "cut", "cut"]), {
          holes: slot(-s - dLong + 16),
        }),
        face("top-front", "top_flap", "flap", polygon(frontFlap, ["crease", "cut", "cut", "cut"]), {
          holes: slot(W + s + dLong - 16),
        }),
        face(
          "top-left",
          "dust_flap",
          "dust_flap",
          polygon(flapOn([-s, W + k], [-s, -k], centre, dEnd), ["crease", "cut", "cut", "cut"]),
        ),
        face(
          "top-right",
          "dust_flap",
          "dust_flap",
          polygon(flapOn([L + s, -k], [L + s, W + k], centre, dEnd), ["crease", "cut", "cut", "cut"]),
        ),
      );
    }
    return assemble(ctx.styleId, [piece("blank", "blank", faces)]);
  },
  hinges(ctx, cfg) {
    const { H, taper: k, s, dEnd } = geometry(ctx, cfg);
    // Each wall leans out by the taper: folded up by less than 90°.
    const up = (Math.acos(k / s) * 180) / Math.PI;
    // A glue flap folds by the angle between two neighbouring walls' planes.
    const n1 = [0, -H, -k];
    const n2 = [H, 0, -k];
    const cos = (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]) / (Math.hypot(...n1) * Math.hypot(...n2));
    const glue = 180 - (Math.acos(cos) * 180) / Math.PI;
    const flat = 180 - up;
    const angles: Record<string, number> = {
      "wall-back": up,
      "wall-front": up,
      "wall-left": up,
      "wall-right": up,
      "glue-back-left": glue,
      "glue-back-right": glue,
      "glue-front-left": glue,
      "glue-front-right": glue,
    };
    const stages: Record<string, number> = {
      "glue-back-left": 0,
      "glue-back-right": 0,
      "glue-front-left": 0,
      "glue-front-right": 0,
      "wall-back": 1,
      "wall-front": 1,
      "wall-left": 2,
      "wall-right": 2,
    };
    if (dEnd > 0) {
      Object.assign(angles, { "top-left": flat, "top-right": flat, "top-back": flat, "top-front": flat });
      Object.assign(stages, { "top-left": 3, "top-right": 3, "top-back": 4, "top-front": 4 });
    }
    return { roots: { blank: "base" }, upright: "base", angles, stages };
  },
};
