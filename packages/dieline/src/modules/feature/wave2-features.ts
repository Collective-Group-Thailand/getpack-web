import { bool, num, str } from "../../params";
import { ellipse, flattenContour, line, polygon, roundedRectangle } from "../../path";
import { t, windowHole, windowIssues } from "../../styles/_shared";
import type { Edge, Face, Pt } from "../../types";
import { face } from "../../faces";
import { dividers, partitionStrips } from "../body/partition";
import type { FeatureModule } from "../types";

/*
 * Features the style library's second wave adds (U3.4 wave 2).
 */

/**
 * A window in a tray (the master `window` axis on trays): `windowPanel` = `wall-front` cuts it in
 * the front wall; `lid` is cut by the hinged lid itself (`hingedLid`). Patched with film like a
 * carton window.
 */
export const trayWindow: FeatureModule = {
  id: "trayWindow",
  slot: "feature",
  status: "implemented",
  fits: ["tray"],
  label: t("หน้าต่างบนถาด", "Tray window"),
  params: ["window", "windowPanel", "windowWidth", "windowHeight", "windowOffsetX", "windowOffsetY", "windowRadius"],
  processes: ["window_patching"],
  contributes: { kinds: [], roles: ["cut"] },
  trayHoles: (ctx, _cfg, f) => ({
    // The front wall in the tray frame: x ∈ [h, h + length], y ∈ [h + width, 2h + width].
    "wall-front": windowHole(
      ctx.v,
      "wall-front",
      f.height,
      f.height + f.length,
      f.height + f.width,
      2 * f.height + f.width,
    ),
  }),
  check: (ctx, _cfg, built) => windowIssues(ctx.v, built),
};

/**
 * Security cuts on a tamper-evident seal (PK-LA-04): half-cut nicks 3 mm long, every 8 mm round the
 * outline and pointing inward, so the face stock tears when the seal is lifted. ⚠ Nick length and
 * pitch to be confirmed with the label printer per face stock.
 */
export const securityCuts: FeatureModule = {
  id: "securityCuts",
  slot: "feature",
  status: "implemented",
  fits: ["flat"],
  label: t("รอยกรีดป้องกันการแกะ", "Tamper-evident security cuts"),
  params: [],
  processes: ["label_press"],
  contributes: { kinds: [], roles: ["half_cut"] },
  flatMarks(_ctx, _cfg, outline) {
    const pts = flattenContour(outline, 0.5);
    // Signed area tells which side is inside (y down).
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const inward = area > 0 ? 1 : -1;
    const out: Edge[] = [];
    let carried = 4;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-9) continue;
      const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      // The inward normal: left of the walk on a positive (y-down) area.
      const [nx, ny] = [-uy * inward, ux * inward];
      let at = carried;
      while (at < len) {
        const p: Pt = [a[0] + ux * at + nx * 0.5, a[1] + uy * at + ny * 0.5];
        out.push(line(p, [p[0] + nx * 3, p[1] + ny * 3], "half_cut"));
        at += 8;
      }
      carried = at - len;
    }
    return out;
  },
};

/**
 * A round hole for a bottle neck (`neckDiameter`), centred on a flat piece of `length` × `width` or
 * `diameter` — the neck collar (PK-LA-05) and the bottle-neck insert (PK-IN-02).
 */
export const neckHole: FeatureModule = {
  id: "neckHole",
  slot: "feature",
  status: "implemented",
  fits: ["flat"],
  label: t("รูสวมคอขวด", "Bottle-neck hole"),
  params: ["neckDiameter"],
  processes: ["die_cut"],
  contributes: { kinds: [], roles: ["cut"] },
  constraints: [
    {
      id: "neckHole.fits",
      code: "hole.too_large",
      severity: "error",
      param: "neckDiameter",
      require: "neckDiameter < (diameter ?? min(length, width)) - 16",
      message: t("รูคอขวดใหญ่เกินชิ้นงาน", "The neck hole is too large for the piece"),
    },
  ],
  flatHoles(ctx, cfg) {
    const r = num(ctx.v, "neckDiameter", 28) / 2;
    const c = cfg.center === "diameter" ? num(ctx.v, "diameter", 60) / 2 : undefined;
    const cx = c ?? num(ctx.v, "length", 100) / 2;
    const cy = c ?? num(ctx.v, "width", 60) / 2;
    return [ellipse(cx, cy, r, r)];
  },
};

/** The bounds of a face's outline: [minX, maxX, minY, maxY]. */
function bounds(f: Face): [number, number, number, number] {
  const xs = f.outline.flatMap((e) => [e.from[0], e.to[0]]);
  const ys = f.outline.flatMap((e) => [e.from[1], e.to[1]]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

const band = (x0: number, x1: number, y0: number, y1: number): Edge[] =>
  polygon(
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    "glue_area",
  );

/**
 * A zip tear strip round a tube (`tearStrip` on): two perforations 8 mm apart across the panels
 * listed in `onPanels` (default all), `from` mm below the top crease (an expression; default a third
 * of the depth, at most 40 mm). The strip of tape is applied inside on the line between them.
 * ⚠ Position and spacing to be confirmed by Prepress.
 */
export const tearStrip: FeatureModule = {
  id: "tearStrip",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("แถบดึงฉีก", "Tear strip"),
  params: ["tearStrip"],
  processes: ["die_cut", "tear_strip_applicator"],
  contributes: { kinds: [], roles: ["perforation"] },
  tubeMarks(ctx, cfg, p) {
    if (!bool(ctx.v, "tearStrip", false)) return [];
    const only = cfg.onPanels as number[] | undefined;
    if (only && !only.includes(p.index)) return [];
    const at = ctx.num((cfg.from as string) ?? "min(40, depth / 3)");
    return [at, at + 8].map((y) => line([p.x0, p.y0 + y], [p.x1, p.y0 + y], "perforation"));
  },
};

/**
 * Peel-and-seal adhesive strips on the inside of a top closure's faces (`adhesive` = `single` |
 * `dual`; `dual` adds a second strip to send the box back): 10 mm wide, 3 mm in from the far edge of
 * each face named in `faces`. ⚠ Strip width and position to be confirmed by Prepress.
 */
export const adhesiveStrip: FeatureModule = {
  id: "adhesiveStrip",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("แถบกาวในตัว", "Adhesive strip"),
  params: ["adhesive"],
  processes: ["adhesive_strip_applicator"],
  contributes: { kinds: [], roles: ["glue_area"] },
  wrapClosure: (ctx, cfg, _end, inner) => (c) => {
    const out = inner(c);
    const kind = str(ctx.v, "adhesive", "none");
    if (kind === "none") return out;
    const ids = (cfg.faces as string[] | undefined) ?? [];
    for (const f of [...out.attachments.map((a) => a.face), ...(out.faces ?? [])]) {
      if (!ids.includes(f.id)) continue;
      const [x0, x1, y0, y1] = bounds(f);
      if (y1 - y0 < 18 || x1 - x0 < 12) continue;
      const strips = [band(x0 + 4, x1 - 4, y0 + 3, y0 + 13)];
      if (kind === "dual" && y1 - y0 >= 36) strips.push(band(x0 + 4, x1 - 4, y0 + 20, y0 + 30));
      f.marks = [...f.marks, ...strips.flat()];
    }
    return out;
  },
};

/**
 * A perforated dispenser opening (PK-SP-19): a rounded rectangle, perforated, in panel `panel`
 * (default the front), its top a fifth of the depth below the top crease, 60 % of the panel wide
 * and a third of the depth tall. Pressed out along the perforation to open. ⚠
 */
export const dispenser: FeatureModule = {
  id: "dispenser",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("ช่องดึงแบบปรุ", "Perforated dispenser opening"),
  params: [],
  processes: ["die_cut"],
  contributes: { kinds: [], roles: ["perforation"] },
  tubeMarks(_ctx, cfg, p) {
    if (p.index !== ((cfg.panel as number | undefined) ?? 0)) return [];
    const w = (p.x1 - p.x0) * 0.6;
    const h = (p.y1 - p.y0) / 3;
    const x = (p.x0 + p.x1) / 2 - w / 2;
    const y = p.y0 + (p.y1 - p.y0) / 5;
    return roundedRectangle(x, y, w, h, Math.min(10, w / 4, h / 4)).map((e) => ({
      ...e,
      role: "perforation" as const,
    }));
  },
};

/**
 * A perforated tear line round a tube that lifts its top away (a tear-away display, PK-DS-02; a
 * shelf-ready tray's tear-off top, PK-CD-01): `front` and `back` are its depths below the top crease
 * on the front (panel 0) and back (panel 2) panels, expressions; across the side panels it runs
 * straight from one to the other; `back` = 0 leaves the back panel whole and the side lines rise to
 * its top corners. ⚠ Line positions to be confirmed by Prepress.
 */
export const tearLine: FeatureModule = {
  id: "tearLine",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("เส้นปรุฉีกเปิดเป็นดิสเพลย์", "Tear-away line"),
  params: [],
  processes: ["die_cut"],
  contributes: { kinds: [], roles: ["perforation"] },
  tubeMarks(ctx, cfg, p) {
    const front = ctx.num(cfg.front as string);
    const back = ctx.num(cfg.back as string);
    const y = (d: number) => p.y0 + d;
    switch (p.index) {
      case 0:
        return [line([p.x0, y(front)], [p.x1, y(front)], "perforation")];
      case 1:
        return [line([p.x0, y(front)], [p.x1, y(back)], "perforation")];
      case 2:
        // `back` = 0: the back stays whole (it carries the hang tab, or is the header).
        return back > 0 ? [line([p.x0, y(back)], [p.x1, y(back)], "perforation")] : [];
      case 3:
        return [line([p.x0, y(back)], [p.x1, y(front)], "perforation")];
      default:
        return [];
    }
  },
};

/**
 * A tamper-evident tuck (PK-TE-05): the top tuck carries a glue spot, so the lid opens only by
 * tearing a perforation across it 8 mm from the tuck crease — the strip stays glued and shows the
 * box was opened. ⚠ Glue spot and perforation position to be confirmed by Prepress.
 */
export const tamperTuck: FeatureModule = {
  id: "tamperTuck",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("ลิ้นเสียบกันแกะ (ทากาว + เส้นปรุ)", "Tamper-evident tuck (glue spot and tear line)"),
  params: [],
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: [], roles: ["perforation", "glue_area"] },
  wrapClosure: (_ctx, _cfg, end, inner) => (c) => {
    const out = inner(c);
    const all = [...out.attachments.map((a) => a.face), ...(out.faces ?? [])];
    const lid = all.find((f) => f.id === `lid-${end}`);
    const tuck = all.find((f) => f.id === `tuck-${end}`);
    if (lid) {
      const [x0, x1, y0] = bounds(lid);
      lid.marks = [...lid.marks, line([x0, y0 + 8], [x1, y0 + 8], "perforation")];
    }
    if (tuck) {
      const [x0, x1, y0, y1] = bounds(tuck);
      const cx = (x0 + x1) / 2;
      const w = Math.min(30, (x1 - x0) / 3);
      tuck.marks = [...tuck.marks, ...band(cx - w / 2, cx + w / 2, y0 + (y1 - y0) * 0.3, y0 + (y1 - y0) * 0.7)];
    }
    return out;
  },
};

/**
 * A partition grid inside a box (PK-CI-04 bottle shipper, PK-SP-06 bottle carrier): the strips of
 * `partitionSet` sized to the inside — `length` − 2 mm along, `width` − 2 mm across, `height` less
 * four calipers tall — cut with the box and set in it, each at its divider (`partition` = rows ×
 * columns). ⚠ Clearances to be confirmed by Prepress.
 */
export const partitionInsert: FeatureModule = {
  id: "partitionInsert",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("ช่องกั้นในกล่อง", "Partition grid inside the box"),
  params: ["partition"],
  processes: ["die_cut", "slotter", "hand_assembly"],
  contributes: { kinds: ["flat"], roles: ["cut"] },
  constraints: [
    {
      id: "partitionInsert.cell",
      code: "partition.cell_too_small",
      severity: "error",
      param: "partition",
      require: "length / gridCount(partition, 1) >= 25 and width / gridCount(partition, 0) >= 25",
      message: t("ช่องเล็กเกินไป (อย่างน้อย 25 มม.)", "The cells are too small (25 mm at least)"),
    },
  ],
  pieces(ctx) {
    const { v, m } = ctx;
    const [rows, cols] = str(v, "partition", "2x2").split("x").map(Number);
    const L = num(v, "length", 300) - 2;
    const W = num(v, "width", 200) - 2;
    const H = num(v, "height", 100) - 4 * m.caliperMm;
    return partitionStrips(L, W, H, m.caliperMm + 1, rows, cols, "cells-");
  },
  hinges(ctx, cfg) {
    const { v } = ctx;
    const [rows, cols] = str(v, "partition", "2x2").split("x").map(Number);
    const L = num(v, "length", 300) - 2;
    const W = num(v, "width", 200) - 2;
    const target = (cfg.target as string) ?? "blank";
    const roots: Record<string, string> = {};
    // Standing on the closed bottom (`floor`, default three calipers: its layers and a clearance).
    const floor = ctx.num((cfg.floor as string) ?? "3 * t");
    const placement: Record<
      string,
      { inside: string; floor: number; rotate?: [number, number, number]; offset: [number, number, number] }
    > = {};
    dividers(rows, W).forEach((z, i) => {
      const id = `cells-long-${i + 1}`;
      roots[id] = id;
      placement[id] = { inside: target, floor, offset: [0, 0, z - W / 2] };
    });
    dividers(cols, L).forEach((x, i) => {
      const id = `cells-cross-${i + 1}`;
      roots[id] = id;
      placement[id] = { inside: target, floor, rotate: [0, 90, 0], offset: [x - L / 2, 0, 0] };
    });
    return { roots, placement };
  },
};

/**
 * A neck lock under the top lid (PK-SP-18): the right panel's dust flap becomes an inner flap the
 * whole length of the box, with a hole (`neckDiameter`) at its centre that the bottle's neck passes
 * through, so a tall bottle cannot rock. ⚠ Hole clearance to be confirmed by Prepress.
 */
export const neckLock: FeatureModule = {
  id: "neckLock",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("ล็อกคอขวด", "Neck lock"),
  params: ["neckDiameter"],
  processes: ["die_cut"],
  contributes: { kinds: ["flap"], roles: ["cut", "crease"] },
  constraints: [
    {
      id: "neckLock.fits",
      code: "hole.too_large",
      severity: "error",
      param: "neckDiameter",
      require: "neckDiameter < min(length, width) - 12",
      message: t("รูคอขวดใหญ่เกินขนาดกล่อง", "The neck hole is too large for the box"),
    },
  ],
  wrapClosure: (ctx, _cfg, end, inner) => (c) => {
    const out = inner(c);
    const right = c.panels[1];
    const at = out.attachments.findIndex((a) => a.face.id === `dust-${right.id}-${end}`);
    if (at < 0) return out;
    const tc = ctx.m.caliperMm;
    const reach = ctx.dims.front - 2 - tc;
    const inset = 2 + tc;
    const r = num(ctx.v, "neckDiameter", 28) / 2;
    const cx = (right.x0 + right.x1) / 2;
    const flap = face(
      `neck-${end}`,
      "inner_flap",
      "flap",
      polygon(
        [
          [right.x0, 0],
          [right.x0 + inset, -reach],
          [right.x1 - inset, -reach],
          [right.x1, 0],
        ],
        ["cut", "cut", "cut", "crease"],
      ),
      { holes: [ellipse(cx, -reach / 2, r, r)] },
    );
    const attachments = [...out.attachments];
    attachments[at] = { face: flap, span: [right.x0, right.x1] };
    return { ...out, attachments };
  },
};
