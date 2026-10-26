import type { PriceStep } from "./pricing";

/** Consecutive quantities that the API prices at the same per-piece figure, shown as one row. */
export interface TierGroup {
  steps: PriceStep[];
  first: PriceStep;
  last: PriceStep;
}

/**
 * A display choice only (D-441, "100–500 ชิ้น ฿x"): quantities next to each other whose per-piece
 * price is the same string are one row. Prices are compared as the decimal strings the API sent and
 * are never added, rounded or averaged; a quantity without an instant price stands alone.
 */
export function mergeEqualTiers(steps: PriceStep[]): TierGroup[] {
  const groups: TierGroup[] = [];
  for (const step of steps) {
    const previous = groups.at(-1);
    if (previous && step.instant && previous.last.instant && step.unitPrice === previous.last.unitPrice) {
      previous.steps.push(step);
      previous.last = step;
    } else {
      groups.push({ steps: [step], first: step, last: step });
    }
  }
  return groups;
}
