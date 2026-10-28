"use client";

import { useMemo } from "react";
import {
  allFaces,
  DEFAULT_SAFE_MM,
  dielineLines,
  flattenContour,
  flattenOpen,
  mirrorDieline,
  pieceOutline,
  safeZone,
  type Dieline,
  type Pt,
} from "@getpack/dieline";

import { useEditor } from "../store/editor";
import type { DesignElement } from "../types";
import type { DesignerCatalog } from "../data/api";
import { activeRules, designIssues, type CheckInput, type DesignIssue, type PrintRule } from "./checks";
import type { FixContext } from "./fixes";
import { elementCorners, localSize } from "./geometry";
import { measureText } from "./measure";

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

/** What the checks are run with besides the sheet (U4.5): the rule catalogue and the design's context. */
export interface CheckContext {
  /** The catalogue (`store.studio.getRules`), or the vendored one while it is not reachable. */
  rules: PrintRule[];
  printMethod: string | null;
  materialClass: string | null;
  /** Studio elements whose legal right is not declared. */
  undeclared?: Set<string>;
}

/** The live print checks for the design on screen. */
export function useDesignIssues(
  dieline: Dieline | null,
  catalog: DesignerCatalog | null,
  context: CheckContext,
): DesignIssue[] {
  const elements = useEditor((s) => s.content.elements);
  const pattern = useEditor((s) => s.content.pattern);
  const safeMm = catalog?.rules.safeMarginMm ?? DEFAULT_SAFE_MM;
  const rules = useMemo(
    () => activeRules(context.rules, { printMethod: context.printMethod, materialClass: context.materialClass }),
    [context.rules, context.printMethod, context.materialClass],
  );
  // The safe zone is the rule's when Prepress set it, else the catalogue's artwork rule.
  const safe = Number(rules.find((r) => r.id === "safe_zone")?.thresholds?.safeZoneMm ?? safeMm);
  const sheet = useMemo(() => (dieline ? sheetOf(dieline, safe) : null), [dieline, safe]);
  // Inside artwork (U4.3) sits on the sheet as seen from inside: checked against the mirrored die.
  const inside = useMemo(() => (dieline ? sheetOf(mirrorDieline(dieline), safe) : null), [dieline, safe]);
  const undeclared = context.undeclared;
  return useMemo(() => {
    if (!sheet || !inside) return [];
    // A hidden element (C8 layers) is neither printed nor checked.
    const outer = elements.filter((e) => e.side !== "inside" && !e.hidden);
    const inner = elements.filter((e) => e.side === "inside" && !e.hidden);
    const common = { cornersOf, rules, undeclared };
    return [
      ...designIssues({ ...sheet, ...common, elements: outer, pattern }),
      ...(inner.length ? designIssues({ ...inside, ...common, elements: inner }) : []),
    ];
  }, [sheet, inside, elements, pattern, rules, undeclared]);
}

/** What a fix needs for a side of the board (U4.5): its die's safe zones and outlines, and the rules. */
export function fixContextFor(
  dieline: Dieline,
  catalog: DesignerCatalog | null,
  context: CheckContext,
  side: "outside" | "inside",
): FixContext {
  const rules = activeRules(context.rules, { printMethod: context.printMethod, materialClass: context.materialClass });
  const safe = Number(
    rules.find((r) => r.id === "safe_zone")?.thresholds?.safeZoneMm ?? catalog?.rules.safeMarginMm ?? DEFAULT_SAFE_MM,
  );
  const sheet = sheetOf(side === "inside" ? mirrorDieline(dieline) : dieline, safe);
  return { cornersOf, safeZones: sheet.safeZones, outlines: sheet.outlines, rules };
}
