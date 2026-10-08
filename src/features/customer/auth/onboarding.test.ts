import { describe, expect, it } from "vitest";

import { consentsToAsk, needsProfile, type Consent } from "./onboarding";

const consent = (purpose: string, required: boolean, granted: boolean | null, outdated = false): Consent => ({
  purpose,
  labelTh: purpose,
  labelEn: purpose,
  required,
  granted,
  outdated,
  versionNo: granted === null ? null : 1,
  summary: purpose,
  text: null,
});

describe("what a sign-in asks for", () => {
  it("asks nothing when every required purpose is granted and current", () => {
    expect(consentsToAsk([consent("terms_of_service", true, true), consent("marketing_line", false, null)])).toEqual(
      [],
    );
  });

  it("asks the required purposes and the unanswered optional ones on a first sign-in", () => {
    const asked = consentsToAsk([
      consent("terms_of_service", true, null),
      consent("privacy_notice", true, null),
      consent("marketing_email", false, false),
      consent("marketing_line", false, null),
    ]);
    expect(asked.map((entry) => entry.purpose)).toEqual(["terms_of_service", "privacy_notice", "marketing_line"]);
  });

  it("asks again when a required purpose's text has a new version", () => {
    expect(consentsToAsk([consent("terms_of_service", true, true, true)])).toHaveLength(1);
  });

  it("asks for a profile until one is saved, and not again after a skip on this browser", () => {
    const profile = {
      id: "x",
      customerCode: null,
      displayName: "ลูกค้า",
      firstName: null,
      lastName: null,
      email: null,
      phone: "+66812345678",
      customerType: "individual" as const,
      createdVia: "self" as const,
      createdAt: "2026-09-01T09:00:00+07:00",
      profileCompletedAt: null,
    };
    expect(needsProfile(profile, undefined)).toBe(true);
    expect(needsProfile({ ...profile, profileCompletedAt: "2026-09-02T09:00:00+07:00" }, undefined)).toBe(false);
    expect(needsProfile(null, undefined)).toBe(false);
    // Skipped once on this browser: not asked again for this customer, still for another.
    expect(needsProfile(profile, "x")).toBe(false);
    expect(needsProfile(profile, "someone-else")).toBe(true);
  });
});
