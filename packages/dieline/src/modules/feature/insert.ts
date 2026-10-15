import { assemble, face, piece } from "../../faces";
import { bool, issue, num, str } from "../../params";
import { arc, ellipse, line, mapEdge, polygon, rectangle, roundedRectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Contour, Face, ParamValues, Pt } from "../../types";
import type { BodyModule, BuildContext, FeatureModule, ModuleConfig } from "../types";

/**
 * A die-cut platform insert: a platform with a cavity for the product, standing on two legs that
 * fold down at its ends, cut as a separate piece and dropped into the box (`insert` = `die_cut`).
 * It clears the inside by `INSERT_CLEARANCE_MM` + t each way; the legs are a third of the inside
 * height (10 mm at least); the cavity is 60 % of the platform each way, rounded 5 mm.
 * ⚠ Cavity size and leg height are placeholders until Prepress sizes the product — U3.4.
 */
export const INSERT_CLEARANCE_MM = 1.5;

export interface InsertSize {
  length: number;
  width: number;
  legs: number;
}

export function insertSize(ctx: BuildContext, floor: number, inset = 0): InsertSize {
  const c = INSERT_CLEARANCE_MM + ctx.m.caliperMm + inset;
  const H = num(ctx.v, "height", 60);
  return {
    length: num(ctx.v, "length", 100) - 2 * c,
    width: num(ctx.v, "width", 60) - 2 * c,
    legs: Math.max(10, Math.min(H / 3, H - floor - 2 * ctx.m.caliperMm - 1)),
  };
}

/** Board kept between two cavities, and between a cavity and the platform's edge (mm). ⚠ Prepress to confirm. */
export const CAVITY_MARGIN_MM = 4;

/**
 * The product a cavity insert holds (`cavityShape`, U3.4 follow-up): `default` is the placeholder
 * cavity (60 % of the platform); `rect`, `circle` (a jar, a cup) and `bottle` (a bottle lying down,
 * its neck to the right) are cut to the product's footprint — `cavityLength` × `cavityWidth` (a
 * circle's diameter is `cavityLength`; a bottle's length and body diameter) — once per cell of
 * `cavityGrid` (rows × columns), each centred in its cell, turned across it when it fits only that way.
 */
export interface Cavities {
  shape: "default" | "rect" | "circle" | "bottle";
  rows: number;
  cols: number;
  length: number;
  width: number;
}

export function cavitiesOf(v: ParamValues): Cavities {
  const [rows, cols] = str(v, "cavityGrid", "1x1").split("x").map(Number);
  const shape = str(v, "cavityShape", "default") as Cavities["shape"];
  return {
    shape,
    rows: rows || 1,
    cols: cols || 1,
    length: num(v, "cavityLength", 60),
    width: shape === "circle" ? num(v, "cavityLength", 60) : num(v, "cavityWidth", 40),
  };
}

/** A bottle lying along x, centred at (cx, cy): body, a shoulder over a fifth of its length, a neck a third as wide. */
function bottleOutline(cx: number, cy: number, length: number, diameter: number): Contour {
  const neck = Math.max(6, diameter / 3);
  const neckLength = length * 0.25;
  const shoulder = length * 0.15;
  const r = Math.min(diameter / 4, 8);
  const x0 = cx - length / 2;
  const xb = cx + length / 2 - neckLength - shoulder;
  const xn = xb + shoulder;
  const x1 = cx + length / 2;
  const [top, bottom] = [cy - diameter / 2, cy + diameter / 2];
  const pts: Pt[] = [
    [x0 + r, top],
    [xb, top],
    [xn, cy - neck / 2],
    [x1, cy - neck / 2],
    [x1, cy + neck / 2],
    [xn, cy + neck / 2],
    [xb, bottom],
    [x0 + r, bottom],
  ];
  // The base's corners rounded: the outline closes through two quarter arcs at the left end.
  return [
    ...polygon(pts, "cut").slice(0, 7),
    arc([x0 + r, bottom], [x0, bottom - r], [x0 + r, bottom - r], true, "cut"),
    line([x0, bottom - r], [x0, top + r], "cut"),
    arc([x0, top + r], [x0 + r, top], [x0 + r, top + r], true, "cut"),
  ];
}

/** Whether a cavity lies across its cell (its length along y): when it only fits that way, or fits better. */
function across(c: Cavities, cellL: number, cellW: number): boolean {
  const m = 2 * CAVITY_MARGIN_MM;
  const along = c.length + m <= cellL + 1e-9 && c.width + m <= cellW + 1e-9;
  const turned = c.width + m <= cellL + 1e-9 && c.length + m <= cellW + 1e-9;
  return !along && turned ? true : along && turned ? cellW > cellL : false;
}

/** The cavities cut in a platform `L` × `W` whose left edge is at `x0` — none that would not fit. */
export function cavityHoles(c: Cavities, x0: number, L: number, W: number): Contour[] {
  if (c.shape === "default") {
    const cw = L * 0.6;
    const ch = W * 0.6;
    return cw >= 10 && ch >= 10 ? [roundedRectangle(x0 + (L - cw) / 2, (W - ch) / 2, cw, ch, Math.min(5, ch / 4))] : [];
  }
  if (!cavitiesFit(c, L, W)) return [];
  const cellL = L / c.cols;
  const cellW = W / c.rows;
  const turn = c.shape !== "circle" && across(c, cellL, cellW);
  const out: Contour[] = [];
  for (let i = 0; i < c.rows; i++)
    for (let j = 0; j < c.cols; j++) {
      const cx = x0 + cellL * (j + 0.5);
      const cy = cellW * (i + 0.5);
      let hole: Contour;
      if (c.shape === "circle") hole = ellipse(cx, cy, c.length / 2, c.length / 2);
      else if (c.shape === "bottle") hole = bottleOutline(cx, cy, c.length, c.width);
      else hole = roundedRectangle(cx - c.length / 2, cy - c.width / 2, c.length, c.width, Math.min(3, c.width / 4));
      // Across the cell: mirrored about its diagonal through the centre (x ↔ y), neck up.
      out.push(turn ? hole.map((e) => mapEdge(e, (p) => [cx + (p[1] - cy), cy + (p[0] - cx)], true)) : hole);
    }
  return out;
}

/** Each cavity fits its cell, along it or across it, with `CAVITY_MARGIN_MM` of board round it. */
export function cavitiesFit(c: Cavities, L: number, W: number): boolean {
  if (c.shape === "default") return true;
  if (!(c.length > 0 && c.width > 0)) return false;
  const [cellL, cellW] = [L / c.cols, W / c.rows];
  const m = 2 * CAVITY_MARGIN_MM;
  return (
    (c.length + m <= cellL + 1e-9 && c.width + m <= cellW + 1e-9) ||
    (c.width + m <= cellL + 1e-9 && c.length + m <= cellW + 1e-9)
  );
}

/** The insert's faces: legs at x ∈ [0, legs] and beyond the platform, platform in between. */
export function insertFaces(s: InsertSize, prefix: string, thumb = false, cavities?: Cavities): Face[] {
  const { length: L, width: W, legs: h } = s;
  const x0 = h;
  const x1 = h + L;
  const holes = cavityHoles(cavities ?? { shape: "default", rows: 1, cols: 1, length: 0, width: 0 }, x0, L, W);
  // A finger notch on each long edge of the platform, to lift it out.
  const r = Math.min(10, L / 6, W / 6);
  const platform: Contour = thumb
    ? [
        line([x0, 0], [x0 + L / 2 - r, 0], "cut"),
        arc([x0 + L / 2 - r, 0], [x0 + L / 2 + r, 0], [x0 + L / 2, 0], false, "cut"),
        line([x0 + L / 2 + r, 0], [x1, 0], "cut"),
        line([x1, 0], [x1, W], "crease"),
        line([x1, W], [x0 + L / 2 + r, W], "cut"),
        arc([x0 + L / 2 + r, W], [x0 + L / 2 - r, W], [x0 + L / 2, W], false, "cut"),
        line([x0 + L / 2 - r, W], [x0, W], "cut"),
        line([x0, W], [x0, 0], "crease"),
      ]
    : rectangle(x0, 0, L, W, { left: "crease", right: "crease" });
  return [
    face(`${prefix}platform`, "platform", "panel", platform, { holes }),
    face(`${prefix}leg-left`, "insert_leg", "flap", rectangle(0, 0, h, W, { right: "crease" })),
    face(`${prefix}leg-right`, "insert_leg", "flap", rectangle(x1, 0, h, W, { left: "crease" })),
  ];
}

const floorOf = (ctx: BuildContext, cfg: ModuleConfig) => ctx.num((cfg.floor ?? "2 * t") as string);
const on = (ctx: BuildContext) => str(ctx.v, "insert", "none") === "die_cut";

export const dieCutInsert: FeatureModule = {
  id: "dieCutInsert",
  slot: "feature",
  status: "implemented",
  fits: ["tube", "tray", "special"],
  label: t("ตัวรองไดคัท (ชิ้นแยก)", "Die-cut insert (separate piece)"),
  params: ["insert", "cavityShape", "cavityGrid", "cavityLength", "cavityWidth"],
  processes: ["die_cut", "hand_assembly"],
  contributes: { kinds: ["panel", "flap"], roles: ["cut", "crease"] },
  constraints: [
    {
      id: "dieCutInsert.size",
      code: "insert.too_small",
      severity: "error",
      param: "insert",
      require: "not (insert == 'die_cut' and (length < 40 or width < 30 or height < 25))",
      message: t("กล่องเล็กเกินกว่าจะใส่ตัวรอง", "The box is too small for an insert"),
    },
  ],
  pieces: (ctx, cfg) =>
    on(ctx)
      ? [
          piece(
            "insert",
            "insert",
            insertFaces(
              insertSize(ctx, floorOf(ctx, cfg), ctx.num((cfg.inset ?? 0) as string)),
              "insert-",
              false,
              cavitiesOf(ctx.v),
            ),
          ),
        ]
      : [],
  check(ctx, cfg) {
    if (!on(ctx)) return [];
    const s = insertSize(ctx, floorOf(ctx, cfg), ctx.num((cfg.inset ?? 0) as string));
    return cavitiesFit(cavitiesOf(ctx.v), s.length, s.width)
      ? []
      : [
          issue(
            "insert.cavity_too_big",
            t(
              `สินค้าใหญ่เกินช่องของตัวรอง (เผื่อขอบ ${CAVITY_MARGIN_MM} มม. รอบช่อง) ลดจำนวนช่องหรือขยายกล่อง`,
              `The product is larger than its cell of the insert (${CAVITY_MARGIN_MM} mm of board round each cavity) — fewer cells or a larger box`,
            ),
            "cavityLength",
          ),
        ];
  },
  hinges: (ctx, cfg) =>
    on(ctx)
      ? {
          roots: { insert: "insert-platform" },
          angles: { "insert-leg-left": -90, "insert-leg-right": -90 },
          placement: {
            insert: {
              inside: (cfg.target as string) ?? "blank",
              floor: floorOf(ctx, cfg),
              lift: num(ctx.v, "height", 60),
              // `rotate`: true stands it up (a tube's insert); an angle triple turns it with its tray.
              ...(Array.isArray(cfg.rotate)
                ? { rotate: cfg.rotate as [number, number, number] }
                : cfg.rotate
                  ? { rotate: [90, 0, 0] as [number, number, number] }
                  : {}),
            },
          },
        }
      : {},
};

/**
 * A die-cut cavity insert on its own (PK-IN-01), sized to its outside: platform and legs come in
 * by one caliper so the folded insert is `length` × `width` × `height`. `fingerHole` (the master
 * `thumb` axis) adds a finger notch on each long edge of the platform.
 */
export const insertBody: BodyModule = {
  id: "insertBody",
  slot: "body",
  kind: "special",
  status: "implemented",
  folds: true,
  label: t("ตัวรองไดคัท (แผ่นรอง + ขา)", "Die-cut insert (platform and legs)"),
  params: ["fingerHole", "grain", "cavityShape", "cavityGrid", "cavityLength", "cavityWidth"],
  processes: ["die_cut"],
  contributes: { kinds: ["panel", "flap"], roles: ["cut", "crease"] },
  build(ctx) {
    const { v, m } = ctx;
    const faces = insertFaces(
      {
        length: num(v, "length", 150) - 2 * m.caliperMm,
        width: num(v, "width", 100),
        legs: num(v, "height", 30) - m.caliperMm,
      },
      "",
      bool(v, "fingerHole", false),
      cavitiesOf(v),
    );
    return assemble(ctx.styleId, [piece("blank", "insert", faces)]);
  },
  hinges: () => ({ roots: { blank: "platform" }, angles: { "leg-left": -90, "leg-right": -90 } }),
};
