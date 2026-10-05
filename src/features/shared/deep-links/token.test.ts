import { describe, expect, it } from "vitest";

import { zoneOfToken } from "./token";

describe("deep-link tokens (D-299)", () => {
  it("reads the zone from the first letter", () => {
    expect(zoneOfToken("sAbCdEfGh123")).toBe("customer");
    expect(zoneOfToken("aAbCdEfGh123")).toBe("admin");
    expect(zoneOfToken("pAbCdEfGh123")).toBe("partner");
  });

  it("refuses anything that is not a token", () => {
    for (const bad of ["", "x123456789", "s123", "s../../etc/passwd", "s%2F%2Fevil.test", "s<script>xx"])
      expect(zoneOfToken(bad), bad).toBeNull();
  });
});
