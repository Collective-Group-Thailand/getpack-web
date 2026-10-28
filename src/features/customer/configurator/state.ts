/**
 * What the customer has chosen so far, and what is wrong with it — pure, so the rules are
 * tested without a browser and the components only render them.
 *
 * Nothing here prices, converts or limits anything on its own. The size rules are the API's
 * (`StoreSizeRulesDto`, internal millimetres, and `StorePouchShapeDto`) and are checked here only
 * so a mistake is explained as it is typed; a size entered on another basis is checked through the
 * API's own conversion (`store.specs.convertDimensions`). The API checks everything again.
 */

import type { Schemas } from "@/lib/api/types";
import type { LengthUnit } from "@/ui/components/DimensionInput";

import {
  basesOf,
  groupsOf,
  normaliseInks,
  optionsById,
  patternById,
  placementOf,
  pouchPartsOf,
  sizeKindOf,
  type ChoiceGroup,
  type Configurator,
  type DesignOption,
  type GroupKind,
  type MeasurementBasis,
  type PrintArea,
  type StoreOption,
} from "./model";
import { isCorrugate, isPrintKind, normaliseCorrugateSide, normaliseSingleInk, startIds } from "./print-model";

export type { ChoiceGroup, Configurator, DesignOption, GroupKind, MeasurementBasis, StoreOption } from "./model";

/** Length, width, depth (boxes); bottom gusset, side gusset, centre seal (pouches). */
export type Axis = "l" | "w" | "d" | "b" | "s" | "cs";

export interface AreaInput {
  amount: number;
  widthMm: number | null;
  lengthMm: number | null;
}

/** What the Structure Advisor needs to know about the goods and their journey (D-238); all optional. */
export interface LoadInput {
  productWeightG: number | null;
  unitsPerBox: number | null;
  stackLayers: number | null;
  fragility: Schemas["AdvisoryFragility"] | null;
  transportMode: Schemas["AdvisoryTransportMode"] | null;
  humidity: Schemas["AdvisoryHumidityBand"] | null;
  storage: Schemas["AdvisoryStorageBand"] | null;
  /** `null` = not palletised. */
  pallet: { pattern: Schemas["AdvisoryPalletPattern"]; overhang: boolean } | null;
}

/** The print sides of one part of a multi-part box. */
export interface PartPrint {
  print_front: string[];
  print_back: string[];
}

/** The board the customer took from a recommendation (D-240). */
export interface AdvisoryChoice {
  recommendationId: string;
  boardId: string;
}

export interface ConfiguratorState {
  patternId: string | null;
  sizeMode: "standard" | "custom";
  standardSizeCode: string | null;
  /** Millimetres on `basis`, as entered. */
  dims: Record<Axis, number | null>;
  /** D-182: chosen by the customer — `null` until they do (no silent default). */
  basis: MeasurementBasis | null;
  /**
   * The API builds this box pattern flat (an insert, a flat card — its conversion measures it on
   * `product` only, `usePatternBases`): sized width × length, no depth.
   */
  flatStyle: boolean;
  /** D-183, display only: the dims above stay millimetres whatever this says. */
  unit: LengthUnit;
  /** Group kind → chosen option ids. A single-choice group holds at most one. */
  choices: Partial<Record<GroupKind, string[]>>;
  /**
   * A box of several parts (a telescope body and lid): sub-pattern id → that part's print, when the
   * customer prints the parts differently. A part not listed prints as `choices.print_*` — every
   * part is priced either way (`build.ts`).
   */
  partPrints: Record<string, PartPrint>;
  /** Option id → where a placed finish or assembly goes. */
  areas: Record<string, AreaInput>;
  /** Corrugate: where the colours print (`CorrugatePrintColourDto.area`). */
  printArea: PrintArea | null;
  /** The quantities priced side by side (price breaks), ascending. */
  quantities: number[];
  /** The one the dock headlines and the quote is saved for. */
  quantity: number;
  postcode: string;
  promoCode: string;
  designOption: DesignOption;
  /**
   * The customer's Studio design this configuration orders (B4.1, `AddCartItemDto.designDocumentId`):
   * the studio's "order this" opens the configurator on it, and the cart line carries it so the
   * order's artwork is the design, not an upload to make later.
   */
  designDocumentId: string | null;
  /** D-247: an optional target per piece (THB incl. VAT, excl. shipping), as typed. */
  target: string;
  load: LoadInput;
  advisory: AdvisoryChoice | null;
}

/**
 * Where the advisor's inputs start (U2.F1 §2 "sensible defaults"): the goods themselves — weight,
 * units, stacking — are the customer's to give; the conditions start at the middle band of each
 * (normal humidity, up to 30 days in store, medium fragility, a parcel service, no pallet), shown
 * as answers the customer can change. The recommendation lists the factors it used (D-189).
 */
export const DEFAULT_LOAD: LoadInput = {
  productWeightG: null,
  unitsPerBox: null,
  stackLayers: null,
  fragility: "medium",
  transportMode: "parcel_domestic",
  humidity: "normal",
  storage: "up_to_30_days",
  pallet: null,
};

export function patternOf(configurator: Configurator, state: Pick<ConfiguratorState, "patternId">) {
  return patternById(configurator, state.patternId);
}

/** The parts the calculator prices, in order: a pattern without parts is one part, sent without a sub-pattern. */
export function partsOf(configurator: Configurator, state: Pick<ConfiguratorState, "patternId">) {
  return [...(patternOf(configurator, state)?.parts ?? [])].sort((a, b) => a.seq - b.seq);
}

/** What one part prints: its own print when the parts differ, else the box's. */
export function printOfPart(
  state: Pick<ConfiguratorState, "choices" | "partPrints">,
  subPatternId: string | undefined,
): PartPrint {
  const own = subPatternId ? state.partPrints[subPatternId] : undefined;
  return own ?? { print_front: state.choices.print_front ?? [], print_back: state.choices.print_back ?? [] };
}

/** The axes a product is sized by, in the order they are asked. */
export function axesOf(
  configurator: Configurator,
  state: Pick<ConfiguratorState, "patternId"> & Partial<Pick<ConfiguratorState, "flatStyle">>,
): Axis[] {
  const kind = sizeKindOf(configurator);
  if (kind === "box") return state.flatStyle ? ["l", "w"] : ["l", "w", "d"];
  if (kind === "flat") return ["w", "l"];
  if (kind === "pouch") return ["w", "l", ...pouchPartsOf(patternOf(configurator, state))];
  return [];
}

/**
 * Quantity tiers around the default: the presets the API offers, capped at `maxTiers`. None when
 * the API suggests nothing — the customer types the first quantity.
 */
function defaultTiers(configurator: Configurator): number[] {
  const { presets, maxTiers, default: preferred } = configurator.quantity;
  const around = [...new Set([...(preferred === null ? [] : [preferred]), ...presets])].sort((a, b) => a - b);
  const start = preferred === null ? 0 : Math.max(0, around.indexOf(preferred) - 1);
  return around.slice(start, start + Math.min(maxTiers, 4));
}

/**
 * The pattern the product opens on: the one its default spec names (D-441), else the first. The id
 * is read from the API's own configuration; nothing is derived from it.
 */
export function defaultPatternOf(configurator: Configurator) {
  const id = configurator.defaultSpec?.configuration["patternId"];
  return configurator.patterns.find((pattern) => pattern.id === id) ?? configurator.patterns[0] ?? null;
}

/** The standard size the product opens on: the one the API marks default (D-441), else the first. */
export function defaultStandardSizeOf(configurator: Configurator) {
  return configurator.standardSizes.find((size) => size.isDefault) ?? configurator.standardSizes[0] ?? null;
}

/**
 * The outside inks of the API's default spec (D-441), for a product whose configurator has no
 * `printModel` yet: the first part's `printFront`, or `null` when the spec does not say.
 */
function defaultSpecInks(configurator: Configurator): string[] | null {
  const parts = configurator.defaultSpec?.configuration["parts"];
  const front = Array.isArray(parts) ? (parts[0] as { printFront?: unknown } | undefined)?.printFront : undefined;
  if (!Array.isArray(front)) return null;
  const offered = new Set(optionsById(configurator).keys());
  return front.flatMap((entry) => {
    const id = (entry as { inkColourId?: unknown } | null)?.inkColourId;
    return typeof id === "string" && offered.has(id) ? [id] : [];
  });
}

export const NO_DIMS: Record<Axis, number | null> = { l: null, w: null, d: null, b: null, s: null, cs: null };

/**
 * The starting configuration: the API's defaults — its default spec's pattern and standard size (D-441),
 * else the first of each — if there is one. A `seed` (a draft, a shared or saved quote reopened) wins where it has an answer.
 * The basis starts unanswered unless the product has only one (`product` for flat items) or a
 * catalogue standard size — an inside size — is the starting point.
 */
export function initialState(configurator: Configurator, seed: Partial<ConfiguratorState> = {}): ConfiguratorState {
  const pattern = defaultPatternOf(configurator);
  const kind = sizeKindOf(configurator);
  const standard = kind === "box" ? defaultStandardSizeOf(configurator) : null;
  const choices: ConfiguratorState["choices"] = {};
  for (const group of groupsOf(configurator)) {
    const defaults = group.options.filter((option) => option.isDefault).map((option) => option.id);
    choices[group.kind] = group.selection === "single" ? defaults.slice(0, 1) : defaults;
    if (isCorrugate(configurator) && isPrintKind(group.kind)) {
      // D-443: each side opens on the model's own default (outside: the default spec's print, inside:
      // none unless the default spec prints it). Without a model: one ink outside, nothing inside.
      choices[group.kind] =
        startIds(configurator, group.kind) ??
        (group.kind === "print_front"
          ? normaliseSingleInk(optionsById(configurator), defaultSpecInks(configurator) ?? defaults)
          : []);
    }
  }
  const bases = basesOf(configurator);
  const tiers = defaultTiers(configurator);
  const state: ConfiguratorState = {
    patternId: pattern?.id ?? null,
    sizeMode: standard ? "standard" : "custom",
    standardSizeCode: standard?.code ?? null,
    dims: standard ? { ...NO_DIMS, l: standard.lengthMm, w: standard.widthMm, d: standard.heightMm } : { ...NO_DIMS },
    basis: standard ? "internal" : bases.length === 1 ? bases[0]! : null,
    flatStyle: false,
    unit: "mm",
    choices,
    partPrints: {},
    areas: {},
    printArea: configurator.printAreas[0] ?? null,
    quantities: tiers,
    // No tier yet: nothing is priced or shown until the customer adds one (`readyToPrice`).
    quantity:
      configurator.quantity.default !== null && tiers.includes(configurator.quantity.default)
        ? configurator.quantity.default
        : (tiers[0] ?? 0),
    postcode: "",
    promoCode: "",
    designOption: configurator.design.default,
    designDocumentId: null,
    target: "",
    load: DEFAULT_LOAD,
    advisory: null,
    ...seed,
  };
  return normaliseInkChoices(configurator, state);
}

/**
 * A seed or draft is brought to a valid print choice per side: on corrugate the product's print
 * model (or, without one, a single ink); on the other calculators a process ink stands alone.
 */
function normaliseInkChoices(configurator: Configurator, state: ConfiguratorState): ConfiguratorState {
  const byId = optionsById(configurator);
  const fix = (kind: "print_front" | "print_back", ids: string[] | undefined) =>
    ids
      ? isCorrugate(configurator)
        ? // C0b: the customer's own picks keep colours beyond the instant price (a quotation), never trimmed.
          normaliseCorrugateSide(configurator, byId, kind, ids, true)
        : normaliseInks(byId, ids)
      : ids;
  const choices = { ...state.choices };
  for (const kind of ["print_front", "print_back"] as const)
    if (choices[kind]) choices[kind] = fix(kind, choices[kind]);
  return {
    ...state,
    choices,
    partPrints: Object.fromEntries(
      Object.entries(state.partPrints).map(([id, print]) => [
        id,
        { print_front: fix("print_front", print.print_front)!, print_back: fix("print_back", print.print_back)! },
      ]),
    ),
  };
}

/* ------------------------------------------------------------------------------ size rules */

export type SizeProblem =
  | { code: "required" }
  | { code: "basis_required" }
  | { code: "min"; limitMm: number; internalMm: number | null }
  | { code: "max"; limitMm: number; internalMm: number | null }
  | { code: "length_exceeds_width" }
  | { code: "length_exceeds_height" }
  | { code: "width_exceeds_height" };

/** The inside size the API converted the entered one to (`ConvertedDimensionsDto.sizes.internal`). */
export type InternalSize = { l: number; w: number; d: number } | null;

/** Whether the size is checked through the API's conversion rather than as entered. */
export const isConverted = (basis: MeasurementBasis | null) =>
  basis !== null && basis !== "internal" && basis !== "product";

/**
 * What is wrong with each axis, by the pattern's rules. An empty object is a valid size.
 *
 * The rules are inside millimetres. A size entered on the inside (or a flat item's own size) is
 * checked as entered; one entered on another basis is checked through `internal` — the API's
 * conversion — and, until that conversion has arrived, only for being filled in.
 */
export function sizeProblems(
  configurator: Configurator,
  state: Pick<ConfiguratorState, "patternId" | "dims" | "basis"> & Partial<Pick<ConfiguratorState, "flatStyle">>,
  internal: InternalSize = null,
): Partial<Record<Axis | "basis", SizeProblem>> {
  const pattern = patternOf(configurator, state);
  const kind = sizeKindOf(configurator);
  if (!pattern || kind === "none") return {};
  const problems: Partial<Record<Axis | "basis", SizeProblem>> = {};
  if (state.basis === null) problems.basis = { code: "basis_required" };
  const axes = axesOf(configurator, state);
  for (const axis of axes) if (state.dims[axis] === null) problems[axis] = { code: "required" };

  const converted = isConverted(state.basis);
  const checked: Partial<Record<Axis, number | null>> = converted
    ? { l: internal?.l ?? null, w: internal?.w ?? null, d: internal?.d ?? null }
    : state.dims;
  const rules = pattern.rules;
  const shape = pattern.pouch;
  const limits: Record<Axis, [number | null, number | null]> = {
    l: [rules.minLMm, rules.maxLMm],
    w: [rules.minWMm, rules.maxWMm],
    d: kind === "box" && !state.flatStyle ? [rules.minHMm, rules.maxHMm] : [null, null],
    b: [shape?.minBMm ?? null, shape?.maxBMm ?? null],
    s: [shape?.minSMm ?? null, shape?.maxSMm ?? null],
    cs: [shape?.minCsMm ?? null, shape?.maxCsMm ?? null],
  };
  for (const axis of axes) {
    const value = checked[axis] ?? null;
    if (problems[axis] || value === null) continue;
    const [min, max] = limits[axis];
    const internalMm = converted ? value : null;
    if (min !== null && value < min) problems[axis] = { code: "min", limitMm: min, internalMm };
    else if (max !== null && value > max) problems[axis] = { code: "max", limitMm: max, internalMm };
  }
  // Checked the way the CS desk checks them (`features/admin/cs/configuration.ts`); the API has
  // the last word on a share it does not publish (`widthMustExceedHeight`).
  const { l, w, d } = checked;
  const box = kind === "box" && !state.flatStyle;
  const clear = (...names: Axis[]) => names.every((axis) => !problems[axis]);
  if (rules.lengthMustExceedWidth && l != null && w != null && clear("l", "w") && l <= w)
    problems.l = { code: "length_exceeds_width" };
  if (rules.lengthMustExceedHeight && box && l != null && d != null && clear("l", "d") && l <= d)
    problems.l = { code: "length_exceeds_height" };
  if (rules.widthMustExceedHeight && box && w != null && d != null && clear("w", "d") && w <= d)
    problems.w = { code: "width_exceeds_height" };
  return problems;
}

/* ----------------------------------------------------------------------------- completeness */

export type StepKey =
  | "size"
  | "logistics"
  | "material"
  | "printing"
  | "finishing"
  | "assembly"
  | "quantity"
  | "delivery"
  | "design"
  | "summary";

/**
 * The steps this product has — a step with nothing in it is left out (the adaptive stepper).
 * `logistics` (the Structure Advisor's inputs) is there only where the advisor answers (D-235).
 */
export function stepsOf(configurator: Configurator, options: { advisor: boolean } = { advisor: false }): StepKey[] {
  const steps: StepKey[] = [];
  const groups = groupsOf(configurator);
  if (sizeKindOf(configurator) !== "none") steps.push("size");
  if (options.advisor) steps.push("logistics");
  for (const step of ["material", "printing", "finishing", "assembly"] as const) {
    if (groups.some((group) => group.step === step)) steps.push(step);
  }
  steps.push("quantity", "delivery", "design", "summary");
  return steps;
}

export function groupsIn(configurator: Configurator, step: StepKey): ChoiceGroup[] {
  return groupsOf(configurator).filter((group) => group.step === step);
}

/** Required groups the customer has not answered. */
export function missingChoices(configurator: Configurator, state: ConfiguratorState): ChoiceGroup[] {
  return groupsOf(configurator).filter((group) => group.required && (state.choices[group.kind]?.length ?? 0) === 0);
}

/** Placed finishes and assemblies whose size the customer still owes. */
export function missingAreas(configurator: Configurator, state: ConfiguratorState): StoreOption[] {
  return groupsOf(configurator).flatMap((group) =>
    (state.choices[group.kind] ?? []).flatMap((id) => {
      const option = group.options.find((candidate) => candidate.id === id);
      const placement = option ? placementOf(group, option) : null;
      if (!option || !placement) return [];
      const area = state.areas[option.id];
      const incomplete =
        !area ||
        (placement.requiresWidth && !area.widthMm) ||
        (placement.requiresLength && !area.lengthMm) ||
        (placement.requiresAmount && !area.amount);
      return incomplete ? [option] : [];
    }),
  );
}

export const POSTCODE = /^\d{5}$/;

/** D-247's format: a positive amount in baht with at most two decimals (the API's own pattern). */
export const TARGET = /^(?!0+(\.0{1,2})?$)\d{1,9}(\.\d{1,2})?$/;

/**
 * Enough to ask for a price: a product priced online, a valid size on a chosen basis, every
 * required choice and a quantity. A standard product has no stock row to price here (its own
 * page sells it), so it never is.
 */
export function readyToPrice(configurator: Configurator, state: ConfiguratorState, internal: InternalSize = null) {
  return (
    configurator.instant &&
    configurator.calculator !== "standard_product" &&
    Object.keys(sizeProblems(configurator, state, internal)).length === 0 &&
    missingChoices(configurator, state).length === 0 &&
    missingAreas(configurator, state).length === 0 &&
    state.quantities.length > 0 &&
    (state.postcode === "" || POSTCODE.test(state.postcode)) &&
    (state.target === "" || TARGET.test(state.target))
  );
}

/**
 * The state on one of the catalogue's standard sizes — an inside size (D-182), so the basis is the
 * inside. The one way a standard size is chosen: the size cards' prices (`option-prices.ts`) and the
 * product page's size picker (pdp redesign) go through it, so they price the same configuration.
 */
export function withStandardSize(
  state: ConfiguratorState,
  size: Pick<Configurator["standardSizes"][number], "code" | "lengthMm" | "widthMm" | "heightMm">,
): ConfiguratorState {
  return {
    ...state,
    sizeMode: "standard",
    standardSizeCode: size.code,
    basis: "internal",
    dims: { ...state.dims, l: size.lengthMm, w: size.widthMm, d: size.heightMm, b: null, s: null, cs: null },
  };
}

/** Adds a quantity tier, keeping them sorted and within the API's bounds (where it gives any). */
export function withTier(configurator: Configurator, tiers: number[], quantity: number): number[] | null {
  const { min, max, maxTiers } = configurator.quantity;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  if ((min !== null && quantity < min) || (max !== null && quantity > max)) return null;
  if (tiers.includes(quantity)) return tiers;
  if (tiers.length >= maxTiers) return null;
  return [...tiers, quantity].sort((a, b) => a - b);
}

/** The chosen options of one kind, as rows. */
export function chosenOf(configurator: Configurator, state: ConfiguratorState, kind: GroupKind): StoreOption[] {
  const byId = optionsById(configurator);
  return (state.choices[kind] ?? []).flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

/**
 * The artwork options this configuration can take: the product's (`configurator.design.options`),
 * less the online designer when it cannot draw the chosen pattern (`designerAvailable`).
 */
export function designOptionsOf(configurator: Configurator, designerAvailable: boolean): DesignOption[] {
  return configurator.design.options.filter((option) => option !== "online_designer" || designerAvailable);
}

/**
 * The option in force: the chosen one while it is offered; otherwise the product's default, or its
 * first offered option — so the step, its collapsed summary and the cart line never carry an option
 * the step does not show (e.g. "ออกแบบออนไลน์" for a pattern the designer cannot draw).
 */
export function designOptionOf(
  configurator: Configurator,
  chosen: DesignOption,
  designerAvailable: boolean,
): DesignOption {
  const offered = designOptionsOf(configurator, designerAvailable);
  if (offered.includes(chosen)) return chosen;
  if (offered.includes(configurator.design.default)) return configurator.design.default;
  return offered[0] ?? chosen;
}
