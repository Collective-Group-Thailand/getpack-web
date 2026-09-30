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

/** The part of the selection both calculators share. */
interface Common {
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

export type MissingField = "pattern" | "material" | "difficulty" | "dimensions";

export function emptySelection(calculator: PublishedCalculator): Selection {
  const common: Common = { printFront: [], printBack: [], graphic: false, structure: false };
  return calculator === "folding" ? { calculator, ...common } : { calculator, printArea: "all_round", ...common };
}

export function missingFields(selection: Selection): MissingField[] {
  const missing: MissingField[] = [];
  if (!selection.patternId) missing.push("pattern");
  if (!selection.materialId) missing.push("material");
  if (!selection.difficultyLevelId) missing.push("difficulty");
  if (!(selection.l && selection.w && selection.d)) missing.push("dimensions");
  return missing;
}

/** Full coverage for each ink colour; the desk does not grade coverage per colour. */
const FULL_COVERAGE = 100;

export function toFolding(selection: FoldingSelection, quantities: number[]): FoldingConfiguration {
  return {
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
