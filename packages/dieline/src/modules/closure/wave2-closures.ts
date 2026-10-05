import { face } from "../../faces";
import { line, polygon, roundedRectangle } from "../../path";
import { str } from "../../params";
import type { Pt } from "../../types";
import { t } from "../../styles/_shared";
import type { ClosureModule, TrayExtras } from "../types";
import { flapSet, MEET, SLOTTED } from "./tube-closures";

/*
 * Closures the style library's second wave adds (U3.4 wave 2).
 */

/**
 * Overlap slotted container flaps (PK-CS-05): the outer flaps on the long panels reach past the
 * centre and overlap by `flapOverlap` (default 30 mm); the inner flaps meet as on an RSC.
 * ⚠ Overlap to be confirmed by Prepress per flute.
 */
export const osc = flapSet(
  "osc",
  t("ฝาเกยกัน (OSC)", "Overlap slotted flaps (OSC)"),
  {
    depths: ["side / 2 + (flapOverlap ?? 30) / 2 + a.flap", MEET, "side / 2 + (flapOverlap ?? 30) / 2 + a.flap", MEET],
    slot: "slotWidth()",
    stages: { front: 1, back: 2 },
  },
  ["slotter", "folder_gluer_straight"],
  [
    ...SLOTTED,
    {
      id: "osc.overlap",
      code: "flap.overlap_too_wide",
      severity: "error",
      param: "flapOverlap",
      require: "(flapOverlap ?? 30) < width - 20",
      message: t("ระยะเกยของฝากว้างเกินความกว้างกล่อง", "The flap overlap is wider than the box"),
    },
  ],
);

/**
 * An open display top with a raised back (PK-DS-03): no flaps; the front panel's top edge dips in a
 * trapezoid so the goods show (`dip` deep, an expression; default a third of the depth), and a
 * header stands on the back panel's top edge in line with it (`header` tall; default half the
 * depth, at most 80 mm), its top corners rounded. ⚠ Proportions to be confirmed by Prepress.
 */
export const displayTop: ClosureModule = {
  id: "displayTop",
  slot: "closure",
  status: "implemented",
  fits: ["tube"],
  label: t("ด้านบนเปิดโชว์ หลังยกสูงเป็นป้าย", "Open display top with a raised back"),
  params: [],
  processes: ["die_cut"],
  contributes: { kinds: ["hanger"], roles: ["cut", "crease"] },
  tube(ctx, cfg, end) {
    const dip = ctx.num((cfg.dip as string) ?? "depth / 3");
    const tall = ctx.num((cfg.header as string) ?? "min(80, depth / 2)");
    return ({ panels }) => {
      const front = panels[0];
      const back = panels[2];
      const w = front.x1 - front.x0;
      const margin = w * 0.15;
      const slope = Math.min(dip * 0.3, w * 0.1);
      // A free edge below y = 0 dips into the panel (positive y, the tube frame's down).
      const profile: [number, number][] = [
        [front.x0 + margin, 0],
        [front.x0 + margin + slope, dip],
        [front.x1 - margin - slope, dip],
        [front.x1 - margin, 0],
      ];
      const r = Math.min(10, tall / 3, (back.x1 - back.x0) / 4);
      const rr = roundedRectangle(back.x0, -tall, back.x1 - back.x0, tall + 2 * r, r);
      // The rounded rectangle's top half (left arc, top line, right arc) closed by the crease at y = 0.
      const [topLine, topRight, , , , , , topLeft] = rr;
      const header = face(`header-${end}`, "header", "hanger", [
        line([back.x0, 0], [back.x0, -tall + r], "cut"),
        topLeft,
        topLine,
        topRight,
        line([back.x1, -tall + r], [back.x1, 0], "cut"),
        line([back.x1, 0], [back.x0, 0], "crease"),
      ]);
      return { attachments: [{ face: header, span: [back.x0, back.x1] }], profiles: { 0: profile } };
    };
  },
  hinges: (_ctx, _cfg, end) => ({ angles: { [`header-${end}`]: 0 } }),
};

/**
 * Cover flaps on a tray (PK-CF-04 book wrap): flaps on the front and back walls that fold over the
 * top and overlap by `flapOverlap` (default 30 mm), end flaps on the side walls folded in under
 * them. `lock` = `slit`: a tongue on the back flap passes through a slit in the front flap.
 * ⚠ Flap depths, tongue and slit to be confirmed by Prepress.
 */
export const coverFlaps: ClosureModule = {
  id: "coverFlaps",
  slot: "closure",
  status: "implemented",
  fits: ["tray"],
  label: t("ฝาพับห่อปิดด้านบน", "Wrap-over cover flaps"),
  params: ["flapOverlap", "lock"],
  processes: ["die_cut", "folder_gluer_corner"],
  contributes: { kinds: ["lid", "flap", "dust_flap"], roles: ["cut", "crease"] },
  tray(ctx, _cfg, f): TrayExtras {
    const { length: L, width: W, height: H } = f;
    const x0 = H;
    const x1 = H + L;
    const y0 = H;
    const y1 = H + W;
    const ov = ctx.num("flapOverlap ?? 30");
    const d = W / 2 + ov / 2;
    const taper = Math.min(8, d / 4, L / 8);
    const slit = str(ctx.v, "lock", "friction") === "slit";
    const tongue = { w: Math.min(30, L / 4), d: Math.min(12, d / 3) };
    const end = Math.min(L * 0.3, W / 2 - 2);
    const endTaper = Math.min(6, end / 3, W / 8);
    const backPts: Pt[] = [
      [x1, 0],
      [x1 - taper, -d],
      ...(slit
        ? ([
            [(x0 + x1) / 2 + tongue.w / 2, -d],
            [(x0 + x1) / 2 + tongue.w / 2 - 3, -d - tongue.d],
            [(x0 + x1) / 2 - tongue.w / 2 + 3, -d - tongue.d],
            [(x0 + x1) / 2 - tongue.w / 2, -d],
          ] as Pt[])
        : []),
      [x0 + taper, -d],
      [x0, 0],
    ];
    const back = face(
      "cover-back",
      "outer_flap",
      "lid",
      polygon(
        backPts,
        backPts.map((_p, i) => (i === backPts.length - 1 ? "crease" : "cut")),
      ),
    );
    // Where the tongue's base lands on the front flap: W − d in from the front wall.
    const at = y1 + H + (W - d);
    const front = face(
      "cover-front",
      "inner_flap",
      "flap",
      polygon(
        [
          [x0, y1 + H],
          [x1, y1 + H],
          [x1 - taper, y1 + H + d],
          [x0 + taper, y1 + H + d],
        ],
        ["crease", "cut", "cut", "cut"],
      ),
      {
        holes: slit
          ? [
              polygon([
                [(x0 + x1) / 2 - tongue.w / 2 - 1, at - 2.5],
                [(x0 + x1) / 2 + tongue.w / 2 + 1, at - 2.5],
                [(x0 + x1) / 2 + tongue.w / 2 + 1, at - 1],
                [(x0 + x1) / 2 - tongue.w / 2 - 1, at - 1],
              ]),
            ]
          : [],
      },
    );
    const endFlap = (id: string, x: number, dir: -1 | 1) => {
      const out = x + dir * end;
      const pts: Pt[] =
        dir === -1
          ? [
              [x, y0],
              [x, y1],
              [out, y1 - endTaper],
              [out, y0 + endTaper],
            ]
          : [
              [x, y1],
              [x, y0],
              [out, y0 + endTaper],
              [out, y1 - endTaper],
            ];
      return face(id, "dust_flap", "dust_flap", polygon(pts, ["crease", "cut", "cut", "cut"]));
    };
    return {
      "wall-back": [back],
      "wall-front": [front],
      "wall-left": [endFlap("cover-left", 0, -1)],
      "wall-right": [endFlap("cover-right", x1 + H, 1)],
    };
  },
  hinges: () => ({ stages: { "cover-left": 4, "cover-right": 4, "cover-front": 5, "cover-back": 6 } }),
};
