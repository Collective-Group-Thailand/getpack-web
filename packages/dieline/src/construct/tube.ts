import { GLUE_AREA_INSET_MM, GLUE_FLAP_TAPER_DEG } from "../constants";
import { face } from "../faces";
import type { FaceLabel } from "../labels";
import { arc, line, mapEdge, mirrorX, polygon } from "../path";
import type { Contour, Edge, EdgeRole, Face, Pt } from "../types";

/**
 * A tube of panels side by side — the construction behind tuck ends, lock bottoms, seal ends,
 * slotted containers and sleeves:
 *
 *        [ top closure faces ]
 *   glue | P0 | P1 | P2 | P3      ← panels, `depth` tall, folding into a tube
 *        [ bottom closure faces ]
 *
 * Coordinates: panel tops at y = 0, bottoms at y = depth; the glue flap occupies x ∈ [0, glue].
 * Closures are drawn in a local frame whose base line is y = 0 and which grows upwards
 * (negative y); the bottom closure is the same drawing mirrored below the panels.
 */

export interface TubePanel {
  id: string;
  label: FaceLabel;
  width: number;
}

export interface PanelSpan {
  id: string;
  label: FaceLabel;
  index: number;
  x0: number;
  x1: number;
}

/** A face hinged on a panel's top (or bottom) edge between `span[0]` and `span[1]`. */
export interface Attachment {
  face: Face;
  span: [number, number];
  /** The hinge role; `crease` unless the construction says otherwise. */
  role?: EdgeRole;
}

/** A half-round cut into a panel's free top edge — the thumb notch of a tuck box. */
export interface Notch {
  panel: number;
  center: number;
  radius: number;
}

export interface ClosureContext {
  panels: PanelSpan[];
  /** `top` or `bottom`; closures use it to name their faces. */
  end: "top" | "bottom";
}

/**
 * What a closure adds: faces hinged on the panels, faces hinged on those (a tuck on its lid),
 * notches in free panel edges, and **profiles** — a free panel edge that is not straight (a
 * gable end rising to its apex), as the points between the panel's two corners.
 */
export type Closure = (ctx: ClosureContext) => {
  attachments: Attachment[];
  faces?: Face[];
  notches?: Notch[];
  profiles?: Record<number, Pt[]>;
};

export interface TubeSpec {
  panels: TubePanel[];
  depth: number;
  /** Glue flap width; 0 or absent for none. It sits left of the first panel before any mirroring. */
  glue?: number;
  /** False for a stitched joint: the flap is stapled, not glued, so no glue area is marked. */
  glueMarks?: boolean;
  /** The glue flap's face id (default `glue`) — unique when a dieline has two tubes. */
  glueId?: string;
  /** Put the glue flap on the right: the whole blank is mirrored (the box is the same, seam at the other corner). */
  glueRight?: boolean;
  top?: Closure;
  bottom?: Closure;
  /** Holes per panel, drawn in the tube frame (after glue offset, before mirroring). */
  holes?: (panel: PanelSpan & { y0: number; y1: number }) => Contour[];
  /** Lines per panel that do not cut it out (perforations, adhesive strips), in the same frame. */
  marks?: (panel: PanelSpan & { y0: number; y1: number }) => Edge[];
}

/** Edges along a panel's top edge from x0 to x1 at y, creased under attachments, cut elsewhere. */
function edgeRun(
  x0: number,
  x1: number,
  y: number,
  spans: { span: [number, number]; role: EdgeRole }[],
  notches: Notch[],
  notchInto: 1 | -1,
  profile?: Pt[],
): Edge[] {
  if (profile && profile.length) {
    // A shaped free edge: straight cuts through the profile points.
    const pts: Pt[] = [[x0, y], ...profile, [x1, y]];
    return pts.slice(1).map((p, i) => line(pts[i], p, "cut"));
  }
  const out: Edge[] = [];
  let cursor = x0;
  const sorted = [...spans].sort((a, b) => a.span[0] - b.span[0]);
  const freeRun = (a: number, b: number) => {
    if (b - a < 1e-9) return;
    const inside = notches
      .filter((n) => n.center - n.radius > a + 1e-9 && n.center + n.radius < b - 1e-9)
      .sort((p, q) => p.center - q.center);
    let at = a;
    for (const n of inside) {
      out.push(line([at, y], [n.center - n.radius, y], "cut"));
      // Half circle into the panel: through (center, y + radius × notchInto).
      out.push(arc([n.center - n.radius, y], [n.center + n.radius, y], [n.center, y], notchInto === -1, "cut"));
      at = n.center + n.radius;
    }
    out.push(line([at, y], [b, y], "cut"));
  };
  for (const s of sorted) {
    freeRun(cursor, s.span[0]);
    out.push(line([s.span[0], y], [s.span[1], y], s.role));
    cursor = s.span[1];
  }
  freeRun(cursor, x1);
  return out;
}

const reversed = (edges: Edge[]): Edge[] =>
  [...edges]
    .reverse()
    .map((e) =>
      e.kind === "arc"
        ? { ...e, from: e.to, to: e.from, clockwise: !e.clockwise }
        : e.kind === "line"
          ? { ...e, from: e.to, to: e.from }
          : { ...e, from: e.to, to: e.from, c1: e.c2, c2: e.c1 },
    );

export function glueFlap(id: string, x: number, width: number, depth: number, side: "left" | "right"): Face {
  const taper = Math.min(width * Math.tan((GLUE_FLAP_TAPER_DEG * Math.PI) / 180), depth / 4);
  const outer = side === "left" ? x - width : x + width;
  const pts: Pt[] =
    side === "left"
      ? [
          [x, 0],
          [outer, taper],
          [outer, depth - taper],
          [x, depth],
        ]
      : [
          [x, depth],
          [outer, depth - taper],
          [outer, taper],
          [x, 0],
        ];
  const inset = Math.min(GLUE_AREA_INSET_MM, width / 4);
  const gx0 = Math.min(x, outer) + inset;
  const gx1 = Math.max(x, outer) - inset;
  const marks =
    gx1 - gx0 > 1 && depth - 2 * (taper + inset) > 1
      ? polygon(
          [
            [gx0, taper + inset],
            [gx1, taper + inset],
            [gx1, depth - taper - inset],
            [gx0, depth - taper - inset],
          ],
          "glue_area",
        )
      : [];
  return face(id, "glue_flap", "glue_flap", polygon(pts, ["cut", "cut", "cut", "crease"]), { marks });
}

/** Builds the faces of a tube with its closures. */
export function buildTube(spec: TubeSpec): Face[] {
  const glue = spec.glue ?? 0;
  const spans: PanelSpan[] = [];
  let x = glue;
  spec.panels.forEach((p, index) => {
    spans.push({ id: p.id, label: p.label, index, x0: x, x1: x + p.width });
    x += p.width;
  });
  const depth = spec.depth;
  const faces: Face[] = [];

  const top = spec.top?.({ panels: spans, end: "top" }) ?? { attachments: [] };
  const bottomLocal = spec.bottom?.({ panels: spans, end: "bottom" }) ?? { attachments: [] };
  // Mirror the bottom closure below the panels.
  const flipDown = (p: Pt): Pt => [p[0], depth - p[1]];
  const down = (f: Face): Face => ({
    ...f,
    outline: f.outline.map((e) => mapEdge(e, flipDown, true)),
    holes: f.holes.map((h) => h.map((e) => mapEdge(e, flipDown, true))),
    marks: f.marks.map((e) => mapEdge(e, flipDown, true)),
  });
  const bottom = {
    attachments: bottomLocal.attachments.map((a) => ({ ...a, face: down(a.face) })),
    faces: (bottomLocal.faces ?? []).map(down),
    notches: bottomLocal.notches ?? [],
    profiles: Object.fromEntries(
      Object.entries(bottomLocal.profiles ?? {}).map(([k, pts]) => [k, pts.map(flipDown)]),
    ) as Record<number, Pt[]>,
  };

  if (glue > 0) {
    const flap = glueFlap(spec.glueId ?? "glue", glue, glue, depth, "left");
    faces.push(spec.glueMarks === false ? { ...flap, marks: [] } : flap);
  }

  for (const s of spans) {
    const within = (a: Attachment) => a.span[0] >= s.x0 - 1e-9 && a.span[1] <= s.x1 + 1e-9;
    const topSpans = top.attachments.filter(within).map((a) => ({ span: a.span, role: a.role ?? "crease" }));
    const bottomSpans = bottom.attachments.filter(within).map((a) => ({ span: a.span, role: a.role ?? "crease" }));
    const hasLeft = s.index > 0 || glue > 0;
    const hasRight = s.index < spans.length - 1;
    const outline: Edge[] = [
      ...edgeRun(
        s.x0,
        s.x1,
        0,
        topSpans,
        (top.notches ?? []).filter((n) => n.panel === s.index),
        1,
        top.profiles?.[s.index],
      ),
      line([s.x1, 0], [s.x1, depth], hasRight ? "crease" : "cut"),
      ...reversed(
        edgeRun(
          s.x0,
          s.x1,
          depth,
          bottomSpans,
          bottom.notches.filter((n) => n.panel === s.index),
          -1,
          bottom.profiles[s.index],
        ),
      ),
      line([s.x0, depth], [s.x0, 0], hasLeft ? "crease" : "cut"),
    ];
    const holes = spec.holes?.({ ...s, y0: 0, y1: depth }) ?? [];
    const marks = spec.marks?.({ ...s, y0: 0, y1: depth }) ?? [];
    faces.push(face(s.id, s.label, "panel", outline, marks.length ? { holes, marks } : { holes }));
  }
  faces.push(...top.attachments.map((a) => a.face), ...(top.faces ?? []));
  faces.push(...bottom.attachments.map((a) => a.face), ...bottom.faces);

  if (!spec.glueRight) return faces;
  const width = x;
  const mirror = mirrorX(width / 2);
  return faces.map((f) => ({
    ...f,
    outline: f.outline.map((e) => mapEdge(e, mirror, true)),
    holes: f.holes.map((h) => h.map((e) => mapEdge(e, mirror, true))),
    marks: f.marks.map((e) => mapEdge(e, mirror, true)),
  }));
}
