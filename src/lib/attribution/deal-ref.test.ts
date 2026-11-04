import { describe, expect, it } from "vitest";

import { cleanDealRef, DEAL_REF_COOKIE, DEAL_REF_MAX_AGE, dealRefCookie } from "./deal-ref";

describe("deal share-link attribution (?ref=)", () => {
  it("keeps an agent code, upper-cased, and refuses anything else", () => {
    expect(cleanDealRef(" agt12345 ")).toBe("AGT12345");
    expect(cleanDealRef("AB1")).toBeNull();
    expect(cleanDealRef("AGT-12345")).toBeNull();
    expect(cleanDealRef("<script>")).toBeNull();
    expect(cleanDealRef(null)).toBeNull();
  });

  it("is a first-party, httpOnly, 30-day cookie", () => {
    expect(dealRefCookie("AGT12345", true)).toEqual({
      name: DEAL_REF_COOKIE,
      value: "AGT12345",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    });
    expect(DEAL_REF_MAX_AGE).toBe(2_592_000);
  });
});
