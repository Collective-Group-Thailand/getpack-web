/**
 * Quantities as the API sends them (decimal strings with 3 places), shown without trailing zeros and
 * grouped — formatted from the string itself, never turned into a float (CLAUDE.md: the web renders
 * what the API computed).
 */
export function formatQty(value: string | null | undefined, locale: string): string {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-GB", { maximumFractionDigits: 3 }).format(
    value as unknown as number,
  );
}

/** A decimal string the API sends as a percentage, e.g. "7.0000" → "7". */
export function formatPlain(value: string | null | undefined, locale: string, decimals = 4): string {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-GB", { maximumFractionDigits: decimals }).format(
    value as unknown as number,
  );
}

/** What a quantity field accepts: up to 11 digits and 3 decimals (the contract's `QTY`). */
export const QTY_PATTERN = /^\d{1,11}(\.\d{1,3})?$/;
export const SIGNED_QTY_PATTERN = /^[-+]?\d{1,11}(\.\d{1,3})?$/;
/** A price or a cost: up to 12 digits and 6 decimals (the contract's `PRICE`). */
export const PRICE_PATTERN = /^\d{1,12}(\.\d{1,6})?$/;

/** Strips grouping a person may type ("1,425.50" → "1425.50") before a value is checked or sent. */
export const plainNumber = (value: string) => value.replace(/[,\s]/g, "").replace(/^\+/, "");

/** True for "0", "0.000" and the like — a quantity of nothing. */
export const isZero = (value: string) => /^[-+]?0*(\.0*)?$/.test(value);

/** "500.000000" → "500", "2.850" → "2.85": a decimal string for an input, without trailing zeros. */
export const trimZeros = (value: string | null | undefined): string =>
  !value ? "" : value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
