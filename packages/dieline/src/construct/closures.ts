import { DUST_FLAP_CLEARANCE_MM, TUCK_SHOULDER_MM } from "../constants";
import { face } from "../faces";
import { arc, line, polygon } from "../path";
import type { Edge, Pt } from "../types";
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
  label?: "top_flap" | "bottom_flap" | "outer_flap" | "inner_flap";
}

/** A flap on every panel, separated by slots — the closure of the slotted-container family. */
export function slottedFlaps(spec: SlottedFlapsSpec): Closure {
  return ({ panels, end }) => {
    const half = spec.slot / 2;
    const last = panels.length - 1;
    const attachments: Attachment[] = panels.map((s, i) => {
      const a = i === 0 ? s.x0 : s.x0 + half;
      const b = i === last ? s.x1 : s.x1 - half;
      const d = spec.depths[i];
      const label = spec.label ?? (end === "top" ? "top_flap" : "bottom_flap");
      return {
        face: face(
          idOf(end, `flap-${s.id}`),
          label,
          "flap",
          polygon(
            [
              [a, 0],
              [a, -d],
              [b, -d],
              [b, 0],
            ],
            ["cut", "cut", "cut", "crease"],
          ),
        ),
        span: [a, b],
      };
    });
    return { attachments };
  };
}
