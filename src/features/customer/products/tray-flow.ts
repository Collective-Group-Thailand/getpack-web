import { categorySegment, productHref, stockProductHref } from "@/features/customer/catalog/paths";

import type { TrayItem } from "./rfq-store";

/**
 * Where one tray item is asked for (prompt item 8, "submit opens the existing quote flow"): its
 * category's RFQ form, naming the product (`from` / `sku`) and its type, in tray mode (`tray=1`) —
 * the form then adds it to the account's draft RFQ basket (D-301) and goes on to the next item.
 * An item whose category the API did not name opens on its own page instead.
 */
export function trayItemHref(item: TrayItem): string {
  const category = item.categoryCode ?? (item.kind === "stock" ? "standard_product" : null);
  if (!category) return item.kind === "stock" ? stockProductHref(item.key) : productHref(item.key);
  const search = new URLSearchParams();
  search.set(item.kind === "stock" ? "sku" : "from", item.key);
  if (item.productTypeCode) search.set("type", item.productTypeCode);
  search.set("tray", "1");
  return `/rfq/${categorySegment(category)}?${search.toString()}`;
}

/** Where the flow goes once the tray is empty: the draft basket, sent in one go. */
export const TRAY_DONE_HREF = "/rfq/basket?added=1";
