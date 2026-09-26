import { describe, expect, it } from "vitest";

import { browserPath, groupSidebar, isCurrent, menuLabel, sidebarItems } from "./menu";

describe("admin menu entitlements", () => {
  describe("browserPath", () => {
    it.each([
      // The shape the contract's own example uses.
      ["/admin/approvals", "/approvals"],
      ["/admin", "/"],
      // The shape the MSW mock uses — the browser's own spelling, already correct.
      ["/orders", "/orders"],
      ["/", "/"],
      // Defensive: a path the backend sends without its leading slash.
      ["orders", "/orders"],
    ])("turns %s into %s", (path, expected) => {
      expect(browserPath(path)).toBe(expected);
    });

    it("does not eat a path that merely starts with the letters", () => {
      // `/administrators` is not `/admin` + `/istrators`. Slicing on length alone would make
      // it `istrators`, which is a 404 nobody would guess the cause of.
      expect(browserPath("/administrators")).toBe("/administrators");
    });
  });

  describe("isCurrent", () => {
    it("marks the entry whose section is open", () => {
      expect(isCurrent("/orders", "/orders")).toBe(true);
      expect(isCurrent("/orders", "/orders/PK-2569-00042")).toBe(true);
    });

    it("matches at a segment boundary, so only one entry is ever current", () => {
      expect(isCurrent("/order", "/orders")).toBe(false);
      expect(isCurrent("/orders", "/orders-archive")).toBe(false);
    });

    it("treats the dashboard as exact", () => {
      // Every path starts with "/", so a prefix match would light the dashboard up forever.
      expect(isCurrent("/", "/")).toBe(true);
      expect(isCurrent("/", "/orders")).toBe(false);
    });
  });

  describe("sidebarItems", () => {
    it("keeps the API's order and never adds an entry of its own", () => {
      const items = sidebarItems([
        { key: "dashboard", path: "/admin" },
        { key: "approvals", path: "/admin/approvals" },
      ]);

      expect(items.map((item) => [item.key, item.href])).toEqual([
        ["dashboard", "/"],
        ["approvals", "/approvals"],
      ]);
    });

    it("renders a key it has no icon for rather than dropping it", () => {
      // The API said this person may open it. A missing icon is a cosmetic gap; a missing
      // entry is a screen they cannot reach.
      const [item] = sidebarItems([{ key: "some_future_screen", path: "/admin/future" }]);
      expect(item?.href).toBe("/future");
      expect(item?.icon).toBeUndefined();
    });

    it("is empty when the API sends no entitlements", () => {
      expect(sidebarItems([])).toEqual([]);
    });
  });

  describe("menuLabel", () => {
    const translate = (key: string) => (key === "menu.orders" ? "คำสั่งซื้อ" : `admin.${key}`);

    it("uses the translation when there is one", () => {
      expect(menuLabel("orders", translate)).toBe("คำสั่งซื้อ");
    });

    it("falls back to the raw key, visibly", () => {
      // next-intl echoes the full path for a missing key, which would render as
      // "admin.menu.audit_logs" in the sidebar. The key alone is shorter and just as obviously
      // untranslated.
      expect(menuLabel("audit_logs", translate)).toBe("audit_logs");
    });
  });
});

describe("groupSidebar", () => {
  it("groups entries without adding, dropping or reordering them within a group", () => {
    const items = sidebarItems([
      { key: "users", path: "/admin/users" },
      { key: "dashboard", path: "/admin" },
      { key: "orders", path: "/admin/orders" },
      { key: "approvals", path: "/admin/approvals" },
      { key: "some_future_screen", path: "/admin/future" },
    ]);
    const groups = groupSidebar(items);

    expect(groups.map((group) => [group.key, group.items.map((item) => item.key)])).toEqual([
      ["overview", ["dashboard", "approvals"]],
      ["sales", ["orders"]],
      ["system", ["users"]],
      ["other", ["some_future_screen"]],
    ]);
    expect(groups.flatMap((group) => group.items)).toHaveLength(items.length);
  });
});
