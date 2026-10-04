/**
 * What the customer has chosen so far, and what is wrong with it — pure, so the rules are
 * tested without a browser and the component only renders them.
 *
 * Nothing here prices anything. The size rules come from the API (`StoreSizeRulesDto`, read by
 * `./from-contract.ts`) and are checked here only so a mistake is explained as it is typed
 * ("กว้างได้ไม่เกิน 500 มม."); the API checks them again and is the authority.
 */

import type { LengthUnit } from "@/ui/components/DimensionInput";

import type {
  Configurator,
  ConfiguratorGroup,
  ConfiguratorOption,
  DesignOption,
  GroupKind,
  MockupOption,
} from "./from-contract";

export type {
  Configurator,
  ConfiguratorGroup,
  ConfiguratorOption,
  ConfiguratorPattern,
  DesignOption,
  GroupKind,
  MockupOption,
} from "./from-contract";

export type Axis = "l" | "w" | "d" | "gusset";

export interface AreaInput {
  amount: number;
  widthMm: number | null;
  lengthMm: number | null;
}

export interface ConfiguratorState {
  patternId: string | null;
  sizeMode: "standard" | "custom";
  standardSizeCode: string | null;
  dims: Record<Axis, number | null>;
  /** Display only (F3 3.2): the dims above stay millimetres whatever this says. */
  unit: LengthUnit;
  /** Group kind → chosen option ids. A single-choice group holds at most one. */
  choices: Partial<Record<GroupKind, string[]>>;
  /** Option id → where a placed finish or assembly goes. */
  areas: Record<string, AreaInput>;
  /** The quantities priced side by side (price breaks), ascending. */
  quantities: number[];
  /** The one the dock headlines and the quote is saved for. */
  quantity: number;
  postcode: string;
  promoCode: string;
  designOption: DesignOption;
  mockupOption: MockupOption;
}

/** The axes a product is sized by. */
export function axesOf(kind: Configurator["size"]["kind"]): Axis[] {
  if (kind === "box") return ["l", "w", "d"];
  if (kind === "pouch") return ["w", "l", "gusset"];
  if (kind === "flat") return ["w", "l"];
  return [];
}

export function patternOf(configurator: Configurator, state: Pick<ConfiguratorState, "patternId">) {
  return (
    configurator.size.patterns.find((pattern) => pattern.id === state.patternId) ??
    configurator.size.patterns[0] ??
    null
  );
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
 * The starting configuration: the API's defaults, the first pattern, the first standard size if
 * there is one. A `seed` (a shared or saved quote reopened) wins where it has an answer.
 */
export function initialState(configurator: Configurator, seed: Partial<ConfiguratorState> = {}): ConfiguratorState {
  const pattern = configurator.size.patterns[0] ?? null;
  const standard =
    configurator.size.standardSizes.find((size) => size.patternId === null || size.patternId === pattern?.id) ?? null;
  const choices: ConfiguratorState["choices"] = {};
  for (const group of configurator.groups) {
    const defaults = group.options.filter((option) => option.isDefault).map((option) => option.id);
    choices[group.kind] = group.selection === "single" ? defaults.slice(0, 1) : defaults;
  }
  const tiers = defaultTiers(configurator);
  return {
    patternId: pattern?.id ?? null,
    sizeMode: standard || !configurator.size.customAllowed ? "standard" : "custom",
    standardSizeCode: standard?.code ?? null,
    dims: {
      l: standard?.lengthMm ?? null,
      w: standard?.widthMm ?? null,
      d: standard?.heightMm ?? null,
      gusset: standard?.gussetMm ?? null,
    },
    unit: "mm",
    choices,
    areas: {},
    quantities: tiers,
    // No tier yet: nothing is priced or shown until the customer adds one (`readyToPrice`).
    quantity:
      configurator.quantity.default !== null && tiers.includes(configurator.quantity.default)
        ? configurator.quantity.default
        : (tiers[0] ?? 0),
    postcode: "",
    promoCode: "",
    designOption: configurator.design.default,
    mockupOption: configurator.mockup.options.includes("none") ? "none" : (configurator.mockup.options[0] ?? "none"),
    ...seed,
  };
}

/* ------------------------------------------------------------------------------ size rules */

export type SizeProblem =
  | { code: "required" }
  | { code: "min"; limitMm: number }
  | { code: "max"; limitMm: number }
  | { code: "step"; stepMm: number }
  | { code: "length_exceeds_width" }
  | { code: "length_exceeds_height" }
  | { code: "width_exceeds_height" };

/** What is wrong with each axis, by the pattern's rules. An empty object is a valid size. */
export function sizeProblems(
  configurator: Configurator,
  state: Pick<ConfiguratorState, "patternId" | "dims">,
): Partial<Record<Axis, SizeProblem>> {
  const pattern = patternOf(configurator, state);
  if (!pattern) return {};
  const rules = pattern.rules;
  const limits: Record<Axis, [number | null, number | null]> = {
    l: [rules.minLengthMm, rules.maxLengthMm],
    w: [rules.minWidthMm, rules.maxWidthMm],
    d: [rules.minHeightMm, rules.maxHeightMm],
    gusset: [rules.minGussetMm, rules.maxGussetMm],
  };
  const problems: Partial<Record<Axis, SizeProblem>> = {};
  for (const axis of axesOf(configurator.size.kind)) {
    const value = state.dims[axis];
    const [min, max] = limits[axis];
    if (value === null) {
      // A pouch without a gusset is a flat pouch: zero is an answer, empty means zero.
      if (axis !== "gusset") problems[axis] = { code: "required" };
      continue;
    }
    if (min !== null && value < min) problems[axis] = { code: "min", limitMm: min };
    else if (max !== null && value > max) problems[axis] = { code: "max", limitMm: max };
    else if (rules.stepMm !== null && rules.stepMm > 1 && value % rules.stepMm !== 0)
      problems[axis] = { code: "step", stepMm: rules.stepMm };
  }
  // Checked the way the CS desk checks them (`features/admin/cs/configuration.ts`). For
  // `widthMustExceedHeight` the calculator allows the height only up to a share of the width, a
  // share it does not publish: this catches a height at or over the width, the API the rest.
  const { l, w, d } = state.dims;
  const box = configurator.size.kind === "box";
  if (rules.lengthMustExceedWidth && l !== null && w !== null && !problems.l && !problems.w && l <= w) {
    problems.l = { code: "length_exceeds_width" };
  }
  if (rules.lengthMustExceedHeight && box && l !== null && d !== null && !problems.l && !problems.d && l <= d) {
    problems.l = { code: "length_exceeds_height" };
  }
  if (rules.widthMustExceedHeight && box && w !== null && d !== null && !problems.w && !problems.d && w <= d) {
    problems.w = { code: "width_exceeds_height" };
  }
  return problems;
}

/* ----------------------------------------------------------------------------- completeness */

export type StepKey = "size" | "material" | "printing" | "finishing" | "assembly" | "quantity" | "delivery" | "design";

/** The steps this product has — a step with nothing in it is left out (the adaptive stepper). */
export function stepsOf(configurator: Configurator): StepKey[] {
  const steps: StepKey[] = [];
  if (configurator.size.kind !== "none") steps.push("size");
  for (const step of ["material", "printing", "finishing", "assembly"] as const) {
    if (configurator.groups.some((group) => group.step === step)) steps.push(step);
  }
  steps.push("quantity", "delivery", "design");
  return steps;
}

export function groupsIn(configurator: Configurator, step: StepKey): ConfiguratorGroup[] {
  return configurator.groups.filter((group) => group.step === step);
}

/** Required single-choice groups the customer has not answered. */
export function missingChoices(configurator: Configurator, state: ConfiguratorState): ConfiguratorGroup[] {
  return configurator.groups.filter(
    (group) => group.required && group.selection === "single" && (state.choices[group.kind]?.length ?? 0) === 0,
  );
}

/** Placed finishes whose size the customer still owes. */
export function missingAreas(configurator: Configurator, state: ConfiguratorState): ConfiguratorOption[] {
  const byId = new Map(configurator.groups.flatMap((group) => group.options.map((option) => [option.id, option])));
  return Object.values(state.choices)
    .flat()
    .flatMap((id) => {
      const option = id ? byId.get(id) : undefined;
      if (!option?.area) return [];
      const area = state.areas[option.id];
      const incomplete =
        !area ||
        (option.area.requiresWidth && !area.widthMm) ||
        (option.area.requiresLength && !area.lengthMm) ||
        (option.area.requiresAmount && !area.amount);
      return incomplete ? [option] : [];
    });
}

export const POSTCODE = /^\d{5}$/;

/** Enough to ask for a price: a product priced online, a valid size, every required choice and a quantity. */
export function readyToPrice(configurator: Configurator, state: ConfiguratorState): boolean {
  return (
    configurator.instant &&
    Object.keys(sizeProblems(configurator, state)).length === 0 &&
    missingChoices(configurator, state).length === 0 &&
    missingAreas(configurator, state).length === 0 &&
    state.quantities.length > 0 &&
    (state.postcode === "" || POSTCODE.test(state.postcode))
  );
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

/**
 * A configuration started from a design (F4 C.2, the designer's "order this"): its catalogue
 * pattern, inside size and material where this product offers them, and the online-designer
 * option. Anything this product does not offer is left at its defaults.
 */
export function seedFromDesign(
  configurator: Configurator,
  query: { pattern?: string; material?: string; l?: string; w?: string; d?: string },
): Partial<ConfiguratorState> | undefined {
  const mm = (value: string | undefined) => (value && /^\d{1,4}(\.\d)?$/.test(value) ? Number(value) : null);
  const [l, w, d] = [mm(query.l), mm(query.w), mm(query.d)];
  const pattern = configurator.size.patterns.find((candidate) => candidate.id === query.pattern);
  const material = configurator.groups
    .find((group) => group.kind === "material")
    ?.options.find((option) => option.id === query.material);
  if (!pattern && !material && !(l && w)) return undefined;
  const seed: Partial<ConfiguratorState> = {};
  if (pattern) seed.patternId = pattern.id;
  if (l && w && configurator.size.customAllowed) {
    seed.sizeMode = "custom";
    seed.standardSizeCode = null;
    seed.dims = { l, w, d, gusset: null };
  }
  if (material) {
    const base = initialState(configurator);
    seed.choices = { ...base.choices, material: [material.id] };
  }
  if (configurator.design.options.includes("online_designer")) seed.designOption = "online_designer";
  return seed;
}
