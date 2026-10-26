/**
 * The one price-display helper (styles redesign ruling C1): /styles cards and quick view, /products
 * cards, the product pages and anything after them show a price through here.
 *
 * It only FORMATS and LABELS amounts the API gave. It never adds, divides, rounds or derives a
 * VAT-inclusive from a VAT-exclusive figure (or the other way round): the API sends VAT-inclusive
 * amounts today (D-220), so every price says "รวม VAT" and the "ราคารวม VAT" switch has nothing to
 * switch until the API supplies both figures for the same price. Money stays a decimal string.
 */

export type VatBasis = "incl" | "excl";

/** The figures the API gave for ONE price. Either may be absent; neither is ever computed here. */
export interface PriceFigures {
  incl?: string | null;
  excl?: string | null;
}

export interface PriceLabels {
  /** "รวม VAT" */
  incl: string;
  /** "ไม่รวม VAT" */
  excl: string;
}

export interface PriceDisplay {
  /** "฿4.85", as formatted by the caller's `thb`. */
  amount: string;
  /** The basis of the amount shown (which may differ from the one asked for when only one exists). */
  basis: VatBasis;
  /** "รวม VAT" / "ไม่รวม VAT" — always next to the amount. */
  vatLabel: string;
}

const present = (value: string | null | undefined): value is string => typeof value === "string" && value !== "";

/** The figures of a plain API amount whose basis the API states (`includesVat`, default: inclusive, D-220). */
export function figuresOf(amount: string | null | undefined, includesVat = true): PriceFigures {
  if (!present(amount)) return {};
  return includesVat ? { incl: amount } : { excl: amount };
}

/**
 * Whether the "ราคารวม VAT" switch may be drawn: only when the API supplied BOTH figures for every
 * price on the page (and there is at least one). Otherwise there is nothing honest to switch.
 */
export function vatSwitchAvailable(prices: Iterable<PriceFigures>): boolean {
  let any = false;
  for (const figures of prices) {
    if (!present(figures.incl) || !present(figures.excl)) return false;
    any = true;
  }
  return any;
}

/**
 * The amount to show for `figures` and the basis it really has. The preferred basis wins when the
 * API supplied it; else the other figure is shown with ITS OWN label, never converted. Null when the
 * API gave no figure (the caller shows "ขอใบเสนอราคา").
 */
export function displayPrice(
  figures: PriceFigures,
  prefer: VatBasis,
  thb: (amount: string) => string,
  labels: PriceLabels,
): PriceDisplay | null {
  const order: VatBasis[] = prefer === "incl" ? ["incl", "excl"] : ["excl", "incl"];
  for (const basis of order) {
    const amount = figures[basis];
    if (present(amount)) return { amount: thb(amount), basis, vatLabel: labels[basis] };
  }
  return null;
}
