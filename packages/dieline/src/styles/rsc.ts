import { allowancesOf, glueWidthFor, MIN_SLOT_MM, SLOT_CALIPER_FACTOR } from "../constants";
import { slottedFlaps } from "../construct/closures";
import { buildTube } from "../construct/tube";
import { assemble, piece } from "../faces";
import { issue, num, str } from "../params";
import type { MaterialSpec, ParamValues } from "../types";
import { defineStyle, glueSideParam, glueWidthParam, grainOn, grainParam, sizeParams, t } from "./_shared";

/** Slot width between corrugated flaps: two calipers, at least 3 mm (0 = slit for paperboard). */
export function slotWidth(m: MaterialSpec): number {
  return m.kind === "corrugated" ? Math.max(MIN_SLOT_MM, SLOT_CALIPER_FACTOR * m.caliperMm) : 0;
}

export type SlottedVariant = "rsc" | "hsc" | "fol" | "cssc";

/**
 * The slotted-container family. Compensation: panels L + a, W + a (a = t or the flute's
 * `col_a`), the glue-side panel t narrower, depth H + 2t; flaps meeting at the centre are
 * (W + a)/2 + a_flap deep (legacy `Flap = W/2 + col_c`). Full-overlap flaps are W + a deep;
 * centre-special minor flaps reach (L + a)/2.
 */
export function makeSlotted(variant: SlottedVariant, v: ParamValues, m: MaterialSpec) {
  const a = allowancesOf(m);
  const L = num(v, "length", 250);
  const W = num(v, "width", 180);
  const H = num(v, "height", 120);
  const front = L + a.panel;
  const side = W + a.panel;
  const depth = H + (variant === "hsc" ? a.trayDepth : a.depth);
  const meet = side / 2 + a.flap;
  const major = variant === "fol" ? side : meet;
  const minor = variant === "cssc" ? front / 2 + a.flap : variant === "fol" ? side : meet;
  const flaps = slottedFlaps({ depths: [major, minor, major, minor], slot: slotWidth(m) });
  const faces = buildTube({
    panels: [
      { id: "front", label: "front", width: front },
      { id: "right", label: "right", width: side },
      { id: "back", label: "back", width: front },
      { id: "left", label: "left", width: side - a.gluePanel },
    ],
    depth,
    glue: num(v, "glueWidth", glueWidthFor(W, m)),
    glueRight: str(v, "glueSide", "left") === "right",
    top: variant === "hsc" ? undefined : flaps,
    bottom: flaps,
  });
  return assemble(variant, [piece("blank", "blank", faces, grainOn(v, faces, "front"))]);
}

const common = {
  category: "corrugated" as const,
  materials: ["corrugated"] as MaterialSpec["kind"][],
  params: [
    ...sizeParams({ length: [80, 1200], width: [60, 800], height: [40, 1000] }),
    glueWidthParam,
    glueSideParam,
    grainParam,
  ],
  defaults: { length: 250, width: 180, height: 120, glueSide: "left", grain: "across" },
  presets: [
    { id: "s", label: t("S 150 × 100 × 80", "S 150 × 100 × 80"), values: { length: 150, width: 100, height: 80 } },
    { id: "m", label: t("M 250 × 180 × 120", "M 250 × 180 × 120"), values: { length: 250, width: 180, height: 120 } },
    { id: "l", label: t("L 350 × 250 × 200", "L 350 × 250 × 200"), values: { length: 350, width: 250, height: 200 } },
    {
      id: "xl",
      label: t("XL 450 × 350 × 300", "XL 450 × 350 × 300"),
      values: { length: 450, width: 350, height: 300 },
    },
  ],
  faces3d: { roots: { blank: "front" } },
};

/** Legacy `l_must_more_than_w` (default on): flaps of a box wider than long overlap badly. */
function lengthOverWidth(v: ParamValues) {
  return num(v, "width", 0) > num(v, "length", 0)
    ? [
        issue(
          "size.width_exceeds_length",
          t("ความกว้างมากกว่าความยาว ลองสลับค่ากัน", "Width is greater than length — try swapping them"),
          "width",
          "warning",
        ),
      ]
    : [];
}

export const rsc = defineStyle({
  ...common,
  id: "rsc",
  codes: { fefco: "0201" },
  name: t("กล่องลูกฟูกฝาชน (RSC)", "Regular slotted container (RSC)"),
  description: t(
    "กล่องขนส่งมาตรฐาน ฝาบน-ล่างยาวครึ่งหนึ่งของความกว้าง พับมาชนกันกลางกล่อง",
    "The standard shipping box: all flaps half the width, outer flaps meeting in the middle",
  ),
  make: (v, m) => makeSlotted("rsc", v, m),
  check: lengthOverWidth,
  legacy: { patternKeys: ["pid:19", "mapping:30", "corrugate-rsc", "rsc"] },
});
