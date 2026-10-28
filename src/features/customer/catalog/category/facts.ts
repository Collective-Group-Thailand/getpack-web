/**
 * The category head's facts (category redesign Phase 1, item 1), from the API's figures only: the lowest
 * "เริ่มต้น" (with its ex-VAT twin and quantity, as the API sent them), the MOQ range, the production
 * lead-time band, the item count and how the category is bought (every item instant, every item by
 * quotation, services, or a mix). Pure — prices are compared as written (`compareDecimal`), never computed.
 */

import { compareDecimal } from "@/features/customer/catalog/ordering";
import type { HubItem } from "@/features/customer/products/hub";

export type BuyMode = "instant" | "quote" | "service" | "stock" | "mixed";

export interface CategoryFacts {
  count: number;
  mode: BuyMode | null;
  /** The cheapest instant price (incl. VAT) with its ex-VAT figure and the quantity it is for. */
  start: { incl: string; excl: string | null; quantity: number | null; unit: HubItem["unit"] } | null;
  moq: { min: number; max: number } | null;
  lead: { min: number; max: number } | null;
}

const range = (values: number[]) => (values.length ? { min: Math.min(...values), max: Math.max(...values) } : null);

export function buyModeOf(items: readonly Pick<HubItem, "mode">[]): BuyMode | null {
  const modes = new Set(items.map((item) => item.mode));
  if (modes.size === 0) return null;
  if (modes.size > 1) return "mixed";
  return [...modes][0]!;
}

export function categoryFacts(items: readonly HubItem[]): CategoryFacts {
  let cheapest: HubItem | null = null;
  for (const item of items) {
    if (item.mode !== "instant" || item.startingPrice === null) continue;
    if (!cheapest || compareDecimal(item.startingPrice, cheapest.startingPrice!) < 0) cheapest = item;
  }
  return {
    count: items.length,
    mode: buyModeOf(items),
    start: cheapest
      ? {
          incl: cheapest.startingPrice!,
          excl: cheapest.startingPriceExVat,
          quantity: cheapest.priceQuantity,
          unit: cheapest.unit,
        }
      : null,
    moq: range(items.flatMap((item) => (item.moq !== null ? [item.moq] : []))),
    lead: (() => {
      const leads = items.flatMap((item) => (item.mode === "instant" && item.leadTime ? [item.leadTime] : []));
      return leads.length
        ? { min: Math.min(...leads.map((l) => l.min)), max: Math.max(...leads.map((l) => l.max)) }
        : null;
    })(),
  };
}
