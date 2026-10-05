import { t } from "../../styles/_shared";
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
