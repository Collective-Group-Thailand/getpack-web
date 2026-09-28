/**
 * Money a person types, turned into the contract's money string (api-conventions §3) — by text,
 * never through a float, so `"0.1"` + nothing is `"0.10"` and never `"0.10000000000000001"`.
 * Formatting what the API sends is `formatTHB`'s job; nothing here adds or rounds an amount.
 */

/** `"45"`, `"45.5"` or `"1,234.50"` → `"45.00"`, `"45.50"`, `"1234.50"`; anything else → `null`. */
export function moneyText(value: string): string | null {
  const text = value.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return `${String(Number(whole))}.${fraction.padEnd(2, "0")}`;
}

/** Whether a money string the API sent is zero — read as text, so `"0.00"` and `"-0.00"` both are. */
export function isZeroMoney(value: string | null | undefined): boolean {
  return !value || /^-?0+(\.0+)?$/.test(value);
}

/** Whether a money string the API sent is below zero. */
export function isNegativeMoney(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("-")) && !isZeroMoney(value);
}
