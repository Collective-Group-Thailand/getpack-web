import { describe, expect, it } from "vitest";

import { safeReturnTo, signInReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps a same-site absolute path", () => {
    expect(safeReturnTo("/orders/123")).toBe("/orders/123");
    expect(safeReturnTo("/orders?page=2")).toBe("/orders?page=2");
  });

  it("falls back when there is nothing to return to", () => {
    expect(safeReturnTo(undefined)).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
    expect(safeReturnTo("")).toBe("/");
  });

  it("refuses an absolute URL to another origin", () => {
    expect(safeReturnTo("https://evil.test/steal")).toBe("/");
    expect(safeReturnTo("http://evil.test")).toBe("/");
  });

  it("refuses a protocol-relative URL", () => {
    // `//evil.test` is a URL, not a path: the browser would leave this origin entirely.
    expect(safeReturnTo("//evil.test/steal")).toBe("/");
  });

  it("refuses the backslash form browsers normalise into a protocol-relative URL", () => {
    expect(safeReturnTo("/\\evil.test")).toBe("/");
  });

  it("takes the caller's fallback when one is given", () => {
    expect(safeReturnTo("https://evil.test", "/dashboard")).toBe("/dashboard");
  });
});

describe("signInReturnTo", () => {
  it("keeps an ordinary destination", () => {
    expect(signInReturnTo("/orders/123?tab=items")).toBe("/orders/123?tab=items");
    expect(signInReturnTo("/en/cart")).toBe("/en/cart");
  });

  it("never returns to a sign-in page", () => {
    expect(signInReturnTo("/login")).toBe("/");
    expect(signInReturnTo("/login?returnTo=%2Forders")).toBe("/");
    expect(signInReturnTo("/sign-in")).toBe("/");
    expect(signInReturnTo("/en/sign-in?returnTo=/cart")).toBe("/");
    expect(signInReturnTo("/login-help")).toBe("/login-help");
  });

  it("drops an internal route spelling the proxy would rewrite a second time", () => {
    expect(signInReturnTo("/admin/orders")).toBe("/");
    expect(signInReturnTo("/partner")).toBe("/");
    expect(signInReturnTo("/bff/v1/store/me")).toBe("/");
    expect(signInReturnTo("/administration")).toBe("/administration");
  });

  it("still refuses another origin", () => {
    expect(signInReturnTo("//evil.test")).toBe("/");
  });
});
