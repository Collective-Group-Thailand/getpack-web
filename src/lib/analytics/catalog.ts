import { CONSENT_COOKIE, parseConsent } from "./consent";

/**
 * What people do in the product catalogue — the style library today, any pack that lists things
 * tomorrow (styles redesign §9; GLOBAL-RULES §5: one wrapper, imported, never forked).
 *
 * getpack's own analytics ingest takes a closed list of names that has none of these yet
 * (CONTRACT-REQUEST store.analytics.catalog-events), so until it does they go to Google Tag
 * Manager's `dataLayer`. They are pushed only once the visitor has accepted analytics (the
 * `pk_consent` cookie, ConsentBanner); without consent, or without GTM on the page, nothing is
 * sent. Nothing here identifies a person: a search's words, a style code, a facet.
 * Never throws.
 */
export interface CatalogEvents {
  /** A search ran. Searches with no result are the point: `result_count: 0` is sent, not dropped. */
  catalog_search: { query: string; mode: "word" | "size"; result_count: number };
  /** A facet value was added or removed; `result_count` is the number of matches when it was clicked. */
  catalog_filter: { facet: string; value: string; action: "add" | "remove"; result_count: number };
  catalog_quickview: { style_code: string; position?: number; source: "grid" | "compare" | "link" };
  catalog_cta: { style_code: string; cta: "design" | "sample" | "quote" | "cart" | "dieline" | "page" };
  catalog_compare: { style_codes: string[] };
}

export type CatalogEventName = keyof CatalogEvents;

function analyticsAllowed(): boolean {
  try {
    const raw = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`))
      ?.slice(CONSENT_COOKIE.length + 1);
    return parseConsent(raw)?.analytics === true;
  } catch {
    return false;
  }
}

export function trackCatalog<K extends CatalogEventName>(event: K, properties: CatalogEvents[K]): void {
  if (typeof window === "undefined") return;
  try {
    if (!analyticsAllowed()) return;
    const layer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    layer?.push({ event, ...properties });
  } catch {
    // Analytics never breaks the page.
  }
}
