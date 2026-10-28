/**
 * The product page's buy box (pdp redesign Phase 1, item 3), in the configurator's own terms: the
 * selection IS a configurator state (`initialState`), changed only by the configurator's own helpers
 * (`withStandardSize`, the print family of `option-prices.ts`), priced with the configurator's own
 * body (`buildCalculateBody`) and handed over as the configurator's own link (`queryOf`). So the
 * page's price is the configurator's price by construction (GLOBAL-RULES §5) — nothing here prices,
 * converts or rounds anything.
 */

import { configureHref } from "@/features/customer/catalog/paths";
import { buildCalculateBody, type CalculateBody } from "@/features/customer/configurator/build";
import {
  groupsOf,
  isProcessInk,
  optionsById,
  sizeKindOf,
  type Configurator,
  type StoreOption,
} from "@/features/customer/configurator/model";
import { inkChoice, NO_MODEL_NONE, printFamily, printKey } from "@/features/customer/configurator/print-family";
import { isCorrugate } from "@/features/customer/configurator/print-model";
import {
  initialState,
  readyToPrice,
  withStandardSize,
  type ConfiguratorState,
} from "@/features/customer/configurator/state";
import { queryOf, seedFromDesign } from "@/features/customer/configurator/url-state";

export type Selection = ConfiguratorState;

/** Where the page starts: the configurator's own opening state (D-441 default spec). */
export const startOf = (configurator: Configurator): Selection => initialState(configurator);

/** The product is sized by standard sizes on this page (boxes with catalogue sizes). */
export const hasStandardSizes = (configurator: Configurator) =>
  sizeKindOf(configurator) === "box" && configurator.standardSizes.length > 0;

export function pickSize(configurator: Configurator, selection: Selection, code: string): Selection {
  const size = configurator.standardSizes.find((candidate) => candidate.code === code);
  return size ? withStandardSize(selection, size) : selection;
}

/** The board options (`material` group), in offer order; none when the product offers one or none. */
export function materialsOf(configurator: Configurator): StoreOption[] {
  return groupsOf(configurator).find((group) => group.kind === "material")?.options ?? [];
}

export function pickMaterial(selection: Selection, id: string): Selection {
  return { ...selection, choices: { ...selection.choices, material: [id] } };
}

/** One outside-print choice as the page shows it. */
export interface PrintChoice {
  /** The key the configurator's print cards (and the batch prices) use. */
  key: string;
  /** What it reads as: no print, CMYK, several spot colours, or one named ink. */
  label: { kind: "none" } | { kind: "cmyk" } | { kind: "spot" } | { kind: "ink"; option: StoreOption };
  selection: Selection;
  selected: boolean;
}

/**
 * The outside print as single choices (prototype "สีพิมพ์ด้านนอก"): on corrugate the configurator's own
 * print family (`printFamily`: the print model's methods, else ไม่พิมพ์ + each ink); elsewhere ไม่พิมพ์ and
 * each offered ink alone — a combination of inks is the configurator's job. Empty when nothing prints.
 */
export function printChoicesOf(configurator: Configurator, selection: Selection): PrintChoice[] {
  const byId = optionsById(configurator);
  const kind = "print_front" as const;
  if (isCorrugate(configurator)) {
    const family = printFamily(configurator, selection, kind);
    if (!family) return [];
    return family.candidates.map((candidate) => {
      const choice = candidate.key.slice(printKey(kind, "").length);
      const id = choice.startsWith("spot:") ? choice.slice(5) : choice.startsWith("ink:") ? choice.slice(4) : null;
      const option = id ? byId.get(id) : undefined;
      const label: PrintChoice["label"] =
        choice === "none" || choice === NO_MODEL_NONE
          ? { kind: "none" }
          : choice === "cmyk" || (option && isProcessInk(option))
            ? { kind: "cmyk" }
            : option
              ? { kind: "ink", option }
              : { kind: "spot" };
      return { key: candidate.key, label, selection: candidate.state, selected: candidate.key === family.currentKey };
    });
  }
  const group = groupsOf(configurator).find((entry) => entry.kind === kind);
  if (!group) return [];
  const current = selection.choices[kind] ?? [];
  const single = (ids: string[]): Selection => ({ ...selection, choices: { ...selection.choices, [kind]: ids } });
  return [
    {
      key: printKey(kind, NO_MODEL_NONE),
      label: { kind: "none" },
      selection: single([]),
      selected: current.length === 0,
    },
    ...group.options.map((option) => ({
      key: printKey(kind, inkChoice(option.id)),
      label: { kind: "ink" as const, option },
      selection: single([option.id]),
      selected: current.length === 1 && current[0] === option.id,
    })),
  ];
}

/** The quantities the page offers: the configurator's own opening tiers (the engine's presets around the default). */
export const tiersOf = (selection: Selection) => selection.quantities;

export function pickQuantity(selection: Selection, quantity: number): Selection {
  return selection.quantities.includes(quantity) ? { ...selection, quantity } : selection;
}

/** The body the live price asks for — the configurator's own, for every tier at once; null when it cannot be priced. */
export function bodyOf(configurator: Configurator, selection: Selection): CalculateBody | null {
  return readyToPrice(configurator, selection) ? buildCalculateBody(configurator, selection) : null;
}

/** "ปรับแต่งต่อและสั่งซื้อ": the configurator, opened on this selection (its own link vocabulary). */
export function configureLinkOf(configurator: Configurator, selection: Selection, extra: Record<string, string> = {}) {
  const query = new URLSearchParams({ ...queryOf(configurator, selection), ...extra });
  const search = query.toString();
  return `${configureHref(configurator.slug)}${search ? `?${search}` : ""}`;
}

/** What the configurator opens on for a link: the state the configurator itself would build from it. */
export function configuratorStateFor(configurator: Configurator, link: string): Selection {
  const search = new URL(link, "https://getpack.invalid").searchParams;
  return initialState(configurator, seedFromDesign(configurator, Object.fromEntries(search)));
}

/**
 * "กำหนดเอง": the configurator's custom-size tab, started from the chosen size's inside dimensions and
 * keeping the board, print and quantity (`size=LxWxH` is the configurator's own custom-size link).
 */
export function customSizeLinkOf(configurator: Configurator, selection: Selection): string {
  if (selection.sizeMode !== "standard") return configureLinkOf(configurator, selection);
  return configureLinkOf(configurator, { ...selection, sizeMode: "custom", standardSizeCode: null });
}

/** Whether the product offers an artwork route the design section shows (own file, Studio, design team). */
export const hasDesignPaths = (configurator: Configurator) =>
  configurator.design.options.some(
    (option) => option === "own_file" || option === "online_designer" || option === "hired_design",
  );
