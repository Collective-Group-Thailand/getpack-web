import "server-only";

import { cache } from "react";

import {
  getCatalogueTree,
  getProduct,
  getStockProduct,
  type CatalogueCategory,
  type ProductDetail,
  type ProductType,
  type StockProduct,
} from "./api.server";
import { categorySegment } from "./paths";

export type ResolvedKey =
  | { kind: "category"; category: CatalogueCategory; tree: CatalogueCategory[] }
  | {
      kind: "product";
      product: ProductDetail;
      type?: ProductType;
      category?: CatalogueCategory;
      tree: CatalogueCategory[];
    }
  | { kind: "stock"; product: StockProduct; tree: CatalogueCategory[] };

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * What `/products/[key]` is: a category, a catalogue product or a stock product, in that
 * order (see `./paths.ts`). Cached for the request, so `generateMetadata` and the page share
 * one set of reads.
 */
export const resolveProductKey = cache(async (raw: string): Promise<ResolvedKey | null> => {
  const key = safeDecode(raw);
  const tree = await getCatalogueTree();

  const category = tree.find((candidate) => categorySegment(candidate.code) === key);
  if (category) return { kind: "category", category, tree };

  const product = await getProduct(key);
  if (product) {
    const owner = tree.find((candidate) => candidate.types.some((type) => type.code === product.productTypeCode));
    const type = owner?.types.find((candidate) => candidate.code === product.productTypeCode);
    return { kind: "product", product, type, category: owner, tree };
  }

  const stock = await getStockProduct(key);
  if (stock) return { kind: "stock", product: stock, tree };

  return null;
});
