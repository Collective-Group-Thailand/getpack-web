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

/**
 * The two texts of a tier row: the quantity cell and the screen-reader tail of its button. The unit
 * appears once in each: a merged row's range already carries it ("100–500 ชิ้น"), so its button
 * must not add it again; a single-quantity cell shows the bare number and its button adds the unit.
 */
export function tierRowLabels(
  group: TierGroup,
  text: {
    number: (value: number) => string;
    range: (from: string, to: string) => string;
    withUnit: (quantity: string) => string;
  },
): { quantity: string; select: string } {
  if (group.steps.length > 1) {
    const range = text.range(text.number(group.first.quantity), text.number(group.last.quantity));
    return { quantity: range, select: range };
  }
  const quantity = text.number(group.first.quantity);
  return { quantity, select: text.withUnit(quantity) };
}
