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
import { buildTube } from "../construct/tube";
import { assemble, piece } from "../faces";
import { bool, issue, num, str } from "../params";
import type { MaterialSpec, ParamSchema, ParamValues } from "../types";
import {
  defineStyle,
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

function makeTuckEnd(v: ParamValues, m: MaterialSpec, reverse: boolean) {
  const d = tubeDims(v, m);
  const L = num(v, "length", 70);
  const W = num(v, "width", 40);
  const tuckDepth = num(v, "tuckDepth", tuckDepthFor(L));
  const tuckRadius =
    str(v, "tuckCorners", "rounded") === "rounded" ? Math.min(TUCK_CORNER_RADIUS_MM, tuckDepth / 2) : 0;
  const dustReach = num(v, "dustFlapDepth", Math.min(L * DUST_FLAP_LENGTH_SHARE, W * DUST_FLAP_WIDTH_SHARE));
  const closure = (lidPanel: number) =>
    tuckClosure({
      lidPanel,
      lidDepth: d.side,
      tuckDepth,
      tuckRadius,
      dustPanels: [1, 3],
      dustReach,
      caliper: m.caliperMm,
      thumbNotch: bool(v, "thumbNotch", false) ? THUMB_NOTCH_RADIUS_MM : 0,
    });
  const faces = buildTube({
    panels: [
      { id: "front", label: "front", width: d.front },
      { id: "right", label: "right", width: d.side },
      { id: "back", label: "back", width: d.front },
      { id: "left", label: "left", width: d.closingSide },
    ],
    depth: d.depth,
    glue: d.glue,
    glueRight: str(v, "glueSide", "left") === "right",
    top: closure(2),
    // Straight tuck: both lids hinge on the back. Reverse tuck: the bottom lid hinges on the front.
    bottom: tuckClosure({
      lidPanel: reverse ? 0 : 2,
      lidDepth: d.side,
      tuckDepth,
      tuckRadius,
      dustPanels: [1, 3],
      dustReach,
      caliper: m.caliperMm,
    }),
    holes: (p) => windowHole(v, p.id, p.x0, p.x1, p.y0, p.y1),
  });
  return assemble(reverse ? "reverse-tuck-end" : "tuck-end", [
    piece("blank", "blank", faces, grainOn(v, faces, "front")),
  ]);
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

const shared = {
  category: "folding_carton" as const,
  materials: ["paperboard", "corrugated"] as MaterialSpec["kind"][],
  params: [
    ...sizeParams({ length: [20, 400], width: [15, 300], height: [20, 450] }),
    ...tuckParams,
    glueWidthParam,
    glueSideParam,
    grainParam,
    ...windowParams(CARTON_PANELS),
  ],
  defaults: {
    length: 70,
    width: 40,
    height: 150,
    tuckCorners: "rounded",
    glueSide: "left",
    thumbNotch: false,
    grain: "across",
    windowPanel: "front",
    ...WINDOW_DEFAULTS,
  },
  presets: [
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
  ],
  faces3d: { roots: { blank: "front" } },
  check: (v: ParamValues, m: MaterialSpec, built: ReturnType<typeof makeTuckEnd>) => [
    ...tuckChecks(v, m),
    ...windowIssues(v, built),
  ],
};

export const tuckEnd = defineStyle({
  ...shared,
  id: "tuck-end",
  name: t("กล่องฝาเสียบ (บน-ล่างทางเดียวกัน)", "Straight tuck end"),
  description: t(
    "กล่องกระดาษแข็งสำหรับสินค้าขายปลีก ลิ้นเสียบบนและล่างพับจากด้านหลังเหมือนกัน",
    "Retail carton whose top and bottom tucks both hinge from the back panel",
  ),
  make: (v, m) => makeTuckEnd(v, m, false),
  legacy: { patternKeys: ["pid:1", "mapping:1", "folding-truck-end-box", "ste"] },
});

export const reverseTuckEnd = defineStyle({
  ...shared,
  id: "reverse-tuck-end",
  name: t("กล่องฝาเสียบสลับ (บน-ล่างสลับด้าน)", "Reverse tuck end"),
  description: t(
    "ลิ้นเสียบบนพับจากด้านหลัง ลิ้นเสียบล่างพับจากด้านหน้า ใช้กระดาษคุ้มกว่าในงานพิมพ์จำนวนมาก",
    "Top tuck hinges from the back, bottom tuck from the front — nests tighter on the press sheet",
  ),
  make: (v, m) => makeTuckEnd(v, m, true),
  legacy: { patternKeys: ["rte"] },
});
