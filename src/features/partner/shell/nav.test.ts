import { describe, expect, it } from "vitest";

import { isCurrent, partnerNav } from "./nav";

const keys = (status: string, permissions: string[] = []) =>
  partnerNav(status, (permission) => permissions.includes(permission)).map((item) => item.key);

describe("partnerNav", () => {
  it("gives a factory still onboarding its wizard, and prices only to a role that may read them", () => {
    expect(keys("applied", ["factory_prices.read"])).toEqual(["today", "onboarding", "prices", "more"]);
    expect(keys("under_review")).toEqual(["today", "onboarding", "more"]);
  });

  it("gives a producing factory the shop floor, never more than five destinations", () => {
    const all = ["factory_jobs.read", "factory_shipments.read", "factory_billing.read"];
    for (const status of ["trial", "active", "suspended"]) {
      const items = keys(status, all);
      expect(items).toEqual(["today", "jobs", "ship", "billing", "more"]);
      expect(items.length).toBeLessThanOrEqual(5);
    }
  });

  it("leaves out what the role cannot open", () => {
    expect(keys("active", ["factory_jobs.read"])).toEqual(["today", "jobs", "more"]);
    expect(keys("active", [])).toEqual(["today", "more"]);
  });

  it("marks the home item current only on the home page", () => {
    expect(isCurrent("/", "/")).toBe(true);
    expect(isCurrent("/", "/jobs")).toBe(false);
    expect(isCurrent("/prices", "/prices/shipping")).toBe(true);
    expect(isCurrent("/prices", "/pricesx")).toBe(false);
  });
});
