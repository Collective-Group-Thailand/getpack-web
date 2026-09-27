import {
  allowancesOf,
  DUST_FLAP_LENGTH_SHARE,
  DUST_FLAP_WIDTH_SHARE,
  glueWidthFor,
  THUMB_NOTCH_RADIUS_MM,
  TUCK_CORNER_RADIUS_MM,
  tuckDepthFor,
} from "../constants";
import { tuckClosure } from "../construct/closures";
import { buildTube, type Closure } from "../construct/tube";
import { assemble, piece } from "../faces";
import { bool, issue, num, str } from "../params";
import type { Dieline, Face, MaterialSpec, ParamSchema, ParamValues } from "../types";
import {
  glueSideParam,
  glueWidthParam,
  grainOn,
  grainParam,
  sizeParams,
  t,
  WINDOW_DEFAULTS,
  windowHole,
  windowIssues,
  windowParams,
} from "./_shared";

/*
 * The four-panel carton family: front | right | back | left with a glue flap, closed at each end
 * by a tuck, a lock bottom, glued flaps… Each style picks its closures; sizing, compensation,
 * windows, glue side and the grain arrow are shared here.
 */

/** The panels of a four-panel carton, for window placement. */
export const CARTON_PANELS = [
  { value: "front", label: t("ด้านหน้า", "Front") },
  { value: "back", label: t("ด้านหลัง", "Back") },
  { value: "right", label: t("ด้านข้างขวา", "Right side") },
  { value: "left", label: t("ด้านข้างซ้าย", "Left side") },
];

export const tuckParams: ParamSchema[] = [
  {
    key: "tuckDepth",
    kind: "length",
    group: "closure",
    label: t("ความลึกลิ้นเสียบ", "Tuck depth"),
    help: t(
      "เว้นว่างเพื่อใช้ค่าแนะนำตามความยาวกล่อง (15 / 20 / 25 มม.)",
      "Leave empty for the recommended depth by box length (15 / 20 / 25 mm)",
    ),
    min: 8,
    max: 60,
    step: 0.5,
    legacyKey: "f",
  },
  {
    key: "tuckCorners",
    kind: "enum",
    group: "closure",
    label: t("มุมลิ้นเสียบ", "Tuck corners"),
    options: [
      { value: "rounded", label: t("มุมมน", "Rounded") },
      { value: "square", label: t("มุมเหลี่ยม", "Square") },
    ],
  },
  {
    key: "dustFlapDepth",
    kind: "length",
    group: "closure",
    label: t("ความลึกปีกกันฝุ่น", "Dust flap depth"),
    help: t("เว้นว่างเพื่อใช้ค่าแนะนำ", "Leave empty for the recommended depth"),
    min: 5,
    max: 300,
    step: 0.5,
  },
  { key: "thumbNotch", kind: "boolean", group: "options", label: t("รอยเว้านิ้วโป้ง", "Thumb notch") },
];

export interface TubeDims {
  /** Panel scores: front/back (L) and sides (W), the side the glue flap closes on already reduced. */
  front: number;
  side: number;
  closingSide: number;
  depth: number;
  glue: number;
}

/**
 * Caliper compensation for a four-panel tube closed at both ends, documented once:
 * - front/back score = L + a_panel, side score = W + a_panel (a_panel = t, or the flute's col_a);
 * - the side the glue flap is glued inside is t narrower (seam does not bulge);
 * - depth score = H + a_depth (2t: a closure layer at each end).
 */
export function tubeDims(v: ParamValues, m: MaterialSpec): TubeDims {
  const a = allowancesOf(m);
  const L = num(v, "length", 70);
  const W = num(v, "width", 40);
  const H = num(v, "height", 150);
  const side = W + a.panel;
  return {
    front: L + a.panel,
    side,
    closingSide: side - a.gluePanel,
    depth: H + a.depth,
    glue: num(v, "glueWidth", glueWidthFor(W, m)),
  };
}

export function tuckChecks(v: ParamValues, m: MaterialSpec) {
  const d = tubeDims(v, m);
  const L = num(v, "length", 70);
  const tuckDepth = num(v, "tuckDepth", tuckDepthFor(L));
  const out = [];
  if (tuckDepth >= d.depth - 5) {
    out.push(
      issue("tuck.too_deep", t("ลิ้นเสียบลึกเกินความสูงกล่อง", "The tuck is deeper than the box is tall"), "tuckDepth"),
    );
  }
  if (tuckDepth > d.side * 1.5) {
    out.push(
      issue(
        "tuck.deeper_than_lid",
        t("ลิ้นเสียบลึกกว่าฝามาก อาจปิดไม่สนิท", "The tuck is much deeper than the lid; it may not close flat"),
        "tuckDepth",
        "warning",
      ),
    );
  }
  return out;
}

export interface TuckValues {
  tuckDepth: number;
  tuckRadius: number;
  dustReach: number;
  thumb: number;
}

export function tuckValues(v: ParamValues): TuckValues {
  const L = num(v, "length", 70);
  const W = num(v, "width", 40);
  const tuckDepth = num(v, "tuckDepth", tuckDepthFor(L));
  return {
    tuckDepth,
    tuckRadius: str(v, "tuckCorners", "rounded") === "rounded" ? Math.min(TUCK_CORNER_RADIUS_MM, tuckDepth / 2) : 0,
    dustReach: num(v, "dustFlapDepth", Math.min(L * DUST_FLAP_LENGTH_SHARE, W * DUST_FLAP_WIDTH_SHARE)),
    thumb: bool(v, "thumbNotch", false) ? THUMB_NOTCH_RADIUS_MM : 0,
  };
}

/** A tuck end closure with the lid on `lidPanel` (0 front, 2 back); the thumb notch only where asked. */
export function tuck(v: ParamValues, m: MaterialSpec, lidPanel: number, withThumb: boolean): Closure {
  const d = tubeDims(v, m);
  const tv = tuckValues(v);
  return tuckClosure({
    lidPanel,
    lidDepth: d.side,
    tuckDepth: tv.tuckDepth,
    tuckRadius: tv.tuckRadius,
    dustPanels: [1, 3],
    dustReach: tv.dustReach,
    caliper: m.caliperMm,
    thumbNotch: withThumb ? tv.thumb : 0,
  });
}

/** Builds a four-panel carton with the given closures (and any extra faces hung on them). */
export function makeCarton(
  styleId: string,
  v: ParamValues,
  m: MaterialSpec,
  closures: { top?: Closure; bottom?: Closure },
  depthOverride?: number,
): Dieline {
  const d = tubeDims(v, m);
  const faces: Face[] = buildTube({
    panels: [
      { id: "front", label: "front", width: d.front },
      { id: "right", label: "right", width: d.side },
      { id: "back", label: "back", width: d.front },
      { id: "left", label: "left", width: d.closingSide },
    ],
    depth: depthOverride ?? d.depth,
    glue: d.glue,
    glueRight: str(v, "glueSide", "left") === "right",
    top: closures.top,
    bottom: closures.bottom,
    holes: (p) => windowHole(v, p.id, p.x0, p.x1, p.y0, p.y1),
  });
  return assemble(styleId, [piece("blank", "blank", faces, grainOn(v, faces, "front"))]);
}

/** Size, glue, grain and window parameters every carton has. */
export function cartonParams(extra: ParamSchema[] = []): ParamSchema[] {
  return [
    ...sizeParams({ length: [20, 400], width: [15, 300], height: [20, 450] }),
    ...extra,
    glueWidthParam,
    glueSideParam,
    grainParam,
    ...windowParams(CARTON_PANELS),
  ];
}

export const CARTON_DEFAULTS: ParamValues = {
  length: 70,
  width: 40,
  height: 150,
  tuckCorners: "rounded",
  glueSide: "left",
  thumbNotch: false,
  grain: "across",
  windowPanel: "front",
  ...WINDOW_DEFAULTS,
};

export const CARTON_PRESETS = [
  {
    id: "cosmetic",
    label: t("ครีม/เครื่องสำอาง 50 × 50 × 120", "Cosmetics 50 × 50 × 120"),
    values: { length: 50, width: 50, height: 120 },
  },
  {
    id: "supplement",
    label: t("อาหารเสริม 70 × 40 × 150", "Supplements 70 × 40 × 150"),
    values: { length: 70, width: 40, height: 150 },
  },
  {
    id: "snack",
    label: t("ขนม 120 × 60 × 180", "Snacks 120 × 60 × 180"),
    values: { length: 120, width: 60, height: 180 },
  },
];

export const CARTON_MATERIALS: MaterialSpec["kind"][] = ["paperboard", "corrugated"];

/** Window rules plus the style's own. */
export const cartonCheck =
  (own?: (v: ParamValues, m: MaterialSpec, built: Dieline) => ReturnType<typeof windowIssues>) =>
  (v: ParamValues, m: MaterialSpec, built: Dieline) => [...(own ? own(v, m, built) : []), ...windowIssues(v, built)];
