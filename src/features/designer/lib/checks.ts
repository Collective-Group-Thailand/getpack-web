import { pointInPolygon, type Pt } from "@packio/dieline";

import type { DesignElement } from "../types";
import { EAN_MIN_WIDTH_MM, ean13Modules, qrMatrix, QR_MIN_MODULE_MM } from "./codes";
import { boxOf, segmentHitsPolygon } from "./geometry";

/**
 * The designer's real-time checks (F4 Part D): what would make a print file fail preflight or print
 * badly, found while the customer designs, each tied to the element so a click selects it.
 * Thresholds come from the artwork rules (settings, D-070) where the rules name them.
 */
export type IssueCode =
  | "text_in_danger_zone"
  | "small_text"
  | "thin_stroke"
  | "low_resolution"
  | "crosses_fold"
  | "on_glue_area"
  | "missing_bleed"
  | "off_sheet"
  | "code_invalid"
  | "code_too_small";

export interface DesignIssue {
  code: IssueCode;
  severity: "warning" | "error";
  elementId: string;
  /** Numbers for the message: effective dpi, size in mm… */
  data?: Record<string, number>;
}

/** Below this printed height a glyph stops holding an edge on board — about 6 pt. */
export const MIN_TEXT_MM = 2.1;
/** A stroke thinner than 0.25 pt may break up in print. */
export const MIN_STROKE_MM = 0.088;

export interface CheckInput {
  elements: DesignElement[];
  /** Each element's four corners on the sheet. */
  cornersOf: (el: DesignElement) => Pt[];
  /** Per face: its safe zone (largest polygon first; the rest are holes, e.g. around a window). */
  safeZones: Pt[][][];
  /** Every crease, perforation and half-cut as a segment (curves as chords). */
  folds: [Pt, Pt][];
  glueAreas: Pt[][];
  /** Each piece's outer outline (flattened). */
  outlines: Pt[][];
  bleedMm: number;
  minDpi: number;
}

function insideSafeZone(corners: Pt[], zones: Pt[][][]): boolean {
  return zones.some(([outer, ...holes]) => {
    if (!outer) return false;
    return corners.every((c) => pointInPolygon(c, outer) && !holes.some((h) => pointInPolygon(c, h)));
  });
}

function grow(corners: Pt[], mm: number): Pt[] {
  const b = boxOf(corners);
  return [
    [b.x - mm, b.y - mm],
    [b.x + b.width + mm, b.y - mm],
    [b.x + b.width + mm, b.y + b.height + mm],
    [b.x - mm, b.y + b.height + mm],
  ];
}

export function designIssues(input: CheckInput): DesignIssue[] {
  const out: DesignIssue[] = [];
  for (const el of input.elements) {
    const corners = input.cornersOf(el);
    // On the sheet if a corner is inside a piece, or a piece's point is inside the element.
    const onSheet = input.outlines.some(
      (o) => corners.some((c) => pointInPolygon(c, o)) || o.some((p) => segmentHitsPolygon(p, p, corners)),
    );
    if (!onSheet) {
      out.push({ code: "off_sheet", severity: "warning", elementId: el.id });
      continue;
    }
    const exact = el.type === "text" || el.type === "code";
    if (exact && !insideSafeZone(corners, input.safeZones))
      out.push({ code: "text_in_danger_zone", severity: "warning", elementId: el.id });
    if (exact && input.folds.some(([a, b]) => segmentHitsPolygon(a, b, corners))) {
      out.push({ code: "crosses_fold", severity: "warning", elementId: el.id });
    }
    if (
      input.glueAreas.some(
        (g) => g.some((p) => pointInPolygon(p, corners)) || corners.some((c) => pointInPolygon(c, g)),
      )
    ) {
      out.push({ code: "on_glue_area", severity: "warning", elementId: el.id });
    }
    if (el.type === "text" && el.fontSize * el.scaleY < MIN_TEXT_MM) {
      out.push({
        code: "small_text",
        severity: "warning",
        elementId: el.id,
        data: { mm: Math.round(el.fontSize * el.scaleY * 10) / 10 },
      });
    }
    if (
      (el.type === "rect" || el.type === "circle" || el.type === "shape") &&
      el.strokeWidth > 0 &&
      el.strokeWidth * Math.min(el.scaleX, el.scaleY) < MIN_STROKE_MM
    ) {
      out.push({ code: "thin_stroke", severity: "warning", elementId: el.id });
    }
    if (el.type === "image" && el.naturalWidth) {
      const shownWidthIn = (el.width * el.scaleX * (el.crop?.width ?? 1)) / 25.4;
      const dpi = Math.round((el.naturalWidth * (el.crop?.width ?? 1)) / shownWidthIn);
      if (dpi < input.minDpi) {
        out.push({
          code: "low_resolution",
          severity: dpi < input.minDpi / 2 ? "error" : "warning",
          elementId: el.id,
          data: { dpi, min: input.minDpi },
        });
      }
    }
    // Artwork reaching towards a cut should run past it by the bleed: inside the outline, but
    // the box grown by the bleed pokes out.
    if (el.type !== "text" && el.type !== "code") {
      const inside = input.outlines.some((o) => corners.every((c) => pointInPolygon(c, o)));
      const grown = grow(corners, input.bleedMm);
      if (
        inside &&
        input.outlines.some(
          (o) => grown.some((c) => !pointInPolygon(c, o)) && corners.every((c) => pointInPolygon(c, o)),
        )
      ) {
        out.push({ code: "missing_bleed", severity: "warning", elementId: el.id, data: { mm: input.bleedMm } });
      }
    }
    if (el.type === "code") {
      if (el.kind === "ean13") {
        const modules = ean13Modules(el.value);
        if (!modules) out.push({ code: "code_invalid", severity: "error", elementId: el.id });
        else if (el.width * el.scaleX < EAN_MIN_WIDTH_MM) {
          out.push({ code: "code_too_small", severity: "warning", elementId: el.id, data: { mm: EAN_MIN_WIDTH_MM } });
        }
      } else {
        const m = qrMatrix(el.value);
        if (!m) out.push({ code: "code_invalid", severity: "error", elementId: el.id });
        else if ((el.width * el.scaleX) / m.size < QR_MIN_MODULE_MM) {
          out.push({
            code: "code_too_small",
            severity: "warning",
            elementId: el.id,
            data: { mm: Math.ceil(QR_MIN_MODULE_MM * m.size) },
          });
        }
      }
    }
  }
  return out;
}
