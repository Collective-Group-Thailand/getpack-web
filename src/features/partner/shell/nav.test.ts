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
      "sales",
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
      "alerts",
      "jobs",
      "floor",
      "kiosk",
      "salesOrders",
      "stock",
      "purchasing",
      "planning",
      "schedule",
      "maintenance",
      "machines",
      "capacity",
      "hours",
      "documents",
      "requests",
      "knowledge",
      "settings",
    ]);
    expect(items("factory_accountant")).toEqual([
      "today",
      "alerts",
      "quotations",
      "salesOrders",
      "stock",
      "purchasing",
      "tradingPartners",
      "invoices",
      "receivables",
      "tax",
      "payables",
      "billing",
      "payouts",
      "prices",
      "shippingRates",
      "documents",
      "requests",
      "knowledge",
      "settings",
    ]);
  });

  it("gives the store and the buying desk their stock, orders and suppliers (D-319)", () => {
    expect(items("factory_storekeeper")).toEqual([
      "alerts",
      "salesOrders",
      "deliveries",
      "stock",
      "purchasing",
      "tradingPartners",
      "planning",
      "documents",
      "requests",
      "knowledge",
      "settings",
    ]);
    expect(items("factory_purchaser")).toEqual([
      "alerts",
      "stock",
      "purchasing",
      "rfqs",
      "tradingPartners",
      "payables",
      "documents",
      "requests",
      "knowledge",
      "settings",
    ]);
    expect(
      partnerBottomItems("active", ["factory_storekeeper"], grants("factory_storekeeper")).map((i) => i.key),
    ).toEqual(["stock", "deliveries", "purchasing", "tradingPartners"]);
  });

  it("gives the sales desk its customers and deals through to delivery and what they owe (D-371)", () => {
    expect(items("factory_sales")).toEqual([
      "alerts",
      "crm",
      "quotations",
      "salesOrders",
      "deliveries",
      "stock",
      "tradingPartners",
      "invoices",
      "receivables",
      "documents",
      "requests",
      "knowledge",
      "settings",
    ]);
    expect(partnerBottomItems("active", ["factory_sales"], grants("factory_sales")).map((i) => i.key)).toEqual([
      "crm",
      "quotations",
      "stock",
      "deliveries",
    ]);
  });

  it("gives the operator the floor and the machine kiosk, the maintenance crew its orders and machines (D-353, D-357)", () => {
    expect(items("factory_operator")).toEqual([
      "today",
      "alerts",
      "jobs",
      "floor",
      "kiosk",
      "planning",
      "maintenance",
      "documents",
      "requests",
      "knowledge",
      "settings",
    ]);
    expect(partnerBottomItems("active", ["factory_operator"], grants("factory_operator")).map((i) => i.key)).toEqual([
      "today",
      "jobs",
      "floor",
    ]);
    expect(items("factory_maintenance")).toEqual([
      "alerts",
      "stock",
      "maintenance",
      "machines",
      "documents",
      "requests",
      "knowledge",
      "settings",
    ]);
    expect(
      partnerBottomItems("active", ["factory_maintenance"], grants("factory_maintenance")).map((i) => i.key),
    ).toEqual(["maintenance", "stock", "alerts"]);
    // Every item a role sees is one its permissions open (no menu that ends in a 403).
    for (const role of Object.keys(FACTORY_ROLE_GRANTS) as (keyof typeof FACTORY_ROLE_GRANTS)[])
      for (const key of items(role)) expect(sidebarItems("active", ["unknown_role"], grants(role))).toContain(key);
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
