/**
 * The quick calculator's model (prompt item 4): what it prices is exactly what the configurator would
 * price when opened from its CTA. The state is built the configurator's own way — a link's parameters
 * (`qty`, `pf`) through `seedFromDesign` onto the API's default spec (`initialState`, D-441) — and the
 * body by the configurator's `buildCalculateBody`; the CTA link is that same state written back by
 * `queryOf`. So calculator, CTA and configurator cannot disagree (GLOBAL-RULES §5: one pricing path).
 *
 * Pure: no fetching, no money.
 */

import { configureHref } from "@/features/customer/catalog/paths";
import { buildCalculateBody, type CalculateBody } from "@/features/customer/configurator/build";
import { groupsOf } from "@/features/customer/configurator/model";
import {
  choiceOf,
  choiceValues,
  idsOfChoice,
  sideModelOf,
  type PrintChoice,
} from "@/features/customer/configurator/print-model";
import {
  initialState,
  readyToPrice,
  type Configurator,
  type ConfiguratorState,
} from "@/features/customer/configurator/state";
import { PARAMS, queryOf, searchWith, seedFromDesign } from "@/features/customer/configurator/url-state";

export type { PrintChoice };

/** The configurator's ceiling on quantities priced in one request (`quantity.maxTiers`, ≤ 10). */
const MAX_TIERS = 10;

export interface PrintOption {
  /** The radio value: `none`, `cmyk`, `spot`, `spot:<ink id>` (model), or `ink:<id>` (no model). */
  choice: PrintChoice;
  /** The ink ids this choice prints the outside with. */
  ids: string[];
  /** The ink option it names, for its label; null for "ไม่พิมพ์" / "สีพิเศษ". */
  inkId: string | null;
}

/**
 * The outside print choices the product offers (prompt item 4, "print options from the product's real
 * spec options"): the per-side print model's radios when it has one (D-443), else its ink list plus
 * "ไม่พิมพ์". Empty when the product has no outside print at all — then no chips are drawn.
 */
export function printOptions(configurator: Configurator): PrintOption[] {
  const group = groupsOf(configurator).find((candidate) => candidate.kind === "print_front");
  if (!group) return [];
  const side = sideModelOf(configurator, "print_front");
  const has = (id: string) => group.options.some((option) => option.id === id);
  if (side) {
    return choiceValues(side, has).map((choice) => ({
      choice,
      ids: idsOfChoice(side, choice, []),
      inkId: choice === "cmyk" ? (side.cmyk?.inkColourId ?? null) : choice.startsWith("spot:") ? choice.slice(5) : null,
    }));
  }
  return [
    { choice: "none", ids: [], inkId: null },
    ...group.options.map((option) => ({ choice: `ink:${option.id}`, ids: [option.id], inkId: option.id })),
  ];
}

/** The choice the configurator opens on (the default spec's outside print). */
export function defaultPrintChoice(configurator: Configurator): PrintChoice | null {
  const options = printOptions(configurator);
  if (options.length === 0) return null;
  const ids = initialState(configurator).choices.print_front ?? [];
  const side = sideModelOf(configurator, "print_front");
  if (side) return choiceOf(side, ids);
  return ids[0] ? `ink:${ids[0]}` : "none";
}

export interface CalcInput {
  quantity: number;
  /** null = the product's default print. */
  print: PrintChoice | null;
}

/** The link parameters a calculator input stands for (the configurator's own names, `url-state.ts`). */
export function calcQuery(configurator: Configurator, input: CalcInput): Record<string, string> {
  const query: Record<string, string> = { [PARAMS.quantity]: String(input.quantity) };
  if (input.print !== null && input.print !== defaultPrintChoice(configurator)) {
    const option = printOptions(configurator).find((candidate) => candidate.choice === input.print);
    if (option) query[PARAMS.printFront] = option.ids.length ? option.ids.join(",") : "none";
  }
  return query;
}

/** The configuration the calculator prices: the configurator's state for that link. */
export function calcState(configurator: Configurator, input: CalcInput): ConfiguratorState {
  return initialState(configurator, seedFromDesign(configurator, calcQuery(configurator, input)) ?? {});
}

/**
 * The quantities priced in one request: the presets and the chosen quantity, ascending, no more than the
 * product's `maxTiers` (≤ 10).
 */
export function calcQuantities(configurator: Configurator, quantity: number): number[] {
  const limit = Math.max(1, Math.min(MAX_TIERS, configurator.quantity.maxTiers));
  const presets = [...new Set(configurator.quantity.presets)].sort((a, b) => a - b);
  const others = presets.filter((preset) => preset !== quantity).slice(0, limit - 1);
  return [...others, quantity].sort((a, b) => a - b);
}

/**
 * `store.quotes.calculate`'s body for the input: the configurator's own body for that state, asking for
 * the presets as well so the bars come in the same answer. Null when the state cannot be priced.
 */
export function calcBody(configurator: Configurator, input: CalcInput): CalculateBody | null {
  const state = calcState(configurator, input);
  if (!readyToPrice(configurator, state)) return null;
  const body = buildCalculateBody(configurator, state);
  return {
    ...body,
    configuration: { ...body.configuration, quantities: calcQuantities(configurator, input.quantity) },
  } as CalculateBody;
}

/** "ปรับขนาดและสั่งซื้อ": the configurator opened on the same product, quantity and print. */
export function calcCtaHref(configurator: Configurator, input: CalcInput): string {
  const query = queryOf(configurator, calcState(configurator, input));
  const search = searchWith("", query);
  return search ? `/configure/${configurator.slug}?${search}` : configureHref(configurator.slug);
}

/** Whether a quantity may be asked for: whole, within the product's minimum and maximum. */
export function quantityProblem(configurator: Configurator, quantity: number): "min" | "max" | "invalid" | null {
  if (!Number.isInteger(quantity) || quantity <= 0) return "invalid";
  const { min, max } = configurator.quantity;
  if (min !== null && quantity < min) return "min";
  if (max !== null && quantity > max) return "max";
  return null;
}

/** The quantity the calculator opens on: the reference quantity (D-441) when offered, else the first preset at or over the minimum. */
export function startQuantity(configurator: Configurator): number {
  const { presets, min } = configurator.quantity;
  const reference = configurator.defaultSpec?.quantity ?? configurator.quantity.default;
  if (reference && quantityProblem(configurator, reference) === null) return reference;
  return presets.find((preset) => quantityProblem(configurator, preset) === null) ?? min ?? presets[0] ?? 1;
}
