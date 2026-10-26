/**
 * The configurator reads the published `store.catalog.getConfigurator` (`StoreConfiguratorDto`)
 * as it is (U2.F1; the U-F0.5 adapter is gone, user decision 2026-10-01). What is here is only
 * what the screens need on top of it and the contract leaves to the storefront: which calculator
 * input each published option kind feeds, in which step it is asked, and how a product is sized
 * — all read off the published calculator configurations (`FoldingConfigurationDto`,
 * `CorrugateConfigurationDto`, `LabelConfigurationDto`, `TagSleeveConfigurationDto`,
 * `PouchConfigurationDto`, `ServiceConfigurationDto`). Nothing here prices or limits anything.
 */

import type { Schemas } from "@/lib/api/types";

export type Configurator = Schemas["StoreConfiguratorDto"];
export type Pattern = Schemas["StoreConfiguratorPatternDto"];
export type StoreOption = Schemas["StoreOptionDto"];
export type CalculatorKey = Schemas["CalculatorKey"];
export type DesignOption = Schemas["DesignOption"];
export type MeasurementBasis = Schemas["MeasurementBasis"];
export type PrintArea = Schemas["CorrugatePrintArea"];
export type PouchPart = Schemas["PouchSizePart"];

/** How a product is sized: a box (L × W × H), a flat item (W × L), a pouch (W × L + gussets), or not at all. */
export type SizeKind = "box" | "flat" | "pouch" | "none";

/** Each calculator's size fields, as its published configuration names them. */
const SIZE_KIND: Record<CalculatorKey, SizeKind> = {
  folding: "box",
  corrugate: "box",
  label: "flat",
  tag_sleeve: "flat",
  pouch: "pouch",
  standard_product: "none",
  service: "none",
};

export const sizeKindOf = (configurator: Pick<Configurator, "calculator">): SizeKind =>
  SIZE_KIND[configurator.calculator];

/**
 * The bases a customer may enter a size on (D-182). Boxes are priced on the inside size and may be
 * entered on any construction basis — the API converts with the material's caliper
 * (`store.specs.convertDimensions`); flat items, tags, sleeves and pouches are their finished size
 * (`product`) only. `product` on a box would be the goods it holds, which needs clearance rules
 * no decision has set, so it is not offered.
 */
export function basesOf(configurator: Pick<Configurator, "calculator">): MeasurementBasis[] {
  const kind = sizeKindOf(configurator);
  if (kind === "box") return ["internal", "external", "over_crease"];
  if (kind === "none") return [];
  return ["product"];
}

/* ------------------------------------------------------------------------- choice groups */

/** The inputs the stepper asks for, one per calculator field. */
export type GroupKind =
  | "material"
  | "print_front"
  | "print_back"
  | "print_set"
  | "coating_front"
  | "coating_back"
  | "finish"
  | "diecut"
  | "assembly";

/** The stepper step a group is asked in. */
export type ChoiceStep = "material" | "printing" | "finishing" | "assembly";

export interface ChoiceGroup {
  kind: GroupKind;
  step: ChoiceStep;
  /** One id (`materialId`, `diecutTypeId`) or a list (`finish2`, `assemblies`, print colours). */
  selection: "single" | "multiple";
  /** The configuration cannot be priced without it. */
  required: boolean;
  /** Finishes and assemblies the calculator places by count and size (foil, window film). */
  placed: boolean;
  options: StoreOption[];
}

type Shape = Omit<ChoiceGroup, "options"> & { from: Schemas["OfferableOptionKind"] };

const material: Shape = {
  kind: "material",
  from: "material",
  step: "material",
  selection: "single",
  required: true,
  placed: false,
};
const printSide = (kind: "print_front" | "print_back"): Shape => ({
  kind,
  from: "ink_colour",
  step: "printing",
  selection: "multiple",
  required: false,
  placed: false,
});
const coating = (kind: "coating_front" | "coating_back"): Shape => ({
  kind,
  from: "coating",
  step: "finishing",
  selection: "single",
  required: false,
  placed: false,
});
const finish: Shape = {
  kind: "finish",
  from: "finish",
  step: "finishing",
  selection: "multiple",
  required: false,
  placed: true,
};
const diecut = (required: boolean): Shape => ({
  kind: "diecut",
  from: "diecut",
  step: "assembly",
  selection: "single",
  required,
  placed: false,
});
const assembly = (placed: boolean): Shape => ({
  kind: "assembly",
  from: "assembly",
  step: "assembly",
  selection: "multiple",
  required: false,
  placed,
});

/**
 * Which published option kind feeds which field of each calculator's configuration:
 * folding `parts[].printFront/printBack, finish1FrontId/BackId, finish2, diecutTypeId, assemblies`;
 * corrugate `parts[].printFront/printBack (area), coatingFrontId/BackId, assemblies`; label
 * `printFront/printBack.inkColourIds, finishFrontId/BackId (coatings), diecutTypeId`; tag & sleeve as
 * folding with a required die-cut; pouch `printColourId` (one colour set) and `optionIds`
 * (zipper, valve… — catalogue assemblies, each once). A service has none.
 */
const SHAPES: Record<CalculatorKey, Shape[]> = {
  folding: [
    material,
    printSide("print_front"),
    printSide("print_back"),
    coating("coating_front"),
    coating("coating_back"),
    finish,
    diecut(false),
    assembly(true),
  ],
  corrugate: [
    material,
    printSide("print_front"),
    printSide("print_back"),
    coating("coating_front"),
    coating("coating_back"),
    assembly(true),
  ],
  label: [
    material,
    printSide("print_front"),
    printSide("print_back"),
    coating("coating_front"),
    coating("coating_back"),
    diecut(false),
  ],
  tag_sleeve: [
    material,
    printSide("print_front"),
    printSide("print_back"),
    coating("coating_front"),
    coating("coating_back"),
    finish,
    diecut(true),
    assembly(true),
  ],
  pouch: [
    material,
    { kind: "print_set", from: "ink_colour", step: "printing", selection: "single", required: false, placed: false },
    assembly(false),
  ],
  standard_product: [],
  service: [],
};

/** The groups this product asks for, in stepper order; a group with no published option is left out. */
export function groupsOf(configurator: Configurator): ChoiceGroup[] {
  return SHAPES[configurator.calculator].flatMap(({ from, ...shape }) => {
    const options = configurator.optionGroups.find((group) => group.kind === from)?.options ?? [];
    return options.length > 0 ? [{ ...shape, options }] : [];
  });
}

/** Every option of the product by id, whichever group lists it. */
export function optionsById(configurator: Configurator): Map<string, StoreOption> {
  return new Map(configurator.optionGroups.flatMap((group) => group.options.map((option) => [option.id, option])));
}

/* -------------------------------------------------------------------------- option facts */

const bool = (value: unknown) => value === true;

/** Where a finish or assembly is placed by count and size, what the calculator needs of it. */
export interface Placement {
  requiresAmount: boolean;
  requiresWidth: boolean;
  requiresLength: boolean;
}

/** The catalogue row's placement attributes (`finish`, `assembly`), when the group places them. */
export function placementOf(group: ChoiceGroup, option: StoreOption): Placement | null {
  if (!group.placed) return null;
  const attributes = option.attributes ?? {};
  const placement = {
    requiresAmount: bool(attributes.requiresAmount),
    requiresWidth: bool(attributes.requiresWidth),
    requiresLength: bool(attributes.requiresLength),
  };
  return placement.requiresAmount || placement.requiresWidth || placement.requiresLength ? placement : null;
}

/**
 * A process ink (CMYK) is printed as one four-colour pass: the calculators that document it take
 * it as "its colour four times" (`FoldingPartDto.printFront`, `TagSleeveConfigurationDto.printFront`).
 */
export const isProcessInk = (option: StoreOption) => option.attributes?.colourKind === "process";

/** The ink groups: front and back colours of a part (a pouch's `print_set` is one colour set, single). */
const isInkGroup = (group: Pick<ChoiceGroup, "kind">) => group.kind === "print_front" || group.kind === "print_back";

/**
 * Folding, label and tag & sleeve inks (no per-side print model yet, B-API-2; corrugate uses
 * `print-model.ts`): how inks combine on a side: a process ink (CMYK) is the whole
 * four-colour print, so it and any other ink are alternatives; only spot inks may be combined.
 * Choosing a process ink replaces the other choices, choosing another ink drops a process ink.
 */
export function toggleChoice(
  group: Pick<ChoiceGroup, "kind">,
  options: ReadonlyMap<string, StoreOption>,
  chosen: string[],
  id: string,
  on: boolean,
): string[] {
  if (!on) return chosen.filter((other) => other !== id);
  if (chosen.includes(id)) return chosen;
  if (!isInkGroup(group)) return [...chosen, id];
  const option = options.get(id);
  if (option && isProcessInk(option)) return [id];
  return [...chosen.filter((other) => !(options.get(other) && isProcessInk(options.get(other)!))), id];
}

/**
 * Normalises a list of ink ids (a seed, a draft, a shared quote) to the same rule: duplicates
 * go, and where a process ink is among them it stands alone (it already prints black).
 */
export function normaliseInks(options: ReadonlyMap<string, StoreOption>, ids: string[]): string[] {
  const unique = [...new Set(ids)];
  const process = unique.filter((id) => options.get(id) && isProcessInk(options.get(id)!));
  return process.length > 0 ? [process[process.length - 1]!] : unique;
}

/* ------------------------------------------------------------------------------- patterns */

export function patternById(configurator: Configurator, patternId: string | null): Pattern | null {
  return configurator.patterns.find((pattern) => pattern.id === patternId) ?? configurator.patterns[0] ?? null;
}

/** The pouch parts a pouch pattern needs besides width and height (`b`, `s`, `cs`). */
export const pouchPartsOf = (pattern: Pattern | null): PouchPart[] => pattern?.pouch?.needs ?? [];
