import { assemble, face, piece } from "../../faces";
import { bool, num, str } from "../../params";
import { arc, ellipse, flattenEdge, line, mapEdge, polygon, rectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Contour, Edge, Pt } from "../../types";
import { hangHoleShape } from "../feature/features";
import type { BodyModule } from "../types";

/*
 * Bodies the style library's second wave adds (U3.4 wave 2).
 */

const mirrorAcross = (c: Contour, y: number): Contour =>
  c.map((e) => mapEdge(e, (p: Pt): Pt => [p[0], 2 * y - p[1]], true));

/**
 * Two leaves joined by one crease, folded to `angle` (degrees; 180 folds one onto the other):
 * a bag header card (PK-TG-04: `length` across × `height` per leaf, folded over the bag's top and
 * stapled, with a hang hole through both leaves `hangFromFold` mm below the fold), or a V-board edge
 * protector (PK-CI-03: legs `width` wide along `length`, folded to 90°). ⚠ Hole position to be
 * confirmed by Prepress.
 */
export const foldedCard: BodyModule = {
  id: "foldedCard",
  slot: "body",
  kind: "special",
  status: "implemented",
  folds: true,
  label: t("แผ่นพับสองทบ", "Two leaves on one crease"),
  params: ["length", "width", "height", "hangHole"],
  processes: ["die_cut"],
  contributes: { kinds: ["panel"], roles: ["cut", "crease"] },
  build(ctx, cfg) {
    const { v } = ctx;
    const across = ctx.num((cfg.across as string) ?? "length");
    const leaf = ctx.num((cfg.leaf as string) ?? "height");
    const kind = str(v, "hangHole", "none");
    const d = num(v, "hangFromFold", 14);
    const holeA = kind === "none" ? [] : hangHoleShape(kind, across / 2, leaf - d);
    const holeB = holeA.map((c) => mirrorAcross(c, leaf));
    const faces = [
      face("leaf-a", "front", "panel", rectangle(0, 0, across, leaf, { bottom: "crease" }), { holes: holeA }),
      face("leaf-b", "back", "panel", rectangle(0, leaf, across, leaf, { top: "crease" }), { holes: holeB }),
    ];
    return assemble(ctx.styleId, [piece("blank", "blank", faces)]);
  },
  hinges: (_ctx, cfg) => ({
    roots: { blank: "leaf-a" },
    angles: { "leaf-b": (cfg.angle as number | undefined) ?? 180 },
  }),
};

/** A half-round notch from `from` to `to` on a straight edge, bulging towards `towards` (y). */
function notchArc(from: Pt, to: Pt, towards: number): Edge {
  const center: Pt = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const a = arc(from, to, center, true, "cut");
  const mid = flattenEdge(a)[Math.floor(flattenEdge(a).length / 2)];
  return Math.sign(mid[1] - center[1]) === Math.sign(towards - center[1]) ? a : arc(from, to, center, false, "cut");
}

/**
 * A presentation folder (PK-SP-12): a back cover, a spine (`spine` mm, default 4) and a front cover
 * `length` × `height`; a pocket (`pocketDepth`, default a third of the height) folded up inside the
 * back cover, glued by a tab on each side folded behind it. `fingerHole` (the `thumb` axis) cuts a
 * half-round notch in the pocket's edge. ⚠ Pocket, tab and spine sizes to be confirmed by Prepress.
 */
export const presentationFolder: BodyModule = {
  id: "presentationFolder",
  slot: "body",
  kind: "special",
  status: "implemented",
  folds: true,
  label: t("แฟ้มเสนองาน (ปก + กระเป๋า)", "Presentation folder (covers and pocket)"),
  params: ["length", "height", "pocketDepth", "fingerHole"],
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["panel", "lid", "flap", "glue_flap"], roles: ["cut", "crease", "glue_area"] },
  build(ctx) {
    const { v, m } = ctx;
    const W = num(v, "length", 220);
    const H = num(v, "height", 305);
    const sp = num(v, "spine", 4) + m.caliperMm;
    const P = num(v, "pocketDepth", Math.round(H / 3));
    const g = Math.min(15, W / 10);
    const y1 = H + P;
    const r = Math.min(15, P / 4);
    const cx = W / 2;
    // The side edges are creased only where the glue tabs hang (2 mm in from each end), so they pair.
    const pocketOutline: Contour = [
      line([0, H], [W, H], "crease"),
      line([W, H], [W, H + 2], "cut"),
      line([W, H + 2], [W, y1 - 2], "crease"),
      line([W, y1 - 2], [W, y1], "cut"),
      ...(bool(v, "fingerHole", false)
        ? [
            line([W, y1], [cx + r, y1], "cut"),
            notchArc([cx + r, y1], [cx - r, y1], y1 - r),
            line([cx - r, y1], [0, y1], "cut"),
          ]
        : [line([W, y1], [0, y1], "cut")]),
      line([0, y1], [0, y1 - 2], "cut"),
      line([0, y1 - 2], [0, H + 2], "crease"),
      line([0, H + 2], [0, H], "cut"),
    ];
    const tab = (id: string, x: number, side: -1 | 1): ReturnType<typeof face> => {
      const out = x + side * g;
      const pts: Pt[] =
        side === 1
          ? [
              [x, H + 2],
              [out, H + 2 + g / 2],
              [out, y1 - 2 - g / 2],
              [x, y1 - 2],
            ]
          : [
              [x, y1 - 2],
              [out, y1 - 2 - g / 2],
              [out, H + 2 + g / 2],
              [x, H + 2],
            ];
      return face(id, "glue_flap", "glue_flap", polygon(pts, ["cut", "cut", "cut", "crease"]));
    };
    const faces = [
      face("back", "back", "panel", rectangle(0, 0, W, H, { left: "crease", bottom: "crease" })),
      face("spine", "side", "panel", rectangle(-sp, 0, sp, H, { left: "crease", right: "crease" })),
      face("front", "front", "lid", rectangle(-sp - W, 0, W, H, { right: "crease" })),
      face("pocket", "inner_flap", "flap", pocketOutline),
      tab("tab-left", 0, -1),
      tab("tab-right", W, 1),
    ];
    return assemble(ctx.styleId, [piece("blank", "blank", faces)]);
  },
  hinges: () => ({
    roots: { blank: "back" },
    angles: { pocket: 180, "tab-left": 180, "tab-right": 180 },
    stages: { "tab-left": 1, "tab-right": 1, pocket: 2, spine: 3, front: 3 },
  }),
};

/**
 * A paperboard envelope or wallet (PK-SP-13): a back `length` × `height`, side flaps folded in, a
 * bottom flap glued over them and a top flap that closes over it. `lock` = `slit` adds a tongue on
 * the top flap and a slit in the bottom flap it passes through; `friction` closes by the flap alone.
 * ⚠ Flap depths, tongue and slit to be confirmed by Prepress.
 */
export const envelope: BodyModule = {
  id: "envelope",
  slot: "body",
  kind: "special",
  status: "implemented",
  folds: true,
  label: t("ซองกระดาษแข็ง", "Paperboard envelope"),
  params: ["length", "height", "lock"],
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["panel", "flap", "lid", "dust_flap"], roles: ["cut", "crease", "glue_area"] },
  build(ctx) {
    const { v } = ctx;
    const W = num(v, "length", 230);
    const H = num(v, "height", 160);
    const sw = Math.min(W * 0.25, 60);
    const bd = H * 0.6;
    const td = H * 0.5;
    const slit = str(v, "lock", "friction") === "slit";
    const tongue = { w: Math.min(24, W / 5), d: Math.min(10, H / 10) };
    const taper = Math.min(sw * 0.4, H * 0.1);
    const side = (id: string, x: number, dir: -1 | 1) => {
      const out = x + dir * sw;
      const pts: Pt[] =
        dir === 1
          ? [
              [x, 0],
              [out, taper],
              [out, H - taper],
              [x, H],
            ]
          : [
              [x, H],
              [out, H - taper],
              [out, taper],
              [x, 0],
            ];
      return face(id, "dust_flap", "dust_flap", polygon(pts, ["cut", "cut", "cut", "crease"]));
    };
    // The bottom flap's sides glue to the side flaps.
    const glue = (x0: number, x1: number): Edge[] =>
      polygon(
        [
          [x0, H + 4],
          [x1, H + 4],
          [x1, H + bd - 6],
          [x0, H + bd - 6],
        ],
        "glue_area",
      );
    const bottom = face(
      "flap-bottom",
      "outer_flap",
      "flap",
      polygon(
        [
          [0, H],
          [W, H],
          [W - taper, H + bd],
          [taper, H + bd],
        ],
        ["crease", "cut", "cut", "cut"],
      ),
      {
        marks: [...glue(taper + 2, taper + 2 + sw * 0.6), ...glue(W - taper - 2 - sw * 0.6, W - taper - 2)],
        // Where the tongue lands when the top flap closes: its base at `td` below the top edge.
        holes: slit
          ? [
              polygon([
                [W / 2 - tongue.w / 2 - 1, 2 * H - td + 1],
                [W / 2 + tongue.w / 2 + 1, 2 * H - td + 1],
                [W / 2 + tongue.w / 2 + 1, 2 * H - td + 2.5],
                [W / 2 - tongue.w / 2 - 1, 2 * H - td + 2.5],
              ]),
            ]
          : [],
      },
    );
    const topPts: Pt[] = [
      [W, 0],
      [0, 0],
      [taper, -td],
      ...(slit
        ? ([
            [W / 2 - tongue.w / 2, -td],
            [W / 2 - tongue.w / 2 + 2, -td - tongue.d],
            [W / 2 + tongue.w / 2 - 2, -td - tongue.d],
            [W / 2 + tongue.w / 2, -td],
          ] as Pt[])
        : []),
      [W - taper, -td],
    ];
    const top = face(
      "flap-top",
      "lid",
      "lid",
      polygon(
        topPts,
        topPts.map((_p, i) => (i === 0 ? "crease" : "cut")),
      ),
    );
    const faces = [
      face(
        "back",
        "back",
        "panel",
        rectangle(0, 0, W, H, { left: "crease", right: "crease", top: "crease", bottom: "crease" }),
      ),
      side("flap-left", 0, -1),
      side("flap-right", W, 1),
      bottom,
      top,
    ];
    return assemble(ctx.styleId, [piece("blank", "blank", faces)]);
  },
  hinges: () => ({
    roots: { blank: "back" },
    angles: { "flap-left": 180, "flap-right": 180, "flap-bottom": 180, "flap-top": 180 },
    stages: { "flap-left": 1, "flap-right": 1, "flap-bottom": 2, "flap-top": 3 },
  }),
};

/**
 * A paper tube (PK-RG-07) as its flat parts: the body's wrap (the circumference of `diameter` ×
 * `height`), the lid's wrap (one wall and a clearance larger, `lidDepth` tall — the whole height for
 * a full lid), and the two end discs. Wound and lined on the tube line, not folded: 2D only (D-152).
 * ⚠ Overlap and clearance to be confirmed with the tube maker.
 */
export const paperTube: BodyModule = {
  id: "paperTube",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("กระบอกกระดาษ (แผ่นห่อ + ฝา + แผ่นปิดหัวท้าย)", "Paper tube (wraps, lid and end discs)"),
  params: ["diameter", "height", "lid", "lidDepth"],
  processes: ["rigid_box_line"],
  contributes: { kinds: ["flat"], roles: ["cut"] },
  build(ctx) {
    const { v, m } = ctx;
    const D = num(v, "diameter", 80);
    const H = num(v, "height", 200);
    const tc = m.caliperMm;
    const lidD = D + 2 * tc + 0.5;
    const lidH = str(v, "lid", "partial") === "full" ? H : num(v, "lidDepth", Math.round(H / 3));
    const overlap = 10;
    const wrap = Math.PI * (D + tc) + overlap;
    const lidWrap = Math.PI * (lidD + tc) + overlap;
    const gap = 10;
    return assemble(ctx.styleId, [
      piece("body", "blank", [face("body-wrap", "front", "flat", rectangle(0, 0, wrap, H))]),
      piece("lid", "lid", [face("lid-wrap", "lid", "flat", rectangle(0, H + gap, lidWrap, lidH))]),
      piece("base-disc", "base", [
        face("base-disc", "bottom", "flat", ellipse(D / 2, H + gap + lidH + gap + D / 2, D / 2, D / 2)),
      ]),
      piece("lid-disc", "lid", [
        face(
          "lid-disc",
          "top",
          "flat",
          ellipse(D + gap + lidD / 2, H + gap + lidH + gap + lidD / 2, lidD / 2, lidD / 2),
        ),
      ]),
    ]);
  },
};

/**
 * A shrink sleeve label (PK-LA-07) laid flat as printed: the container's largest circumference
 * (`diameter`) and the seam overlap (`sealWidth`, default 8 mm) across, the label `height` plus the
 * shrink allowance (`shrinkAllowance`, default 5 %) tall; the seam band marked on the right edge.
 * Its lay-flat width, as the factory quotes it, is half the across size. 2D only (D-152). ⚠ Allowance
 * per film to be confirmed with the converter.
 */
export const shrinkSleeve: BodyModule = {
  id: "shrinkSleeve",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("ฉลากฟิล์มหด", "Shrink sleeve label"),
  params: ["diameter", "height", "sealWidth", "shrinkAllowance"],
  processes: ["shrink_sleeve"],
  contributes: { kinds: ["flat"], roles: ["cut", "glue_area"] },
  build(ctx) {
    const { v } = ctx;
    const seam = num(v, "sealWidth", 8);
    const across = Math.PI * num(v, "diameter", 70) + seam;
    const tall = num(v, "height", 150) * (1 + num(v, "shrinkAllowance", 5) / 100);
    const marks = polygon(
      [
        [across - seam + 0.5, 0.5],
        [across - 0.5, 0.5],
        [across - 0.5, tall - 0.5],
        [across - seam + 0.5, tall - 0.5],
      ],
      "glue_area",
    );
    return assemble(ctx.styleId, [
      piece("blank", "blank", [face("label", "label", "flat", rectangle(0, 0, across, tall), { marks })]),
    ]);
  },
};
