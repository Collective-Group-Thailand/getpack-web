import type { BoundFormat } from "@/features/shared/format/bind";

/**
 * C4-API-2/3 store fields, displayed as the API sends them (nothing priced or dated here).
 *
 * The VAT rate arrives as a fraction decimal string ("0.07"); the label shows it in percent ("7") by moving the
 * decimal point as text, so no floating-point arithmetic touches it. Null for anything that is not a plain decimal.
 */
export function vatPercentOf(rate: string | null | undefined): string | null {
  if (!rate || !/^\d+(\.\d+)?$/.test(rate.trim())) return null;
  const [whole, fraction = ""] = rate.trim().split(".");
  const digits = `${whole}${fraction.padEnd(2, "0")}`;
  const point = whole!.length + 2;
  const int = digits.slice(0, point).replace(/^0+(?=\d)/, "");
  const rest = digits.slice(point).replace(/0+$/, "");
  return rest ? `${int}.${rest}` : int;
}

/**
 * The arrival window as a short day–month range ("12–14 ต.ค.", "30 ต.ค.–2 พ.ย."), or one date when both ends are the
 * same day. Dates are the API's Bangkok calendar days (YYYY-MM-DD).
 */
export function arrivalRangeText(
  format: Pick<BoundFormat, "date">,
  arrival: { from: string; to: string },
): { single: true; date: string } | { single: false; from: string; to: string } {
  const to = format.date(arrival.to, { style: "dayMonth" });
  if (arrival.from === arrival.to) return { single: true, date: to };
  const sameMonth = arrival.from.slice(0, 7) === arrival.to.slice(0, 7);
  const from = sameMonth ? String(Number(arrival.from.slice(8, 10))) : format.date(arrival.from, { style: "dayMonth" });
  return { single: false, from, to };
}
