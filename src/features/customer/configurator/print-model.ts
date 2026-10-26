/**
 * D-443: per side (outside = `printFront`, inside = `printBack` of each corrugate part) the customer
 * picks ONE print method — none, spot colour(s) or CMYK (+ an optional add-on). The product's
 * `printModel` (`StorePrintModelDto`) says which methods, which inks and how many are offered, and
 * what each side opens on. This is the one place that reads it; nothing here prices anything.
 *
 * A side is held as the list of ink ids the calculate body carries (`state.choices.print_front|back`):
 * none → `[]`, spot → the spot inks, cmyk → `[cmyk.inkColourId, …add-on inks]` (B-API-2, "Mapping
 * to the engine"). Without a model (UAT before the API change, non-corrugate products) a corrugate
 * side falls back to one ink per side, and the inside starts unprinted.
 */

import type { Schemas } from "@/lib/api/types";

import { isProcessInk, type Configurator, type StoreOption } from "./model";

export type PrintModel = Schemas["StorePrintModelDto"];
export type PrintSide = Schemas["StorePrintSideDto"];
export type PrintMethod = Schemas["PrintSideMethod"];
export type PrintKind = "print_front" | "print_back";

const SIDE: Record<PrintKind, keyof PrintModel> = { print_front: "outside", print_back: "inside" };

export const isPrintKind = (kind: string): kind is PrintKind => kind === "print_front" || kind === "print_back";

/** Corrugate sides are single-method (D-443); the other calculators have no per-side model yet. */
export const isCorrugate = (configurator: Pick<Configurator, "calculator">) => configurator.calculator === "corrugate";

/** The product's model for one side, or `null` (no model, or a calculator that has none). */
export function sideModelOf(configurator: Configurator, kind: PrintKind): PrintSide | null {
  if (!isCorrugate(configurator)) return null;
  const model = (configurator as { printModel?: PrintModel | null }).printModel;
  return model?.[SIDE[kind]] ?? null;
}

const unique = (ids: readonly string[]) => [...new Set(ids)];

/** The ids a side's default selection stands for, kept to what the model offers. */
export function defaultIds(side: PrintSide): string[] {
  const { method, spotInkColourIds, cmykAddOnInkColourIds } = side.default;
  if (method === "cmyk" && side.cmyk) {
    const addOn = side.cmyk.addOn.enabled ? cmykAddOns(side, cmykAddOnInkColourIds) : [];
    return [side.cmyk.inkColourId, ...addOn];
  }
  if (method === "spot" && side.spot) return unique(spotInkColourIds).slice(0, side.spot.maxColours);
  return [];
}

/** The spot inks that may stand beside CMYK, at most M. */
function cmykAddOns(side: PrintSide, ids: readonly string[]): string[] {
  const addOn = side.cmyk?.addOn;
  if (!side.cmyk || !addOn?.enabled) return [];
  const allowed = new Set(side.spot?.inkColourIds ?? []);
  return unique(ids)
    .filter((id) => id !== side.cmyk!.inkColourId && allowed.has(id))
    .slice(0, addOn.maxColours);
}

/** Which method a list of ink ids is, on this side. */
export function methodOf(side: PrintSide, ids: readonly string[]): PrintMethod {
  if (ids.length === 0) return "none";
  return side.cmyk && ids.includes(side.cmyk.inkColourId) ? "cmyk" : "spot";
}

/**
 * Brings any list of ink ids (a draft, a seed, a saved quote in the old shape) to one valid choice
 * of the model: CMYK stands alone (beside only the add-on inks, when enabled), spot is at most N
 * offered inks, and anything the model does not offer falls back to the side's default. CMYK
 * together with a spot ink is never produced.
 */
export function normaliseSide(side: PrintSide, ids: readonly string[]): string[] {
  const wanted = unique(ids);
  if (wanted.length === 0) return side.methods.includes("none") ? [] : defaultIds(side);
  if (side.cmyk && side.methods.includes("cmyk") && wanted.includes(side.cmyk.inkColourId)) {
    return [side.cmyk.inkColourId, ...cmykAddOns(side, wanted)];
  }
  if (side.spot && side.methods.includes("spot")) {
    const allowed = new Set(side.spot.inkColourIds);
    const spots = wanted.filter((id) => allowed.has(id)).slice(0, side.spot.maxColours);
    if (spots.length > 0) return spots;
  }
  return defaultIds(side);
}

/**
 * Without a model a corrugate side is one ink: a process ink (CMYK) if the list has one, else the
 * first. The calculator refuses CMYK + another ink on one side whatever the model says.
 */
export function normaliseSingleInk(options: ReadonlyMap<string, StoreOption>, ids: readonly string[]): string[] {
  const wanted = unique(ids);
  const process = wanted.find((id) => options.get(id) && isProcessInk(options.get(id)!));
  const one = process ?? wanted[0];
  return one ? [one] : [];
}

/** What a corrugate side holds, whether or not the product has a model. */
export function normaliseCorrugateSide(
  configurator: Configurator,
  options: ReadonlyMap<string, StoreOption>,
  kind: PrintKind,
  ids: readonly string[],
): string[] {
  const side = sideModelOf(configurator, kind);
  return side ? normaliseSide(side, ids) : normaliseSingleInk(options, ids);
}

/* ----------------------------------------------------------------------------- the radio choices */

/** `none`, `cmyk`, `spot` (N > 1: the inks are picked below it) or `spot:<ink id>` (N = 1). */
export type PrintChoice = string;

export function choiceOf(side: PrintSide, ids: readonly string[]): PrintChoice {
  const method = methodOf(side, ids);
  if (method === "spot" && side.spot?.maxColours === 1 && ids[0]) return `spot:${ids[0]}`;
  return method;
}

/**
 * The radio values a side offers, in the order the cards show them: ไม่พิมพ์, each spot colour (or
 * `spot` when more than one may be picked), CMYK — only what the model offers (`hasInk`: the product
 * lists that ink). The cards and the option prices (`option-prices.ts`) read this one list, so a
 * card and its price always share a key.
 */
export function choiceValues(side: PrintSide, hasInk: (id: string) => boolean): PrintChoice[] {
  const spotIds = side.spot?.inkColourIds.filter(hasInk) ?? [];
  const maxSpot = side.spot?.maxColours ?? 0;
  return [
    ...(side.methods.includes("none") ? ["none"] : []),
    ...(side.methods.includes("spot") && side.spot
      ? maxSpot === 1
        ? spotIds.map((id) => `spot:${id}`)
        : spotIds.length > 0
          ? ["spot"]
          : []
      : []),
    ...(side.methods.includes("cmyk") && side.cmyk ? ["cmyk"] : []),
  ];
}

/** The ids a radio stands for; picking spot with N > 1 starts from the side's default or the first ink. */
export function idsOfChoice(side: PrintSide, choice: PrintChoice, current: readonly string[]): string[] {
  if (choice === "none") return [];
  if (choice === "cmyk" && side.cmyk) return [side.cmyk.inkColourId];
  if (choice.startsWith("spot:")) return [choice.slice("spot:".length)];
  if (choice === "spot" && side.spot) {
    const kept = current.filter((id) => side.spot!.inkColourIds.includes(id));
    if (kept.length > 0) return kept;
    const first = side.default.method === "spot" ? side.default.spotInkColourIds[0] : undefined;
    const id = first ?? side.spot.inkColourIds[0];
    return id ? [id] : [];
  }
  return [...current];
}

/** The ink ids of a side that sit beside the method: spot inks (N > 1) or the CMYK add-on. */
export function withExtraInks(side: PrintSide, ids: readonly string[], extra: readonly string[]): string[] {
  if (side.cmyk && ids.includes(side.cmyk.inkColourId)) return [side.cmyk.inkColourId, ...cmykAddOns(side, extra)];
  return unique(extra).slice(0, side.spot?.maxColours ?? 0);
}

/** The model's starting ids for a side, or `null` when the product has none for it. */
export function startIds(configurator: Configurator, kind: PrintKind): string[] | null {
  const side = sideModelOf(configurator, kind);
  return side ? defaultIds(side) : null;
}

/* ------------------------------------------------------------------------------ a 422 refusal */

/** `errors[].path` of a refused combination → the side it names. */
export function refusedSide(path: string): "outside" | "inside" | null {
  if (/printFront$/.test(path)) return "outside";
  if (/printBack$/.test(path)) return "inside";
  return null;
}

export const PRINT_REFUSAL_CODES = [
  "method_not_offered",
  "cmyk_with_spot",
  "process_repeated",
  "spot_count",
  "add_on_count",
  "colour_repeated",
  "colour_not_allowed",
] as const;
