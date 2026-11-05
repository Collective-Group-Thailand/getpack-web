import { describe, expect, it } from "vitest";

import {
  cofundingTotalOf,
  fundingOf,
  isClaimedByCompany,
  publicConfigSurfacesOf,
  SURFACES_CLOSED,
  surfacesOf,
} from "./read";

describe("loyalty P4 readers of published fields", () => {
  it("reads seven flags, anything missing as closed, and drops capacityDeals", () => {
    expect(surfacesOf({ deals: true, redeem: "yes", capacityDeals: true })).toEqual({
      ...SURFACES_CLOSED,
      deals: true,
    });
    expect(surfacesOf(null)).toEqual(SURFACES_CLOSED);
    expect(Object.keys(surfacesOf({}))).not.toContain("capacityDeals");
  });

  it("reads the anonymous view from publicConfig, closed when the field is not there yet", () => {
    expect(publicConfigSurfacesOf({ claimWindowDays: 7 })).toEqual(SURFACES_CLOSED);
    expect(publicConfigSurfacesOf({ loyaltySurfaces: { ...SURFACES_CLOSED, checklist: true } }).checklist).toBe(true);
  });

  it("knows the claimed task status, a capacity deal's funding and a statement's co-funding total", () => {
    expect(isClaimedByCompany({ status: "claimed_by_company" })).toBe(true);
    expect(isClaimedByCompany({ status: "done" })).toBe(false);
    expect(
      fundingOf({ funding: { defaultFunder: "getpack", offers: [], acceptedCount: 0, factoryShareToDate: "0.00" } }),
    ).not.toBeNull();
    expect(fundingOf({ weekStart: "2026-11-09" })).toBeNull();
    expect(cofundingTotalOf({ cofunding: "-480.00" })).toBe("-480.00");
    expect(cofundingTotalOf({ cofunding: "0.00" })).toBeNull();
    expect(cofundingTotalOf({ production: "1.00" })).toBeNull();
  });
});
