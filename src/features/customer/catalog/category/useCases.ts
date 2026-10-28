/**
 * "เลือกตามการใช้งาน" (category Phase 1 item 4): the approved use cases of the category with a live count each.
 * A value with no result is never drawn, and the whole group goes when no value narrows the list (every value
 * equals the total) — the old static chips ("ราคาทันที / ขอใบเสนอราคา / ขั้นต่ำ ≤ 100 …") showed both kinds.
 */

import type { UseCase } from "./content/schema";

export interface UseCaseChip {
  id: string;
  count: number;
}

export function caseChipsOf(useCases: readonly UseCase[], keys: readonly string[]): UseCaseChip[] {
  const present = new Set(keys);
  const chips = useCases
    .map((useCase) => ({ id: useCase.id, count: new Set(useCase.keys.filter((key) => present.has(key))).size }))
    .filter((chip) => chip.count > 0);
  return chips.some((chip) => chip.count < keys.length) ? chips : [];
}

/** The keys a chosen use case keeps; an unknown or empty choice keeps everything. */
export function filterByUseCase<T extends { key: string }>(
  items: readonly T[],
  useCases: readonly UseCase[],
  chosen: string | null,
): T[] {
  const useCase = chosen ? useCases.find((candidate) => candidate.id === chosen) : undefined;
  if (!useCase) return [...items];
  const keep = new Set(useCase.keys);
  return items.filter((item) => keep.has(item.key));
}

/** The use cases an item belongs to (the comparison table's "เหมาะกับ"). */
export const caseIdsOf = (useCases: readonly UseCase[], key: string) =>
  useCases.filter((useCase) => useCase.keys.includes(key)).map((useCase) => useCase.id);
