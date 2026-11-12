import { describe, expect, it } from "vitest";

import { isCurrent, PROFILE_MENU, RAIL_ITEMS, SIDEBAR_GROUPS, TAB_ITEMS } from "./nav";

describe("getpack Agent navigation (D-467)", () => {
  it("puts exactly four tabs on a phone, in the agreed order, and no 'more'", () => {
    expect(TAB_ITEMS.map((item) => item.key)).toEqual(["home", "leads", "quotes", "commissions"]);
    expect(TAB_ITEMS.map((item) => item.href)).toEqual(["/", "/leads", "/quotes", "/commissions"]);
  });

  it("reaches every page from the sidebar, and the account pages from the profile menu", () => {
    const sidebar = SIDEBAR_GROUPS.flatMap((group) => group.items.map((item) => item.key));
    for (const key of RAIL_ITEMS.map((item) => item.key)) expect(sidebar).toContain(key);
    expect(PROFILE_MENU.map((item) => item.key)).toEqual(["playbook", "profile", "payout", "tax", "notifications"]);
  });

  it("marks the current page, the home tab only at /", () => {
    expect(isCurrent("/", "/")).toBe(true);
    expect(isCurrent("/", "/leads")).toBe(false);
    expect(isCurrent("/statements", "/statements/abc")).toBe(true);
    expect(isCurrent("/statements", "/statementsx")).toBe(false);
  });
});
