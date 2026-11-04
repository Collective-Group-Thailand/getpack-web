import { describe, expect, it } from "vitest";

import { BLOCKED_REWARDS, SAMPLE_REDEMPTIONS, SAMPLE_REWARDS } from "./fixtures";
import {
  balanceAfter,
  blockedReasonOf,
  countByStatus,
  groupRewards,
  isCancellable,
  quarterOf,
  redeemHref,
} from "./model";

describe("the redeem page's rules", () => {
  it("groups cash-off apart from the perks, in the API's order", () => {
    const groups = groupRewards(SAMPLE_REWARDS);
    expect(groups.map((entry) => entry.group)).toEqual(["cash", "perks"]);
    expect(groups[0]!.items.map((item) => item.code)).toEqual(["cash_off_50", "cash_off_100"]);
    expect(groupRewards(SAMPLE_REWARDS.slice(2)).map((entry) => entry.group)).toEqual(["perks"]);
  });

  it("names the reason a signed-in customer cannot redeem, and none for a guest", () => {
    expect(BLOCKED_REWARDS.map(blockedReasonOf)).toEqual(["insufficient_points", "tier", "open_limit", "held"]);
    expect(blockedReasonOf({ ...SAMPLE_REWARDS[0]!, canRedeem: null })).toBeNull();
    // A refusal without a reason reads as held (the conservative words).
    expect(blockedReasonOf({ ...SAMPLE_REWARDS[0]!, canRedeem: false, blockedReason: null })).toBe("held");
  });

  it("previews the balance after a redeem, never below zero", () => {
    expect(balanceAfter(1250, 60)).toBe(1190);
    expect(balanceAfter(40, 60)).toBe(0);
  });

  it("offers a cancel on an unused catalogue coupon before its window closes", () => {
    const [bought, perk, used] = SAMPLE_REDEMPTIONS;
    const inside = Date.parse("2026-11-05T10:00:00+07:00");
    expect(isCancellable(bought!, inside)).toBe(true);
    expect(isCancellable(bought!, Date.parse("2026-11-11T14:05:01+07:00"))).toBe(false);
    expect(isCancellable(perk!, inside)).toBe(false);
    expect(isCancellable(used!, inside)).toBe(false);
  });

  it("counts coupons per tab, reads quarters and builds the deals link", () => {
    expect(countByStatus(SAMPLE_REDEMPTIONS)).toEqual({ issued: 2, used: 1, expired: 0, cancelled: 0 });
    expect(quarterOf("2026-Q4")).toEqual({ year: 2026, quarter: 4 });
    expect(quarterOf("2026-13")).toBeNull();
    expect(redeemHref("free_shipping")).toBe("/account/points/redeem#free_shipping");
  });
});
