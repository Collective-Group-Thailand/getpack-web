import { allFaces, faceBounds, flattenContour, pointInPolygon, type Dieline } from "@getpack/dieline";

import type { Box } from "../../lib/geometry";
import type { DesignElement, ImageElement } from "../../types";

/** 1 pt in mm. Text sizes are stored in mm (document unchanged); the Studio shows points. */
export const MM_PER_PT = 25.4 / 72;
export const ptOf = (mm: number) => mm / MM_PER_PT;
export const mmOfPt = (pt: number) => pt * MM_PER_PT;

/** The face (panel) the box's centre is on, with its bounds — a panel name for the inspector, a frame for placing. */
export function faceOfBox(dieline: Dieline | null, box: Box): { id: string; bounds: Box } | null {
  if (!dieline) return null;
  const centre: [number, number] = [box.x + box.width / 2, box.y + box.height / 2];
  for (const face of allFaces(dieline)) {
    if (pointInPolygon(centre, flattenContour(face.outline, 0.5))) return { id: face.id, bounds: faceBounds(face) };
  }
  return null;
}

/** Where a 9-cell position puts the box inside the frame, `margin` mm from its edges — as a move. */
export function placeIn(box: Box, frame: Box, cell: number, margin: number): { dx: number; dy: number } {
  const col = cell % 3;
  const row = Math.floor(cell / 3);
  const left = frame.x + margin;
  const top = frame.y + margin;
  const right = frame.x + frame.width - margin - box.width;
  const bottom = frame.y + frame.height - margin - box.height;
  const x = col === 0 ? left : col === 2 ? right : frame.x + (frame.width - box.width) / 2;
  const y = row === 0 ? top : row === 2 ? bottom : frame.y + (frame.height - box.height) / 2;
  return { dx: x - box.x, dy: y - box.y };
}

/** The image's effective resolution where it is placed, crop included (pixels per printed inch). */
export function effectivePpi(el: ImageElement): number | null {
  if (!el.naturalWidth || !el.naturalHeight) return null;
  const crop = el.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const inches = (mm: number) => mm / 25.4;
  return Math.floor(
    Math.min(
      (el.naturalWidth * crop.width) / inches(el.width * Math.abs(el.scaleX)),
      (el.naturalHeight * crop.height) / inches(el.height * Math.abs(el.scaleY)),
    ),
  );
}

/** The inspector's type word for an element (`designer.shell.type.*`). */
export function typeKey(el: DesignElement): string {
  if (el.type === "code") return el.kind === "qr" ? "qr" : "barcode";
  if (el.type === "shape" && el.open) return "line";
  if (el.type === "rect" || el.type === "circle") return "shape";
  return el.type;
}
