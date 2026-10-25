/**
 * What people do in the style library (styles redesign §9): searches — above all the ones that
 * find nothing — filters, quick views, calls to action and comparisons.
 *
 * getpack's own analytics ingest takes a closed list of names that has none of these yet
 * (CONTRACT-REQUEST store.analytics.catalog-events), so until it does they go to Google Tag
 * Manager's `dataLayer`, where GA4 reads them under the visitor's consent (Consent Mode is set by
 * `ConsentBanner`). Nothing here identifies a person: a search's words, a style code, a facet.
 * Never throws; without GTM on the page it is a no-op.
 */

export interface CatalogEvents {
  catalog_search: { query: string; mode: "word" | "size"; result_count: number };
  catalog_filter: { facet: string; value: string; action: "add" | "remove"; result_count?: number };
  catalog_quickview: { style_code: string; position?: number; source: "grid" | "compare" | "link" };
  catalog_cta: { style_code: string; cta: "design" | "sample" | "quote" | "cart" | "dieline" | "page" };
  catalog_compare: { style_codes: string[] };
}

export function trackCatalog<K extends keyof CatalogEvents>(event: K, properties: CatalogEvents[K]): void {
  if (typeof window === "undefined") return;
  try {
    const layer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    layer?.push({ event, ...properties });
  } catch {
    // Analytics never breaks the page.
  }
}
