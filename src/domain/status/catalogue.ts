import { defineStatusMap } from "./types";
import type { CatalogStatus, ContentStatus, StockAvailability } from "./contract";

/** A catalogue record: product type, pattern, material, stock product (B2.1). */
export const CATALOG_STATUS = defineStatusMap<CatalogStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "catalog.draft" },
  active: { tone: "success", icon: "check", labelKey: "catalog.active" },
  inactive: { tone: "neutral", icon: "pause", labelKey: "catalog.inactive" },
  archived: { tone: "neutral", icon: "archive", labelKey: "catalog.archived" },
});

/** CMS content: banners, articles, FAQs (B2.1). */
export const CONTENT_STATUS = defineStatusMap<ContentStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "content.draft" },
  published: { tone: "success", icon: "check", labelKey: "content.published" },
  archived: { tone: "neutral", icon: "archive", labelKey: "content.archived" },
});

/** A stock product on the storefront: on hand ("พร้อมส่ง") or out of stock ("สินค้าหมด", no cart — D-447 §10.4). */
export const STOCK_AVAILABILITY = defineStatusMap<StockAvailability>({
  in_stock: { tone: "primary", icon: "check", labelKey: "stockAvailability.in_stock" },
  out_of_stock: { tone: "neutral", icon: "ban", labelKey: "stockAvailability.out_of_stock" },
});

/** The availability of a stock product as the API states it (`inStock`). */
export const stockAvailabilityOf = (inStock: boolean): StockAvailability => (inStock ? "in_stock" : "out_of_stock");
