import { describe, expect, it } from "vitest";

import { ACCOUNT_SECTIONS, COMPANY_SECTION, sectionOf, tabOf } from "./sections";

describe("account sections (C6 Phase 1)", () => {
  it("has nine sections in the decided order", () => {
    expect(ACCOUNT_SECTIONS.map((section) => section.key)).toEqual([
      "overview",
      "orders",
      "quotes",
      "designs",
      "reorder",
      "documents",
      "messages",
      "rewards",
      "profile",
    ]);
  });

  it("keeps every old address as a tab of its section", () => {
    const cases: [string, string, string | null][] = [
      ["/account", "overview", null],
      ["/account/orders/abc", "orders", null],
      ["/account/instalments", "orders", null],
      ["/account/rfqs/1", "quotes", "rfqs"],
      ["/account/rfq-baskets/2", "quotes", "rfqs"],
      ["/account/samples", "designs", "samples"],
      ["/account/structural-requests/new", "designs", "structuralRequests"],
      ["/account/call-offs", "reorder", "callOffs"],
      ["/en/account/wallet", "rewards", "wallet"],
      ["/account/agent/leads", "rewards", "agent"],
      ["/account/privacy", "profile", "privacy"],
    ];
    for (const [path, key, tab] of cases) {
      const section = sectionOf(path);
      expect(section?.key, path).toBe(key);
      expect(tabOf(section!, path.replace(/^\/en/, ""))?.key ?? null, path).toBe(tab);
    }
    expect(sectionOf("/business/members", [...ACCOUNT_SECTIONS, COMPANY_SECTION])?.key).toBe("company");
    expect(sectionOf("/products")).toBeNull();
  });
});
