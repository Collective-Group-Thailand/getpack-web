import { DUST_FLAP_CLEARANCE_MM, GLUE_AREA_INSET_MM, TUCK_SHOULDER_MM } from "../constants";
import { face } from "../faces";
import type { FaceLabel } from "../labels";
import { arc, line, mapEdge, polygon, roundedRectangle } from "../path";
import type { Contour, Edge, EdgeRole, Face, FaceKind, Pt } from "../types";
import type { Attachment, Closure, Notch, PanelSpan } from "./tube";

/*
 * Closures draw in a local frame: the panels' edge is y = 0 and the closure grows upwards
 * (negative y). `buildTube` mirrors the bottom closure into place. Every attachment's base edge
 * runs exactly from (span[0], 0) to (span[1], 0) so the panel and the flap share it.
 */

const idOf = (end: "top" | "bottom", name: string) => `${name}-${end}`;

/** A tuck flap on the far edge of a lid: shoulders cut back, corners rounded. */
function tuckOutline(x0: number, x1: number, yBase: number, depth: number, radius: number): Edge[] {
  const sh = Math.min(TUCK_SHOULDER_MM, (x1 - x0) / 8, depth / 4);
  const yTop = yBase - depth;
  const left = x0 + sh;
  const right = x1 - sh;
  const r = Math.max(0, Math.min(radius, (right - left) / 2 - 0.01, depth - sh - 0.01));
  const out: Edge[] = [line([x1, yBase], [right, yBase - sh], "cut")];
  if (r > 0.01) {
    out.push(line([right, yBase - sh], [right, yTop + r], "cut"));
    out.push(arc([right, yTop + r], [right - r, yTop], [right - r, yTop + r], false, "cut"));
    out.push(line([right - r, yTop], [left + r, yTop], "cut"));
    out.push(arc([left + r, yTop], [left, yTop + r], [left + r, yTop + r], false, "cut"));
    out.push(line([left, yTop + r], [left, yBase - sh], "cut"));
  } else {
    out.push(line([right, yBase - sh], [right, yTop], "cut"));
    out.push(line([right, yTop], [left, yTop], "cut"));
    out.push(line([left, yTop], [left, yBase - sh], "cut"));
  }
  out.push(line([left, yBase - sh], [x0, yBase], "cut"));
  out.push(line([x0, yBase], [x1, yBase], "crease"));
  return out;
}

/**
 * A dust flap on a side panel. The edge next to the lid's panel is cut back so the flap slides
 * under the lid; the other edge only slightly.
 */
function dustFlap(
  end: "top" | "bottom",
  s: PanelSpan,
  reach: number,
  lidSide: "left" | "right",
  caliper: number,
): Attachment {
  const w = s.x1 - s.x0;
  const lidInset = Math.min(w / 3, DUST_FLAP_CLEARANCE_MM + caliper + reach * 0.15);
  const otherInset = Math.min(w / 4, reach * 0.1);
  const insetL = lidSide === "left" ? lidInset : otherInset;
  const insetR = lidSide === "right" ? lidInset : otherInset;
  const pts: Pt[] = [
    [s.x0, 0],
    [s.x0 + insetL, -reach],
    [s.x1 - insetR, -reach],
    [s.x1, 0],
  ];
  return {
    face: face(idOf(end, `dust-${s.id}`), "dust_flap", "dust_flap", polygon(pts, ["cut", "cut", "cut", "crease"])),
    span: [s.x0, s.x1],
  };
}

export interface TuckClosureSpec {
  /** Index of the panel the lid hinges on. */
  lidPanel: number;
  lidDepth: number;
  tuckDepth: number;
  tuckRadius: number;
  /** Panels that carry dust flaps. */
  dustPanels: number[];
  dustReach: number;
  caliper: number;
  /** Thumb notch radius on the panel opposite the lid (the one the tuck slides into); 0 for none. */
  thumbNotch?: number;
}

/** Lid + tuck on one panel, dust flaps on the sides — a tuck end closure. */
export function tuckClosure(spec: TuckClosureSpec): Closure {
  return ({ panels, end }) => {
    const lid = panels[spec.lidPanel];
    const y = -spec.lidDepth;
    const lidFace = face(idOf(end, "lid"), "lid", "lid", [
      line([lid.x0, 0], [lid.x0, y], "cut"),
      line([lid.x0, y], [lid.x1, y], "crease"),
      line([lid.x1, y], [lid.x1, 0], "cut"),
      line([lid.x1, 0], [lid.x0, 0], "crease"),
    ]);
    const tuck = face(
      idOf(end, "tuck"),
      "tuck",
      "tuck",
      tuckOutline(lid.x0, lid.x1, y, spec.tuckDepth, spec.tuckRadius),
    );
    const attachments: Attachment[] = [{ face: lidFace, span: [lid.x0, lid.x1] }];
    for (const i of spec.dustPanels) {
      const s = panels[i];
      // Which way the lid lies once folded: panels wrap round, so the last panel's right edge meets the first.
      const lidSide = (i + 1) % panels.length === spec.lidPanel ? "right" : "left";
      attachments.push(dustFlap(end, s, spec.dustReach, lidSide, spec.caliper));
    }
    const notches: Notch[] = [];
    if (spec.thumbNotch && spec.thumbNotch > 0) {
      const opposite = (spec.lidPanel + 2) % panels.length;
      const s = panels[opposite];
      const r = Math.min(spec.thumbNotch, (s.x1 - s.x0) / 4);
      notches.push({ panel: opposite, center: (s.x0 + s.x1) / 2, radius: r });
    }
    // The tuck hangs off the lid, not off a panel.
    return { attachments, faces: [tuck], notches };
  };
}

export interface SlottedFlapsSpec {
  /** Flap depth per panel index. */
  depths: number[];
  /** Slot width between neighbouring flaps (0 = a single slit). */
  slot: number;
  /** Face label per panel index, or one for all. */
  labels?: FaceLabel[] | FaceLabel;
  /** Panels whose flap carries a glue area (seal ends). */
  glue?: number[];
  /** Face kind; dust flaps close before the flaps that lie over them. */
  kinds?: FaceKind[];
  /** Holes in a flap (a window in a seal end's outer flap), in the closure's local frame. */
  holes?: (index: number, x0: number, x1: number, depth: number) => Contour[];
}

/**
 * A flap on every panel, separated by slots — the closure of the slotted-container family and
 * of seal ends. With a zero slot, neighbouring flaps share their slit; where one is deeper, its
 * side is split at the shallower flap's depth so the shared part is one line, not two.
 */
export function slottedFlaps(spec: SlottedFlapsSpec): Closure {
  return ({ panels, end }) => {
    const half = spec.slot / 2;
    const last = panels.length - 1;
    const attachments: Attachment[] = panels.map((s, i) => {
      const a = i === 0 ? s.x0 : s.x0 + half;
      const b = i === last ? s.x1 : s.x1 - half;
      const d = spec.depths[i];
      const left = spec.slot === 0 && i > 0 ? spec.depths[i - 1] : Infinity;
      const right = spec.slot === 0 && i < last ? spec.depths[i + 1] : Infinity;
      const pts: Pt[] = [[a, 0]];
      if (left < d - 1e-9) pts.push([a, -left]);
      pts.push([a, -d], [b, -d]);
      if (right < d - 1e-9) pts.push([b, -right]);
      pts.push([b, 0]);
      const roles: EdgeRole[] = pts.map((_, k) => (k === pts.length - 1 ? "crease" : "cut"));
      const label = Array.isArray(spec.labels)
        ? spec.labels[i]
        : (spec.labels ?? (end === "top" ? "top_flap" : "bottom_flap"));
      const inset = Math.min(GLUE_AREA_INSET_MM, (b - a) / 4, d / 4);
      const marks = spec.glue?.includes(i)
        ? polygon(
            [
              [a + inset, -inset],
              [b - inset, -inset],
              [b - inset, -d + inset],
              [a + inset, -d + inset],
            ],
            "glue_area",
          )
        : [];
      return {
        face: face(idOf(end, `flap-${s.id}`), label, spec.kinds?.[i] ?? "flap", polygon(pts, roles), {
          marks,
          holes: spec.holes?.(i, a, b, d) ?? [],
        }),
        span: [a, b],
      };
    });
    return { attachments };
  };
}

/** A flap on a panel whose sides lean in by `inset` over its depth. */
function trapezoid(
  id: string,
  label: FaceLabel,
  kind: FaceKind,
  s: PanelSpan,
  depth: number,
  insetL: number,
  insetR: number,
) {
  return face(
    id,
    label,
    kind,
    polygon(
      [
        [s.x0, 0],
        [s.x0 + insetL, -depth],
        [s.x1 - insetR, -depth],
        [s.x1, 0],
      ],
      ["cut", "cut", "cut", "crease"],
    ),
  );
}

export interface SnapLockSpec {
  /** The tongue past the centre line (legacy `b`: 3 / 5 / 10 mm by width). */
  tongue: number;
  /** Clearance around the tongue in the opposite flap's notch. */
  clearance: number;
}

/**
 * A snap-lock ("1-2-3") bottom on a four-panel tube: the front and back flaps meet at the centre,
 * the front one's tongue passing into a notch in the back one; the side flaps fold in underneath.
 * ⚠ Simplified locking geometry — prepress to confirm against a die sample.
 */
export function snapLockClosure(spec: SnapLockSpec): Closure {
  return ({ panels, end }) => {
    const [front, right, back, left] = panels;
    const side = right.x1 - right.x0;
    const h = side / 2;
    const lock = (s: PanelSpan, kind: "tongue" | "notch"): Attachment => {
      const len = s.x1 - s.x0;
      const ch = Math.min(h * 0.5, len * 0.15);
      const tw = len * 0.4;
      const xm = (s.x0 + s.x1) / 2;
      const b = Math.min(spec.tongue, h * 0.6);
      const half = tw / 2 + (kind === "notch" ? spec.clearance : 0);
      const tip = kind === "tongue" ? -h - b : -h + b;
      const pts: Pt[] = [
        [s.x0, 0],
        [s.x0 + ch, -h],
        [xm - half, -h],
        [xm - half, tip],
        [xm + half, tip],
        [xm + half, -h],
        [s.x1 - ch, -h],
        [s.x1, 0],
      ];
      return {
        face: face(
          idOf(end, `lock-${s.id}`),
          "lock_flap",
          "lock",
          polygon(pts, [...pts.slice(1).map(() => "cut" as const), "crease"]),
        ),
        span: [s.x0, s.x1],
      };
    };
    const sideFlap = (s: PanelSpan): Attachment => {
      const depth = Math.min((front.x1 - front.x0) * 0.45, (s.x1 - s.x0) * 0.9);
      const e = Math.min(depth, (s.x1 - s.x0) / 3) * 0.5;
      return {
        face: trapezoid(idOf(end, `lock-${s.id}`), "lock_flap", "dust_flap", s, depth, e, e),
        span: [s.x0, s.x1],
      };
    };
    return { attachments: [lock(front, "tongue"), sideFlap(right), lock(back, "notch"), sideFlap(left)] };
  };
}

/**
 * A crash-lock (auto) bottom: the side flaps carry a 45° crease and a glue area that the
 * factory glues to the front and back flaps, so the bottom snaps square when the tube is opened.
 * ⚠ Simplified hook geometry — prepress to confirm against a die sample.
 */
export function crashLockClosure(): Closure {
  return ({ panels, end }) => {
    const side = panels[1].x1 - panels[1].x0;
    const attachments: Attachment[] = panels.map((s, i) => {
      const w = s.x1 - s.x0;
      if (i % 2 === 0) {
        // Front / back: half the width plus an overlap, the leading corner cut back.
        const h = side / 2 + Math.min(side * 0.25, 15);
        const lead = Math.min(h * 0.4, w * 0.3);
        const pts: Pt[] = [
          [s.x0, 0],
          [s.x0, -h + lead],
          [s.x0 + lead, -h],
          [s.x1 - Math.min(2, w / 10), -h],
          [s.x1, 0],
        ];
        return {
          face: face(
            idOf(end, `crash-${s.id}`),
            "crash_flap",
            "lock",
            polygon(pts, ["cut", "cut", "cut", "cut", "crease"]),
          ),
          span: [s.x0, s.x1],
        };
      }
      const h = Math.min(side / 2, w);
      const e = Math.min(2, w / 10);
      const pts: Pt[] = [
        [s.x0, 0],
        [s.x0, -h],
        [s.x1 - e, -h],
        [s.x1, 0],
      ];
      // The 45° crease from the base corner, and glue on the triangle beyond it.
      const diagonal = Math.min(h, w - e);
      const marks: Edge[] = [line([s.x0, 0], [s.x0 + diagonal, -diagonal], "crease")];
      if (diagonal > 12) {
        marks.push(
          ...polygon(
            [
              [s.x0 + 2, -5],
              [s.x0 + 2, -h + 2],
              [s.x0 + Math.min(diagonal, h) - 5, -h + 2],
            ],
            "glue_area",
          ),
        );
      }
      return {
        face: face(idOf(end, `crash-${s.id}`), "crash_flap", "flap", polygon(pts, ["cut", "cut", "cut", "crease"]), {
          marks,
        }),
        span: [s.x0, s.x1],
      };
    });
    return { attachments };
  };
}

export interface GableSpec {
  /** Slope length of each roof panel. */
  roof: number;
  /** Height of the gable ends' apex above the panels. */
  apex: number;
  /** Handle panel height above the ridge, and its hand hole. */
  handle: number;
  hole: { width: number; height: number };
}

/**
 * A gable top: roof panels on the front and back rise to a ridge, the side panels end in gable
 * triangles, and a handle panel on each roof panel stands up back to back with a hand hole.
 */
export function gableClosure(spec: GableSpec): Closure {
  return ({ panels, end }) => {
    const attachments: Attachment[] = [];
    const faces: Face[] = [];
    const profiles: Record<number, Pt[]> = {};
    panels.forEach((s, i) => {
      if (i % 2 === 1) {
        profiles[i] = [[(s.x0 + s.x1) / 2, -spec.apex]];
        return;
      }
      const roof = face(idOf(end, `roof-${s.id}`), "roof", "lid", [
        line([s.x0, 0], [s.x0, -spec.roof], "cut"),
        line([s.x0, -spec.roof], [s.x1, -spec.roof], "crease"),
        line([s.x1, -spec.roof], [s.x1, 0], "cut"),
        line([s.x1, 0], [s.x0, 0], "crease"),
      ]);
      attachments.push({ face: roof, span: [s.x0, s.x1] });
      const y0 = -spec.roof;
      const y1 = y0 - spec.handle;
      const hw = Math.min(spec.hole.width, (s.x1 - s.x0) * 0.6);
      const hh = Math.min(spec.hole.height, spec.handle * 0.5);
      const cx = (s.x0 + s.x1) / 2;
      const cy = y0 - spec.handle * 0.55;
      faces.push(
        face(
          idOf(end, `handle-${s.id}`),
          "handle",
          "handle",
          [
            line([s.x0, y0], [s.x0, y1], "cut"),
            line([s.x0, y1], [s.x1, y1], "cut"),
            line([s.x1, y1], [s.x1, y0], "cut"),
            line([s.x1, y0], [s.x0, y0], "crease"),
          ],
          { holes: [roundedRectangle(cx - hw / 2, cy - hh / 2, hw, hh, hh / 2)] },
        ),
      );
    });
    return { attachments, faces, profiles };
  };
}

export interface PolygonLidSpec {
  panel: number;
  /** Lid outline points after the base edge, in the local frame (x from the panel, y up = negative). */
  points: (s: PanelSpan) => Pt[];
  /** Index into `points` where the tuck edge starts (it runs to the next point). */
  tuckEdge: number;
  tuckDepth: number;
  tuckRadius: number;
}

/** A lid of any polygon on one panel's edge with a tuck on one of its far edges — the hexagonal box. */
export function polygonLid(spec: PolygonLidSpec): Closure {
  return ({ panels, end }) => {
    const s = panels[spec.panel];
    const rest = spec.points(s);
    const pts: Pt[] = [[s.x1, 0], ...rest, [s.x0, 0]];
    const roles: EdgeRole[] = pts.map((_, k) =>
      k === pts.length - 1 ? "crease" : k === spec.tuckEdge + 1 ? "crease" : "cut",
    );
    const lid = face(idOf(end, "lid"), "lid", "lid", polygon(pts, roles));
    // The tuck, on the edge from pts[t] to pts[t + 1] (walked backwards so it lies outside the lid).
    const a = pts[spec.tuckEdge + 1];
    const b = pts[spec.tuckEdge + 2];
    const tuck = tuckOnEdge(idOf(end, "tuck"), b, a, spec.tuckDepth, spec.tuckRadius);
    return { attachments: [{ face: lid, span: [s.x0, s.x1] }], faces: [tuck] };
  };
}

/** A tuck hinged on the segment a → b, lying to its left (y-down frame), shoulders and corners as a tuck. */
export function tuckOnEdge(id: string, a: Pt, b: Pt, depth: number, radius: number) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  // Left normal in the y-down frame.
  const nx = uy;
  const ny = -ux;
  const local = tuckOutline(0, len, 0, depth, radius);
  const map = (p: Pt): Pt => [a[0] + p[0] * ux - p[1] * nx, a[1] + p[0] * uy - p[1] * ny];
  return face(
    id,
    "tuck",
    "tuck",
    local.map((e) => mapEdge(e, map)),
  );
}

export interface AirplaneClosureSpec {
  /** Index of the panel the lid hinges on. */
  lidPanel: number;
  lidDepth: number;
  tuckDepth: number;
  tuckRadius: number;
  /** How far the wings hang down inside the box. */
  wingReach: number;
  caliper: number;
}

/**
 * An airplane-style tuck end: the lid hinges on one panel with a tuck on its far edge, and its
 * dust flaps — the "wings" — hinge on the lid's own sides and fold down inside the box along the
 * side panels, which carry no flaps of their own. ⚠ Wing proportions to be confirmed by Prepress.
 */
export function airplaneClosure(spec: AirplaneClosureSpec): Closure {
  return ({ panels, end }) => {
    const lid = panels[spec.lidPanel];
    const y = -spec.lidDepth;
    const lidFace = face(idOf(end, "lid"), "lid", "lid", [
      line([lid.x0, 0], [lid.x0, y], "crease"),
      line([lid.x0, y], [lid.x1, y], "crease"),
      line([lid.x1, y], [lid.x1, 0], "crease"),
      line([lid.x1, 0], [lid.x0, 0], "crease"),
    ]);
    const tuck = face(
      idOf(end, "tuck"),
      "tuck",
      "tuck",
      tuckOutline(lid.x0, lid.x1, y, spec.tuckDepth, spec.tuckRadius),
    );
    const reach = spec.wingReach;
    // Cut back at the panel corner (the wing must clear the side panel's crease) and at the tuck.
    const nearPanel = Math.min(reach * 0.3 + spec.caliper, spec.lidDepth / 4);
    const nearTuck = Math.min(reach * 0.15 + spec.caliper, spec.lidDepth / 4);
    const wing = (side: "left" | "right"): Face => {
      const x = side === "left" ? lid.x0 : lid.x1;
      const out = side === "left" ? x - reach : x + reach;
      const pts: Pt[] =
        side === "left"
          ? [
              [x, 0],
              [out, -nearPanel],
              [out, y + nearTuck],
              [x, y],
            ]
          : [
              [x, y],
              [out, y + nearTuck],
              [out, -nearPanel],
              [x, 0],
            ];
      return face(idOf(end, `wing-${side}`), "dust_flap", "dust_flap", polygon(pts, ["cut", "cut", "cut", "crease"]));
    };
    return {
      attachments: [{ face: lidFace, span: [lid.x0, lid.x1] }],
      faces: [tuck, wing("left"), wing("right")],
    };
  };
}

/**
 * A four-flap end: a flap on every panel, cut at 45° so the four tile the end exactly and meet
 * along its diagonals. Folded in turn they lie flat and hold each other closed.
 * ⚠ Simplified — the interlocking hooks of a production four-flap lock come from a die sample
 * (Prepress); this draws the flaps' footprint.
 */
export function fourFlapClosure(): Closure {
  return ({ panels, end }) => {
    const widths = panels.map((s) => s.x1 - s.x0);
    const d = Math.min(...widths) / 2;
    const attachments: Attachment[] = panels.map((s) => {
      const w = s.x1 - s.x0;
      const reach = Math.min(d, w / 2);
      const pts: Pt[] =
        w - 2 * reach > 0.05
          ? [
              [s.x0, 0],
              [s.x0 + reach, -reach],
              [s.x1 - reach, -reach],
              [s.x1, 0],
            ]
          : [
              [s.x0, 0],
              [(s.x0 + s.x1) / 2, -reach],
              [s.x1, 0],
            ];
      const roles: EdgeRole[] = pts.map((_, k) => (k === pts.length - 1 ? "crease" : "cut"));
      return {
        face: face(idOf(end, `lock-${s.id}`), "lock_flap", "lock", polygon(pts, roles)),
        span: [s.x0, s.x1],
      };
    });
    return { attachments };
  };
}
