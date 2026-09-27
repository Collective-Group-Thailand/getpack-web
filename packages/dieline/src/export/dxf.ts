import { dielineLines } from "../lines";
import { arcAngles, flattenOpen, round3 } from "../path";
import type { Dieline, Pt } from "../types";
import { LAYER_OF, LAYER_ORDER, LAYER_STYLE } from "./layers";

const deg = (rad: number) => round3(((((rad * 180) / Math.PI) % 360) + 360) % 360);

/**
 * AutoCAD R12 ASCII DXF — the version every die-making CAD still opens. Millimetres, same layers
 * as the SVG (`CUT`, `CREASE`, `PERF`, `HALFCUT`, `GLUE`), lines as `LINE`, circular arcs as true
 * `ARC` entities, Béziers as polylines within 0.05 mm. DXF's y axis points up, so the sheet is
 * flipped about its height; the drawing looks the same as the SVG.
 */
export function dielineToDxf(d: Dieline): string {
  const out: string[] = [];
  const pair = (code: number, value: string | number) => out.push(String(code), String(value));
  const flip = (p: Pt): Pt => [round3(p[0]), round3(d.height - p[1])];

  pair(0, "SECTION");
  pair(2, "HEADER");
  pair(9, "$ACADVER");
  pair(1, "AC1009");
  pair(9, "$INSUNITS");
  pair(70, 4);
  pair(9, "$MEASUREMENT");
  pair(70, 1);
  pair(9, "$EXTMIN");
  pair(10, 0);
  pair(20, 0);
  pair(9, "$EXTMAX");
  pair(10, round3(d.width));
  pair(20, round3(d.height));
  pair(0, "ENDSEC");

  pair(0, "SECTION");
  pair(2, "TABLES");
  pair(0, "TABLE");
  pair(2, "LTYPE");
  pair(70, 1);
  pair(0, "LTYPE");
  pair(2, "CONTINUOUS");
  pair(70, 0);
  pair(3, "Solid line");
  pair(72, 65);
  pair(73, 0);
  pair(40, 0);
  pair(0, "ENDTAB");
  pair(0, "TABLE");
  pair(2, "LAYER");
  pair(70, LAYER_ORDER.length);
  for (const name of LAYER_ORDER) {
    pair(0, "LAYER");
    pair(2, name);
    pair(70, 0);
    pair(62, LAYER_STYLE[name].dxfColor);
    pair(6, "CONTINUOUS");
  }
  pair(0, "ENDTAB");
  pair(0, "ENDSEC");

  pair(0, "SECTION");
  pair(2, "ENTITIES");
  for (const l of dielineLines(d)) {
    const layer = LAYER_OF[l.role];
    const e = l.edge;
    if (e.kind === "line") {
      const [x1, y1] = flip(e.from);
      const [x2, y2] = flip(e.to);
      pair(0, "LINE");
      pair(8, layer);
      pair(10, x1);
      pair(20, y1);
      pair(11, x2);
      pair(21, y2);
    } else if (e.kind === "arc") {
      // Flipping y negates angles; a clockwise (y-down) arc runs counter-clockwise in DXF from
      // `from` to `to` only after the flip reverses it, so its DXF start is at `to`.
      const { start, end } = arcAngles(e);
      const [cx, cy] = flip(e.center);
      pair(0, "ARC");
      pair(8, layer);
      pair(10, cx);
      pair(20, cy);
      pair(40, round3(e.radius));
      pair(50, e.clockwise ? deg(-end) : deg(-start));
      pair(51, e.clockwise ? deg(-start) : deg(-end));
    } else {
      pair(0, "POLYLINE");
      pair(8, layer);
      pair(66, 1);
      pair(10, 0);
      pair(20, 0);
      pair(70, 0);
      for (const p of flattenOpen(e, 0.05)) {
        const [x, y] = flip(p);
        pair(0, "VERTEX");
        pair(8, layer);
        pair(10, x);
        pair(20, y);
      }
      pair(0, "SEQEND");
      pair(8, layer);
    }
  }
  pair(0, "ENDSEC");
  pair(0, "EOF");
  return out.join("\n") + "\n";
}
