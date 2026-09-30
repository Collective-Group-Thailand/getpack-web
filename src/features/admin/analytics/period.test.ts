import { describe, expect, it } from "vitest";

import { addDays, bangkokToday, periodOf, previousPeriod } from "./period";

describe("the dashboard period", () => {
  // 2026-09-30 23:30 UTC is already 1 October in Bangkok.
  const lateUtc = new Date("2026-09-30T23:30:00Z");

  it("reads today in Asia/Bangkok, not in UTC", () => {
    expect(bangkokToday(lateUtc)).toBe("2026-10-01");
  });

  it("adds calendar days across months and years", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("ends a preset yesterday and counts the days inclusively", () => {
    expect(periodOf("7d", {}, lateUtc)).toEqual({ from: "2026-09-24", to: "2026-09-30" });
    expect(periodOf("30d", {}, lateUtc)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("waits for both custom dates, in order", () => {
    expect(periodOf("custom", { from: "2026-09-01" }, lateUtc)).toBeNull();
    expect(periodOf("custom", { from: "2026-09-10", to: "2026-09-01" }, lateUtc)).toBeNull();
    expect(periodOf("custom", { from: "2026-09-01", to: "2026-09-10" }, lateUtc)).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
    });
  });

  it("compares with the period of equal length just before", () => {
    expect(previousPeriod({ from: "2026-09-01", to: "2026-09-30" })).toEqual({ from: "2026-08-02", to: "2026-08-31" });
    expect(previousPeriod({ from: "2026-09-30", to: "2026-09-30" })).toEqual({ from: "2026-09-29", to: "2026-09-29" });
  });
});
