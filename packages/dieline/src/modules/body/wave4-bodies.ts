import { GLUE_AREA_INSET_MM } from "../../constants";
import { assemble, face, piece } from "../../faces";
import { num, str } from "../../params";
import { arc, ellipse, line, polygon, rectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Edge, Pt } from "../../types";
import type { BodyModule } from "../types";

/*
 * Bodies the market survey of 2026-10-15 adds (D-409): a tent card, a folded leaflet, a paper cup
 * or bowl blank and a corrugated U-liner. ⚠ Every allowance here is to be confirmed by Prepress.
 */

/**
 * A table tent (PK-DS-05): two printed faces `length` wide leaning together to an apex `height`
 * above a base `width` deep, the back face's glue tab fixed inside the front at the apex.
 */
export const tentCard: BodyModule = {
  id: "tentCard",
  slot: "body",
  kind: "special",
  status: "implemented",
  folds: true,
  label: t("ป้ายตั้งโต๊ะทรงสามเหลี่ยม", "Table tent card"),
  params: ["length", "width", "height"],
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["panel", "base", "glue_flap"], roles: ["cut", "crease", "glue_area"] },
  build(ctx) {
    const { v } = ctx;
    const L = num(v, "length", 150);
    const D = num(v, "width", 60);
    const H = num(v, "height", 100);
    const s = Math.hypot(H, D / 2);
    const g = Math.min(15, s / 4);
    const inset = Math.min(g * 0.4, L / 6);
    const faces = [
      face("face-front", "front", "panel", rectangle(0, -s, L, s, { bottom: "crease" })),
      face("base", "base", "base", rectangle(0, 0, L, D, { top: "crease", bottom: "crease" })),
      face("face-back", "back", "panel", rectangle(0, D, L, s, { top: "crease", bottom: "crease" })),
      face(
        "glue-tab",
        "glue_flap",
        "glue_flap",
        polygon(
          [
            [L, D + s],
            [0, D + s],
            [inset, D + s + g],
            [L - inset, D + s + g],
          ],
          ["crease", "cut", "cut", "cut"],
        ),
        {
          marks: polygon(
            [
              [inset + 1, D + s + 1],
              [L - inset - 1, D + s + 1],
              [L - inset - 1, D + s + g - 1],
              [inset + 1, D + s + g - 1],
            ],
            "glue_area",
          ),
        },
      ),
    ];
    return assemble(ctx.styleId, [piece("blank", "blank", faces)]);
  },
  hinges(ctx) {
    const D = num(ctx.v, "width", 60);
    const H = num(ctx.v, "height", 100);
    // The faces lean in from the base by β; they meet at the apex at α.
    const beta = (Math.atan2(H, D / 2) * 180) / Math.PI;
    const alpha = 180 - 2 * beta;
    return {
      roots: { blank: "base" },
      upright: "base",
      angles: { "face-front": 180 - beta, "face-back": 180 - beta, "glue-tab": 180 - alpha },
      stages: { "glue-tab": 0, "face-back": 1, "face-front": 2 },
    };
  },
};

/** The panel widths of a folded leaflet `length` wide when folded (`foldScheme`). */
export function leafletPanels(scheme: string, L: number): number[] {
  switch (scheme) {
    case "tri_fold":
      // The panel folded in is 2 mm narrower, so it clears the fold it tucks behind.
      return [L, L, L - 2];
    case "z_fold":
      return [L, L, L];
    case "gate_fold":
      return [L / 2 - 1, L, L / 2 - 1];
    default:
      return [L, L];
  }
}

/**
 * A folded leaflet or package insert (PK-TG-06): one sheet `height` tall, panels side by side as
 * its fold scheme sets them (`foldScheme`: bi, tri (roll), Z or gate fold), creased between. Folded
 * by the printer and delivered flat; it is not modelled folded.
 */
export const leaflet: BodyModule = {
  id: "leaflet",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("ใบแทรกพับ", "Folded leaflet"),
  params: ["length", "height", "foldScheme"],
  processes: ["die_cut"],
  contributes: { kinds: ["panel"], roles: ["cut", "crease"] },
  build(ctx) {
    const H = num(ctx.v, "height", 210);
    const widths = leafletPanels(str(ctx.v, "foldScheme", "bi_fold"), num(ctx.v, "length", 100));
    let x = 0;
    const last = widths.length - 1;
    const faces = widths.map((w, i) => {
      const f = face(
        `panel-${i + 1}`,
        "panel",
        "panel",
        rectangle(x, 0, w, H, { left: i > 0 ? "crease" : "cut", right: i < last ? "crease" : "cut" }),
      );
      x += w;
      return f;
    });
    return assemble(ctx.styleId, [piece("blank", "blank", faces)]);
  },
};

/**
 * A paper cup or bowl blank (PK-SP-23, PK-SP-24): the wall — a cone frustum unrolled into an
 * annular sector, rim `topDiameter`, base `bottomDiameter`, `height` tall, with a side-seam
 * `overlap` — and the bottom disc with a 6 mm skirt that the wall's foot curls round. Cut flat and
 * formed on a cup machine.
 */
export const cupBlank: BodyModule = {
  id: "cupBlank",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("แผ่นคลี่แก้ว / ชามกระดาษ", "Paper cup or bowl blank"),
  params: ["topDiameter", "bottomDiameter", "height", "overlap"],
  processes: ["die_cut"],
  contributes: { kinds: ["flat"], roles: ["cut", "glue_area"] },
  constraints: [
    {
      id: "cupBlank.taper",
      code: "sleeve.inverted",
      severity: "error",
      param: "bottomDiameter",
      require: "bottomDiameter < topDiameter - 1",
      message: t("ก้นต้องเล็กกว่าปาก", "The base must be narrower than the rim"),
    },
  ],
  build(ctx) {
    const { v } = ctx;
    const D = num(v, "topDiameter", 90);
    const d = num(v, "bottomDiameter", 60);
    const h = num(v, "height", 95);
    const overlap = num(v, "overlap", 10);
    const skirt = 6;
    // The wall reaches below the base by the skirt (the curl that holds the disc).
    const run = (D - d) / 2;
    const s = Math.hypot(h, run);
    const inner = (s * d) / (D - d);
    const outer = inner + s;
    const sweep = (Math.PI * D + overlap) / outer;
    const a0 = -Math.PI / 2 - sweep / 2;
    const a1 = -Math.PI / 2 + sweep / 2;
    const at = (r: number, a: number): Pt => [r * Math.cos(a), r * Math.sin(a)];
    const lo = Math.max(1, inner - skirt);
    const wall: Edge[] = [
      arc(at(outer, a0), at(outer, a1), [0, 0], true),
      line(at(outer, a1), at(lo, a1)),
      arc(at(lo, a1), at(lo, a0), [0, 0], false),
      line(at(lo, a0), at(outer, a0)),
    ];
    const gi = GLUE_AREA_INSET_MM;
    const g = overlap / outer;
    const marks = polygon(
      [at(outer - gi, a1 - g), at(outer - gi, a1 - gi / outer), at(lo + gi, a1 - gi / lo), at(lo + gi, a1 - g)],
      "glue_area",
    );
    // The disc beside the wall's lowest point, clear of it.
    const r = d / 2 + skirt;
    const cx = outer + r + 10;
    return assemble(ctx.styleId, [
      piece("blank", "blank", [face("wall", "band", "flat", wall, { marks })]),
      piece("bottom", "base", [face("bottom-disc", "base", "flat", ellipse(cx, 0, r, r))]),
    ]);
  },
};

/**
 * A corrugated U-liner (PK-IN-04): one pad scored twice, its sides `height` tall standing up from
 * a base `width` deep, `length` long — doubling two walls and the floor of a shipper.
 */
export const uLiner: BodyModule = {
  id: "uLiner",
  slot: "body",
  kind: "special",
  status: "implemented",
  folds: true,
  label: t("แผ่นรองลูกฟูกพับตัวยู", "Corrugated U-liner"),
  params: ["length", "width", "height"],
  processes: ["die_cut"],
  contributes: { kinds: ["base", "wall"], roles: ["cut", "crease"] },
  build(ctx) {
    const L = num(ctx.v, "length", 300);
    const W = num(ctx.v, "width", 200);
    const H = num(ctx.v, "height", 100);
    return assemble(ctx.styleId, [
      piece("blank", "blank", [
        face("wall-back", "wall_back", "wall", rectangle(0, -H, L, H, { bottom: "crease" })),
        face("base", "base", "base", rectangle(0, 0, L, W, { top: "crease", bottom: "crease" })),
        face("wall-front", "wall_front", "wall", rectangle(0, W, L, H, { top: "crease" })),
      ]),
    ]);
  },
  hinges: () => ({ roots: { blank: "base" }, upright: "base" }),
};
