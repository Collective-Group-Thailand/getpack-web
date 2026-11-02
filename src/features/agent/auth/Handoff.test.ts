import { describe, expect, it, vi } from "vitest";

vi.mock("./redeem", () => ({ redeemHandoff: vi.fn() }));

const { readFragment } = await import("./Handoff");

describe("hand-off fragment (D-467)", () => {
  it("reads the code and where to go", () => {
    expect(readFragment("#code=hc_abc&to=%2Fleads")).toEqual({ code: "hc_abc", to: "/leads" });
  });

  it("goes home when there is nowhere safe to go", () => {
    expect(readFragment("#code=x&to=https%3A%2F%2Fevil.test")).toEqual({ code: "x", to: "/" });
    expect(readFragment("#code=x&to=%2F%2Fevil.test").to).toBe("/");
    expect(readFragment("").code).toBeNull();
  });
});
