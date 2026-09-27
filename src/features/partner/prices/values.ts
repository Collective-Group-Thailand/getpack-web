import type { Schemas } from "@/lib/api/types";

export type PriceComponentDef = Schemas["PriceComponentDto"];
export type PriceReference = { column: string; id: string; code: string | null; name: string };
export type Values = Record<string, unknown>;

/**
 * A decimal from the API, shown as it came — never parsed into a float and re-rounded (a price
 * rate keeps its six places). Only trailing zeros past two decimals are dropped, so
 * `"11.800000"` reads `11.80` and `"0.625000"` reads `0.625`.
 */
export function decimalText(value: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(value)) return value;
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  const shown = trimmed.length < 2 ? fraction.slice(0, 2).padEnd(2, "0") : trimmed;
  return fraction ? `${whole}.${shown}` : whole!;
}

/** One cell of a price row, as a person reads it: a catalogue name for a reference, text otherwise. */
export function cellText(
  value: unknown,
  column: { key: string; type: Schemas["PriceColumnType"] } | undefined,
  referenceName: (column: string, id: string) => string | undefined,
  labels: { yes: string; no: string; open: string },
): string {
  if (value === null || value === undefined || value === "") return labels.open;
  if (column?.type === "ref" && typeof value === "string") return referenceName(column.key, value) ?? value.slice(0, 8);
  if (column?.type === "boolean" || typeof value === "boolean") return value ? labels.yes : labels.no;
  if (typeof value === "string" && column?.type === "decimal") return decimalText(value);
  return String(value);
}

/** The columns of a component: the ones that identify a line, then the ones a proposal changes. */
export function columnsOf(definitions: PriceComponentDef[], component: Schemas["PriceComponent"]) {
  const definition = definitions.find((item) => item.component === component);
  return {
    dimensions: definition?.dimensions ?? [],
    values: definition?.values ?? [],
    all: [...(definition?.dimensions ?? []), ...(definition?.values ?? [])],
  };
}

/** Which value columns a proposed line changes against the line it replaces. */
export function changedKeys(current: Values | null, next: Values | null): Set<string> {
  if (!current || !next) return new Set(Object.keys(next ?? current ?? {}));
  return new Set(Object.keys(next).filter((key) => JSON.stringify(current[key]) !== JSON.stringify(next[key])));
}

/** A lookup from `(column, id)` to the catalogue name `partner.references` gave. */
export function referenceLookup(references: PriceReference[]) {
  const map = new Map(references.map((item) => [`${item.column}:${item.id}`, item.name]));
  const byId = new Map(references.map((item) => [item.id, item.name]));
  return (column: string, id: string) => map.get(`${column}:${id}`) ?? byId.get(id);
}

/** The price groups of D-040, in the order a factory reads them. */
export const PRICE_GROUPS = [
  "materials",
  "process_rates",
  "waste",
  "commercial_terms",
  "shipping",
  "rules",
] as const satisfies readonly Schemas["PriceGroup"][];
