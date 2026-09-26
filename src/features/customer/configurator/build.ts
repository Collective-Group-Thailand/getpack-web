/**
 * The configurator's selection → the body `POST /v1/store/quotes/actions/calculate` takes.
 *
 * Folding cartons go as the published `FoldingConfigurationDto` (packio-api B2.3). The other six
 * instant calculators go as the generic shape of CONTRACT-REQUEST store.quote-configurations —
 * the selection by group kind, which the API maps onto its own calculator — until each ships its
 * own DTO. Either way the body carries catalogue ids only, never a price.
 */

import type { z } from "zod";

import type { storeGenericConfiguration } from "@/lib/api/requests/store-quotes";
import type { Schemas } from "@/lib/api/types";

import { patternOf, POSTCODE, type Configurator, type ConfiguratorState } from "./state";

export type FoldingConfiguration = Schemas["FoldingConfigurationDto"];
export type GenericConfiguration = z.input<typeof storeGenericConfiguration>;
export type Configuration = FoldingConfiguration | GenericConfiguration;

export interface CalculateBody {
  productTypeCode: string;
  configuration: Configuration;
  deliveryPostcode?: string;
}

/**
 * The quote part's assembly as packio-api's controller validates it (`quote.dto.ts`
 * `AssemblyDto { assemblyId, amount?, w?, l? }`). The contract kept the catalogue row of the same
 * name instead — CONTRACT-REQUEST store.quote-configurations — so the type is written here from
 * the backend's class, and `pricing.ts` is where the body meets the generated types.
 */
export interface FoldingAssembly {
  assemblyId: string;
  amount?: number;
  w?: number[];
  l?: number[];
}

type FoldingPart = Omit<FoldingConfiguration["parts"][number], "assemblies"> & { assemblies?: FoldingAssembly[] };

const one = (state: ConfiguratorState, kind: keyof ConfiguratorState["choices"]) => state.choices[kind]?.[0];
const all = (state: ConfiguratorState, kind: keyof ConfiguratorState["choices"]) => state.choices[kind] ?? [];

/** The design fees the calculator adds (DesignOptionsDto): Packio designs the artwork, or not. */
function designOf(state: ConfiguratorState) {
  return {
    graphic: state.designOption === "hired_design" || state.designOption === "free_design",
    structure: false,
  };
}

function areaOf(state: ConfiguratorState, optionId: string) {
  const area = state.areas[optionId];
  if (!area) return {};
  return {
    ...(area.amount ? { amount: area.amount } : {}),
    ...(area.widthMm ? { w: Array.from({ length: area.amount || 1 }, () => area.widthMm!) } : {}),
    ...(area.lengthMm ? { l: Array.from({ length: area.amount || 1 }, () => area.lengthMm!) } : {}),
  };
}

function folding(
  configurator: Configurator,
  state: ConfiguratorState,
): Omit<FoldingConfiguration, "parts"> & {
  parts: FoldingPart[];
} {
  const pattern = patternOf(configurator, state);
  const byId = new Map(configurator.groups.flatMap((group) => group.options.map((option) => [option.id, option])));
  const print = byId.get(one(state, "print") ?? "")?.print ?? { front: [], back: [] };
  const part: FoldingPart = {
    ...(pattern?.parts[0]?.subPatternId ? { subPatternId: pattern.parts[0].subPatternId } : {}),
    printFront: print.front,
    printBack: print.back,
    ...(one(state, "coating_front") ? { finish1FrontId: one(state, "coating_front") } : {}),
    ...(one(state, "coating_back") ? { finish1BackId: one(state, "coating_back") } : {}),
    finish2: all(state, "finish").map((finishId) => ({ finishId, ...areaOf(state, finishId) })),
    ...(one(state, "diecut") ? { diecutTypeId: one(state, "diecut") } : {}),
    assemblies: all(state, "assembly").map((assemblyId) => ({ assemblyId, ...areaOf(state, assemblyId) })),
  };
  return {
    catalogProductId: configurator.catalogProductId,
    patternId: pattern?.id ?? "",
    l: state.dims.l ?? 0,
    w: state.dims.w ?? 0,
    d: state.dims.d ?? 0,
    materialId: one(state, "material") ?? "",
    difficultyLevelId: configurator.fixedInputs.difficultyLevelId ?? "",
    quantities: state.quantities,
    parts: [part],
    design: designOf(state),
  };
}

function generic(configurator: Configurator, state: ConfiguratorState): GenericConfiguration {
  const pattern = patternOf(configurator, state);
  const options: GenericConfiguration["options"] = {};
  for (const group of configurator.groups) {
    const chosen = state.choices[group.kind] ?? [];
    if (chosen.length === 0) continue;
    options[group.kind] = group.selection === "single" ? chosen[0]! : chosen;
  }
  const placed = Object.entries(state.areas)
    .filter(([optionId]) => Object.values(state.choices).some((ids) => ids?.includes(optionId)))
    .map(([optionId]) => ({ optionId, ...areaOf(state, optionId) }));
  const kind = configurator.size.kind;
  return {
    catalogProductId: configurator.catalogProductId,
    ...(pattern ? { patternId: pattern.id } : {}),
    ...(state.sizeMode === "standard" && state.standardSizeCode ? { standardSizeCode: state.standardSizeCode } : {}),
    ...(kind !== "none" && state.dims.l ? { l: state.dims.l } : {}),
    ...(kind !== "none" && state.dims.w ? { w: state.dims.w } : {}),
    ...(kind === "box" && state.dims.d ? { d: state.dims.d } : {}),
    ...(kind === "pouch" ? { gusset: state.dims.gusset ?? 0 } : {}),
    options,
    ...(placed.length > 0 ? { areas: placed } : {}),
    quantities: state.quantities,
    design: designOf(state),
  };
}

export function buildConfiguration(configurator: Configurator, state: ConfiguratorState): Configuration {
  return configurator.calculator === "folding"
    ? (folding(configurator, state) as unknown as FoldingConfiguration)
    : generic(configurator, state);
}

export function buildCalculateBody(configurator: Configurator, state: ConfiguratorState): CalculateBody {
  return {
    productTypeCode: configurator.productTypeCode,
    configuration: buildConfiguration(configurator, state),
    ...(POSTCODE.test(state.postcode) ? { deliveryPostcode: state.postcode } : {}),
  };
}

/**
 * The other way: a configuration the API handed back (a shared or saved quotation) → the answers
 * to start the configurator from. Anything that no longer matches the product's current choices
 * is dropped, so a quote reopened after a catalogue change starts from what is still offered.
 */
export function seedFromConfiguration(
  configurator: Configurator,
  configuration: Record<string, unknown>,
  quantity?: number,
): Partial<ConfiguratorState> {
  const known = new Map(configurator.groups.flatMap((group) => group.options.map((option) => [option.id, group])));
  const choices: ConfiguratorState["choices"] = {};
  const put = (id: unknown) => {
    const group = typeof id === "string" ? known.get(id) : undefined;
    if (!group) return;
    const list = choices[group.kind] ?? [];
    choices[group.kind] = group.selection === "single" ? [id as string] : [...list, id as string];
  };
  const num = (value: unknown) => (typeof value === "number" && value > 0 ? value : null);
  const quantities = Array.isArray(configuration.quantities)
    ? (configuration.quantities as unknown[]).filter((value): value is number => typeof value === "number")
    : [];

  if (configurator.calculator === "folding") {
    const folding = configuration as unknown as FoldingConfiguration;
    const part = (folding.parts?.[0] ?? {}) as FoldingPart;
    put(folding.materialId);
    put(part.finish1FrontId);
    put(part.finish1BackId);
    for (const finish of part.finish2 ?? []) put(finish.finishId);
    put(part.diecutTypeId);
    for (const assembly of part.assemblies ?? []) put(assembly.assemblyId);
    const print = configurator.groups
      .find((group) => group.kind === "print")
      ?.options.find(
        (option) =>
          option.print?.front.length === (part.printFront?.length ?? 0) &&
          option.print?.back.length === (part.printBack?.length ?? 0),
      );
    if (print) choices.print = [print.id];
  } else {
    const generic = configuration as unknown as GenericConfiguration;
    for (const value of Object.values(generic.options ?? {})) for (const id of [value].flat()) put(id);
  }

  const patternId =
    typeof configuration.patternId === "string" &&
    configurator.size.patterns.some((pattern) => pattern.id === configuration.patternId)
      ? configuration.patternId
      : undefined;
  const standardSizeCode =
    typeof configuration.standardSizeCode === "string" ? configuration.standardSizeCode : undefined;
  return {
    ...(patternId ? { patternId } : {}),
    sizeMode: standardSizeCode ? "standard" : "custom",
    standardSizeCode: standardSizeCode ?? null,
    dims: {
      l: num(configuration.l),
      w: num(configuration.w),
      d: num(configuration.d),
      gusset: num(configuration.gusset),
    },
    choices: { ...Object.fromEntries(configurator.groups.map((group) => [group.kind, []])), ...choices },
    ...(quantities.length > 0 ? { quantities: [...new Set(quantities)].sort((a, b) => a - b) } : {}),
    ...(quantity ? { quantity } : quantities[0] ? { quantity: quantities[0] } : {}),
  };
}
