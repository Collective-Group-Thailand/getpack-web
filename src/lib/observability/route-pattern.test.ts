import { describe, expect, it } from "vitest";

import { routePattern } from "./route-pattern";

describe("routePattern", () => {
  it("puts parameter names back where the values were", () => {
    expect(routePattern(["(storefront)", "track", "9f2c4e1a"], { locale: "th", token: "9f2c4e1a" })).toBe(
      "/track/[token]",
    );
    expect(routePattern(["products", "PKO-BTL-0250"], { key: "PKO-BTL-0250" })).toBe("/products/[key]");
  });

  it("matches an encoded segment to its decoded parameter", () => {
    expect(routePattern(["products", "%E0%B8%81"], { key: "ก" })).toBe("/products/[key]");
  });

  it("collapses a catch-all into one name", () => {
    expect(routePattern(["checkout", "delivery", "address"], { step: ["delivery", "address"] })).toBe(
      "/checkout/[...step]",
    );
  });

  it("keeps static segments and the root", () => {
    expect(routePattern([], {})).toBe("/");
    expect(routePattern(["account", "designs"], null)).toBe("/account/designs");
  });
});
