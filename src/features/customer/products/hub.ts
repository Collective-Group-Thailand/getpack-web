/**
 * The /products hub ("สินค้าและราคา", products redesign Phase 1): every catalogue and stock product
 * as one list, the buying mode each is sold by, and the filtering, sorting and paging the page does
 * on the server over ALL of them (the list API has no mode, MOQ or lead-time sort yet — R5).
 *
 * Pure: no fetching, no money arithmetic. Prices are the API's decimal strings, compared digit by
 * digit (`compareDecimal`), never added or converted.
 */

import { compareDecimal } from "@/features/customer/catalog/ordering";
import type { Schemas } from "@/lib/api/types";

/** The four ways to buy (prototype "วิธีซื้อ"). */
export const HUB_MODES = ["instant", "quote", "stock", "service"] as const;
export type HubMode = (typeof HUB_MODES)[number];

export const HUB_SORTS = ["recommended", "price", "moq", "lead"] as const;
export type HubSort = (typeof HUB_SORTS)[number];

/** Cards per "โหลดเพิ่ม" batch on the hub (prompt hard rule 9). */
export const HUB_BATCH = 15;

export interface HubItem {
  kind: "catalog" | "stock";
  /** Catalogue slug or stock SKU — the item's key everywhere (links, RFQ tray). */
  key: string;
  nameTh: string;
  nameEn: string;
  mode: HubMode;
  /** The category the item's product type sits in; null when the API does not say. */
  categoryCode: string | null;
  productTypeCode: string | null;
  imageUrl: string | null;
  imageAlt: { th: string; en?: string } | null;
  /** "เริ่มต้น" per piece incl. VAT (D-220), as the API sent it; null = no instant price. */
  startingPrice: string | null;
  /** The quantity that price is for ("ที่ 300 หน่วย"). */
  priceQuantity: number | null;
  /** The spec that price is for, in the API's words (D-441). */
  specLabel: Schemas["LocalisedLabelDto"] | null;
  moq: number | null;
  unit: Schemas["ProductUnit"] | null;
  leadTime: { min: number; max: number } | null;
  /** Stock only: whether it is on hand (the "พร้อมส่ง" badge). */
  inStock: boolean | null;
  /** The API's own order, kept inside a group. */
  order: number;
}

/** A service type (design, mock-up, plates): its category is the service category. */
const SERVICE = /(^|_)service/;

export function isServiceCategory(code: string | null | undefined): boolean {
  return !!code && SERVICE.test(code);
}

/**
 * A catalogue product's mode: a service category → บริการ; an instant (or partial) price →
 * ราคาทันที; otherwise สั่งผลิตตามสเปก. `partial` ("บางสเปก", none on UAT) counts as instant — the
 * card then still shows only what the API priced (OPEN QUESTION in the C1 report).
 */
export function catalogMode(
  card: Pick<Schemas["StoreProductCardDto"], "availability">,
  categoryCode: string | null,
): HubMode {
  if (isServiceCategory(categoryCode)) return "service";
  return card.availability === "rfq" ? "quote" : "instant";
}

const RANK: Record<HubMode, number> = { instant: 0, quote: 1, stock: 2, service: 3 };

export interface HubFilter {
  mode?: HubMode | null;
  cat?: string | null;
}

export function filterItems(items: readonly HubItem[], filter: HubFilter): HubItem[] {
  return items.filter(
    (item) => (!filter.mode || item.mode === filter.mode) && (!filter.cat || item.categoryCode === filter.cat),
  );
}

const nullsLast = <T>(a: T | null, b: T | null, compare: (x: T, y: T) => number) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : compare(a, b);

/**
 * "เรียง": แนะนำ = what can be bought now first, then made-to-spec, stock, and services last (prompt
 * item 12: services lose their emphasis but stay filterable); the API's order inside each mode.
 * The others sort by the API's figure with items that have none last; ties keep the API's order.
 */
export function sortItems(items: readonly HubItem[], sort: HubSort): HubItem[] {
  const byOrder = (a: HubItem, b: HubItem) => RANK[a.mode] - RANK[b.mode] || a.order - b.order;
  const sorted = [...items];
  switch (sort) {
    case "price":
      return sorted.sort((a, b) => nullsLast(a.startingPrice, b.startingPrice, compareDecimal) || byOrder(a, b));
    case "moq":
      return sorted.sort((a, b) => nullsLast(a.moq, b.moq, (x, y) => x - y) || byOrder(a, b));
    case "lead":
      return sorted.sort(
        (a, b) => nullsLast(a.leadTime?.max ?? null, b.leadTime?.max ?? null, (x, y) => x - y) || byOrder(a, b),
      );
    default:
      return sorted.sort(byOrder);
  }
}

export function modeCounts(items: readonly HubItem[]): Record<HubMode | "all", number> {
  const counts = { all: items.length, instant: 0, quote: 0, stock: 0, service: 0 };
  for (const item of items) counts[item.mode] += 1;
  return counts;
}

/** The categories present among `items` (the chips "only categories present in the current mode"), in tree order. */
export function categoriesIn(items: readonly HubItem[], treeOrder: readonly string[]): string[] {
  const present = new Set(items.flatMap((item) => (item.categoryCode ? [item.categoryCode] : [])));
  const ordered = treeOrder.filter((code) => present.has(code));
  return [...ordered, ...[...present].filter((code) => !treeOrder.includes(code)).sort()];
}

/** The first `page` batches ("แสดง x จาก y"); `page` < 1 is the first batch. */
export function visibleBatch<T>(items: readonly T[], page: number, batch = HUB_BATCH): T[] {
  return items.slice(0, Math.max(1, Math.floor(page)) * batch);
}

const minOf = (values: number[]) => (values.length ? Math.min(...values) : null);
const maxOf = (values: number[]) => (values.length ? Math.max(...values) : null);

export interface ModeSummary {
  /** ราคาทันที: the lowest "เริ่มต้น" and the item it belongs to (its MOQ and unit go with it). */
  instant: { price: string; unit: HubItem["unit"]; moq: number | null } | null;
  /** สั่งผลิตตามสเปก: the MOQ range of the items that state one. */
  quote: { min: number; max: number } | null;
  /** สินค้าพร้อมส่ง: the smallest MOQ. */
  stock: { min: number } | null;
}

/**
 * The data line of each mode card (prompt item 2), from the API's figures only: the cheapest instant
 * price with that item's MOQ, the quote MOQ range, the stock minimum. Nothing is estimated; a mode
 * without figures gets no line.
 */
export function modeSummary(items: readonly HubItem[]): ModeSummary {
  let cheapest: HubItem | null = null;
  for (const item of items) {
    if (item.mode !== "instant" || item.startingPrice === null) continue;
    if (!cheapest || compareDecimal(item.startingPrice, cheapest.startingPrice!) < 0) cheapest = item;
  }
  const quoteMoqs = items.flatMap((item) => (item.mode === "quote" && item.moq !== null ? [item.moq] : []));
  const stockMin = minOf(items.flatMap((item) => (item.mode === "stock" && item.moq !== null ? [item.moq] : [])));
  const quoteMin = minOf(quoteMoqs);
  const quoteMax = maxOf(quoteMoqs);
  return {
    instant: cheapest ? { price: cheapest.startingPrice!, unit: cheapest.unit, moq: cheapest.moq } : null,
    quote: quoteMin !== null && quoteMax !== null ? { min: quoteMin, max: quoteMax } : null,
    stock: stockMin !== null ? { min: stockMin } : null,
  };
}

/** The production lead-time band of the instant items, for the process step's tag ("ราคาทันที 5–10 วันทำการ"). */
export function instantLeadBand(items: readonly HubItem[]): { min: number; max: number } | null {
  const ranges = items.flatMap((item) => (item.mode === "instant" && item.leadTime ? [item.leadTime] : []));
  const min = minOf(ranges.map((range) => range.min));
  const max = maxOf(ranges.map((range) => range.max));
  return min !== null && max !== null ? { min, max } : null;
}

/** Whether an item is asked for by quotation (the card's "เพิ่มในใบขอราคา"). */
export const quotable = (item: Pick<HubItem, "mode">) => item.mode !== "instant";
