import { EURO_SLOT_HEIGHT_MM, EURO_SLOT_WIDTH_MM, HANG_HOLE_DIAMETER_MM } from "../../constants";
import { face } from "../../faces";
import { num, str } from "../../params";
import { arc, ellipse, line, rectangle, roundedRectangle } from "../../path";
import { t, windowHole, windowIssues } from "../../styles/_shared";
import type { Contour, Face } from "../../types";
import type { FeatureModule, TrayExtras, TrayWall } from "../types";

/** A window cut in one panel (`windowPanel`), kept 6 mm inside it; film patched on by the factory. */
export const windowFeature: FeatureModule = {
  id: "window",
  slot: "feature",
  status: "implemented",
  fits: ["tube", "special"],
  label: t("หน้าต่าง", "Window"),
  params: ["window", "windowPanel", "windowWidth", "windowHeight", "windowOffsetX", "windowOffsetY", "windowRadius"],
  processes: ["window_patching"],
  contributes: { kinds: [], roles: ["cut"] },
  tubeHoles: (ctx, _cfg, p) => windowHole(ctx.v, p.id, p.x0, p.x1, p.y0, p.y1),
  check: (ctx, _cfg, built) => windowIssues(ctx.v, built),
};

/** A half-round notch in the panel the tuck slides into (`end`), when `thumbNotch` is on. Drawn by the tuck. */
export const thumbNotch: FeatureModule = {
  id: "thumbNotch",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("รอยเว้านิ้วโป้ง", "Thumb notch"),
  params: ["thumbNotch"],
  processes: ["die_cut"],
  contributes: { kinds: [], roles: ["cut"] },
};

/** A hang hole centred on (cx, cy): `euro` slot, `round` hole or `sombrero` header; none for `none`. */
export function hangHoleShape(kind: string, cx: number, cy: number): Contour[] {
  switch (kind) {
    case "euro":
      return [
        roundedRectangle(
          cx - EURO_SLOT_WIDTH_MM / 2,
          cy - EURO_SLOT_HEIGHT_MM / 2,
          EURO_SLOT_WIDTH_MM,
          EURO_SLOT_HEIGHT_MM,
          EURO_SLOT_HEIGHT_MM / 2,
        ),
      ];
    case "round":
      return [ellipse(cx, cy, HANG_HOLE_DIAMETER_MM / 2, HANG_HOLE_DIAMETER_MM / 2)];
    case "sombrero":
      return [sombreroHole(cx, cy)];
    default:
      return [];
  }
}

/** A top edge from (x0, y + r) to (x1, y + r) with rounded corners. */
function roundedTop(x0: number, x1: number, y: number, r: number) {
  const rr = roundedRectangle(x0, y, x1 - x0, 2 * r + 1, r);
  // Take the top-left arc, the top line and the top-right arc of a rounded rectangle, reordered.
  const [topLine, topRight, , , , , , topLeft] = rr;
  return r > 0.01 ? [topLeft, topLine, topRight] : [line([x0, y], [x1, y], "cut")];
}

/**
 * A sombrero (hat-shaped) hang hole centred on (cx, cy): a crown 12 mm across rising from a brim
 * slot 30 × 3 mm — it takes a peg and a hook alike. ⚠ Proportions to be confirmed by Prepress.
 */
function sombreroHole(cx: number, cy: number): Contour {
  const brim = 15;
  const crown = 6;
  const y = cy + 2;
  return [
    line([cx - brim, y], [cx - crown, y], "cut"),
    line([cx - crown, y], [cx - crown, y - 6], "cut"),
    arc([cx - crown, y - 6], [cx + crown, y - 6], [cx, y - 6], true, "cut"),
    line([cx + crown, y - 6], [cx + crown, y], "cut"),
    line([cx + crown, y], [cx + brim, y], "cut"),
    line([cx + brim, y], [cx + brim, y + 3], "cut"),
    line([cx + brim, y + 3], [cx - brim, y + 3], "cut"),
    line([cx - brim, y + 3], [cx - brim, y], "cut"),
  ];
}

/**
 * A hang tab standing up from the back panel at `end`, with a euro slot, a round hole or a
 * sombrero header hole (`hangHole`). The crease at its foot lets it fold flat for shipping; on the
 * shelf it stands in line with the back. With `optional` in its settings, `hangHole` = `none`
 * leaves the tab off altogether (the master file's `hang` = `none`, U3.4).
 */
export const hangTab: FeatureModule = {
  id: "hangTab",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("หูแขวน", "Hang tab"),
  params: ["hangerHeight", "hangHole"],
  processes: ["die_cut"],
  contributes: { kinds: ["hanger"], roles: ["cut", "crease"] },
  constraints: [
    {
      id: "hangTab.euro_width",
      code: "hanger.too_narrow",
      severity: "error",
      param: "hangHole",
      require: "not ((hangHole == 'euro' or hangHole == 'sombrero') and front < C.EURO_SLOT_WIDTH_MM + 12)",
      message: t(
        "กล่องแคบเกินกว่าจะเจาะรูยูโร เลือกรูกลมแทน",
        "The box is too narrow for a euro slot — choose a round hole",
      ),
    },
  ],
  wrapClosure: (ctx, cfg, _end, inner) => (c) => {
    const base = inner(c);
    if (cfg.optional === true && str(ctx.v, "hangHole", "none") === "none") return base;
    const back = c.panels[2];
    const h = num(ctx.v, "hangerHeight", Math.max(25, Math.min(45, ctx.dims.side)));
    const cx = (back.x0 + back.x1) / 2;
    const cy = -h * 0.55;
    const kind = str(ctx.v, "hangHole", "euro");
    const holes = kind === "sombrero" ? [sombreroHole(cx, -h * 0.4)] : hangHoleShape(kind, cx, cy);
    const r = Math.min(6, h / 3, (back.x1 - back.x0) / 4);
    const hanger = face(
      `hanger-${c.end}`,
      "hanger",
      "hanger",
      [
        line([back.x0, 0], [back.x0, -h + r], "cut"),
        ...roundedTop(back.x0, back.x1, -h, r),
        line([back.x1, -h + r], [back.x1, 0], "cut"),
        line([back.x1, 0], [back.x0, 0], "crease"),
      ],
      { holes },
    );
    return { ...base, attachments: [...base.attachments, { face: hanger, span: [back.x0, back.x1] }] };
  },
  hinges: (_ctx, cfg) => ({ angles: { [`hanger-${cfg.end as string}`]: 0 } }),
};

/** Hand hole in each end panel: a stadium 90 × 30 mm (narrower on small boxes), 30 mm below the top crease. ⚠ */
const HAND_HOLE = { width: 90, height: 30, fromTop: 30, margin: 20 };

/** Hand holes in the end panels (`handles` = side). */
export const handHoles: FeatureModule = {
  id: "handHoles",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("ช่องมือจับ", "Hand holes"),
  params: ["handles"],
  processes: ["die_cut"],
  contributes: { kinds: [], roles: ["cut"] },
  constraints: [
    {
      id: "handHoles.size",
      code: "handle.too_small",
      severity: "error",
      param: "handles",
      require: "not (handles == 'side' and (width < 60 + 2 * 20 or height < 80))",
      message: t("กล่องเล็กเกินกว่าจะเจาะช่องมือจับ", "The box is too small for hand holes"),
    },
  ],
  tubeHoles(ctx, _cfg, panel) {
    if (str(ctx.v, "handles", "none") !== "side" || (panel.id !== "right" && panel.id !== "left")) return [];
    const w = Math.min(HAND_HOLE.width, panel.x1 - panel.x0 - 2 * HAND_HOLE.margin);
    const cx = (panel.x0 + panel.x1) / 2;
    const y = panel.y0 + HAND_HOLE.fromTop;
    return [roundedRectangle(cx - w / 2, y, w, HAND_HOLE.height, HAND_HOLE.height / 2)];
  },
};

/**
 * Inner walls rolled over a tray's walls (`walls`: back | front | left | right), the caliper
 * shorter than the wall — a double wall that traps the corner flaps (no corner glue) or the
 * rolled ends of a mailer.
 */
export const rollOverWalls: FeatureModule = {
  id: "rollOverWalls",
  slot: "feature",
  status: "implemented",
  fits: ["tray"],
  label: t("ผนังพับสองชั้น", "Rolled-over double walls"),
  params: [],
  processes: ["die_cut"],
  contributes: { kinds: ["flap"], roles: ["cut", "crease"] },
  tray(ctx, cfg, f): TrayExtras {
    const { length: L, width: W, height: H } = f;
    const inner = H - ctx.m.caliperMm;
    const x0 = H;
    const x1 = H + L;
    const y1 = H + W;
    const make: Record<string, () => Face> = {
      back: () => face("inner-back", "inner_wall", "flap", rectangle(x0, -inner, L, inner, { bottom: "crease" })),
      front: () => face("inner-front", "inner_wall", "flap", rectangle(x0, y1 + H, L, inner, { top: "crease" })),
      left: () => face("inner-left", "inner_wall", "flap", rectangle(-inner, H, inner, W, { right: "crease" })),
      right: () => face("inner-right", "inner_wall", "flap", rectangle(x1 + H, H, inner, W, { left: "crease" })),
    };
    const out: TrayExtras = {};
    for (const w of cfg.walls as string[]) out[`wall-${w}` as TrayWall] = [make[w]()];
    return out;
  },
  hinges: (_ctx, cfg) => ({ angles: Object.fromEntries((cfg.walls as string[]).map((w) => [`inner-${w}`, 180])) }),
};

/** A punched string hole near the top of a flat tag (legacy `dim`: 3 or 6 mm, `hole`; `holeOffset` from the top). */
export const hangHole: FeatureModule = {
  id: "hangHole",
  slot: "feature",
  status: "implemented",
  fits: ["flat"],
  label: t("รูร้อยเชือก", "String hole"),
  params: ["hole", "holeOffset"],
  processes: ["die_cut"],
  contributes: { kinds: [], roles: ["cut"] },
  constraints: [
    {
      id: "hangHole.edge",
      code: "hole.too_close",
      severity: "error",
      param: "holeOffset",
      require: "not (number(hole) > 0 and (holeOffset ?? max(8, number(hole) * 1.5)) - number(hole) / 2 < 3)",
      message: t("รูใกล้ขอบเกินไป (ต้องห่างอย่างน้อย 3 มม.)", "The hole is too close to the edge (at least 3 mm)"),
    },
  ],
  flatHoles(ctx) {
    const d = Number(str(ctx.v, "hole", "6"));
    if (!(d > 0)) return [];
    const w = num(ctx.v, "width", 40);
    const cy = num(ctx.v, "holeOffset", Math.max(8, d * 1.5));
    return [ellipse(w / 2, cy, d / 2, d / 2)];
  },
};
