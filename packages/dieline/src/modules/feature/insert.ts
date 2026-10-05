import { assemble, face, piece } from "../../faces";
import { bool, num, str } from "../../params";
import { arc, line, rectangle, roundedRectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Contour, Face } from "../../types";
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

/** The insert's faces: legs at x ∈ [0, legs] and beyond the platform, platform in between. */
export function insertFaces(s: InsertSize, prefix: string, thumb = false): Face[] {
  const { length: L, width: W, legs: h } = s;
  const x0 = h;
  const x1 = h + L;
  const cw = L * 0.6;
  const ch = W * 0.6;
  const holes: Contour[] =
    cw >= 10 && ch >= 10 ? [roundedRectangle(x0 + (L - cw) / 2, (W - ch) / 2, cw, ch, Math.min(5, ch / 4))] : [];
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
  params: ["insert"],
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
            insertFaces(insertSize(ctx, floorOf(ctx, cfg), ctx.num((cfg.inset ?? 0) as string)), "insert-"),
          ),
        ]
      : [],
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
  params: ["fingerHole", "grain"],
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
    );
    return assemble(ctx.styleId, [piece("blank", "insert", faces)]);
  },
  hinges: () => ({ roots: { blank: "platform" }, angles: { "leg-left": -90, "leg-right": -90 } }),
};
