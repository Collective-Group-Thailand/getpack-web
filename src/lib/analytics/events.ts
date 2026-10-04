/**
 * The first-party analytics vocabulary (D-102).
 *
 * D-102 puts demand and growth analytics in R1 because "traffic and order data are the
 * argument for recruiting more factories" — the funnel visit → configure → quote → order →
 * paid, and what people wanted that Packio could not quote. That report is only as good as
 * the names the UI sends, so they are a closed union rather than free strings: a misspelt
 * `"quote_viewd"` becomes a silent hole in a report nobody reconciles for months.
 *
 * These events go to Packio's own API, not to GTM. They are necessary to operate the service,
 * carry no advertising identifier and never leave Packio, so they are not gated on consent —
 * unlike GA4, which is; the visitor and session ids that travel with them are kept by packio-api
 * only with analytics consent. See `./consent.ts`, and `./ingest.ts` for how these names map onto
 * the five packio-api ingests (`store.analytics.ingest`).
 */

/**
 * The D-102 funnel, in order, plus the steps that explain why someone left it, and the journey
 * funnels of the UX scorecard (U5.0) — studio, claims, reorder. Each journey's steps and where
 * they are sent from are in `docs/ux/funnels.md`.
 */
export const FUNNEL_EVENTS = [
  "page_view",
  "product_viewed",
  "configurator_opened",
  "configuration_changed",
  "quote_shown",
  "quote_abandoned",
  "rfq_submitted",
  "design_started",
  "design_saved",
  "design_ordered",
  "cart_item_added",
  "checkout_started",
  "order_placed",
  "order_paid",
  "claim_started",
  "claim_submitted",
  "reorder_started",
  "reorder_added_to_cart",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/**
 * What may travel with an event.
 *
 * Deliberately narrow and deliberately not `Record<string, unknown>`. D-102 promises the
 * partner prospectus contains "aggregated, anonymised data only", and the way that promise
 * gets broken is a helpful `{ customerName }` added to one call site. Nothing here identifies
 * a person: a product type, a quantity, a postcode — the dimensions the report is sliced by
 * (D-102) and no more. packio-api stores the quantity as a band and the postcode as its
 * province (backend wins, triage `analytics.events`).
 */
export interface AnalyticsProperties {
  /** Route pattern, never the URL — see the same rule in `src/lib/observability`. */
  route?: string;
  productType?: string;
  /** The exact quantity; packio-api bands it before storing (`quote_shown`, `add_to_cart`). */
  quantity?: number;
  /** Lead time and unit price of a shown quote (decimal string, never computed here). */
  leadTimeDays?: number | null;
  unitPrice?: string | null;
  /** The placed order group (`order_placed` only), which links the session to its payment. */
  orderGroupId?: string;
  /** A delivery postcode; packio-api keeps only its province, and only with consent. */
  postcode?: string;
  /** Not sent: packio-api takes the exact `quantity` and bands it itself. */
  quantityBand?: string;
  /** Not sent: packio-api takes a `postcode`. */
  province?: string;
  /** `instant` or `rfq` (D-043). */
  quoteMode?: string;
  /** Why a funnel step ended, e.g. `price_shown` for `quote_abandoned`. */
  reason?: string;
}

export interface AnalyticsEvent {
  name: FunnelEvent;
  properties?: AnalyticsProperties;
  /** Milliseconds since the epoch, taken in the browser; the API decides the business date. */
  occurredAt: number;
}

export function isFunnelEvent(name: string): name is FunnelEvent {
  return (FUNNEL_EVENTS as readonly string[]).includes(name);
}
