/** The `catalog` translator, as much of it as a unit needs. */
interface CatalogT {
  (key: string): string;
  has(key: string): boolean;
}

/**
 * A unit code the API sends as free text (`piece`, `box`, …) in the reader's words, from `catalog.stock.units`;
 * a code the messages do not know is shown as sent rather than as a missing key.
 */
export function unitLabel(t: CatalogT, unit: string | null | undefined): string {
  const code = unit || "piece";
  const key = `stock.units.${code}`;
  return t.has(key) ? t(key) : code;
}
