import { dielineLines } from "../lines";
import { bleedOutline } from "../offset";
import { round3, svgPathData } from "../path";
import type { Dieline, Pt } from "../types";
import { LAYER_OF, LAYER_ORDER, LAYER_STYLE, type LayerName } from "./layers";

export interface SvgOptions {
  /** White space around the dieline, mm. Default 5. */
  margin?: number;
  /** Adds a BLEED layer: the outline grown by this many mm. */
  bleedMm?: number;
  /** Stroke width in mm. Default 0.25. */
  strokeMm?: number;
  /** Draws each piece's grain arrow on a NOTES layer. */
  annotations?: boolean;
}

const fmt = (n: number) => String(round3(n));

/**
 * True-size SVG (1 user unit = 1 mm, `width`/`height` in mm) with one group per layer:
 * `CUT`, `CREASE`, `PERF`, `HALFCUT`, `GLUE` (+ `BLEED`, `NOTES` when asked). Arcs stay SVG arcs
 * and Béziers stay curves, so a CAD import gets true geometry. Empty layers are still written, so
 * the structure never changes between styles.
 */
export function dielineToSvg(d: Dieline, opts: SvgOptions = {}): string {
  const margin = opts.margin ?? 5;
  const stroke = opts.strokeMm ?? 0.25;
  const shift = (p: Pt): Pt => [p[0] + margin, p[1] + margin];
  const paths: Record<LayerName, string[]> = { CUT: [], CREASE: [], PERF: [], HALFCUT: [], GLUE: [], BLEED: [] };

  for (const l of dielineLines(d)) {
    const e = l.edge;
    const moved =
      e.kind === "line"
        ? { ...e, from: shift(e.from), to: shift(e.to) }
        : e.kind === "arc"
          ? { ...e, from: shift(e.from), to: shift(e.to), center: shift(e.center) }
          : { ...e, from: shift(e.from), to: shift(e.to), c1: shift(e.c1), c2: shift(e.c2) };
    paths[LAYER_OF[l.role]].push(`<path d="${svgPathData([moved], false, fmt)}"/>`);
  }
  if (opts.bleedMm) {
    for (const p of d.pieces) {
      for (const poly of bleedOutline(p, opts.bleedMm)) {
        paths.BLEED.push(`<path d="M${poly.map((q) => `${fmt(q[0] + margin)} ${fmt(q[1] + margin)}`).join(" L")} Z"/>`);
      }
    }
  }

  const w = fmt(d.width + margin * 2);
  const h = fmt(d.height + margin * 2);
  const layers = LAYER_ORDER.filter((name) => name !== "BLEED" || opts.bleedMm).map((name) => {
    const s = LAYER_STYLE[name];
    const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : "";
    return `  <g id="${name}" stroke="${s.hex}" stroke-width="${fmt(stroke)}"${dash} fill="none">${paths[name].join("")}</g>`;
  });
  if (opts.annotations) {
    const notes = d.pieces.flatMap((p) =>
      p.annotations.map((a) => {
        const [x1, y1] = shift(a.from);
        const [x2, y2] = shift(a.to);
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const head = (da: number): string => `${fmt(x2 - 4 * Math.cos(ang + da))} ${fmt(y2 - 4 * Math.sin(ang + da))}`;
        return `<path d="M${fmt(x1)} ${fmt(y1)} L${fmt(x2)} ${fmt(y2)} M${head(0.4)} L${fmt(x2)} ${fmt(y2)} L${head(-0.4)}"/>`;
      }),
    );
    layers.push(`  <g id="NOTES" stroke="#808080" stroke-width="${fmt(stroke)}" fill="none">${notes.join("")}</g>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" data-style="${d.styleId}">
${layers.join("\n")}
</svg>`;
}
