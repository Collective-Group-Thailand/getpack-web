import { pushToDataLayer } from "./datalayer";

/**
 * What people do on a product page (`/products/[slug]`, pdp redesign Phase 1 item 11) — through the
 * catalogue wrapper's channel (GLOBAL-RULES §5): GTM's `dataLayer`, only once the visitor has accepted
 * analytics (`pk_consent`), like the hub's `products_*` events. Nothing identifies a person: the
 * product slug, an option's code, a quantity, which button.
 */
export interface PdpEvents {
  /** A picker in the buy box changed: `size` (code), `material` (option code), `print`, `quantity`. */
  pdp_option_change: { product: string; option: "size" | "material" | "print" | "quantity"; value: string };
  /** A price for the current selection was shown (once per settled selection). */
  pdp_price_view: { product: string; size: string | null; qty: number; instant: boolean };
  /** A buy-box action: configure, save the quote, the box file, ask, or the mobile bar's configure. */
  pdp_cta: { product: string; cta: "configure" | "save_quote" | "dieline" | "ask" | "configure_bar" | "custom_size" };
  /** "เลือกเบอร์นี้" in the sizes table. */
  pdp_size_table_pick: { product: string; size: string };
  /** A design path card: own file, the Studio, or the design team. */
  pdp_design_path: { product: string; path: "own_file" | "studio" | "hired_design" };
}

export type PdpEventName = keyof PdpEvents;

export function trackPdp<K extends PdpEventName>(event: K, properties: PdpEvents[K]): void {
  pushToDataLayer(event, properties);
}
