import { describe, expect, it } from "vitest";

import { bangkokDay, daysUntil, fromLocalInput, isDueToday, quickFollowUp, toLocalInput } from "./dates";

// 2026-11-03 23:30 Bangkok = 16:30 UTC: the Bangkok day is already the 3rd, a UTC-only sum would get "tomorrow" wrong.
const NOW = Date.parse("2026-11-03T16:30:00Z");

describe("pipeline dates (Asia/Bangkok)", () => {
  it("reads the Bangkok calendar day, not the UTC one", () => {
    expect(bangkokDay(NOW)).toBe("2026-11-03");
    expect(bangkokDay(Date.parse("2026-11-03T17:00:00Z"))).toBe("2026-11-04");
  });

  it("offers tomorrow 10:00, in 3 days and in a week at 10:00 Bangkok", () => {
    expect(quickFollowUp("tomorrow", NOW)).toBe("2026-11-04T10:00:00+07:00");
    expect(quickFollowUp("threeDays", NOW)).toBe("2026-11-06T10:00:00+07:00");
    expect(quickFollowUp("week", NOW)).toBe("2026-11-10T10:00:00+07:00");
  });

  it("counts protection days by the Bangkok calendar", () => {
    expect(daysUntil("2026-11-03T09:00:00+07:00", NOW)).toBe(0);
    expect(daysUntil("2026-11-04T00:30:00+07:00", NOW)).toBe(1);
    expect(daysUntil("2026-11-01T10:00:00+07:00", NOW)).toBe(-2);
  });

  it("round-trips a datetime-local value as Bangkok wall time", () => {
    expect(toLocalInput("2026-11-04T10:00:00+07:00")).toBe("2026-11-04T10:00");
    expect(fromLocalInput("2026-11-04T10:00")).toBe("2026-11-04T10:00:00+07:00");
    expect(fromLocalInput("nonsense")).toBeNull();
  });

  it("treats an overdue follow-up as due today", () => {
    expect(isDueToday("2026-11-01T10:00:00+07:00", NOW)).toBe(true);
    expect(isDueToday("2026-11-03T22:00:00+07:00", NOW)).toBe(true);
    expect(isDueToday("2026-11-04T08:00:00+07:00", NOW)).toBe(false);
    expect(isDueToday(null, NOW)).toBe(false);
  });
});
