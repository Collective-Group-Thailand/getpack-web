import type { CatalogueCategory, ProductCard } from "./api.server";

/** Where a category sits in the catalogue (UX audit, `/products`): instant price, then RFQ, then services. */
export type CategoryGroup = "instant" | "rfq" | "service";

const SERVICE = /service|design|mockup|graphic/i;

export function categoryGroup(category: Pick<CatalogueCategory, "code" | "types">): CategoryGroup {
  if (SERVICE.test(category.code)) return "service";
  return category.types.some((type) => type.quoteMode === "instant") ? "instant" : "rfq";
}

const RANK: Record<CategoryGroup, number> = { instant: 0, rfq: 1, service: 2 };

/**
 * The categories in the order a buyer decides in — what can be priced now first, what needs a
 * quotation next, design services last — keeping the admin's order within each group (a stable
 * sort), so the back office still decides the order inside a group.
 */
export function orderCategories<T extends Pick<CatalogueCategory, "code" | "types">>(tree: readonly T[]): T[] {
  return [...tree].sort((a, b) => RANK[categoryGroup(a)] - RANK[categoryGroup(b)]);
}

/** The category page's filter chips (UX audit, `/products/[category]`). */
export const CARD_FILTERS = ["instant", "rfq", "moq100", "fast", "promo"] as const;
export type CardFilter = (typeof CARD_FILTERS)[number];

export const CARD_SORTS = ["recommended", "price", "fastest"] as const;
export type CardSort = (typeof CARD_SORTS)[number];

/** The lead-time bound of the "ผลิต ≤ 5 วัน" chip, in business days. */
export const FAST_LEAD_DAYS = 5;
/** The MOQ bound of the "ขั้นต่ำ ≤ 100" chip, in pieces. */
export const SMALL_MOQ = 100;

/**
 * Whether a card passes every chosen chip. The facts are the API's own (D-307); nothing is
 * estimated — a card without a lead time or an MOQ does not pass a chip about it.
 */
export function passes(card: ProductCard, filters: readonly CardFilter[]): boolean {
  return filters.every((filter) => {
    switch (filter) {
      case "instant":
        return card.availability !== "rfq";
      case "rfq":
        return card.availability === "rfq";
      case "moq100":
        return card.moq !== null && card.moq <= SMALL_MOQ;
      case "fast":
        return card.leadTimeDays !== null && card.leadTimeDays.max <= FAST_LEAD_DAYS;
      case "promo":
        return card.campaignBadge !== null;
    }
  });
}

/**
 * Compares two non-negative decimal strings as the API sends money ("14.13", "198.9"), digit by
 * digit, without turning either into a number (CLAUDE.md: money is never computed on here).
 */
export function compareDecimal(a: string, b: string): number {
  const [aInt = "", aFrac = ""] = a.replace(/^0+(?=\d)/, "").split(".");
  const [bInt = "", bFrac = ""] = b.replace(/^0+(?=\d)/, "").split(".");
  if (aInt.length !== bInt.length) return aInt.length - bInt.length;
  if (aInt !== bInt) return aInt < bInt ? -1 : 1;
  const width = Math.max(aFrac.length, bFrac.length);
  const x = aFrac.padEnd(width, "0");
  const y = bFrac.padEnd(width, "0");
  return x === y ? 0 : x < y ? -1 : 1;
}

/**
 * Orders cards for the "เรียงตาม" menu: by the API's starting price (compared as written; cards
 * without one last) or by the shortest lead time. "แนะนำ" keeps the API's own order.
 */
export function sortCards(cards: readonly ProductCard[], sort: CardSort): ProductCard[] {
  if (sort === "recommended") return [...cards];
  if (sort === "price") {
    return [...cards].sort((a, b) => {
      if (a.startingPricePerPiece === null) return b.startingPricePerPiece === null ? 0 : 1;
      if (b.startingPricePerPiece === null) return -1;
      return compareDecimal(a.startingPricePerPiece, b.startingPricePerPiece);
    });
  }
  const days = (card: ProductCard) => card.leadTimeDays?.max ?? Number.POSITIVE_INFINITY;
  return [...cards].sort((a, b) => days(a) - days(b));
}

export function readFilters(value: string | undefined): CardFilter[] {
  return (value ?? "")
    .split(",")
    .filter((item): item is CardFilter => (CARD_FILTERS as readonly string[]).includes(item));
}

export function readSort(value: string | undefined): CardSort {
  return (CARD_SORTS as readonly string[]).includes(value ?? "") ? (value as CardSort) : "recommended";
}
