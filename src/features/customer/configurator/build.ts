/**
 * The configurator's selection → the body `POST /v1/store/quotes/actions/calculate` takes, and
 * back again.
 *
 * Every calculator goes as its own published configuration (contract v0.41.0): folding
 * `FoldingConfigurationDto`, corrugate `CorrugateConfigurationDto`, label `LabelConfigurationDto`,
 * tag & sleeve `TagSleeveConfigurationDto`, pouch `PouchConfigurationDto`, service
 * `ServiceConfigurationDto`. The body carries the ids `store.catalog.getConfigurator` published,
 * the sizes on the basis the customer chose (D-182) and an optional target (D-247) — never a price.
 */

import type { Schemas } from "@/lib/api/types";

import { groupsOf, isProcessInk, optionsById, sizeKindOf, type MeasurementBasis } from "./model";
import {
  NO_DIMS,
  partsOf,
  patternOf,
  printOfPart,
  POSTCODE,
  TARGET,
  type Axis,
  type Configurator,
  type ConfiguratorState,
  type GroupKind,
  type PartPrint,
} from "./state";

export type FoldingConfiguration = Schemas["FoldingConfigurationDto"];
export type CorrugateConfiguration = Schemas["CorrugateConfigurationDto"];
export type LabelConfiguration = Schemas["LabelConfigurationDto"];
export type TagSleeveConfiguration = Schemas["TagSleeveConfigurationDto"];
export type PouchConfiguration = Schemas["PouchConfigurationDto"];
export type ServiceConfiguration = Schemas["ServiceConfigurationDto"];
export type Configuration =
  | FoldingConfiguration
  | CorrugateConfiguration
  | LabelConfiguration
  | TagSleeveConfiguration
  | PouchConfiguration
  | ServiceConfiguration;

export type CalculateBody = Omit<Schemas["CalculateQuoteDto"], "configuration"> & { configuration: Configuration };

/** Full coverage for each ink colour, as the CS desk prices it (`admin/cs/configuration.ts`). */
const FULL_COVERAGE = 100;

const one = (state: ConfiguratorState, kind: GroupKind) => state.choices[kind]?.[0];
const all = (state: ConfiguratorState, kind: GroupKind) => state.choices[kind] ?? [];
const optional = <K extends string, V>(key: K, value: V | undefined | null) =>
  (value === undefined || value === null ? {} : { [key]: value }) as Partial<Record<K, V>>;

/** The design fee the calculator adds (DesignOptionsDto): getpack designs the artwork, or not. */
function designOf(state: ConfiguratorState) {
  return {
    graphic: state.designOption === "hired_design" || state.designOption === "free_design",
    structure: false,
  };
}

/** A placed finish or assembly: how many, and each piece's size (`Finish2Dto`, `QuoteAssemblyInputDto`). */
function placedPieces(state: ConfiguratorState, optionId: string) {
  const area = state.areas[optionId];
  if (!area) return {};
  const count = area.amount || 1;
  return {
    ...(area.amount ? { amount: area.amount } : {}),
    ...(area.widthMm ? { w: Array.from({ length: count }, () => area.widthMm!) } : {}),
    ...(area.lengthMm ? { l: Array.from({ length: count }, () => area.lengthMm!) } : {}),
  };
}

/** Folding and tag & sleeve colours: each at full coverage, a process ink laid four times. */
function printColours(configurator: Configurator, ids: string[]): Schemas["PrintColourDto"][] {
  const byId = optionsById(configurator);
  return ids.flatMap((inkColourId) => {
    const option = byId.get(inkColourId);
    const times = option && isProcessInk(option) ? 4 : 1;
    return Array.from({ length: times }, () => ({ inkColourId, percent: FULL_COVERAGE }));
  });
}

const mm = (state: ConfiguratorState, axis: Axis) => (axis === "d" && state.flatStyle ? 0 : (state.dims[axis] ?? 0));

function common(configurator: Configurator, state: ConfiguratorState) {
  return {
    catalogProductId: configurator.catalogProductId,
    basis: state.basis ?? undefined,
    quantities: state.quantities,
    design: designOf(state),
  };
}

/**
 * A box is priced part by part (`FoldingPartDto`, `CorrugatePartDto`): a telescope box is its body
 * and its lid, and the calculator refuses a pattern's parts sent as one. Each part prints what the
 * customer chose for it (`printOfPart`); a coating or die-cut is the whole box's, so every part has
 * it; a placed finish or an assembly is counted once, on the first part.
 */
function eachPart<P>(
  configurator: Configurator,
  state: ConfiguratorState,
  part: (print: PartPrint, first: boolean) => P,
) {
  const parts = partsOf(configurator, state);
  if (parts.length === 0) return [part(printOfPart(state, undefined), true)];
  return parts.map(({ subPatternId }, index) => ({
    subPatternId,
    ...part(printOfPart(state, subPatternId), index === 0),
  }));
}

function folding(configurator: Configurator, state: ConfiguratorState): FoldingConfiguration {
  const pattern = patternOf(configurator, state);
  return {
    ...common(configurator, state),
    patternId: pattern?.id ?? "",
    l: mm(state, "l"),
    w: mm(state, "w"),
    d: mm(state, "d"),
    materialId: one(state, "material") ?? "",
    // An instant product always has one (D-043); without it nothing is asked (`readyToPrice`).
    difficultyLevelId: configurator.difficultyLevelId ?? "",
    parts: eachPart(configurator, state, (print, first) => ({
      printFront: printColours(configurator, print.print_front),
      printBack: printColours(configurator, print.print_back),
      ...optional("finish1FrontId", one(state, "coating_front")),
      ...optional("finish1BackId", one(state, "coating_back")),
      finish2: first ? all(state, "finish").map((finishId) => ({ finishId, ...placedPieces(state, finishId) })) : [],
      ...optional("diecutTypeId", one(state, "diecut")),
      assemblies: first
        ? all(state, "assembly").map((assemblyId) => ({ assemblyId, ...placedPieces(state, assemblyId) }))
        : [],
    })),
  };
}

function corrugate(configurator: Configurator, state: ConfiguratorState): CorrugateConfiguration {
  const pattern = patternOf(configurator, state);
  const area = state.printArea ?? configurator.printAreas[0] ?? "all_round";
  const colours = (ids: string[]) => ids.map((inkColourId) => ({ inkColourId, area }));
  return {
    ...common(configurator, state),
    patternId: pattern?.id ?? "",
    l: mm(state, "l"),
    w: mm(state, "w"),
    d: mm(state, "d"),
    materialId: one(state, "material") ?? "",
    difficultyLevelId: configurator.difficultyLevelId ?? "",
    parts: eachPart(configurator, state, (print, first) => ({
      printFront: colours(print.print_front),
      printBack: colours(print.print_back),
      ...optional("coatingFrontId", one(state, "coating_front")),
      ...optional("coatingBackId", one(state, "coating_back")),
      assemblies: first
        ? all(state, "assembly").map((assemblyId) => {
            const piece = state.areas[assemblyId];
            return {
              assemblyId,
              ...optional("amount", piece?.amount || null),
              ...optional("w", piece?.widthMm),
              ...optional("l", piece?.lengthMm),
            };
          })
        : [],
    })),
  };
}

function label(configurator: Configurator, state: ConfiguratorState): LabelConfiguration {
  const side = (ids: string[]) => (ids.length > 0 ? { inkColourIds: ids } : undefined);
  return {
    ...common(configurator, state),
    w: mm(state, "w"),
    l: mm(state, "l"),
    materialId: one(state, "material") ?? "",
    difficultyLevelId: configurator.difficultyLevelId ?? "",
    ...optional("printFront", side(all(state, "print_front"))),
    ...optional("printBack", side(all(state, "print_back"))),
    ...optional("finishFrontId", one(state, "coating_front")),
    ...optional("finishBackId", one(state, "coating_back")),
    ...optional("diecutTypeId", one(state, "diecut")),
  };
}

function tagSleeve(configurator: Configurator, state: ConfiguratorState): TagSleeveConfiguration {
  const pattern = patternOf(configurator, state);
  return {
    ...common(configurator, state),
    patternId: pattern?.id ?? "",
    w: mm(state, "w"),
    l: mm(state, "l"),
    materialId: one(state, "material") ?? "",
    difficultyLevelId: configurator.difficultyLevelId ?? "",
    // A tag is always die-cut: the group is required (`model.ts`).
    diecutTypeId: one(state, "diecut") ?? "",
    printFront: printColours(configurator, all(state, "print_front")),
    printBack: printColours(configurator, all(state, "print_back")),
    ...optional("finish1FrontId", one(state, "coating_front")),
    ...optional("finish1BackId", one(state, "coating_back")),
    finish2: all(state, "finish").map((finishId) => ({ finishId, ...placedPieces(state, finishId) })),
    assemblies: all(state, "assembly").map((assemblyId) => ({ assemblyId, ...placedPieces(state, assemblyId) })),
  };
}

function pouch(configurator: Configurator, state: ConfiguratorState): PouchConfiguration {
  const pattern = patternOf(configurator, state);
  const needs = pattern?.pouch?.needs ?? [];
  return {
    ...common(configurator, state),
    patternId: pattern?.id ?? "",
    w: mm(state, "w"),
    l: mm(state, "l"),
    ...(needs.includes("b") ? { b: mm(state, "b") } : {}),
    ...(needs.includes("s") ? { s: mm(state, "s") } : {}),
    ...(needs.includes("cs") ? { cs: mm(state, "cs") } : {}),
    materialId: one(state, "material") ?? "",
    ...optional("printColourId", one(state, "print_set")),
    optionIds: all(state, "assembly"),
  };
}

function service(configurator: Configurator, state: ConfiguratorState): ServiceConfiguration {
  return { catalogProductId: configurator.catalogProductId, quantities: state.quantities };
}

export function buildConfiguration(configurator: Configurator, state: ConfiguratorState): Configuration {
  switch (configurator.calculator) {
    case "folding":
      return folding(configurator, state);
    case "corrugate":
      return corrugate(configurator, state);
    case "label":
      return label(configurator, state);
    case "tag_sleeve":
      return tagSleeve(configurator, state);
    case "pouch":
      return pouch(configurator, state);
    case "service":
    case "standard_product":
      // A standard product is never priced here (`readyToPrice`); a service is its quantity.
      return service(configurator, state);
  }
}

export function buildCalculateBody(configurator: Configurator, state: ConfiguratorState): CalculateBody {
  return {
    productTypeCode: configurator.productTypeCode,
    configuration: buildConfiguration(configurator, state),
    ...(POSTCODE.test(state.postcode) ? { deliveryPostcode: state.postcode } : {}),
    ...(TARGET.test(state.target) ? { targetPricePerUnit: state.target } : {}),
  };
}

/* ------------------------------------------------------------------------------- the reverse */

/**
 * A configuration the API handed back (a draft, a shared or saved quotation) → the answers to
 * start the configurator from. Anything that no longer matches the product's current choices is
 * dropped, so a quote reopened after a catalogue change starts from what is still offered. A
 * configuration without a basis was priced on the inside size (D-182, U2.1 assumption 4).
 */
export function seedFromConfiguration(
  configurator: Configurator,
  configuration: Record<string, unknown>,
  extra: { quantity?: number; target?: string | null } = {},
): Partial<ConfiguratorState> {
  const groups = groupsOf(configurator);
  const choices: ConfiguratorState["choices"] = Object.fromEntries(groups.map((group) => [group.kind, []]));
  const put = (kind: GroupKind, id: unknown) => {
    const group = groups.find((candidate) => candidate.kind === kind);
    if (typeof id !== "string" || !group?.options.some((option) => option.id === id)) return;
    const list = choices[kind] ?? [];
    if (!list.includes(id)) choices[kind] = group.selection === "single" ? [id] : [...list, id];
  };
  const record = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
  const list = (value: unknown) => (Array.isArray(value) ? (value as unknown[]) : []);
  const num = (value: unknown) => (typeof value === "number" && value > 0 ? value : null);
  const part = record(list(configuration.parts)[0]);
  const colourIds = (colours: unknown) => list(colours).map((colour) => record(colour).inkColourId);

  put("material", configuration.materialId);
  switch (configurator.calculator) {
    case "folding":
    case "tag_sleeve": {
      const source = configurator.calculator === "folding" ? part : configuration;
      for (const id of colourIds(source.printFront)) put("print_front", id);
      for (const id of colourIds(source.printBack)) put("print_back", id);
      put("coating_front", source.finish1FrontId);
      put("coating_back", source.finish1BackId);
      for (const finish of list(source.finish2)) put("finish", record(finish).finishId);
      put("diecut", source.diecutTypeId ?? configuration.diecutTypeId);
      for (const assembly of list(source.assemblies)) put("assembly", record(assembly).assemblyId);
      break;
    }
    case "corrugate":
      for (const id of colourIds(part.printFront)) put("print_front", id);
      for (const id of colourIds(part.printBack)) put("print_back", id);
      put("coating_front", part.coatingFrontId);
      put("coating_back", part.coatingBackId);
      for (const assembly of list(part.assemblies)) put("assembly", record(assembly).assemblyId);
      break;
    case "label":
      for (const id of list(record(configuration.printFront).inkColourIds)) put("print_front", id);
      for (const id of list(record(configuration.printBack).inkColourIds)) put("print_back", id);
      put("coating_front", configuration.finishFrontId);
      put("coating_back", configuration.finishBackId);
      put("diecut", configuration.diecutTypeId);
      break;
    case "pouch":
      put("print_set", configuration.printColourId);
      for (const id of list(configuration.optionIds)) put("assembly", id);
      break;
    default:
      break;
  }

  // A multi-part box: the first part's print is the box's; a part printed otherwise keeps its own.
  const partPrints: ConfiguratorState["partPrints"] = {};
  if (configurator.calculator === "folding" || configurator.calculator === "corrugate") {
    const offered =
      (kind: GroupKind) =>
      (id: unknown): id is string =>
        typeof id === "string" && groups.some((group) => group.kind === kind && group.options.some((o) => o.id === id));
    const printOf = (value: unknown): PartPrint => ({
      print_front: [...new Set(colourIds(record(value).printFront).filter(offered("print_front")))],
      print_back: [...new Set(colourIds(record(value).printBack).filter(offered("print_back")))],
    });
    const parts = list(configuration.parts).map((value) => ({ id: record(value).subPatternId, print: printOf(value) }));
    const same = (a: PartPrint, b: PartPrint) =>
      a.print_front.join() === b.print_front.join() && a.print_back.join() === b.print_back.join();
    if (parts.length > 1 && parts.some((other) => !same(other.print, parts[0]!.print))) {
      for (const { id, print } of parts) if (typeof id === "string") partPrints[id] = print;
    }
  }

  const quantities = list(configuration.quantities).filter((value): value is number => typeof value === "number");
  const printArea = record(list(part.printFront)[0]).area;
  const patternId =
    typeof configuration.patternId === "string" &&
    configurator.patterns.some((pattern) => pattern.id === configuration.patternId)
      ? configuration.patternId
      : undefined;
  const kind = sizeKindOf(configurator);
  const basis = (configuration.basis as MeasurementBasis | undefined) ?? (kind === "box" ? "internal" : "product");
  return {
    ...(patternId ? { patternId } : {}),
    sizeMode: "custom",
    standardSizeCode: null,
    basis: kind === "none" ? null : basis,
    dims: {
      ...NO_DIMS,
      l: num(configuration.l),
      w: num(configuration.w),
      d: num(configuration.d),
      b: num(configuration.b),
      s: num(configuration.s),
      cs: num(configuration.cs),
    },
    choices,
    partPrints,
    ...(typeof printArea === "string" && configurator.printAreas.includes(printArea as never)
      ? { printArea: printArea as ConfiguratorState["printArea"] }
      : {}),
    ...(quantities.length > 0 ? { quantities: [...new Set(quantities)].sort((a, b) => a - b) } : {}),
    ...(extra.quantity ? { quantity: extra.quantity } : quantities[0] ? { quantity: quantities[0] } : {}),
    ...(extra.target ? { target: extra.target } : {}),
  };
}
