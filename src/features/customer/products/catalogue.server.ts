import "server-only";

import {
  getCatalogueTree,
  getPriceHints,
  listProducts,
  listStockProducts,
  type CatalogueCategory,
  type Page,
  type ProductCard,
  type StockProduct,
} from "@/features/customer/catalog/api.server";
import { photoVariant } from "@/features/customer/catalog/images";

import { catalogMode, type HubItem } from "./hub";

/** The list APIs answer at most 100 rows a page (`perPage` 200 → 422). */
const PER_PAGE = 100;
/** A ceiling on pages read per list: 1,000 rows — far above today's ~143 (R5 is the real fix). */
const MAX_PAGES = 10;

/** Every page of a list, read one after another (the first answer says how many there are). */
async function everyPage<T>(read: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const first = await read(1);
  const pages = Math.min(MAX_PAGES, Math.ceil(first.meta.total / Math.max(1, first.meta.perPage)));
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => read(index + 2)));
  return [first, ...rest].flatMap((page) => page.data);
}

export interface HubData {
  items: HubItem[];
  tree: CatalogueCategory[];
}

/**
 * Every catalogue and stock product as hub items (prompt item 5: "server-side filtering + pagination over ALL
 * items"), searched by the API when `q` is given, restricted to one category (and its sub-categories, D-228)
 * when `category` is. Three to four cached reads (catalogue 300 s, prices 60 s); nothing is computed but the
 * mode and the category each item belongs to.
 */
export async function loadHubItems(query: { q?: string | null; category?: string | null } = {}): Promise<HubData> {
  const filter = { ...(query.q ? { q: query.q } : {}), ...(query.category ? { category: query.category } : {}) };
  const [tree, products, stock] = await Promise.all([
    getCatalogueTree(),
    everyPage<ProductCard>((page) => listProducts({ ...filter, page, perPage: PER_PAGE })),
    everyPage<StockProduct>((page) => listStockProducts({ ...filter, page, perPage: PER_PAGE })),
  ]);
  const categoryOfType = new Map(tree.flatMap((category) => category.types.map((type) => [type.code, category.code])));

  // A stock product names no type; its price hint does (`store.catalog.listPriceHints`, one read per 100 SKUs).
  const skus = stock.map((product) => product.sku);
  const chunks = Array.from({ length: Math.ceil(skus.length / PER_PAGE) }, (_, index) =>
    skus.slice(index * PER_PAGE, (index + 1) * PER_PAGE),
  );
  const hintMaps = await Promise.all(chunks.map((chunk) => getPriceHints({ skus: chunk })));
  const stockType = new Map(
    hintMaps.flatMap((map) =>
      [...map.values()].filter((hint) => hint.kind === "stock_product").map((hint) => [hint.key, hint.productTypeCode]),
    ),
  );

  const catalogue = products.map((card, index): HubItem => {
    const categoryCode = categoryOfType.get(card.productTypeCode) ?? null;
    return {
      kind: "catalog",
      key: card.slug,
      nameTh: card.nameTh,
      nameEn: card.nameEn,
      mode: catalogMode(card, categoryCode),
      categoryCode,
      productTypeCode: card.productTypeCode,
      imageUrl: card.imageUrl,
      imageAlt: null,
      startingPrice: card.availability === "rfq" ? null : card.startingPricePerPiece,
      priceQuantity: card.availability === "rfq" ? null : (card.startingPriceAssumes?.quantity ?? null),
      specLabel: card.availability === "rfq" ? null : (card.startingPriceAssumes?.label ?? null),
      moq: card.moq,
      unit: null,
      leadTime: card.leadTimeDays,
      inStock: null,
      order: index,
    };
  });
  const shelf = stock.map((product, index): HubItem => {
    const productTypeCode = stockType.get(product.sku) ?? null;
    const variant = photoVariant(product.images[0]?.variant);
    return {
      kind: "stock",
      key: product.sku,
      nameTh: product.nameTh,
      nameEn: product.nameEn,
      mode: "stock",
      categoryCode: productTypeCode ? (categoryOfType.get(productTypeCode) ?? null) : null,
      productTypeCode,
      imageUrl: product.imageUrls[0] ?? null,
      imageAlt: variant?.alt ?? null,
      // R1: the API publishes no "starting from" for stock yet (`price-hints` sends null) — nothing is shown.
      startingPrice: null,
      priceQuantity: null,
      specLabel: null,
      moq: product.minOrderQty,
      unit: product.unit,
      leadTime: null,
      inStock: product.inStock,
      order: catalogue.length + index,
    };
  });
  return { items: [...catalogue, ...shelf], tree };
}
