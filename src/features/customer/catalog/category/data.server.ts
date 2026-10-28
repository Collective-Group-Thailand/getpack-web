import "server-only";

import {
  getConfigurator,
  getProduct,
  listStyles,
  type CatalogueCategory,
  type Configurator,
  type ProductDetail,
} from "@/features/customer/catalog/api.server";
import { hasStandardSizes } from "@/features/customer/catalog/pdp/model";
import { listMaterials } from "@/features/customer/learn/api.server";
import { loadHubItems } from "@/features/customer/products/catalogue.server";
import type { HubItem } from "@/features/customer/products/hub";

import { contentFor, type CategoryContent } from "./content";
import { categoryFacts, type CategoryFacts } from "./facts";

/** Up to this many items a category lists as rows (with details); more → the /products grid (prompt item 4). */
export const ROWS_MAX = 8;
/** Configurators read for the finder and the flute guide (instant products only). */
const MAX_CONFIGURATORS = 12;

export interface CategoryData {
  items: HubItem[];
  facts: CategoryFacts;
  content: CategoryContent;
  /** Product details by slug, for rows / the comparison table (≤ {@link ROWS_MAX} items only). */
  details: Map<string, ProductDetail>;
  /** Configurators of the instant catalogue products, in list order. */
  configurators: Configurator[];
  /** Instant box products with standard sizes, the finder's choices (an approved content pick first). */
  finder: Configurator[];
  /** The style-library category to link to and its live count (> 0), or null. */
  styles: { category: string; count: number } | null;
  /** /materials has data (the guide's "เปรียบเทียบวัสดุทั้งหมด"). */
  materialsPage: boolean;
}

/**
 * Everything `/products/[category]` shows, from the API (category redesign PLAN.md §3, "data layer"): the
 * category's items as the /products hub reads them, its facts, its approved content, the details of up to eight
 * items, the instant products' configurators (finder, guide), the style library's count for this category and
 * whether the materials page has data. Every read is cached like the catalogue; a failing optional read leaves
 * its section out.
 */
export async function loadCategory(category: CatalogueCategory, typeCode?: string | null): Promise<CategoryData> {
  const content = contentFor(category.code);
  const data = await loadHubItems({ category: category.code });
  const selected = typeCode ? category.types.find((type) => type.code === typeCode) : undefined;
  const items = selected ? data.items.filter((item) => item.productTypeCode === selected.code) : data.items;
  const catalogue = items.filter((item) => item.kind === "catalog");
  const instant = catalogue.filter((item) => item.mode === "instant").slice(0, MAX_CONFIGURATORS);
  // The style library's category: an approved mapping (Q6), else the same code when the library has it.
  const styleCategory = content.styles?.styleCategory ?? category.code;

  const [details, configurators, styleList, materials] = await Promise.all([
    items.length <= ROWS_MAX
      ? Promise.all(catalogue.map((item) => getProduct(item.key).catch(() => null)))
      : Promise.resolve([] as (ProductDetail | null)[]),
    Promise.all(instant.map((item) => getConfigurator(item.key).catch(() => null))),
    listStyles({ limit: 1 }).catch(() => null),
    listMaterials().catch(() => []),
  ]);

  const ready = configurators.filter(
    (configurator): configurator is Configurator => configurator !== null && configurator.instant,
  );
  const sized = ready.filter(hasStandardSizes);
  const preferred = content.sizeFinder?.productSlug;
  const finder = preferred
    ? [...sized.filter((c) => c.slug === preferred), ...sized.filter((c) => c.slug !== preferred)]
    : sized;
  const count = styleList?.facets.category.find((facet) => facet.value === styleCategory)?.count ?? 0;

  return {
    items,
    facts: categoryFacts(items),
    content,
    details: new Map(details.flatMap((detail) => (detail ? [[detail.slug, detail] as const] : []))),
    configurators: ready,
    finder,
    styles: count > 0 ? { category: styleCategory, count } : null,
    materialsPage: materials.length > 0,
  };
}
