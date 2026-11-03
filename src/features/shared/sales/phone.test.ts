import { describe, expect, it } from "vitest";

import { displayPhone, toE164, toLocalPhone, toMoneyInput } from "./phone";

describe("lead phone and amount input", () => {
  it("turns what an agent types into E.164", () => {
    expect(toE164("0812345678")).toBe("+66812345678");
    expect(toE164("081-234-5678")).toBe("+66812345678");
    expect(toE164("+66812345678")).toBe("+66812345678");
    expect(toE164("021234567")).toBe("+6621234567");
    expect(toE164("12345")).toBeNull();
  });

  it("reads E.164 back as a Thai number", () => {
    expect(toLocalPhone("+66812345678")).toBe("0812345678");
    expect(displayPhone("+66812345678")).toBe("081-234-5678");
    expect(displayPhone("+6621234567")).toBe("02-123-4567");
  });

  it("passes a typed amount through as a decimal string without doing arithmetic", () => {
    expect(toMoneyInput("86,000")).toBe("86000");
    expect(toMoneyInput("1500.50")).toBe("1500.50");
    expect(toMoneyInput("abc")).toBeNull();
    expect(toMoneyInput("1.234")).toBeNull();
    expect(toMoneyInput("")).toBeNull();
  });
});
