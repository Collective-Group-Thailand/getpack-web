/**
 * PDPA consent (D-144), as a value rather than a component.
 *
 * Two independent choices, both defaulting to **denied**: PDPA requires consent before
 * personal data is processed for a purpose the person did not ask for, and a default of
 * "granted until they object" is not consent. Analytics and marketing are separated because
 * they are separate purposes — someone may reasonably allow measurement and refuse ad
 * targeting, and D-144 already lets customers opt out of marketing without opting out of
 * order messages.
 *
 * What is *not* gated: the first-party funnel events this app posts to its own API. Those are
 * necessary to operate the service and are covered by legitimate interest; they carry no
 * advertising identifier and never leave Packio. GTM and GA4 are third-party processing and
 * are gated. (Legal counsel should confirm the split before launch — noted in PROGRESS.)
 */

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
}

/** Nothing is granted until someone says so. */
export const CONSENT_DENIED: ConsentState = { analytics: false, marketing: false };
export const CONSENT_ALL: ConsentState = { analytics: true, marketing: true };

/**
 * JS-readable on purpose, like `pk_theme`: the banner writes it without a round trip, and it
 * holds two booleans rather than anything identifying. A year, because asking again next week
 * is how a banner becomes something people click through without reading.
 */
export const CONSENT_COOKIE = "pk_consent";
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Serialised as `a1m0` rather than JSON.
 *
 * A cookie value with braces and quotes has to be URL-encoded, and every reader then has to
 * remember to decode it. Four characters need neither, and an unparseable value fails closed.
 */
export function serialiseConsent(consent: ConsentState): string {
  return `a${consent.analytics ? 1 : 0}m${consent.marketing ? 1 : 0}`;
}

/** `null` when there is no valid cookie — which means "not asked yet", not "refused". */
export function parseConsent(value: string | undefined | null): ConsentState | null {
  if (!value) return null;
  const match = /^a([01])m([01])$/.exec(value);
  if (!match) return null;
  return { analytics: match[1] === "1", marketing: match[2] === "1" };
}

/**
 * Google Consent Mode v2 signals.
 *
 * GTM must receive these *before* any tag fires, defaulting to denied; with consent mode
 * configured, GA4 still sends cookieless pings it can model from, rather than nothing. The
 * two security signals are always granted — they cover fraud prevention, not measurement.
 */
export function consentModeSignals(consent: ConsentState): Record<string, "granted" | "denied"> {
  const analytics = consent.analytics ? "granted" : "denied";
  const marketing = consent.marketing ? "granted" : "denied";

  return {
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
    analytics_storage: analytics,
    functionality_storage: "granted",
    personalization_storage: analytics,
    security_storage: "granted",
  };
}
