import {
  allFaces,
  faceBounds,
  flattenContour,
  mirrorDieline,
  pointInPolygon,
  type Dieline,
  type Pt,
} from "@packio/dieline";

import type { DesignContent, DesignElement } from "../types";
import { elementCorners, localSize, type Box } from "./geometry";

/** A face's bounds by id, and the sheet's. */
function frame(d: Dieline) {
  const faces = allFaces(d).map((f) => ({ id: f.id, bounds: faceBounds(f), poly: flattenContour(f.outline, 0.5) }));
  return { faces, sheet: { x: 0, y: 0, width: d.width, height: d.height } satisfies Box };
}

/**
 * The design re-fitted to a new size of its box (U4.8, "duplicate to a new size"): each element keeps
 * its place on its face — the point it is centred on, as a fraction of the face — and grows or
 * shrinks with the face, by the smaller of the face's two ratios so nothing is distorted; an element
 * on no face keeps its place on the sheet the same way. Rotation, colours and text are untouched; the
 * inside's elements are fitted on the mirrored die they are drawn on. Pure; the checks re-run on
 * the result like on any edit.
 */
export function refitContent(content: DesignContent, from: Dieline, to: Dieline): DesignContent {
  const frames = {
    outside: [frame(from), frame(to)] as const,
    inside: [frame(mirrorDieline(from)), frame(mirrorDieline(to))] as const,
  };
  const elements = content.elements.map((el): DesignElement => {
    const [before, after] = frames[el.side === "inside" ? "inside" : "outside"];
    const corners = elementCorners(el, localSize(el));
    const centre: Pt = [
      corners.reduce((s, p) => s + p[0], 0) / corners.length,
      corners.reduce((s, p) => s + p[1], 0) / corners.length,
    ];
    const faceId = el.clipFaceId ?? before.faces.find((f) => pointInPolygon(centre, f.poly))?.id ?? null;
    const b0 = (faceId && before.faces.find((f) => f.id === faceId)?.bounds) || before.sheet;
    const found = faceId ? after.faces.find((f) => f.id === faceId)?.bounds : undefined;
    const b1 = found ?? after.sheet;
    const a = found || !faceId ? b0 : before.sheet;
    if (a.width <= 0 || a.height <= 0) return el;
    const k = Math.min(b1.width / a.width, b1.height / a.height);
    const target: Pt = [
      b1.x + ((centre[0] - a.x) / a.width) * b1.width,
      b1.y + ((centre[1] - a.y) / a.height) * b1.height,
    ];
    // The origin keeps its offset from the centre, scaled with the element (its rotation is kept).
    return {
      ...el,
      x: target[0] - (centre[0] - el.x) * k,
      y: target[1] - (centre[1] - el.y) * k,
      scaleX: el.scaleX * k,
      scaleY: el.scaleY * k,
    };
  });
  return { ...content, elements };
}
