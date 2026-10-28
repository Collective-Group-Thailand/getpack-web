/**
 * The configurator's state in the address bar: which parameters there are, how a link becomes the
 * starting configuration (`seedFromDesign`) and how the configuration becomes a link again
 * (`queryOf`). The names are defined here once; the product page, the home page's quick start, the
 * Studio's "order this" and the configurator itself all speak this one vocabulary.
 *
 * Pure, so the round trip is tested without a browser. A parameter that is garbled, or names something
 * this product does not offer (a size code, a board, an ink), is ignored — never guessed at. The
 * postcode and the target price are deliberately not here: they are the customer's own, kept locally
 * or internal-only, and a shared link must not carry them.
 */

import {
  basesOf,
  groupsOf,
  sizeKindOf,
  type Configurator,
  type DesignOption,
  type GroupKind,
  type MeasurementBasis,
} from "./model";
import { axesOf, initialState, NO_DIMS, withTier, type Axis, type ConfiguratorState } from "./state";

/** The parameters the configurator reads and writes. */
export const PARAMS = {
  /** A pattern (box style) id. */
  pattern: "pattern",
  /** A standard size's code, or a custom inside size as `LxWxH` in millimetres (`140x97.5x60`, `LxW` when flat). */
  size: "size",
  /** The basis a custom size is measured on (`external`, `over_crease`); without it, the inside / the item's own size. */
  basis: "basis",
  /** The board's option id. */
  material: "material",
  /** The outside print: ink option ids, comma-separated, or `none`. */
  printFront: "pf",
  /** The inside print, the same way. */
  printBack: "pb",
  /** The quantity the summary headlines. */
  quantity: "qty",
  /** How the artwork comes: a `DesignOption`, or a Studio design's id (the Studio's "order this"). */
  design: "design",
} as const;

/**
 * Older or other links in the wild, read and never written: the home page's quick start and the designer
 * (`l`, `w`, `d`, `ink`), and `print` — the outside print by its plain name, as the product page's brief
 * spells it (`?size=&material=&print=&qty=`, pdp redesign item 3); `pf` wins when both are there.
 */
export const LEGACY_PARAMS = { l: "l", w: "w", d: "d", ink: "ink", print: "print" } as const;

/** Other features' parameters on this address (`?from`, `?quote`, `?calc`, …): left exactly as they are. */
const OWNED: readonly string[] = [...Object.values(PARAMS), ...Object.values(LEGACY_PARAMS)];

/** What a link can say, before it has been checked against a product. */
export type ConfiguratorQuery = Partial<Record<string, string | string[] | undefined>>;

const DESIGN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MM = /^\d{1,4}(\.\d)?$/;
const SIZE = /^(\d{1,4}(?:\.\d)?)x(\d{1,4}(?:\.\d)?)(?:x(\d{1,4}(?:\.\d)?))?$/i;

/** A parameter's one value: a repeated parameter or a non-string is read as absent, never thrown on. */
function text(query: ConfiguratorQuery, name: string): string | undefined {
  const value = query[name];
  return typeof value === "string" && value !== "" && value.length <= 200 ? value : undefined;
}

const mm = (value: string | undefined | null) => (value && MM.test(value) ? Number(value) : null);

/**
 * A configuration started from a link (F4 C.2, the designer's "order this"; the product page; a refresh):
 * the pattern, size, board, print, quantity and artwork option where this product offers them.
 * Anything it does not offer — and everything the link does not say — is left at the API's defaults;
 * in particular the artwork option is only ever set by an explicit `design`.
 */
export function seedFromDesign(
  configurator: Configurator,
  raw: ConfiguratorQuery,
): Partial<ConfiguratorState> | undefined {
  const groups = groupsOf(configurator);

  // size: a standard size's code, or LxWxH (the older l / w / d still work).
  const sizeParam = text(raw, PARAMS.size);
  const standard = sizeParam ? configurator.standardSizes.find((candidate) => candidate.code === sizeParam) : undefined;
  const parsed = !standard && sizeParam ? SIZE.exec(sizeParam) : null;
  const [l, w, d] = parsed
    ? [mm(parsed[1]), mm(parsed[2]), mm(parsed[3])]
    : [mm(text(raw, LEGACY_PARAMS.l)), mm(text(raw, LEGACY_PARAMS.w)), mm(text(raw, LEGACY_PARAMS.d))];
  const basisParam = text(raw, PARAMS.basis);
  const basis = basesOf(configurator).find((candidate) => candidate === basisParam) ?? null;

  // The home page's quick start sends the quantity too (U-F3); one the product does not take is ignored.
  const qtyParam = text(raw, PARAMS.quantity);
  const qty = qtyParam && /^\d{1,7}$/.test(qtyParam) ? Number(qtyParam) : null;
  const tiers = qty !== null ? withTier(configurator, initialState(configurator).quantities, qty) : null;

  const pattern = configurator.patterns.find((candidate) => candidate.id === text(raw, PARAMS.pattern));
  const material = groups
    .find((group) => group.kind === "material")
    ?.options.find((option) => option.id === text(raw, PARAMS.material));

  /** One side's inks: `none` is blank; nothing offered in it is no answer at all. */
  const inksOf = (kind: GroupKind, value: string | undefined): string[] | null => {
    if (value === undefined) return null;
    if (value === "none") return [];
    const group = groups.find((candidate) => candidate.kind === kind);
    const ids = [...new Set(value.split(","))].filter((id) => group?.options.some((option) => option.id === id));
    return ids.length > 0 ? ids : null;
  };
  const printFrontParam = text(raw, PARAMS.printFront) ?? text(raw, LEGACY_PARAMS.print);
  // The home hero (`ink`) prices its board and outside inks and nothing else, so what it does not send starts
  // unanswered; `pf` / `pb` are one side each of a complete configuration and leave the rest at the defaults.
  const hero = printFrontParam === undefined && text(raw, LEGACY_PARAMS.ink) !== undefined;
  const front = inksOf("print_front", printFrontParam ?? text(raw, LEGACY_PARAMS.ink));
  const back = inksOf("print_back", text(raw, PARAMS.printBack));

  const designParam = text(raw, PARAMS.design);
  const designId = designParam && DESIGN_ID.test(designParam) ? designParam : null;
  const design: DesignOption | undefined = designId
    ? configurator.design.options.find((option) => option === "online_designer")
    : configurator.design.options.find((option) => option === designParam);

  if (!pattern && !material && !(l && w) && !tiers && !standard && !front && !back && !design) return undefined;

  const seed: Partial<ConfiguratorState> = {};
  if (standard) {
    seed.sizeMode = "standard";
    seed.standardSizeCode = standard.code;
    seed.dims = { ...NO_DIMS, l: standard.lengthMm, w: standard.widthMm, d: standard.heightMm };
    seed.basis = "internal";
  }
  if (tiers && qty !== null) {
    seed.quantities = tiers;
    seed.quantity = qty;
  }
  if (pattern) seed.patternId = pattern.id;
  if (l && w) {
    seed.sizeMode = "custom";
    seed.standardSizeCode = null;
    seed.dims = { ...NO_DIMS, l, w, d };
    // The designer draws a box on its inside size (F4); a basis in the link is the customer's own.
    seed.basis = basis ?? (sizeKindOf(configurator) === "box" ? "internal" : "product");
  }
  if (material || front || back) {
    const base = initialState(configurator);
    const defaults = hero
      ? Object.fromEntries(groups.map((group) => [group.kind, group.required ? (base.choices[group.kind] ?? []) : []]))
      : base.choices;
    seed.choices = {
      ...defaults,
      ...(material ? { material: [material.id] } : {}),
      ...(front ? { print_front: front } : {}),
      ...(back ? { print_back: back } : {}),
    };
  }
  // Only an asked-for option is seeded (`?design=own_file` from `/studio/upload`, a design's "order this").
  // Without one the step opens on the API's own default (`configurator.design.default`).
  if (design) seed.designOption = design;
  if (design && designId) seed.designDocumentId = designId;
  return seed;
}

/* ----------------------------------------------------------------------------- state → link */

/** The size as the link carries it: a standard size's code, or `LxWxH` — `null` where it cannot be said. */
function sizeOf(
  configurator: Configurator,
  state: ConfiguratorState,
): { size: string; basis?: MeasurementBasis } | null {
  if (state.sizeMode === "standard") return state.standardSizeCode ? { size: state.standardSizeCode } : null;
  const axes: Axis[] = axesOf(configurator, state);
  // A pouch's gussets are not in the link: it would be a size the link cannot say.
  if (state.basis === null || axes.some((axis) => axis !== "l" && axis !== "w" && axis !== "d")) return null;
  const values = axes.map((axis) => state.dims[axis]);
  if (values.some((value) => value === null || !MM.test(String(value)))) return null;
  const order: Axis[] = ["l", "w", "d"];
  const size = order
    .filter((axis) => axes.includes(axis))
    .map((axis) => String(state.dims[axis]))
    .join("x");
  const plain = sizeKindOf(configurator) === "box" ? "internal" : "product";
  return state.basis === plain ? { size } : { size, basis: state.basis };
}

function paramsOf(configurator: Configurator, state: ConfiguratorState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.patternId) out[PARAMS.pattern] = state.patternId;
  const size = sizeOf(configurator, state);
  if (size) {
    out[PARAMS.size] = size.size;
    if (size.basis) out[PARAMS.basis] = size.basis;
  }
  const material = state.choices.material?.[0];
  if (material) out[PARAMS.material] = material;
  const side = (kind: "print_front" | "print_back") => {
    const ids = state.choices[kind];
    return ids ? (ids.length > 0 ? ids.join(",") : "none") : null;
  };
  const front = side("print_front");
  const back = side("print_back");
  if (front) out[PARAMS.printFront] = front;
  if (back) out[PARAMS.printBack] = back;
  if (state.quantity > 0) out[PARAMS.quantity] = String(state.quantity);
  out[PARAMS.design] =
    state.designOption === "online_designer" && state.designDocumentId ? state.designDocumentId : state.designOption;
  return out;
}

/**
 * What the link must say for a visit to come back to this configuration: every parameter whose value
 * differs from the API's starting configuration (`initialState`). Defaults are left out, so an
 * untouched configurator has a clean address.
 */
export function queryOf(configurator: Configurator, state: ConfiguratorState): Record<string, string> {
  const start = paramsOf(configurator, initialState(configurator));
  return Object.fromEntries(
    Object.entries(paramsOf(configurator, state)).filter(([key, value]) => start[key] !== value),
  );
}

/** The address's search with the configurator's parameters replaced and every other one kept. */
export function searchWith(current: string, query: Record<string, string>): string {
  const next = new URLSearchParams(current);
  for (const key of OWNED) next.delete(key);
  for (const [key, value] of Object.entries(query)) next.set(key, value);
  return next.toString();
}
