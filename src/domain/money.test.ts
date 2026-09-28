import { describe, expect, it } from "vitest";

import { isNegativeMoney, isZeroMoney, moneyText } from "./money";

describe("moneyText", () => {
  it("pads to two decimals by text", () => {
    expect(moneyText("45")).toBe("45.00");
    expect(moneyText("45.5")).toBe("45.50");
    expect(moneyText(" 1,234.05 ")).toBe("1234.05");
    expect(moneyText("007.1")).toBe("7.10");
  });

  it("refuses what is not an amount", () => {
    for (const value of ["", "abc", "1.234", "-5", "1e3", "12."]) expect(moneyText(value), value).toBeNull();
  });
});

describe("reading the API's money strings", () => {
  it("tells zero and negative apart without parsing", () => {
    expect(isZeroMoney("0.00")).toBe(true);
    expect(isZeroMoney("-0.00")).toBe(true);
    expect(isZeroMoney("0.01")).toBe(false);
    expect(isNegativeMoney("-12.50")).toBe(true);
    expect(isNegativeMoney("-0.00")).toBe(false);
    expect(isNegativeMoney("12.50")).toBe(false);
  });
});
