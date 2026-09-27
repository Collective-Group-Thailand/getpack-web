import { allowancesOf, glueWidthFor, MIN_SLOT_MM, SLOT_CALIPER_FACTOR } from "../constants";
import { slottedFlaps } from "../construct/closures";
import { buildTube } from "../construct/tube";
import { assemble, piece } from "../faces";
import { issue, num, str } from "../params";
import { roundedRectangle } from "../path";
import type { Contour, Issue, MaterialSpec, ParamSchema, ParamValues } from "../types";
import { defineStyle, glueSideParam, glueWidthParam, grainOn, grainParam, sizeParams, t } from "./_shared";

/** Slot width between corrugated flaps: two calipers, at least 3 mm (0 = slit for paperboard). */
export function slotWidth(m: MaterialSpec): number {
  return m.kind === "corrugated" ? Math.max(MIN_SLOT_MM, SLOT_CALIPER_FACTOR * m.caliperMm) : 0;
}

export type SlottedVariant = "rsc" | "hsc" | "fol" | "cssc";

/** Hand hole in each end panel: a stadium 90 × 30 mm (narrower on small boxes), 30 mm below the top crease. ⚠ */
const HAND_HOLE = { width: 90, height: 30, fromTop: 30, margin: 20 };

function handHoles(v: ParamValues, panel: { id: string; x0: number; x1: number; y0: number }): Contour[] {
  if (str(v, "handles", "none") !== "side" || (panel.id !== "right" && panel.id !== "left")) return [];
  const w = Math.min(HAND_HOLE.width, panel.x1 - panel.x0 - 2 * HAND_HOLE.margin);
  const cx = (panel.x0 + panel.x1) / 2;
  const y = panel.y0 + HAND_HOLE.fromTop;
  return [roundedRectangle(cx - w / 2, y, w, HAND_HOLE.height, HAND_HOLE.height / 2)];
}

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
    holes: (p) => handHoles(v, p),
  });
  return assemble(variant, [piece("blank", "blank", faces, grainOn(v, faces, "front"))]);
}

export const handlesParam: ParamSchema = {
  key: "handles",
  kind: "enum",
  group: "options",
  label: t("ช่องมือจับ", "Hand holes"),
  options: [
    { value: "none", label: t("ไม่มี", "None") },
    { value: "side", label: t("ที่ด้านข้างทั้งสอง", "In both end panels") },
  ],
};

export const slottedCommon = {
  category: "corrugated" as const,
  materials: ["corrugated"] as MaterialSpec["kind"][],
  params: [
    ...sizeParams({ length: [80, 1200], width: [60, 800], height: [40, 1000] }),
    glueWidthParam,
    glueSideParam,
    handlesParam,
    grainParam,
  ],
  defaults: { length: 250, width: 180, height: 120, glueSide: "left", handles: "none", grain: "across" },
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

/** Legacy `l_must_more_than_w` (default on) as a warning, and hand holes only where they fit. */
export function slottedChecks(v: ParamValues): Issue[] {
  const out: Issue[] = [];
  if (num(v, "width", 0) > num(v, "length", 0)) {
    out.push(
      issue(
        "size.width_exceeds_length",
        t("ความกว้างมากกว่าความยาว ลองสลับค่ากัน", "Width is greater than length — try swapping them"),
        "width",
        "warning",
      ),
    );
  }
  if (
    str(v, "handles", "none") === "side" &&
    (num(v, "width", 0) < 60 + 2 * HAND_HOLE.margin || num(v, "height", 0) < 80)
  ) {
    out.push(
      issue(
        "handle.too_small",
        t("กล่องเล็กเกินกว่าจะเจาะช่องมือจับ", "The box is too small for hand holes"),
        "handles",
      ),
    );
  }
  return out;
}

export const rsc = defineStyle({
  ...slottedCommon,
  id: "rsc",
  codes: { fefco: "0201" },
  name: t("กล่องลูกฟูกฝาชน (RSC)", "Regular slotted container (RSC)"),
  description: t(
    "กล่องขนส่งมาตรฐาน ฝาบน-ล่างยาวครึ่งหนึ่งของความกว้าง พับมาชนกันกลางกล่อง",
    "The standard shipping box: all flaps half the width, outer flaps meeting in the middle",
  ),
  make: (v, m) => makeSlotted("rsc", v, m),
  check: slottedChecks,
  legacy: { patternKeys: ["pid:19", "mapping:30", "corrugate-rsc", "rsc-3d", "rsc"] },
});
