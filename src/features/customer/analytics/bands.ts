/**
 * Quantity bands for the D-102 funnel: a quote is reported as "1,000–2,999 pieces", never its
 * exact quantity, which together with a product type and a date could single out one customer's
 * order (`AnalyticsProperties.quantityBand`).
 */
const BANDS = [100, 500, 1000, 3000, 5000, 10000, 50000, 100000] as const;

export function quantityBand(quantity: number): string {
  if (!Number.isFinite(quantity) || quantity < BANDS[0]) return `<${BANDS[0]}`;
  for (let index = BANDS.length - 1; index >= 0; index -= 1) {
    const floor = BANDS[index]!;
    if (quantity >= floor) {
      const ceiling = BANDS[index + 1];
      return ceiling ? `${floor}-${ceiling - 1}` : `${floor}+`;
    }
  }
  return `<${BANDS[0]}`;
}
