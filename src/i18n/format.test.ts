import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  formatDimensions,
  formatIsoDate,
  formatMm,
  formatNumber,
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
