import type { Process } from "../modules/types";
import { recipeUses } from "../recipes/build";
import type { StyleRecipe } from "../recipes/types";
import type { Dieline, MaterialSpec } from "../types";

/**
 * Which partner machines can cut a flat blank (U3.2 §3). The capability data — maximum and minimum
 * sheet, caliper, processes — comes from the API (B2.2 machines, U3.B3 matrix) and the API decides
 * who makes what; this is the instant answer the UI shows while a customer types a size. It never
 * names a factory to a customer (D-050): callers pass opaque refs.
 */
export interface MachineEnvelope {
  /** Opaque to the engine (a machine or partner id from the API). */
  ref: string;
  maxSheet: { width: number; height: number };
  minSheet?: { width: number; height: number };
  maxCaliperMm?: number;
  /** What the partner can do; absent means "not known", which never excludes. */
  processes?: Process[];
}

export type EnvelopeReason = "sheet.too_large" | "sheet.too_small" | "caliper.too_thick" | "process.missing";

export interface EnvelopeFit {
  ref: string;
  fits: boolean;
  reasons: EnvelopeReason[];
  /** Processes the recipe needs that this envelope lacks. */
  missing: Process[];
  /** True when a piece only fits turned 90° on the sheet. */
  rotated: boolean;
}

/** Every process a recipe's modules need, in module order, once each. */
export function recipeProcesses(recipe: StyleRecipe): Process[] {
  return [...new Set(recipeUses(recipe).all.flatMap((u) => u.def.processes))];
}

/**
 * Checks each piece of the dieline (pieces are cut separately) against each envelope, either way
 * round, plus caliper and processes.
 */
export function fitsEnvelope(
  d: Dieline,
  material: MaterialSpec,
  envelopes: MachineEnvelope[],
  processes: Process[] = [],
): EnvelopeFit[] {
  return envelopes.map((e) => {
    const reasons = new Set<EnvelopeReason>();
    let rotated = false;
    for (const p of d.pieces) {
      const { width: w, height: h } = p.bounds;
      const within = (a: number, b: number) => a <= e.maxSheet.width + 1e-9 && b <= e.maxSheet.height + 1e-9;
      if (within(w, h)) continue;
      if (within(h, w)) rotated = true;
      else reasons.add("sheet.too_large");
    }
    if (e.minSheet) {
      const longest = Math.max(...d.pieces.map((p) => Math.max(p.bounds.width, p.bounds.height)));
      const shortest = Math.max(...d.pieces.map((p) => Math.min(p.bounds.width, p.bounds.height)));
      const minLong = Math.max(e.minSheet.width, e.minSheet.height);
      const minShort = Math.min(e.minSheet.width, e.minSheet.height);
      if (longest < minLong || shortest < minShort) reasons.add("sheet.too_small");
    }
    if (e.maxCaliperMm !== undefined && material.caliperMm > e.maxCaliperMm) reasons.add("caliper.too_thick");
    const missing = e.processes ? processes.filter((p) => !e.processes!.includes(p)) : [];
    if (missing.length) reasons.add("process.missing");
    return { ref: e.ref, fits: reasons.size === 0, reasons: [...reasons], missing, rotated };
  });
}
