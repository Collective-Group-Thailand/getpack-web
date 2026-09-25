import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  formatDimensions,
  formatIsoDate,
  formatMm,
  formatNumber,
  formatBytes,
  formatDuration,
  formatPercent,
  formatRelativeTime,
  formatTHB,
} from "./format";

describe("formatTHB", () => {
  it("renders the API's decimal string without doing arithmetic on it", () => {
    expect(formatTHB("1234.56")).toBe("฿1,234.56");
    expect(formatTHB("0.00")).toBe("฿0.00");
    expect(formatTHB("12500")).toBe("฿12,500.00");
  });

  it("keeps precision that binary floating point would lose", () => {
    // 0.1 + 0.2 !== 0.3 in a double; the string carries the exact value the API sent.
    expect(formatTHB("1000000000000.07")).toBe("฿1,000,000,000,000.07");
    expect(formatTHB("70.10")).toBe("฿70.10");
  });

  it("handles negatives, for credit notes and refunds", () => {
    expect(formatTHB("-500.50")).toBe("฿-500.50");
  });

  it("never prints NaN in front of a customer", () => {
    expect(formatTHB("")).toBe("฿—");
    expect(formatTHB("abc")).toBe("฿—");
  });

  it("can drop the symbol and the decimals, for table columns", () => {
    expect(formatTHB("1234.56", "th", { withSymbol: false })).toBe("1,234.56");
    expect(formatTHB("1234.56", "th", { decimals: 0 })).toBe("฿1,234");
  });
});

describe("formatDate", () => {
  // 2026-09-17T18:00:00Z is 2026-09-18 01:00 in Bangkok: the day differs from UTC.
  const lateEvening = "2026-09-17T18:00:00Z";

  it("renders Thai dates in the Buddhist era by default", () => {
    expect(formatDate("2026-09-17T04:00:00Z", "th")).toContain("2569");
  });

  it("renders English dates in the Common Era by default", () => {
    expect(formatDate("2026-09-17T04:00:00Z", "en")).toContain("2026");
  });

  it("lets a call site ask for CE even in Thai, for exports and accounting", () => {
    expect(formatDate("2026-09-17T04:00:00Z", "th", { era: "ce" })).toContain("2026");
  });

  it("uses Bangkok time, not the runtime's time zone", () => {
    // UTC+7 pushes this to the 18th.
    expect(formatDate(lateEvening, "en", { style: "numeric" })).toContain("18");
  });

  it("returns a dash for a missing or unparseable date", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("shows 24-hour Bangkok time", () => {
    expect(formatDateTime("2026-09-17T04:30:00Z", "en", { era: "ce" })).toContain("11:30");
  });
});

describe("formatIsoDate", () => {
  it("gives YYYY-MM-DD in Bangkok time for exports", () => {
    expect(formatIsoDate("2026-09-17T18:00:00Z")).toBe("2026-09-18");
    expect(formatIsoDate("bad")).toBe("");
  });
});

describe("dimensions and units", () => {
  it("formats a dieline's dimensions as one value", () => {
    expect(formatDimensions({ length: 150, width: 100, height: 80 })).toBe("150×100×80");
    expect(formatDimensions({ length: 150, width: 100, height: 80 }, "th", { withUnit: true })).toBe("150×100×80 มม.");
  });

  it("formats millimetres per locale", () => {
    expect(formatMm(525, "th")).toBe("525 มม.");
    expect(formatMm(525, "en")).toBe("525 mm");
  });

  it("groups thousands", () => {
    expect(formatNumber(12500, "en")).toBe("12,500");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-09-25T10:00:00+07:00");

  it("says how long ago, coarsely, in both languages", () => {
    expect(formatRelativeTime("2026-09-25T09:55:00+07:00", "en", now)).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-09-25T07:00:00+07:00", "en", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2026-09-25T09:59:50+07:00", "en", now)).toBe("now");
    expect(formatRelativeTime("2026-09-25T12:00:00+07:00", "th", now)).toContain("2");
  });

  it("does not invent a time for a malformed input", () => {
    expect(formatRelativeTime("not a date", "th", now)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("renders the largest two units", () => {
    expect(formatDuration((2 * 60 + 15) * 60 * 1000, "en")).toBe("2 hrs 15 mins");
    expect(formatDuration(26 * 60 * 60 * 1000, "en")).toBe("1 day 2 hrs");
    expect(formatDuration(30_000, "en")).toBe("0 mins");
  });

  it("is a distance, so the sign does not matter", () => {
    expect(formatDuration(-45 * 60_000, "en")).toBe("45 mins");
  });
});

describe("formatPercent", () => {
  it("trims the API's decimal string without doing arithmetic on it", () => {
    expect(formatPercent("12.5000", "en")).toBe("12.5%");
    expect(formatPercent("5", "en")).toBe("5%");
    expect(formatPercent("-3.1400", "en")).toBe("-3.14%");
    expect(formatPercent("0.3333", "en", 1)).toBe("0.3%");
  });

  it("refuses a malformed value rather than printing NaN", () => {
    expect(formatPercent("abc", "en")).toBe("—");
  });
});

describe("formatBytes", () => {
  it("picks a readable unit", () => {
    expect(formatBytes(512, "en")).toBe("512 byte");
    expect(formatBytes(1536, "en")).toBe("1.5 kB");
    expect(formatBytes(5 * 1024 * 1024, "en")).toBe("5 MB");
  });
});
