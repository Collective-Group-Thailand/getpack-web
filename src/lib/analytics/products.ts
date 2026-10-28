import { pushToDataLayer } from "./datalayer";

/**
 * What people do on the /products hub ("สินค้าและราคา", products redesign Phase 1 item 15) — through
 * the one catalogue wrapper's channel (GLOBAL-RULES §5): GTM's `dataLayer`, only once the visitor has
 * accepted analytics (`pk_consent`), until getpack's ingest takes these names
 * (CONTRACT-REQUEST store.analytics.catalog-events). Nothing identifies a person: words searched,
 * a product slug or SKU, a quantity, a count. Never throws.
 */
export interface ProductsEvents {
  products_search: { query: string; result_count: number };
  products_mode_select: { mode: string; action: "select" | "clear" };
  products_tab: { mode: string };
  products_view_toggle: { view: "grid" | "table" };
  products_calc_change: { product: string; qty: number; print: string };
  products_calc_cta: { product: string; qty: number; print: string };
  products_rfq_add: { product: string; count: number };
  products_rfq_remove: { product: string; count: number };
  products_rfq_submit: { count: number };
}

export type ProductsEventName = keyof ProductsEvents;

export function trackProducts<K extends ProductsEventName>(event: K, properties: ProductsEvents[K]): void {
  pushToDataLayer(event, properties);
}
