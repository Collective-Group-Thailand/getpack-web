import { GLUE_AREA_INSET_MM } from "../../constants";
import { issue, num, str } from "../../params";
import {
  arc,
  boundsOf,
  ellipse,
  flattenContour,
  line,
  mapEdge,
  polygon,
  rectangle,
  roundedRectangle,
} from "../../path";
import { flatDieline } from "../../styles/_flat";
import { t } from "../../styles/_shared";
import { parseSvgPath } from "../../svgpath";
import type { Contour, Edge, ParamValues, Pt } from "../../types";
import type { BodyModule, BuildContext, Parts } from "../types";

/*
 * Flat pieces — labels, stickers, tags, bands, cup sleeves: one face cut all round, no folding,
 * no 3D (D-152: 2D mockups).
 */

/** A 40 mm rounded star, the default custom shape — any closed SVG path works. */
export const SAMPLE_PATH = "M20 0 L25 14 L40 15 L28 24 L32 40 L20 31 L8 40 L12 24 L0 15 L15 14 Z";

function customOutline(path: string, size: number): Contour | null {
  let contours: Contour[];
  try {
    contours = parseSvgPath(path);
  } catch {
    return null;
  }
  if (contours.length === 0) return null;
  // The largest subpath is the outline; smaller ones would be holes, which a sticker die rarely has.
  const measured = contours.map((c) => ({ c, b: boundsOf(flattenContour(c, 0.5)) }));
  measured.sort((p, q) => q.b.width * q.b.height - p.b.width * p.b.height);
  const { c, b } = measured[0];
  const longest = Math.max(b.width, b.height);
  if (!(longest > 0)) return null;
  const k = size / longest;
  return c.map((e) => mapEdge(e, (p) => [(p[0] - b.x) * k, (p[1] - b.y) * k]));
}

/**
 * Hang tag outline — legacy "Tag ตัดมุม" (corners cut at 45°) and "Tag มุมมน" (rounded corners);
 * `cornerSize` is legacy `r` (5).
 */
function tagOutline(v: ParamValues): Contour {
  const w = num(v, "width", 40);
  const h = num(v, "length", 60);
  const r = Math.min(num(v, "cornerSize", 5), w / 3, h / 3);
  const corners = str(v, "corners", "chamfer");
  if (corners === "rounded") return roundedRectangle(0, 0, w, h, r);
  if (corners === "square" || r <= 0)
    return polygon([
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ]);
  // Chamfer the two top corners.
  return [
    line([r, 0], [w - r, 0]),
    line([w - r, 0], [w, r]),
    line([w, r], [w, h]),
    line([w, h], [0, h]),
    line([0, h], [0, r]),
    line([0, r], [r, 0]),
  ];
}

type Shape = "rectangle" | "rounded_rectangle" | "circle" | "oval" | "custom_path" | "tag";

function outlineOf(shape: Shape, v: ParamValues): Contour {
  switch (shape) {
    case "rectangle":
      return rectangle(0, 0, num(v, "length", 100), num(v, "width", 60));
    case "rounded_rectangle":
      return roundedRectangle(0, 0, num(v, "length", 100), num(v, "width", 60), num(v, "cornerRadius", 6));
    case "circle": {
      const r = num(v, "diameter", 50) / 2;
      return ellipse(r, r, r, r);
    }
    case "oval": {
      const rx = num(v, "length", 80) / 2;
      const ry = num(v, "width", 50) / 2;
      return ellipse(rx, ry, rx, ry);
    }
    case "custom_path":
      return (
        customOutline(str(v, "path", SAMPLE_PATH), num(v, "size", 60)) ??
        rectangle(0, 0, num(v, "size", 60), num(v, "size", 60))
      );
    case "tag":
      return tagOutline(v);
  }
}

const holesOf = (ctx: BuildContext, parts: Parts) =>
  parts.features.flatMap((f) => (f.def.slot === "feature" ? (f.def.flatHoles?.(ctx, f.cfg) ?? []) : []));

/** A flat shape: rectangle, rounded rectangle, circle, oval, a custom SVG outline, or a hang tag. */
export const flatShape: BodyModule = {
  id: "flatShape",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t(
    "ชิ้นงานแบน (สี่เหลี่ยม มุมมน วงกลม วงรี รูปอิสระ ป้าย)",
    "Flat shape (rectangle, rounded, circle, oval, custom, tag)",
  ),
  params: ["length", "width", "cornerRadius", "diameter", "size", "path", "corners", "cornerSize"],
  processes: ["die_cut"],
  contributes: { kinds: ["flat"], roles: ["cut"] },
  constraints: (cfg) =>
    cfg.shape === "rounded_rectangle"
      ? [
          {
            id: "flatShape.corner_radius",
            code: "corner.too_large",
            severity: "warning",
            param: "cornerRadius",
            require: "cornerRadius <= min(length, width) / 2",
            message: t(
              "รัศมีมุมเกินครึ่งหนึ่งของด้านที่สั้นกว่า",
              "The corner radius is more than half the shorter side",
            ),
          },
        ]
      : [],
  check: (ctx, cfg) =>
    cfg.shape === "custom_path" && !customOutline(str(ctx.v, "path", SAMPLE_PATH), num(ctx.v, "size", 60))
      ? [issue("path.invalid", t("อ่านเส้นรอบรูปจาก SVG ไม่ได้", "The SVG outline could not be read"), "path")]
      : [],
  build(ctx, cfg, parts) {
    const shape = cfg.shape as Shape;
    const holes = holesOf(ctx, parts);
    const outline = outlineOf(shape, ctx.v);
    const marks = parts.features.flatMap((f) =>
      f.def.slot === "feature" ? (f.def.flatMarks?.(ctx, f.cfg, outline) ?? []) : [],
    );
    return flatDieline(ctx.styleId, outline, shape === "tag" ? "tag" : "label", {
      ...(holes.length ? { holes } : {}),
      ...(marks.length ? { marks } : {}),
    });
  },
};

/** A paper band (legacy "สายคาด", strap): a strip wrapped round a product, glued on its overlap. */
export const band: BodyModule = {
  id: "band",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("สายคาด (แถบทับกาวที่ปลาย)", "Band glued on its overlap"),
  params: ["length", "width", "overlap", "lock"],
  processes: ["die_cut"],
  contributes: { kinds: ["flat"], roles: ["cut", "glue_area"] },
  build(ctx) {
    const { v } = ctx;
    const l = num(v, "length", 400);
    const w = num(v, "width", 50);
    const o = num(v, "overlap", 15);
    if (str(v, "lock", "friction") === "slit") {
      // Slit lock (PK-SL-03): a slit from one edge at each end, halfway across, that hook into
      // each other — no glue. 1 mm wide. ⚠ To be confirmed by Prepress.
      const a = o / 2 - 0.5;
      const b = l - o / 2 - 0.5;
      return flatDieline(
        ctx.styleId,
        polygon([
          [0, 0],
          [a, 0],
          [a, w / 2],
          [a + 1, w / 2],
          [a + 1, 0],
          [l, 0],
          [l, w],
          [b + 1, w],
          [b + 1, w / 2],
          [b, w / 2],
          [b, w],
          [0, w],
        ]),
        "band",
      );
    }
    const i = Math.min(GLUE_AREA_INSET_MM, o / 4, w / 4);
    return flatDieline(ctx.styleId, rectangle(0, 0, l, w), "band", {
      marks: polygon(
        [
          [l - o + i, i],
          [l - i, i],
          [l - i, w - i],
          [l - o + i, w - i],
        ],
        "glue_area",
      ),
    });
  },
};

/**
 * A band round a cone frustum — legacy "ปลอกแก้ว" (cup sleeve). A frustum unrolls into an annular
 * sector: slant s = √(h² + ((D − d)/2)²), inner radius s·d/(D − d), outer s·D/(D − d), and the
 * sector's outer arc is the top circumference π·D plus the glue overlap. A straight cup (D = d)
 * unrolls into a rectangle.
 */
export const cone: BodyModule = {
  id: "cone",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("ปลอกทรงกรวย (คลี่เป็นส่วนโค้ง)", "Cone frustum band (unrolled sector)"),
  params: ["topDiameter", "bottomDiameter", "height", "overlap"],
  processes: ["die_cut"],
  contributes: { kinds: ["flat"], roles: ["cut", "glue_area"] },
  constraints: [
    {
      id: "cone.inverted",
      code: "sleeve.inverted",
      severity: "error",
      param: "bottomDiameter",
      require: "bottomDiameter <= topDiameter",
      message: t("ก้นแก้วใหญ่กว่าปากแก้ว สลับค่ากัน", "The base is wider than the rim — swap them"),
    },
  ],
  build(ctx) {
    const { v } = ctx;
    const D = num(v, "topDiameter", 90);
    const d = num(v, "bottomDiameter", 60);
    const h = num(v, "height", 70);
    const overlap = num(v, "overlap", 10);
    if (D - d < 0.5) {
      const w = Math.PI * D + overlap;
      const inset = Math.min(GLUE_AREA_INSET_MM, overlap / 4);
      return flatDieline(ctx.styleId, rectangle(0, 0, w, h), "band", {
        marks: polygon(
          [
            [w - overlap + inset, inset],
            [w - inset, inset],
            [w - inset, h - inset],
            [w - overlap + inset, h - inset],
          ],
          "glue_area",
        ),
      });
    }
    const s = Math.sqrt(h * h + ((D - d) / 2) ** 2);
    const inner = (s * d) / (D - d);
    const outer = inner + s;
    const sweep = (Math.PI * D + overlap) / outer;
    // Centred on "up" (−π/2 in the y-down frame); the outer arc runs clockwise from a0 to a1.
    const a0 = -Math.PI / 2 - sweep / 2;
    const a1 = -Math.PI / 2 + sweep / 2;
    const at = (r: number, a: number): Pt => [r * Math.cos(a), r * Math.sin(a)];
    const outline: Edge[] = [
      arc(at(outer, a0), at(outer, a1), [0, 0], true),
      line(at(outer, a1), at(inner, a1)),
      arc(at(inner, a1), at(inner, a0), [0, 0], false),
      line(at(inner, a0), at(outer, a0)),
    ];
    // Glue on the overlap at the a1 end.
    const g = overlap / outer;
    const gi = GLUE_AREA_INSET_MM;
    const marks = polygon(
      [
        at(outer - gi, a1 - g),
        at(outer - gi, a1 - gi / outer),
        at(inner + gi, a1 - gi / inner),
        at(inner + gi, a1 - g),
      ],
      "glue_area",
    );
    return flatDieline(ctx.styleId, outline, "band", { marks });
  },
};
