import { pushToDataLayer } from "./datalayer";

/**
 * What people do on a category page (`/products/[category]`, category redesign Phase 1 item 9) — through the
 * catalogue wrapper's channel (GLOBAL-RULES §5): GTM's `dataLayer`, only once the visitor has accepted analytics
 * (`pk_consent`), like the product page's `pdp_*` events. Nothing identifies a person: the category code, a use
 * case id, a view, a size code, the product's measured size in mm.
 */
export interface CategoryEvents {
  /** A use-case chip was chosen (`all` = the chip that clears it). */
  category_use_filter: { category: string; use: string; count: number };
  /** The list switched between rows / grid and the comparison table. */
  category_view_toggle: { category: string; view: "rows" | "table" };
  /** The finder answered a measured product size (L × W × H, mm) with a size code, or none. */
  category_size_find: { category: string; product: string; dims: string; result: string | null };
  /** A standard size was chosen (button or chart). */
  category_size_select: { category: string; product: string; size: string };
  /** An action of the selected size: order it in the configurator, or its free box file. */
  category_size_cta: { category: string; product: string; size: string; cta: "order" | "dieline" };
  /** The guide section came into view. */
  category_guide_view: { category: string; kind: "flute" | "material" };
  /** "ต้องการแบบอื่น" → the style library. */
  category_crosslink_styles: { category: string; styleCategory: string };
}

export type CategoryEventName = keyof CategoryEvents;

export function trackCategory<K extends CategoryEventName>(event: K, properties: CategoryEvents[K]): void {
  pushToDataLayer(event, properties);
}
