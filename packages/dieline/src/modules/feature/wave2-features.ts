import { num } from "../../params";
import { ellipse, flattenContour, line } from "../../path";
import { t, windowHole, windowIssues } from "../../styles/_shared";
import type { Edge, Pt } from "../../types";
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
