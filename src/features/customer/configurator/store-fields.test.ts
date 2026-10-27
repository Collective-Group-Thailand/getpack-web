import { describe, expect, it } from "vitest";

import { bindFormat } from "@/features/shared/format/bind";

import { arrivalRangeText, vatPercentOf } from "./store-fields";

describe("C4 store fields", () => {
  it("shows the VAT rate fraction as a percent without float arithmetic", () => {
    expect(vatPercentOf("0.07")).toBe("7");
    expect(vatPercentOf("0.075")).toBe("7.5");
    expect(vatPercentOf("0.1")).toBe("10");
    expect(vatPercentOf("1")).toBe("100");
    expect(vatPercentOf(null)).toBeNull();
    expect(vatPercentOf("abc")).toBeNull();
  });

  it("formats the arrival window compactly, one date when both ends match", () => {
    const th = bindFormat("th");
    expect(arrivalRangeText(th, { from: "2026-10-12", to: "2026-10-14" })).toEqual({
      single: false,
      from: "12",
      to: th.date("2026-10-14", { style: "dayMonth" }),
    });
    expect(arrivalRangeText(th, { from: "2026-10-30", to: "2026-11-02" })).toEqual({
      single: false,
      from: th.date("2026-10-30", { style: "dayMonth" }),
      to: th.date("2026-11-02", { style: "dayMonth" }),
    });
    expect(arrivalRangeText(th, { from: "2026-10-12", to: "2026-10-12" })).toEqual({
      single: true,
      date: th.date("2026-10-12", { style: "dayMonth" }),
    });
  });
});
