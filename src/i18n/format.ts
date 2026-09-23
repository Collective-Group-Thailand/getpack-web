import type { Locale } from "./routing";

/**
 * Formatters for the values the API hands us. Two rules run through all of them (CLAUDE.md):
 *
 * 1. **Money is a decimal string.** It is never parsed into a number to be added, subtracted
 *    or rounded — binary floating point cannot hold 0.1, and a baht is not ours to lose. The
 *    API computes every total; this only renders one.
 * 2. **Dates are rendered in Asia/Bangkok**, in the Buddhist era where the legacy system used
 *    it, wherever the reader happens to be.
 */

export const TIME_ZONE = "Asia/Bangkok";

/** Buddhist era is 543 years ahead of the Common Era. */
const BE_OFFSET = 543;

const localeTag = (locale: Locale) => (locale === "th" ? "th-TH" : "en-GB");

/**
 * `th-TH` defaults to the Buddhist calendar in `Intl`, so the year would be shifted twice —
 * once by Intl and once by us. Pinning `ca-gregory` makes the era an explicit choice per call
 * site, which is the point: an accounting export needs CE even for a Thai reader.
 */
const dateTag = (locale: Locale) => (locale === "th" ? "th-TH-u-ca-gregory" : "en-GB");

/**
 * `฿1,234.56` with tabular figures (the caller applies `.tabular-nums`).
 *
 * Takes the API's decimal string as-is. `Intl` formats the digits; it never does arithmetic
 * on them, and a value with more precision than two decimals is shown rounded for display
 * only — the string the API sent stays the truth.
 */
export function formatTHB(
  amount: string | number,
  locale: Locale = "th",
  options: { withSymbol?: boolean; decimals?: number } = {},
): string {
  const { withSymbol = true, decimals = 2 } = options;
  const text = typeof amount === "string" ? amount.trim() : String(amount);

  // A malformed amount must never render as "NaN" in front of a customer.
  if (text === "" || !/^-?\d+(\.\d+)?$/.test(text)) return withSymbol ? "฿—" : "—";

  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const negative = text.startsWith("-");

  const groupedWhole = new Intl.NumberFormat(localeTag(locale)).format(BigInt(whole));
  const paddedFraction = decimals > 0 ? `.${fraction.padEnd(decimals, "0").slice(0, decimals)}` : "";
  const formatted = `${negative ? "-" : ""}${groupedWhole}${paddedFraction}`;

  return withSymbol ? `฿${formatted}` : formatted;
}

/** A plain count — quantities, pieces, points. */
export function formatNumber(value: number, locale: Locale = "th", options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeTag(locale), options).format(value);
}

/** Millimetres, the designer's and the dieline's only unit. */
export function formatMm(value: number, locale: Locale = "th", decimals = 0): string {
  const number = formatNumber(value, locale, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
  return locale === "th" ? `${number} มม.` : `${number} mm`;
}

/** `150×100×80` — dimensions read as one value, so they are formatted as one. */
export function formatDimensions(
  dims: { length: number; width: number; height: number },
  locale: Locale = "th",
  options: { withUnit?: boolean } = {},
): string {
  const core = `${dims.length}×${dims.width}×${dims.height}`;
  if (!options.withUnit) return core;
  return locale === "th" ? `${core} มม.` : `${core} mm`;
}

type DateInput = string | number | Date;

function toDate(input: DateInput): Date | null {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface DateFormatOptions {
  /**
   * `be` renders the Buddhist era, `ce` the Common Era. Thai defaults to `be`, which is what
   * the legacy system showed customers; English defaults to `ce`.
   */
  era?: "be" | "ce";
  /** `short` → 17 ก.ย. 2569 · `long` → 17 กันยายน 2569 · `numeric` → 17/09/2569 */
  style?: "short" | "long" | "numeric";
}

/**
 * A date in Bangkok time. The year is shifted for the Buddhist era rather than relying on
 * `th-TH-u-ca-buddhist`, so the era is an explicit decision per call site — an export or an
 * accounting document needs CE even for a Thai reader.
 */
export function formatDate(input: DateInput, locale: Locale = "th", options: DateFormatOptions = {}): string {
  const date = toDate(input);
  if (!date) return "—";

  const { era = locale === "th" ? "be" : "ce", style = "short" } = options;

  const parts = new Intl.DateTimeFormat(dateTag(locale), {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: style === "numeric" ? "2-digit" : style === "long" ? "long" : "short",
    year: "numeric",
  }).formatToParts(date);

  return parts
    .map((part) => {
      if (part.type !== "year") return part.value;
      const year = Number(part.value);
      return String(era === "be" ? year + BE_OFFSET : year);
    })
    .join("");
}

/** A date with the time, for audit trails and timelines. */
export function formatDateTime(input: DateInput, locale: Locale = "th", options: DateFormatOptions = {}): string {
  const date = toDate(input);
  if (!date) return "—";

  const time = new Intl.DateTimeFormat(dateTag(locale), {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${formatDate(date, locale, options)} ${time}`;
}

/**
 * ISO 8601 in Bangkok time, for CSV and XLSX exports (design-system.md §4: ISO in exports).
 * Never shown in the UI.
 */
export function formatIsoDate(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  // en-CA gives YYYY-MM-DD, and the time zone does the shifting.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
