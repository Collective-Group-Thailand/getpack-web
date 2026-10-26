import { pushToDataLayer } from "./datalayer";

/**
 * What people do in the configurator (C4 redesign): which option they pick and what the API said it costs,
 * how they size and count, where they leave for. Same wrapper as the catalogue's (`catalog.ts`): pushed to
 * the `dataLayer` once the visitor has accepted analytics, otherwise nothing.
 *
 * Deliberately narrow, like `AnalyticsProperties`: no postcode (only the zone it resolves to), no target
 * price (it is internal-only: `cfg_target_price_set` says THAT one was set, never what), no dimensions
 * typed by the customer, no discount code. A `delta` is the API's own signed string for the card chosen
 * (`calculate-batch`), passed through; this module never computes one.
 */
export interface ConfiguratorEvents {
  /** A card or choice picked. `delta`: the API's price change of that card against the selection before it, or null. */
  cfg_option_change: { step: string; option: string; value: string; delta: string | null };
  /** Standard sizes or a size of their own. */
  cfg_size_mode: { mode: "standard" | "custom" };
  /** A quantity typed that is not one of the API's presets. */
  cfg_qty_custom: { quantity: number };
  /** An optional target price was entered. The amount is never sent. */
  cfg_target_price_set: Record<string, never>;
  /** A delivery postcode resolved to an area; the area's (province) name only, never the postcode. */
  cfg_postcode_set: { zone: string };
  /** How the artwork comes: `own_file`, `online_designer`, `hired_design`, … */
  cfg_design_path: { path: string };
  /** The real-sample checkbox. */
  cfg_sample_toggle: { on: boolean };
  /** A button or link of the price summary pressed. */
  cfg_cta: { cta: "cart" | "save" | "share" | "pdf" | "sample" | "rfq" | "studio" | "line" };
  /** The API has no instant price for this size and quantity: a quotation is needed. `size` is the standard code or `custom`. */
  cfg_quote_only_shown: { size: string; qty: number };
}

export type ConfiguratorEventName = keyof ConfiguratorEvents;

export function trackConfigurator<K extends ConfiguratorEventName>(event: K, properties: ConfiguratorEvents[K]): void {
  pushToDataLayer(event, properties);
}
