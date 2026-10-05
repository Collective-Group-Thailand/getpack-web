import { allowancesOf, glueWidthFor, LID_CLEARANCE_MM } from "../../constants";
import { buildTray } from "../../construct/tray";
import { buildTube } from "../../construct/tube";
import { assemble, face, piece, prefixFaces } from "../../faces";
import { num, str } from "../../params";
import { line, polygon, rectangle } from "../../path";
import { grainOn, t, windowHole } from "../../styles/_shared";
import type { Contour, Edge } from "../../types";
import { extraPieces } from "../body/tube";
import type { PieceSetModule } from "../types";

/*
 * Piece sets the style library's second wave adds (U3.4 wave 2).
 */

/** How far a rigid case's boards stand proud of the tray they hold, each side, mm. ⚠ */
export const CASE_OVERHANG_MM = 3;

const slot = (cx: number, cy: number, w: number, h: number): Contour =>
  polygon([
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ]);

const pocket = (cx: number, cy: number, w: number, h: number): Edge[] =>
  polygon(
    [
      [cx - w / 2, cy - h / 2],
      [cx + w / 2, cy - h / 2],
      [cx + w / 2, cy + h / 2],
      [cx - w / 2, cy + h / 2],
    ],
    "half_cut",
  );

/**
 * A rigid box in a case (PK-RG-03 book-style, PK-RG-06 hinged lid): a greyboard tray with stayed
 * corners (`length` × `width` × `height` inside), set in a wrapped case of three boards — back, spine
 * and front — that close over it. `spine` = `side` hinges the front on the tray's left end (a book);
 * `back` on its back wall (a hinged lid); `doors` puts a spine on each end and a door on each,
 * meeting at the centre (PK-RG-08). The boards stand `CASE_OVERHANG_MM` proud of the tray.
 * `closure`: `magnetic` marks the magnet pockets (half-cut) in the front board's free edge and the
 * tray's facing wall; `ribbon` two slots in the front and back boards' free edges the ribbon runs
 * through. A `window` is cut in the front board (`case-front`) or the tray's front wall (`wall-front`).
 * ⚠ Overhang, spine clearance, magnet and slot positions to be confirmed by Prepress.
 */
export const rigidCase: PieceSetModule = {
  id: "rigidCase",
  slot: "pieceSet",
  status: "implemented",
  label: t("กล่องแข็งในปก (ถาด + ปกสามแผ่น)", "Rigid tray in a case (back, spine, front)"),
  params: ["length", "width", "height", "closureRigid", "grain"],
  processes: ["rigid_box_line"],
  contributes: { kinds: ["base", "wall", "panel", "lid"], roles: ["cut", "crease", "half_cut"] },
  build(ctx, cfg, parts) {
    const { v, m } = ctx;
    const a = allowancesOf(m);
    const tc = m.caliperMm;
    const side = cfg.spine === "side";
    const f = {
      length: ctx.num("length") + a.panel,
      width: ctx.num("width") + a.panel,
      height: ctx.num("height") + a.trayDepth,
    };
    const closure = str(v, "closureRigid", "none");
    // The tray's wall facing the front board's free edge: the front wall, or the right end on a book.
    const facing = side ? "wall-right" : "wall-front";
    const trayHoles: Record<string, Contour[]> = {
      "wall-front": windowHole(
        v,
        "wall-front",
        f.height,
        f.height + f.length,
        f.height + f.width,
        2 * f.height + f.width,
      ),
    };
    const trayMarks: Record<string, Edge[]> = {};
    if (closure === "magnetic")
      trayMarks[facing] = side
        ? pocket(f.height + f.length + f.height / 2, f.height + f.width / 2, 6, 20)
        : pocket(f.height + f.length / 2, f.height + f.width + f.height / 2, 20, 6);
    const tray = buildTray({ ...f, cornerFlap: 0, holes: trayHoles }).map((x) =>
      trayMarks[x.id] ? { ...x, marks: [...x.marks, ...trayMarks[x.id]!] } : x,
    );

    // The case: back, spine, front laid out across the spine's crease.
    const o = CASE_OVERHANG_MM;
    const L = f.length + tc + 2 * o;
    const W = f.width + tc + 2 * o;
    const S = f.height + 2 * tc + 1;
    // Along the spine: `along` is the board edge the spine runs on; `across` the board's other side.
    const along = side ? W : L;
    const across = side ? L : W;
    const boardHoles = (id: "case-front" | "case-back", y0: number): Contour[] => {
      const holes: Contour[] = [];
      if (id === "case-front") holes.push(...windowHole(v, "case-front", 0, along, y0, y0 + across));
      // Ribbon slots 10 mm in from the free edge, a quarter in from each end.
      if (closure === "ribbon") {
        const free = id === "case-front" ? y0 + across - 10 : y0 + 10;
        holes.push(slot(along / 2, free, 16, 3));
      }
      return holes;
    };
    const frontMarks = closure === "magnetic" ? pocket(along / 2, across + S + across - 8, 20, 6) : [];
    if (cfg.spine === "doors") {
      // PK-RG-08: spines on both ends, a door on each meeting at the centre (a 1 mm gap).
      const half = L / 2 - 0.5;
      const doorExtras = (meet: number) => ({
        holes: closure === "ribbon" ? [slot(meet, W / 2, 3, 16)] : [],
        marks: closure === "magnetic" ? pocket(meet, W / 2, 6, 20) : [],
      });
      const doors = [
        face("case-back", "back", "panel", rectangle(0, 0, L, W, { left: "crease", right: "crease" })),
        face("case-spine-left", "left", "panel", rectangle(-S, 0, S, W, { left: "crease", right: "crease" })),
        face("case-spine-right", "right", "panel", rectangle(L, 0, S, W, { left: "crease", right: "crease" })),
        face(
          "case-door-left",
          "lid",
          "lid",
          rectangle(-S - half, 0, half, W, { right: "crease" }),
          doorExtras(-S - half + 8),
        ),
        face(
          "case-door-right",
          "lid",
          "lid",
          rectangle(L + S, 0, half, W, { left: "crease" }),
          doorExtras(L + S + half - 8),
        ),
      ];
      return assemble(ctx.styleId, [
        piece("case", "lid", doors, grainOn(v, doors, "case-back")),
        piece("base", "base", tray, grainOn(v, tray, "base")),
        ...extraPieces(ctx, parts),
      ]);
    }
    const caseFaces = [
      face("case-back", "back", "panel", rectangle(0, 0, along, across, { bottom: "crease" }), {
        holes: boardHoles("case-back", 0),
      }),
      face("case-spine", "side", "panel", rectangle(0, across, along, S, { top: "crease", bottom: "crease" })),
      face("case-front", "lid", "lid", rectangle(0, across + S, along, across, { top: "crease" }), {
        holes: boardHoles("case-front", across + S),
        marks: frontMarks,
      }),
    ];
    return assemble(ctx.styleId, [
      piece("case", "lid", caseFaces, grainOn(v, caseFaces, "case-front")),
      piece("base", "base", tray, grainOn(v, tray, "base")),
      ...extraPieces(ctx, parts),
    ]);
  },
  hinges: (ctx, cfg) => ({
    roots: { case: "case-back", base: "base" },
    upright: "base",
    placement: {
      base: {
        inside: "case",
        floor: ctx.m.caliperMm,
        // A book's spine is at the tray's left end: turned a quarter so its length runs along the spine.
        ...(cfg.spine === "side" ? { rotate: [0, 90, 0] as [number, number, number] } : {}),
      },
    },
  }),
};

/**
 * A rigid shoulder-neck box (PK-RG-02): a base tray `height` − `lidDepth` deep inside, a neck — a
 * wrapped band glued round — standing in it on the floor and rising `lidDepth` above its rim (the
 * shoulder), and a lid that slides over the neck down to the shoulder, so lid and base meet flush.
 * ⚠ Neck and lid clearances to be confirmed by Prepress.
 */
export const shoulderNeck: PieceSetModule = {
  id: "shoulderNeck",
  slot: "pieceSet",
  status: "implemented",
  label: t("กล่องแข็งมีคอ (ตัวกล่อง คอ ฝา)", "Rigid shoulder-neck box (base, neck, lid)"),
  params: ["length", "width", "height", "lidDepth", "grain"],
  processes: ["rigid_box_line"],
  contributes: { kinds: ["base", "wall", "panel", "glue_flap"], roles: ["cut", "crease", "glue_area"] },
  constraints: [
    {
      id: "shoulderNeck.lid_depth",
      code: "lid.too_deep",
      severity: "error",
      param: "lidDepth",
      require: "(lidDepth ?? max(15, round(height / 3))) < height - 15",
      message: t("ฝาลึกจนตัวกล่องเหลือต่ำเกินไป", "The lid is so deep the base is too shallow"),
    },
  ],
  build(ctx, _cfg, parts) {
    const { v, m } = ctx;
    const a = allowancesOf(m);
    const tc = m.caliperMm;
    const L = num(v, "length", 150);
    const W = num(v, "width", 100);
    const H = num(v, "height", 80);
    const e = num(v, "lidDepth", Math.max(15, Math.round(H / 3)));
    const base = buildTray({ length: L + a.panel, width: W + a.panel, height: H - e + a.trayDepth, cornerFlap: 0 });
    // The neck: outside the base's inside (less a clearance), standing on the floor, `e` proud of the rim.
    const nl = L - tc - 0.5;
    const nw = W - tc - 0.5;
    const neck = prefixFaces(
      buildTube({
        panels: [
          { id: "front", label: "front", width: nl },
          { id: "right", label: "right", width: nw },
          { id: "back", label: "back", width: nl },
          { id: "left", label: "left", width: nw - a.gluePanel },
        ],
        depth: H - tc,
        glue: glueWidthFor(nw, m),
      }),
      "neck-",
    );
    // The lid's inside is the neck's outside (≈ the base's inside) plus a clearance: flush with the base.
    const c = Math.min(LID_CLEARANCE_MM, 0.5);
    const lid = prefixFaces(
      buildTray({ length: L + a.panel + c, width: W + a.panel + c, height: e + a.trayDepth, cornerFlap: 0 }),
      "lid-",
    );
    return assemble(ctx.styleId, [
      piece("base", "base", base, grainOn(v, base, "base")),
      piece("neck", "sleeve", neck, grainOn(v, neck, "neck-front")),
      piece("lid", "lid", lid, grainOn(v, lid, "lid-base")),
      ...extraPieces(ctx, parts),
    ]);
  },
  hinges: (ctx) => ({
    roots: { base: "base", neck: "neck-front", lid: "lid-base" },
    upright: "base",
    placement: {
      neck: { inside: "base", floor: ctx.m.caliperMm, rotate: [90, 0, 0] },
      lid: {
        over: "neck",
        flip: true,
        sink: num(ctx.v, "lidDepth", Math.max(15, Math.round(num(ctx.v, "height", 80) / 3))),
        lift: 40,
      },
    },
  }),
};

/**
 * A floor display unit (PK-CD-02): a three-sided corrugated body — two sides `width` deep and a
 * back `length` wide, `height` tall, open at the front — with `shelves` (1–4) trays set in it at
 * even heights, each `length` × `width` with a 40 mm lip; `header` adds a header card standing on
 * the back panel's top edge, in line with it. ⚠ Shelf supports (clips or ledges) and header height
 * to be confirmed by Prepress; the shelves rest on the sides' inner faces here.
 */
export const floorDisplay: PieceSetModule = {
  id: "floorDisplay",
  slot: "pieceSet",
  status: "implemented",
  label: t("ชั้นวางโชว์ตั้งพื้น (ตัว ชั้น ป้ายหัว)", "Floor display unit (body, shelves, header)"),
  params: ["length", "width", "height", "shelves", "header", "grain"],
  processes: ["die_cut", "hand_assembly"],
  contributes: { kinds: ["panel", "base", "wall", "hanger"], roles: ["cut", "crease"] },
  build(ctx) {
    const { v, m } = ctx;
    const tc = m.caliperMm;
    const L = num(v, "length", 400);
    const D = num(v, "width", 300);
    const H = num(v, "height", 1400);
    const n = Number(str(v, "shelves", "3"));
    const header = str(v, "header", "none") !== "none";
    const hh = Math.min(300, H / 4);
    const body = buildTube({
      panels: [
        { id: "side-left", label: "left", width: D + tc },
        { id: "back", label: "back", width: L + tc },
        { id: "side-right", label: "right", width: D + tc },
      ],
      depth: H,
      ...(header
        ? {
            top: ({ panels }) => {
              const b = panels[1];
              return {
                attachments: [
                  {
                    span: [b.x0, b.x1] as [number, number],
                    face: face("header", "header", "hanger", [
                      line([b.x0, 0], [b.x0, -hh], "cut"),
                      line([b.x0, -hh], [b.x1, -hh], "cut"),
                      line([b.x1, -hh], [b.x1, 0], "cut"),
                      line([b.x1, 0], [b.x0, 0], "crease"),
                    ]),
                  },
                ],
              };
            },
          }
        : {}),
    });
    const shelves = Array.from({ length: n }, (_x, i) =>
      piece(
        `shelf-${i + 1}`,
        "base",
        prefixFaces(buildTray({ length: L - 1, width: D - 1, height: 40, cornerFlap: 0 }), `shelf-${i + 1}-`),
      ),
    );
    return assemble(ctx.styleId, [piece("body", "blank", body, grainOn(v, body, "back")), ...shelves]);
  },
  hinges(ctx) {
    const H = num(ctx.v, "height", 1400);
    const n = Number(str(ctx.v, "shelves", "3"));
    const roots: Record<string, string> = { body: "back" };
    const placement: Record<string, { inside: string; floor: number; rotate: [number, number, number] }> = {};
    for (let i = 0; i < n; i++) {
      const id = `shelf-${i + 1}`;
      roots[id] = `${id}-base`;
      // Shelf i of n at (i + 1) / (n + 1) of the height, the lowest a lip above the floor. ⚠
      placement[id] = { inside: "body", floor: ((H - 40) * i) / n + 2, rotate: [-90, 0, 0] };
    }
    return { roots, angles: { header: 0 }, placement };
  },
};
