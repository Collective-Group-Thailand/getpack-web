import { CONSENT_COOKIE, parseConsent } from "./consent";

/** Whether the visitor has accepted analytics (the `pk_consent` cookie, ConsentBanner). */
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

/**
 * The one consent-gated push to Google Tag Manager's `dataLayer` (GLOBAL-RULES §5: one wrapper, imported,
 * never forked). Nothing is sent before the visitor has accepted analytics, or without GTM on the page.
 * Never throws. The typed maps (`catalog.ts`, `configurator.ts`) are the only callers.
 */
export function pushToDataLayer(event: string, properties: object): void {
  if (typeof window === "undefined") return;
  try {
    if (!analyticsAllowed()) return;
    const layer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    layer?.push({ event, ...properties });
  } catch {
    // Analytics never breaks the page.
  }
}
