import { describe, expect, it } from "vitest";

import { isDriverToken, zoneOfToken } from "./token";

const DRIVER = `d${"Q2hlY2tUaGlzSXNBRmFrZVRva2VuMDAw".slice(0, 32)}`;

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

describe("driver handover tokens (D-462)", () => {
  it("are `d` and 32 base64url characters", () => {
    expect(DRIVER).toHaveLength(33);
    expect(isDriverToken(DRIVER)).toBe(true);
    expect(isDriverToken(`d${"-_aZ09".repeat(5)}xy`)).toBe(true);
  });

  it("belong to no signed-in zone, so they never take the sign-in path", () => {
    expect(zoneOfToken(DRIVER)).toBeNull();
  });

  it("refuses the wrong length, letter or alphabet", () => {
    for (const bad of [
      DRIVER.slice(0, 32),
      `${DRIVER}x`,
      `s${DRIVER.slice(1)}`,
      `D${DRIVER.slice(1)}`,
      `d${"a".repeat(31)}/`,
      `d${"a".repeat(31)}=`,
      "",
    ])
      expect(isDriverToken(bad), bad).toBe(false);
  });
});
