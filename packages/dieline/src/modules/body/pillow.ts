import { glueWidthFor } from "../../constants";
import { glueFlap } from "../../construct/tube";
import { assemble, face, piece } from "../../faces";
import { num } from "../../params";
import { arc, line } from "../../path";
import { grainOn, t } from "../../styles/_shared";
import type { ArcEdge, Pt } from "../../types";
import type { BodyModule } from "../types";

/** An arc from `a` to `b` (a left of b, on one horizontal line) bulging up (−y) or down by `sagitta`. */
function bulge(a: Pt, b: Pt, sagitta: number, up: boolean, role: ArcEdge["role"]): ArcEdge {
  const c = b[0] - a[0];
  const r = (c * c) / (8 * sagitta) + sagitta / 2;
  const xm = (a[0] + b[0]) / 2;
  const center: Pt = up ? [xm, a[1] - sagitta + r] : [xm, a[1] + sagitta - r];
  // Left to right over the top runs through increasing angles (clockwise on screen); under, decreasing.
  return arc(a, b, center, up, role);
}

const reverse = (e: ArcEdge): ArcEdge => ({ ...e, from: e.to, to: e.from, clockwise: !e.clockwise });

/**
 * Pillow tube: two panels whose ends are curved creases; beyond each crease a lens-shaped flap
 * bounded by a deeper cut arc folds in, and the curved creases bow the panels into a pillow.
 * `thickness` is the lens depth (the pillow's thickness at its middle); the creases bow a third
 * of it. ⚠ Curve proportions to be confirmed by prepress.
 */
export const pillowTube: BodyModule = {
  id: "pillowTube",
  slot: "body",
  kind: "special",
  status: "implemented",
  folds: true,
  label: t("ตัวกล่องหมอน (ปลายโค้งพับ)", "Pillow tube with curved ends"),
  params: ["length", "width", "thickness", "glueWidth", "grain"],
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["panel", "flap", "glue_flap"], roles: ["cut", "crease", "glue_area"] },
  build(ctx) {
    const { v, m } = ctx;
    const T = num(v, "thickness", 30);
    const sc = T / 3;
    // `length` is overall, at the middle: the chords sit inside it by the creases' bow.
    const L = num(v, "length", 150) - 2 * sc;
    const W = num(v, "width", 100) + m.caliperMm;
    const g = num(v, "glueWidth", glueWidthFor(W, m));
    const x = [g, g + W, g + 2 * W];
    const faces = [glueFlap("glue", g, g, L, "left")];
    ["front", "back"].forEach((id, i) => {
      const x0 = x[i];
      const x1 = x[i + 1];
      const topCrease = bulge([x0, 0], [x1, 0], sc, true, "crease");
      const bottomCrease = bulge([x0, L], [x1, L], sc, false, "crease");
      faces.push(
        face(id, id === "front" ? "front" : "back", "panel", [
          topCrease,
          line([x1, 0], [x1, L], i === 0 ? "crease" : "cut"),
          reverse(bottomCrease),
          line([x0, L], [x0, 0], "crease"),
        ]),
        face(`end-${id}-top`, "end_flap", "flap", [bulge([x0, 0], [x1, 0], T, true, "cut"), reverse(topCrease)]),
        face(`end-${id}-bottom`, "end_flap", "flap", [reverse(bulge([x0, L], [x1, L], T, false, "cut")), bottomCrease]),
      );
    });
    return assemble(ctx.styleId, [piece("blank", "blank", faces, grainOn(v, faces, "front"))]);
  },
  hinges: () => ({
    roots: { blank: "front" },
    angles: { back: 180, glue: 180, "end-back-top": -90, "end-back-bottom": -90 },
  }),
};
