import { describe, expect, it } from "vitest";

import { CONSENT_DENIED, consentModeSignals, parseConsent, serialiseConsent } from "./consent";

describe("consent serialisation", () => {
  it("round-trips both choices", () => {
    for (const consent of [
      { analytics: false, marketing: false },
      { analytics: true, marketing: false },
      { analytics: false, marketing: true },
      { analytics: true, marketing: true },
    ]) {
      expect(parseConsent(serialiseConsent(consent))).toEqual(consent);
    }
  });

  it("needs no URL encoding", () => {
    // A value with braces or quotes has to be encoded, and then every reader has to remember
    // to decode it.
    const value = serialiseConsent({ analytics: true, marketing: true });
    expect(encodeURIComponent(value)).toBe(value);
  });

  it("distinguishes 'not asked' from 'refused'", () => {
    // They are different: one means show the banner, the other means never show it again.
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("a0m0")).toEqual(CONSENT_DENIED);
  });

  it("fails closed on anything it does not recognise", () => {
    for (const value of ["yes", "a1", "a2m0", '{"analytics":true}', "a1m1x"]) {
      expect(parseConsent(value), value).toBeNull();
    }
  });
});

describe("consentModeSignals", () => {
  it("denies everything until someone consents", () => {
    const signals = consentModeSignals(CONSENT_DENIED);

    expect(signals.analytics_storage).toBe("denied");
    expect(signals.ad_storage).toBe("denied");
    expect(signals.ad_user_data).toBe("denied");
    expect(signals.ad_personalization).toBe("denied");
  });

  it("keeps the two purposes separate", () => {
    // Someone may reasonably allow measurement and refuse ad targeting.
    const signals = consentModeSignals({ analytics: true, marketing: false });

    expect(signals.analytics_storage).toBe("granted");
    expect(signals.ad_storage).toBe("denied");
    expect(signals.ad_personalization).toBe("denied");
  });

  it("always grants the signals that are not measurement", () => {
    // `security_storage` covers fraud prevention and `functionality_storage` the site
    // working at all; neither is something to ask permission for.
    const signals = consentModeSignals(CONSENT_DENIED);
    expect(signals.security_storage).toBe("granted");
    expect(signals.functionality_storage).toBe("granted");
  });
});
