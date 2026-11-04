import { describe, expect, it } from "vitest";

import { ACCOUNT_BANNER_PRIORITY, accountBannerOf, type AccountBannerInput } from "./account-banner";

const none: AccountBannerInput = { refresh: null, survey: null, tasks: null, bonusLots: [] };
const all: AccountBannerInput = {
  refresh: { due: true, lastConfirmedAt: "2025-11-01T10:00:00+07:00" },
  survey: { status: "open" },
  tasks: { remainingPoints: 120 },
  bonusLots: [{ reason: "winback" }],
};

describe("the /account banner", () => {
  it("shows nothing when no banner has anything to say", () => {
    expect(accountBannerOf(none)).toBeNull();
  });

  it("follows the priority: data confirmation, survey, earn checklist, win-back", () => {
    expect(ACCOUNT_BANNER_PRIORITY).toEqual(["data_confirmation", "survey", "earn", "winback"]);
    expect(accountBannerOf(all)).toBe("data_confirmation");
    expect(accountBannerOf({ ...all, refresh: null })).toBe("survey");
    expect(accountBannerOf({ ...all, refresh: null, survey: null })).toBe("earn");
    expect(accountBannerOf({ ...none, bonusLots: [{ reason: "winback" }] })).toBe("winback");
  });

  it("applies each banner's own rule before ranking it", () => {
    // The first confirmation is a checklist task, not a banner.
    expect(accountBannerOf({ ...all, refresh: { due: true, lastConfirmedAt: null } })).toBe("survey");
    expect(accountBannerOf({ ...all, refresh: { due: false, lastConfirmedAt: "2026-10-01T10:00:00+07:00" } })).toBe(
      "survey",
    );
    // A survey already seen is not offered again here.
    expect(accountBannerOf({ ...all, refresh: null, survey: { status: "seen" } })).toBe("earn");
    // Nothing left to earn hides the checklist nudge.
    expect(accountBannerOf({ ...none, tasks: { remainingPoints: 0 }, bonusLots: [{ reason: "winback" }] })).toBe(
      "winback",
    );
  });
});
