/**
 * D-313: getpack-api puts its words next to every labelled status — `<field>LabelTh` (the
 * customer's) and `<field>LabelAdminTh` (staff and factories). The mock takes one Thai wording for
 * both from the web's own status maps; the API's dictionary is `store.statusLabels.list`.
 */

import { statusMeta, type StatusMeta } from "@/domain/status";
import statusTh from "@/i18n/messages/th/common/status.json";

type Labels<F extends string, V = string> = { [K in `${F}LabelTh` | `${F}LabelAdminTh`]: V };

function wordsOf(map: Record<string, StatusMeta>, value: string): string {
  // A value the web has no map entry for reads as itself, never as "unknown".
  if (!(value in map)) return value;
  const text = statusMeta(map, value)
    .labelKey.split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], statusTh);
  return typeof text === "string" ? text : value;
}

/** The two labels of one status field, e.g. `statusLabels("status", ORDER_STATUS, "shipping")`. */
export function statusLabels<F extends string>(field: F, map: Record<string, StatusMeta>, value: string): Labels<F>;
/** A status that may be unset: both labels are null with it. */
export function statusLabels<F extends string>(
  field: F,
  map: Record<string, StatusMeta>,
  value: string | null,
): Labels<F, string | null>;
export function statusLabels(field: string, map: Record<string, StatusMeta>, value: string | null) {
  const words = value === null ? null : wordsOf(map, value);
  return { [`${field}LabelTh`]: words, [`${field}LabelAdminTh`]: words };
}
