import { statusMeta, type StatusMeta } from "@/domain/status";

/** The `status` namespace translator, as much of it as a label needs. */
interface StatusT {
  (key: string): string;
  has(key: string): boolean;
}

/**
 * A status's words for the customer, outside a chip (a summary card's label): the same lookup `StatusChip`
 * makes — the customer reading under `status.customer.*` when there is one, else the shared label.
 */
export function customerStatusLabel<T extends string>(t: StatusT, map: Record<T, StatusMeta>, value: string): string {
  const meta = statusMeta(map, value);
  const customerKey = `customer.${meta.labelKey}`;
  return t.has(customerKey) ? t(customerKey) : t(meta.labelKey);
}
