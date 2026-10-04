import { describe, expect, it } from "vitest";

import { codeOfSlug, compareHref, slugify, styleHref, styleSlug } from "./paths";

describe("style paths", () => {
  it("put the code first and the name after it, in any script", () => {
    expect(styleHref("PK-TE-01", "Tuck-end carton (configurable ends)")).toBe(
      "/styles/pk-te-01-tuck-end-carton-configurable-ends",
    );
    expect(styleSlug("PK-TE-01", "กล่องฝาเสียบ (ปรับฝาบน-ล่างได้)")).toBe("pk-te-01-กล่องฝาเสียบ-ปรับฝาบน-ล่างได้");
    expect(decodeURIComponent(styleHref("PK-TE-01", "กล่องฝาเสียบ"))).toBe("/styles/pk-te-01-กล่องฝาเสียบ");
    expect(styleHref("PK-TE-01", "กล่องฝาเสียบ")).toMatch(/^[\x21-\x7e]+$/);
  });

  it("read the code back from a slug, encoded or not, with or without a name", () => {
    expect(codeOfSlug("pk-te-01-tuck-end-carton")).toBe("PK-TE-01");
    expect(codeOfSlug(encodeURIComponent("pk-cf-01-กล่องไปรษณีย์"))).toBe("PK-CF-01");
    expect(codeOfSlug("pk-cs-06")).toBe("PK-CS-06");
    expect(codeOfSlug("tuck-end")).toBeNull();
  });

  it("keep a slug short and tidy", () => {
    expect(slugify("  A -- B  ")).toBe("a-b");
    expect(slugify("x".repeat(80))).toHaveLength(60);
  });

  it("link a comparison of up to three codes", () => {
    expect(compareHref(["PK-TE-01", "PK-CF-01"])).toBe("/styles/compare?codes=PK-TE-01,PK-CF-01");
    expect(compareHref([])).toBe("/styles/compare");
  });
});
