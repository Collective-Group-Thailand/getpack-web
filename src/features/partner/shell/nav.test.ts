import { describe, expect, it } from "vitest";

import { FACTORY_ROLE_GRANTS } from "../../../../mocks/generated/rbac";
import { isCurrent } from "./nav";
import { partnerBottomItems, partnerSidebar, sidebarItems } from "./sidebar";

const grants = (role: keyof typeof FACTORY_ROLE_GRANTS) => (permission: string) =>
  (FACTORY_ROLE_GRANTS[role] as readonly string[]).includes(permission);
const items = (role: keyof typeof FACTORY_ROLE_GRANTS, status = "active") => sidebarItems(status, [role], grants(role));

describe("partner sidebar by role (round 2, Phase 1)", () => {
  it("gives the owner every group", () => {
    expect(partnerSidebar("active", ["factory_owner"], grants("factory_owner")).map((g) => g.key)).toEqual([
      "daily",
      "supply",
      "plan",
      "finance",
      "factory",
    ]);
  });

  it("gives QC its queue, samples and claims — not the operator's floor or the money", () => {
    expect(items("factory_qc")).toEqual(["qc", "samples", "claims", "requests", "knowledge", "settings"]);
  });

  it("gives shipping its trips, the planner its capacity, the accountant the money", () => {
    expect(items("factory_shipping")).toEqual(["ship", "requests", "knowledge", "settings"]);
    expect(items("factory_planner")).toEqual([
      "today",
      "jobs",
      "stock",
      "purchasing",
      "capacity",
      "hours",
      "requests",
      "knowledge",
      "settings",
    ]);
    expect(items("factory_accountant")).toEqual([
      "today",
      "stock",
      "purchasing",
      "tradingPartners",
      "billing",
      "payouts",
      "prices",
      "shippingRates",
      "requests",
      "knowledge",
      "settings",
    ]);
  });

  it("gives the store and the buying desk their stock, orders and suppliers (D-319)", () => {
    expect(items("factory_storekeeper")).toEqual([
      "stock",
      "purchasing",
      "tradingPartners",
      "requests",
      "knowledge",
      "settings",
    ]);
    expect(items("factory_purchaser")).toEqual([
      "stock",
      "purchasing",
      "tradingPartners",
      "requests",
      "knowledge",
      "settings",
    ]);
    expect(
      partnerBottomItems("active", ["factory_storekeeper"], grants("factory_storekeeper")).map((i) => i.key),
    ).toEqual(["stock", "purchasing", "tradingPartners"]);
  });

  it("keeps a factory being onboarded to its wizard, prices and guides", () => {
    expect(items("factory_owner", "applied")).toEqual([
      "today",
      "onboarding",
      "prices",
      "requests",
      "knowledge",
      "settings",
    ]);
  });

  it("puts at most four of the role's daily destinations on the phone's bar", () => {
    expect(partnerBottomItems("active", ["factory_qc"], grants("factory_qc")).map((i) => i.key)).toEqual([
      "qc",
      "samples",
      "claims",
    ]);
    expect(partnerBottomItems("active", ["factory_owner"], grants("factory_owner"))).toHaveLength(4);
  });

  it("marks the home item current only on the home page", () => {
    expect(isCurrent("/", "/")).toBe(true);
    expect(isCurrent("/", "/jobs")).toBe(false);
    expect(isCurrent("/prices", "/prices/shipping")).toBe(true);
    expect(isCurrent("/prices", "/pricesx")).toBe(false);
  });
});
