/**
 * The CS calculators' selection → the published bodies (`admin.csFolding.calculate`,
 * `admin.csCorrugate.calculate`, and `admin.quotes.create`, which prices the same configuration).
 *
 * The desk prices one part: the pattern, or one of its sub-patterns, printed and finished alike —
 * the scope the F2 form had. The body carries catalogue ids only, never a price; quantities are the
 * tiers CS compares.
 */

import type { Schemas } from "@/lib/api/types";

import type { PublishedCalculator } from "./calculators";

export type FoldingInputData = Schemas["FoldingInputDataDto"];
export type CorrugateInputData = Schemas["CorrugateInputDataDto"];
export type InputDataOf<K extends PublishedCalculator> = K extends "folding" ? FoldingInputData : CorrugateInputData;

export type FoldingConfiguration = Schemas["FoldingConfigurationDto"];
export type CorrugateConfiguration = Schemas["CsCorrugateConfigurationDto"];

export type SizeRules = Schemas["StoreSizeRulesDto"];
export type CatalogProduct = Schemas["CsCatalogProductDto"];

/** The part of the selection both calculators share. */
interface Common {
  /** The catalogue product the box is (its standard sizes and quantity presets), when CS picks one. */
  catalogProductId?: string;
  patternId?: string;
  subPatternId?: string;
  materialId?: string;
  difficultyLevelId?: string;
  l?: number;
  w?: number;
  d?: number;
  /** Ink colours printed on the outside; the inside is not printed by the desk's single part. */
  printFront: string[];
  printBack: string[];
  graphic: boolean;
  structure: boolean;
}

export interface FoldingSelection extends Common {
  calculator: "folding";
  finish1FrontId?: string;
  finish1BackId?: string;
  diecutTypeId?: string;
}

export interface CorrugateSelection extends Common {
  calculator: "corrugate";
  printArea: Schemas["CorrugatePrintArea"];
  coatingFrontId?: string;
  coatingBackId?: string;
}

export type Selection = FoldingSelection | CorrugateSelection;

export type MissingField = "pattern" | "material" | "difficulty" | "dimensions" | "size";

export type Axis = "l" | "w" | "d";

/** What is wrong with one dimension by the pattern's own rules (`InputPatternDto.rules`, v0.5.0). */
export type SizeProblem =
  | { code: "min"; limitMm: number }
  | { code: "max"; limitMm: number }
  | { code: "lengthMustExceedWidth" }
  | { code: "lengthMustExceedHeight" }
  | { code: "widthMustExceedHeight" };

/**
 * Each dimension checked against the rules the API sent with the pattern — the limits are its
 * data, so the desk says what is wrong before asking for a price the API would refuse.
 */
export function sizeProblems(rules: SizeRules | undefined, selection: Selection): Partial<Record<Axis, SizeProblem>> {
  if (!rules) return {};
  const limits: Record<Axis, [number | null, number | null]> = {
    l: [rules.minLMm, rules.maxLMm],
    w: [rules.minWMm, rules.maxWMm],
    d: [rules.minHMm, rules.maxHMm],
  };
  const problems: Partial<Record<Axis, SizeProblem>> = {};
  for (const axis of ["l", "w", "d"] as const) {
    const value = selection[axis];
    const [min, max] = limits[axis];
    if (value === undefined) continue;
    if (min !== null && value < min) problems[axis] = { code: "min", limitMm: min };
    else if (max !== null && value > max) problems[axis] = { code: "max", limitMm: max };
  }
  const { l, w, d } = selection;
  if (rules.lengthMustExceedWidth && l !== undefined && w !== undefined && !problems.l && l <= w)
    problems.l = { code: "lengthMustExceedWidth" };
  if (rules.lengthMustExceedHeight && l !== undefined && d !== undefined && !problems.l && l <= d)
    problems.l = { code: "lengthMustExceedHeight" };
  if (rules.widthMustExceedHeight && w !== undefined && d !== undefined && !problems.w && w <= d)
    problems.w = { code: "widthMustExceedHeight" };
  return problems;
}

export function emptySelection(calculator: PublishedCalculator): Selection {
  const common: Common = { printFront: [], printBack: [], graphic: false, structure: false };
  return calculator === "folding" ? { calculator, ...common } : { calculator, printArea: "all_round", ...common };
}

export function missingFields(selection: Selection, rules?: SizeRules): MissingField[] {
  const missing: MissingField[] = [];
  if (!selection.patternId) missing.push("pattern");
  if (!selection.materialId) missing.push("material");
  if (!selection.difficultyLevelId) missing.push("difficulty");
  if (!(selection.l && selection.w && selection.d)) missing.push("dimensions");
  else if (Object.keys(sizeProblems(rules, selection)).length > 0) missing.push("size");
  return missing;
}

/** Full coverage for each ink colour; the desk does not grade coverage per colour. */
const FULL_COVERAGE = 100;

export function toFolding(selection: FoldingSelection, quantities: number[]): FoldingConfiguration {
  return {
    ...(selection.catalogProductId ? { catalogProductId: selection.catalogProductId } : {}),
    patternId: selection.patternId!,
    materialId: selection.materialId!,
    difficultyLevelId: selection.difficultyLevelId!,
    l: selection.l!,
    w: selection.w!,
    d: selection.d!,
    quantities,
    design: { graphic: selection.graphic, structure: selection.structure },
    parts: [
      {
        ...(selection.subPatternId ? { subPatternId: selection.subPatternId } : {}),
        printFront: selection.printFront.map((inkColourId) => ({ inkColourId, percent: FULL_COVERAGE })),
        printBack: selection.printBack.map((inkColourId) => ({ inkColourId, percent: FULL_COVERAGE })),
        ...(selection.finish1FrontId ? { finish1FrontId: selection.finish1FrontId } : {}),
        ...(selection.finish1BackId ? { finish1BackId: selection.finish1BackId } : {}),
        ...(selection.diecutTypeId ? { diecutTypeId: selection.diecutTypeId } : {}),
      },
    ],
  };
}

export function toCorrugate(selection: CorrugateSelection, quantities: number[]): CorrugateConfiguration {
  return {
    ...(selection.catalogProductId ? { catalogProductId: selection.catalogProductId } : {}),
    patternId: selection.patternId!,
    materialId: selection.materialId!,
    difficultyLevelId: selection.difficultyLevelId!,
    l: selection.l!,
    w: selection.w!,
    d: selection.d!,
    quantities,
    design: { graphic: selection.graphic, structure: selection.structure },
    parts: [
      {
        ...(selection.subPatternId ? { subPatternId: selection.subPatternId } : {}),
        printFront: selection.printFront.map((inkColourId) => ({ inkColourId, area: selection.printArea })),
        printBack: selection.printBack.map((inkColourId) => ({ inkColourId, area: selection.printArea })),
        ...(selection.coatingFrontId ? { coatingFrontId: selection.coatingFrontId } : {}),
        ...(selection.coatingBackId ? { coatingBackId: selection.coatingBackId } : {}),
      },
    ],
  };
}

export function toConfiguration(
  selection: Selection,
  quantities: number[],
): FoldingConfiguration | CorrugateConfiguration {
  return selection.calculator === "folding" ? toFolding(selection, quantities) : toCorrugate(selection, quantities);
}
