"use client";

/**
 * The price of every option card (size, material, outside / inside print), from ONE request per
 * state change: `store.quotes.calculateBatch`.
 *
 * Each card is a variant: the full calculate configuration of the current state with exactly one
 * change (a standard size, a material, a print method for a side), built by `build.ts` — nothing is
 * priced or re-implemented here. The variant that equals the current selection is the baseline; the
 * API answers every variant's unit price (incl. VAT, as it sends it) and its difference against the
 * baseline per quantity. Money stays a string: the web never adds or subtracts it.
 *
 * Limits of the endpoint (≤ 24 variants, 20 requests a minute per client): the request is debounced,
 * cached by its body, sent once for the whole page and never per card. Where it is unavailable (an
 * older API without it, a throttle, the network) the cards simply show no price: nothing else depends
 * on it.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

import { buildConfiguration, type Configuration } from "./build";
import { groupsOf, optionsById, type Configurator } from "./model";
import { PRICE_DEBOUNCE_MS, useDebounced } from "./pricing";
import { choiceValues, idsOfChoice, isCorrugate, sideModelOf, choiceOf, type PrintKind } from "./print-model";
import { printOfPart, partsOf, type ConfiguratorState } from "./state";

export type BatchBody = Schemas["CalculateQuoteBatchDto"];
export type BatchResult = Schemas["QuoteBatchResultDto"];

/** The endpoint's own limit of variants in one request. */
export const MAX_VARIANTS = 24;

export const sizeKey = (code: string) => `size:${code}`;
export const materialKey = (id: string) => `material:${id}`;
export const printSideOf = (kind: PrintKind) => (kind === "print_front" ? "outside" : "inside");
export const printKey = (kind: PrintKind, choice: string) => `print:${printSideOf(kind)}:${choice}`;

/** The radio value of a corrugate side without a print model: ไม่พิมพ์ or `ink:<id>`. */
export const NO_MODEL_NONE = "none";
export const inkChoice = (id: string) => `ink:${id}`;

interface Candidate {
  key: string;
  state: ConfiguratorState;
}
interface Family {
  /** The key of the option the state holds now, if one of this family's cards is it. */
  currentKey: string | null;
  candidates: Candidate[];
}

const withChoice = (state: ConfiguratorState, kind: PrintKind, ids: string[]): ConfiguratorState => ({
  ...state,
  choices: { ...state.choices, [kind]: ids },
});

function sizeFamily(configurator: Configurator, state: ConfiguratorState): Family | null {
  if (configurator.calculator !== "folding" && configurator.calculator !== "corrugate") return null;
  if (state.sizeMode !== "standard" || configurator.standardSizes.length === 0) return null;
  return {
    currentKey: state.standardSizeCode ? sizeKey(state.standardSizeCode) : null,
    candidates: configurator.standardSizes.map((size) => ({
      key: sizeKey(size.code),
      state: {
        ...state,
        standardSizeCode: size.code,
        // The catalogue's standard sizes are inside sizes.
        basis: "internal",
        dims: { ...state.dims, l: size.lengthMm, w: size.widthMm, d: size.heightMm, b: null, s: null, cs: null },
      },
    })),
  };
}

function materialFamily(configurator: Configurator, state: ConfiguratorState): Family | null {
  const group = groupsOf(configurator).find((entry) => entry.kind === "material");
  if (!group || group.options.length < 2) return null;
  const current = state.choices.material?.[0] ?? null;
  return {
    currentKey: current ? materialKey(current) : null,
    candidates: group.options.map((option) => ({
      key: materialKey(option.id),
      state: { ...state, choices: { ...state.choices, material: [option.id] } },
    })),
  };
}

/** One corrugate side as the cards show it (`PrintSideChoice`): the model's methods, else the ink list. */
function printFamily(configurator: Configurator, state: ConfiguratorState, kind: PrintKind): Family | null {
  if (!isCorrugate(configurator)) return null;
  const group = groupsOf(configurator).find((entry) => entry.kind === kind);
  if (!group) return null;
  // A box printed otherwise per part has no single side to compare.
  const parts = partsOf(configurator, state);
  if (parts.length > 1 && parts.some((part) => state.partPrints[part.subPatternId])) return null;
  const current = printOfPart(state, undefined)[kind];
  const side = sideModelOf(configurator, kind);
  const byId = optionsById(configurator);
  if (side) {
    return {
      currentKey: printKey(kind, choiceOf(side, current)),
      candidates: choiceValues(side, (id) => byId.has(id)).map((choice) => ({
        key: printKey(kind, choice),
        state: withChoice(state, kind, idsOfChoice(side, choice, current)),
      })),
    };
  }
  return {
    currentKey: printKey(kind, current[0] ? inkChoice(current[0]) : NO_MODEL_NONE),
    candidates: [
      { key: printKey(kind, NO_MODEL_NONE), state: withChoice(state, kind, []) },
      ...group.options.map((option) => ({
        key: printKey(kind, inkChoice(option.id)),
        state: withChoice(state, kind, [option.id]),
      })),
    ],
  };
}

/** The key of the print card for a side holding `ids` (what the batch answers under), as `printFamily` keys it. */
export function printCardKey(configurator: Configurator, kind: PrintKind, ids: string[]): string | null {
  if (!isCorrugate(configurator)) return null;
  const side = sideModelOf(configurator, kind);
  if (side) return printKey(kind, choiceOf(side, ids));
  return printKey(kind, ids[0] ? inkChoice(ids[0]) : NO_MODEL_NONE);
}

export interface VariantPlan {
  /** The key of the variant that IS the current state; the others are compared with it. */
  baselineKey: string;
  variants: { key: string; state: ConfiguratorState }[];
  /** A card whose option is the current one shares the baseline's price: key → baseline key. */
  aliases: Record<string, string>;
}

/**
 * The variants to price for the cards on screen: the options of the size (standard tab), material and
 * the outside / inside print, one change each. The option the state holds now is priced once, as the
 * baseline; the same option in the other families is that same configuration and is not sent again.
 * Null when no card has a current option to compare with.
 */
export function planVariants(configurator: Configurator, state: ConfiguratorState): VariantPlan | null {
  const families = [
    sizeFamily(configurator, state),
    materialFamily(configurator, state),
    printFamily(configurator, state, "print_front"),
    printFamily(configurator, state, "print_back"),
  ].filter((family): family is Family => family !== null && family.candidates.length > 0);

  const base = families.find(
    (family) => family.currentKey !== null && family.candidates.some((c) => c.key === family.currentKey),
  );
  if (!base) return null;
  const baselineKey = base.currentKey!;
  const aliases: Record<string, string> = {};
  const variants: VariantPlan["variants"] = [];
  const seen = new Set<string>();
  const add = (key: string, variant: ConfiguratorState) => {
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({ key, state: variant });
  };
  add(baselineKey, base.candidates.find((c) => c.key === baselineKey)!.state);
  for (const family of families) {
    for (const candidate of family.candidates) {
      if (candidate.key === family.currentKey) {
        if (candidate.key !== baselineKey) aliases[candidate.key] = baselineKey;
        continue;
      }
      add(candidate.key, candidate.state);
    }
  }
  return { baselineKey, variants: variants.slice(0, MAX_VARIANTS), aliases };
}

/** The request for a plan: every variant's full configuration, at the quantity on screen. */
export function batchBodyOf(configurator: Configurator, state: ConfiguratorState, plan: VariantPlan): BatchBody {
  return {
    productTypeCode: configurator.productTypeCode,
    quantities: [state.quantity],
    baselineKey: plan.baselineKey,
    variants: plan.variants.map(({ key, state: variant }) => ({
      key,
      configuration: buildConfiguration(configurator, variant) as Configuration,
    })),
  };
}

/* --------------------------------------------------------------------------------- the answers */

export interface OptionPrice {
  /** Per piece incl. VAT, as the API sent it; null when the variant has no instant price. */
  unitPrice: string | null;
  /** Signed 2-decimal string against the current selection, as sent; null when it cannot be compared. */
  delta: string | null;
  /** The API priced it instantly (false: a quotation is needed). */
  instant: boolean;
  /** The variant was refused (e.g. a print combination the product does not offer). */
  problem: string | null;
  /** This option is the current selection. */
  baseline: boolean;
}

export function optionPriceOf(
  result: BatchResult | undefined,
  quantity: number,
  baseline: boolean,
): OptionPrice | null {
  if (!result) return null;
  const step = result.calculation?.steps.find((entry) => entry.quantity === quantity);
  return {
    unitPrice: step?.instant ? (step.unitPrice ?? null) : null,
    delta: result.deltas?.find((entry) => entry.quantity === quantity)?.unitPriceDelta ?? null,
    instant: step?.instant === true,
    problem: result.problem?.code ?? null,
    baseline,
  };
}

/** How a signed decimal string reads on a card: the sign from the string, never from arithmetic. */
export type DeltaView = { kind: "same" } | { kind: "up" | "down"; amount: string };

export function deltaView(delta: string | null | undefined): DeltaView | null {
  if (delta === null || delta === undefined) return null;
  const match = /^([+\-−])?(\d+(?:\.\d+)?)$/.exec(delta.trim());
  if (!match) return null;
  const [, sign, amount] = match;
  if (/^0+(\.0+)?$/.test(amount!)) return { kind: "same" };
  return { kind: sign === "-" || sign === "−" ? "down" : "up", amount: amount! };
}

/* ------------------------------------------------------------------------------------- the hook */

let unsupported = false;
const supportListeners = new Set<() => void>();
function markUnsupported() {
  if (unsupported) return;
  unsupported = true;
  supportListeners.forEach((listener) => listener());
}
/** For `useSyncExternalStore`: whether the API has said the batch endpoint does not exist (so price slots can collapse). */
export function subscribeOptionPricesSupport(listener: () => void) {
  supportListeners.add(listener);
  return () => void supportListeners.delete(listener);
}
export const optionPricesUnsupported = () => unsupported;
/** Tests only: forget that the endpoint answered 404. */
export function resetOptionPricesSupport() {
  unsupported = false;
  supportListeners.forEach((listener) => listener());
}

export interface OptionPrices {
  /** The price of a card by its key; null while unknown or when the endpoint is unavailable. */
  price: (key: string) => OptionPrice | null;
  /** A batch answer is on screen (it may be the previous state's while the next one is fetched). */
  available: boolean;
  /** The state changed and the answer on screen is not for it yet. */
  pending: boolean;
}

const NONE: OptionPrices = { price: () => null, available: false, pending: false };

/**
 * `enabled` is the page's own "ready to price": no batch is asked for a configuration the calculation
 * itself would refuse.
 */
export function useOptionPrices(configurator: Configurator, state: ConfiguratorState, enabled: boolean): OptionPrices {
  const plan = useMemo(() => (enabled ? planVariants(configurator, state) : null), [configurator, state, enabled]);
  const body = useMemo(() => (plan ? batchBodyOf(configurator, state, plan) : null), [configurator, state, plan]);
  const key = body ? JSON.stringify(body) : null;
  const settledKey = useDebounced(key, PRICE_DEBOUNCE_MS);
  const query = useQuery({
    queryKey: [...queryKeys.zone("customer"), "option-prices", settledKey],
    queryFn: async ({ signal }) => {
      try {
        const { data } = await browserApi().POST("/v1/store/quotes/actions/calculate-batch", {
          // The regenerated contract lists `accept-language` as a required header of this operation
          // (the generator's quirk: the other operations take it as optional); the client's middleware sets
          // the same language, this only satisfies the type.
          params: { header: { "accept-language": document.documentElement.lang || "th" } },
          body: JSON.parse(settledKey!) as BatchBody,
          signal,
        });
        return data ?? null;
      } catch (error) {
        // An API without the endpoint: stop asking for the rest of the visit.
        if (isApiError(error) && error.status === 404) markUnsupported();
        throw error;
      }
    },
    enabled: settledKey !== null && !unsupported,
    retry: false,
    staleTime: 60_000,
    // The cards keep the last figures (dimmed) while the next are fetched, so nothing jumps.
    placeholderData: (previous) => previous,
  });

  return useMemo(() => {
    const results = query.data?.results;
    if (!results || !plan || query.isError) return NONE;
    const byKey = new Map(results.map((result) => [result.key, result]));
    const pending = key !== settledKey || query.isFetching;
    return {
      available: true,
      pending,
      price: (cardKey: string) => {
        const resolved = plan.aliases[cardKey] ?? cardKey;
        const price = optionPriceOf(byKey.get(resolved), state.quantity, resolved === plan.baselineKey);
        // The deltas on screen were measured from the previous selection: not shown until the new ones arrive.
        return price && pending ? { ...price, delta: null } : price;
      },
    };
  }, [query.data, query.isError, query.isFetching, plan, key, settledKey, state.quantity]);
}
