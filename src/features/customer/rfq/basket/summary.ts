import type { Schemas } from "@/lib/api/types";

type Item = Schemas["RfqBasketItemDto"];

/** What an item asks for, from the specification it was added with: size and quantities (D-301). */
export function itemFacts(item: Item): {
  size: [number, number, number | null] | null;
  quantities: number[];
  answers: number;
} {
  const spec = item.specification as {
    quantities?: number[];
    lengthMm?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
    spec?: Record<string, unknown>;
  };
  const size =
    spec.lengthMm && spec.widthMm
      ? ([spec.lengthMm, spec.widthMm, spec.heightMm ?? null] as [number, number, number | null])
      : null;
  return {
    size,
    quantities: Array.isArray(spec.quantities) ? spec.quantities.filter((q) => typeof q === "number") : [],
    answers: spec.spec ? Object.keys(spec.spec).length : 0,
  };
}
