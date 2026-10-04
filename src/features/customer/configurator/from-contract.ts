/**
 * The published `store.catalog.getConfigurator` (contract v0.6.0) → the view the configurator
 * screens were built on (F3 3.2).
 *
 * A thin adapter, on purpose (user decision 2026-10-01): it lets the configurator and the instant
 * quote run on the real backend now, and U2.F1 (configurator v2) rebuilds the screens directly on
 * `StoreConfiguratorDto` and deletes this file. So the view type below is a UI type — the subset
 * the screens read — not an API response type.
 *
 * Every field the contract carries is mapped. What the screens used and the contract does not
 * carry is the honest empty value (null, [], no explainer) and marked
 * `CONTRACT-GAP store.configurator`; nothing here invents a price, a limit or a default.
 */

import type { Schemas } from "@/lib/api/types";

type Dto = Schemas["StoreConfiguratorDto"];

export type CalculatorKey = Schemas["CalculatorKey"];
export type DesignOption = Schemas["DesignOption"];
export type MockupOption = Schemas["MockupOption"];
export type ProductUnit = Schemas["ProductUnit"];
export type PrintArea = Schemas["CorrugatePrintArea"];

/** How a product is sized: a box (L × W × H), a flat item (W × L), a pouch (+ gusset), or not at all. */
export type SizeKind = "box" | "flat" | "pouch" | "none";

/**
 * The choice groups the stepper shows. The published `OfferableOptionKind` is per catalogue
 * table; these are per calculator input, so one coating group answers both sides.
 */
export type GroupKind = "material" | "print" | "coating_front" | "coating_back" | "finish" | "diecut" | "assembly";

/** The stepper step a group is shown in — the storefront's layout per kind. */
export type ChoiceStep = "material" | "printing" | "finishing" | "assembly";

export interface PrintColour {
  inkColourId: string;
  percent: number;
}

export interface ConfiguratorOption {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  descriptionTh: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  swatchHex: string | null;
  isDefault: boolean;
  /** The catalogue row's kind-specific attributes (gsm, flute, finish kind…), as published. */
  attributes: Record<string, unknown>;
  /**
   * CONTRACT-GAP store.configurator — no print presets are published ("4 สี" as the process colour
   * four times): the contract offers ink colours and leaves composing them, with their coverage, to
   * the storefront. Until U2.F1 builds that picker, no option carries a preset and the configurator
   * prices an unprinted part.
   */
  print: { front: PrintColour[]; back: PrintColour[] } | null;
  /** Finishes and assemblies placed by count or size (foil, spot UV, window film). */
  area: {
    requiresAmount: boolean;
    requiresWidth: boolean;
    requiresLength: boolean;
    /** CONTRACT-GAP store.configurator — no maximum count is published; the API checks the count. */
    maxAmount: number | null;
  } | null;
}

export interface ConfiguratorGroup {
  kind: GroupKind;
  step: ChoiceStep;
  /** Follows the calculator's configuration: a list (`finish2`, `assemblies`) or one id. */
  selection: "single" | "multiple";
  /** The configuration cannot be priced without it (`materialId`). */
  required: boolean;
  options: ConfiguratorOption[];
}

/** Size rules the configurator checks as the customer types; `null` = no limit. The API checks them again. */
export interface SizeRules {
  minLengthMm: number | null;
  maxLengthMm: number | null;
  minWidthMm: number | null;
  maxWidthMm: number | null;
  minHeightMm: number | null;
  maxHeightMm: number | null;
  /** CONTRACT-GAP store.configurator — no gusset limits (no pouch calculator is ported yet, U-B6). */
  minGussetMm: number | null;
  maxGussetMm: number | null;
  lengthMustExceedWidth: boolean;
  lengthMustExceedHeight: boolean;
  /** Corrugate: the height at most a share of the width — the calculator's share, not published. */
  widthMustExceedHeight: boolean;
  /** CONTRACT-GAP store.configurator — no cutting step is published; `null` = any whole millimetre. */
  stepMm: number | null;
}

export interface ConfiguratorPattern {
  id: string;
  code: string;
  name: string;
  /** `@packio/dieline` style key when the 3D preview can draw it. */
  dielineKey: string | null;
  imageUrl: string | null;
  descriptionTh: string | null;
  descriptionEn: string | null;
  /** The parts of a multi-part pattern; empty = one part, sent without `subPatternId`. */
  parts: { subPatternId: string; seq: number; name: string }[];
  /**
   * Corrugate: the flutes offered; empty = any. A board names its flute by code
   * (`attributes.flute`), not by id, so the storefront cannot hide a board of another flute —
   * the API refuses one.
   */
  fluteTypeIds: string[];
  rules: SizeRules;
}

export interface ConfiguratorStandardSize {
  id: string;
  code: string;
  name: string;
  /** Standard sizes belong to the catalogue product: `null` = any of its patterns. */
  patternId: string | null;
  lengthMm: number;
  widthMm: number;
  heightMm: number | null;
  /** CONTRACT-GAP store.configurator — no gusset on a standard size. */
  gussetMm: number | null;
}

export interface Configurator {
  slug: string;
  catalogProductId: string;
  productTypeCode: string;
  calculator: CalculatorKey;
  /** Priced online now (D-043, D-100); otherwise the configurator routes to RFQ. */
  instant: boolean;
  /** The product's own difficulty level (the calculator's input, not the customer's choice). */
  difficultyLevelId: string | null;
  /** The sales unit (`ชิ้น`, `ซอง`…) in the reader's language. */
  unit: string;
  size: {
    kind: SizeKind;
    patterns: ConfiguratorPattern[];
    standardSizes: ConfiguratorStandardSize[];
    /** The customer may type their own size within the pattern's rules. */
    customAllowed: boolean;
  };
  groups: ConfiguratorGroup[];
  /** Corrugate: where a colour can print; empty for the other calculators. */
  printAreas: PrintArea[];
  quantity: {
    /** Suggested quantities, ascending. */
    presets: number[];
    /** `null` = no limit published; the API checks the quantity. */
    min: number | null;
    max: number | null;
    /** `null` = no suggestion: the customer types the first quantity. */
    default: number | null;
    /** How many quantities one calculation prices. */
    maxTiers: number;
  };
  design: { options: DesignOption[]; default: DesignOption };
  /**
   * CONTRACT-GAP store.configurator — no mockup add-on is published: D-192 turns it into the
   * `sample` entity, whose order-attached part comes with U2.F. Empty, so the step offers none.
   */
  mockup: { options: MockupOption[] };
  /** D-051, from settings: how long a saved quotation holds its price. */
  quoteValidityDays: number;
}

export interface ConfiguratorLabels {
  /** The sales unit in the reader's language (`catalog.stock.units`). */
  unit: (unit: ProductUnit) => string;
}

/**
 * CONTRACT-GAP store.configurator — the size kind is not published; it is implied by the
 * calculator. The API publishes a configurator only for the ported folding and corrugate
 * calculators, which are boxes; the others are read the way the storefront has always sized them.
 */
const SIZE_KIND: Record<CalculatorKey, SizeKind> = {
  folding: "box",
  corrugate: "box",
  label: "flat",
  tag_sleeve: "flat",
  pouch: "pouch",
  standard_product: "none",
  service: "none",
};

const bool = (value: unknown) => value === true;

function optionOf(option: Schemas["StoreOptionDto"], placed: boolean): ConfiguratorOption {
  const attributes = option.attributes ?? {};
  const requiresAmount = bool(attributes.requiresAmount);
  const requiresWidth = bool(attributes.requiresWidth);
  const requiresLength = bool(attributes.requiresLength);
  return {
    id: option.id,
    code: option.code,
    nameTh: option.nameTh,
    nameEn: option.nameEn,
    descriptionTh: option.descriptionTh,
    descriptionEn: option.descriptionEn,
    imageUrl: option.imageUrl,
    swatchHex: option.swatchHex,
    isDefault: option.isDefault,
    attributes,
    print: null,
    area:
      placed && (requiresAmount || requiresWidth || requiresLength)
        ? { requiresAmount, requiresWidth, requiresLength, maxAmount: null }
        : null,
  };
}

/**
 * Where each published option kind goes, and how it is chosen — read off the calculator's
 * configuration (`FoldingPartDto`, `CorrugatePartDto`): one material, one coating per side, any
 * number of finishes and assemblies, one die-cut.
 */
type GroupShape = Omit<ConfiguratorGroup, "options"> & { placed?: boolean };

const GROUPS_OF: Partial<Record<Schemas["OfferableOptionKind"], GroupShape[]>> = {
  material: [{ kind: "material", step: "material", selection: "single", required: true }],
  coating: [
    { kind: "coating_front", step: "finishing", selection: "single", required: false },
    { kind: "coating_back", step: "finishing", selection: "single", required: false },
  ],
  finish: [{ kind: "finish", step: "finishing", selection: "multiple", required: false, placed: true }],
  diecut: [{ kind: "diecut", step: "assembly", selection: "single", required: false }],
  assembly: [{ kind: "assembly", step: "assembly", selection: "multiple", required: false, placed: true }],
  // CONTRACT-GAP store.configurator — `ink_colour`: no print presets (see `ConfiguratorOption.print`),
  // so there is no printing group. `print_type` and `pattern` are inputs neither published
  // configuration takes, and the patterns come in `patterns`.
};

function groupsOf(dto: Dto): ConfiguratorGroup[] {
  return dto.optionGroups.flatMap((group) =>
    (GROUPS_OF[group.kind] ?? []).map(({ placed = false, ...shape }) => ({
      ...shape,
      options: group.options.map((option) => optionOf(option, placed)),
    })),
  );
}

function patternOf(pattern: Schemas["StoreConfiguratorPatternDto"], kind: SizeKind): ConfiguratorPattern {
  const { rules } = pattern;
  return {
    id: pattern.id,
    code: pattern.code,
    name: pattern.name,
    dielineKey: pattern.dielineKey,
    imageUrl: pattern.imageUrl,
    descriptionTh: pattern.descriptionTh,
    descriptionEn: pattern.descriptionEn,
    parts: [...pattern.parts].sort((a, b) => a.seq - b.seq),
    fluteTypeIds: pattern.fluteTypeIds,
    rules: {
      minLengthMm: rules.minLMm,
      maxLengthMm: rules.maxLMm,
      minWidthMm: rules.minWMm,
      maxWidthMm: rules.maxWMm,
      minHeightMm: kind === "box" ? rules.minHMm : null,
      maxHeightMm: kind === "box" ? rules.maxHMm : null,
      minGussetMm: null,
      maxGussetMm: null,
      lengthMustExceedWidth: rules.lengthMustExceedWidth,
      lengthMustExceedHeight: rules.lengthMustExceedHeight,
      widthMustExceedHeight: rules.widthMustExceedHeight,
      stepMm: null,
    },
  };
}

export function fromContract(dto: Dto, labels: ConfiguratorLabels): Configurator {
  const kind = SIZE_KIND[dto.calculator];
  return {
    slug: dto.slug,
    catalogProductId: dto.catalogProductId,
    productTypeCode: dto.productTypeCode,
    calculator: dto.calculator,
    instant: dto.instant,
    difficultyLevelId: dto.difficultyLevelId,
    unit: labels.unit(dto.unit),
    size: {
      kind,
      patterns: kind === "none" ? [] : dto.patterns.map((pattern) => patternOf(pattern, kind)),
      standardSizes:
        kind === "none"
          ? []
          : dto.standardSizes.map((size) => ({
              id: size.id,
              code: size.code,
              name: size.name,
              patternId: null,
              lengthMm: size.lengthMm,
              widthMm: size.widthMm,
              heightMm: kind === "box" ? size.heightMm : null,
              gussetMm: null,
            })),
      // The calculators accept any size within the pattern's rules (triage `store.configurator`).
      customAllowed: kind !== "none",
    },
    groups: groupsOf(dto).filter((group) => group.options.length > 0),
    printAreas: dto.printAreas,
    quantity: {
      presets: [...dto.quantity.presets].sort((a, b) => a - b),
      min: dto.quantity.min,
      max: dto.quantity.max,
      default: dto.quantity.default,
      maxTiers: dto.quantity.maxTiers,
    },
    design: { options: dto.design.options, default: dto.design.default },
    mockup: { options: [] },
    quoteValidityDays: dto.quoteValidityDays,
  };
}
