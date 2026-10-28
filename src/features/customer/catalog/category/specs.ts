/**
 * The spec facts a category row and the comparison table show for a product (category Phase 1 items 4), read
 * from the API's product detail only: structure (`patterns[].name`), flutes of its boards (`fluteOf`: the
 * material's `flute` attribute or the flute its name states), its boards, its standard sizes and whether the
 * configurator takes a custom size (instant products). Anything the API does not say is null — the page writes
 * "ดูในหน้าสินค้า", never a guess (prompt hard rule 3).
 */

import { fluteOf } from "@/features/customer/catalog/flute";
import type { Schemas } from "@/lib/api/types";

type Detail = Pick<Schemas["StoreProductDetailDto"], "patterns" | "optionGroups" | "standardSizes">;

export interface ProductSpecs {
  structures: string[];
  /** Flute codes in offer order ("B", "E", "BC"). */
  flutes: string[];
  /** Board / material names (localised by the caller's `pick`). */
  materials: { th: string; en: string }[];
  /** Standard sizes with a height (boxes); flat sizes count too, separately. */
  standardSizes: number;
  /** The configurator takes the customer's own size (an instant product). */
  customSize: boolean;
}

const unique = <T>(values: T[]) => [...new Set(values)];

export function specsOf(detail: Detail | null, instant: boolean): ProductSpecs | null {
  if (!detail) return null;
  const materials = detail.optionGroups.filter((group) => group.kind === "material").flatMap((group) => group.options);
  return {
    structures: unique(detail.patterns.map((pattern) => pattern.name.trim()).filter(Boolean)),
    flutes: unique(materials.flatMap((option) => fluteOf(option) ?? [])),
    materials: materials.map((option) => ({ th: option.nameTh, en: option.nameEn })),
    standardSizes: detail.standardSizes.length,
    customSize: instant,
  };
}
