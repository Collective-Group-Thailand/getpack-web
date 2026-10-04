"use client";

import { useMemo } from "react";
import {
  allFaces,
  DEFAULT_BLEED_MM,
  DEFAULT_SAFE_MM,
  dielineLines,
  flattenContour,
  flattenOpen,
  mirrorDieline,
  pieceOutline,
  safeZone,
  type Dieline,
  type Pt,
} from "@packio/dieline";

import { useEditor } from "../store/editor";
import type { DesignElement } from "../types";
import type { DesignerCatalog } from "../data/api";
import { designIssues, type CheckInput, type DesignIssue } from "./checks";
import { elementCorners, localSize } from "./geometry";
import { measureText } from "./measure";

/** The minimum image resolution when the catalogue sends no artwork rules. */
const DEFAULT_MIN_DPI = 300;

export const cornersOf = (el: DesignElement): Pt[] =>
  elementCorners(el, localSize(el, el.type === "text" ? measureText(el) : undefined));

/** What the checks need from the dieline — computed once per box, not per change. */
export function sheetOf(
  dieline: Dieline,
  safeMm: number,
): Pick<CheckInput, "safeZones" | "folds" | "glueAreas" | "outlines"> {
  const faces = allFaces(dieline);
  const folds: [Pt, Pt][] = [];
  for (const l of dielineLines(dieline)) {
    if (l.role !== "crease" && l.role !== "perforation" && l.role !== "half_cut") continue;
    const pts = flattenOpen(l.edge);
    for (let i = 1; i < pts.length; i++) folds.push([pts[i - 1]!, pts[i]!]);
  }
  const glueAreas = faces.filter((f) => f.kind === "glue_flap").map((f) => flattenContour(f.outline));
  return {
    safeZones: faces.map((f) => safeZone(f, safeMm)).filter((z) => z.length > 0),
    folds,
    glueAreas,
    outlines: dieline.pieces.flatMap((p) => pieceOutline(p)),
  };
}

/** The live print checks for the design on screen. */
export function useDesignIssues(dieline: Dieline | null, catalog: DesignerCatalog | null): DesignIssue[] {
  const elements = useEditor((s) => s.content.elements);
  const safeMm = catalog?.rules.safeMarginMm ?? DEFAULT_SAFE_MM;
  const bleedMm = catalog?.rules.bleedMm ?? DEFAULT_BLEED_MM;
  const minDpi = catalog?.rules.minDpi ?? DEFAULT_MIN_DPI;
  const sheet = useMemo(() => (dieline ? sheetOf(dieline, safeMm) : null), [dieline, safeMm]);
  // Inside artwork (U4.3) sits on the sheet as seen from inside: checked against the mirrored die.
  const inside = useMemo(() => (dieline ? sheetOf(mirrorDieline(dieline), safeMm) : null), [dieline, safeMm]);
  return useMemo(() => {
    if (!sheet || !inside) return [];
    const outer = elements.filter((e) => e.side !== "inside");
    const inner = elements.filter((e) => e.side === "inside");
    return [
      ...designIssues({ ...sheet, elements: outer, cornersOf, bleedMm, minDpi }),
      ...(inner.length ? designIssues({ ...inside, elements: inner, cornersOf, bleedMm, minDpi }) : []),
    ];
  }, [sheet, inside, elements, bleedMm, minDpi]);
}
