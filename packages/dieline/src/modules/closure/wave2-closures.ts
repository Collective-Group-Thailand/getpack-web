import { face } from "../../faces";
import { line, roundedRectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { ClosureModule } from "../types";
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
      const header = face(`header-${end}`, "hanger", "hanger", [
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
