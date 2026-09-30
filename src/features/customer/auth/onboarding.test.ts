import { describe, expect, it } from "vitest";

import { consentsToAsk, needsProfile, type Consent } from "./onboarding";

const consent = (purpose: string, required: boolean, granted: boolean | null, outdated = false): Consent => ({
  purpose,
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

  it("asks for a profile only when there is no e-mail and this customer was not asked before", () => {
    const me = {
      id: "x",
      displayName: "ลูกค้า",
      phone: "0812345678",
      locale: "th" as const,
      roles: [],
      permissions: [],
      scopes: [],
      identities: [],
    };
    expect(needsProfile({ ...me, email: null }, undefined)).toBe(true);
    expect(needsProfile({ ...me, email: "a@b.invalid" }, undefined)).toBe(false);
    expect(needsProfile(null, undefined)).toBe(false);
    // Saved or skipped once: the e-mail cannot be set there (CONTRACT-GAP store.profile), so the
    // step would otherwise come back at every sign-in.
    expect(needsProfile({ ...me, email: null }, "x")).toBe(false);
    expect(needsProfile({ ...me, email: null }, "someone-else")).toBe(true);
  });
});
