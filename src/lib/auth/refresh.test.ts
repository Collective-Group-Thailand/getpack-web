import { describe, expect, it } from "vitest";

import { isExpiringSoon, parseExpiry, sessionCookieName, sessionCookieOptions } from "./cookies";
import { refreshDecision } from "./refresh";

const now = new Date("2026-09-23T10:00:00+07:00");
const seconds = (n: number) => new Date(now.getTime() + n * 1000);

describe("refreshDecision", () => {
  it("does nothing without a refresh token — an anonymous visitor is not a failure", () => {
    expect(refreshDecision({ hasAccessToken: false, accessExpiresAt: null, hasRefreshToken: false, now })).toBe("none");
  });

  it("refreshes when the access token is gone but the session is not", () => {
    expect(refreshDecision({ hasAccessToken: false, accessExpiresAt: null, hasRefreshToken: true, now })).toBe(
      "refresh",
    );
  });

  it("refreshes inside the skew window rather than mid-render", () => {
    // Server Components cannot set cookies, so a token that expires between the proxy and
    // the last fetch of a page leaves it half signed in.
    expect(refreshDecision({ hasAccessToken: true, accessExpiresAt: seconds(30), hasRefreshToken: true, now })).toBe(
      "refresh",
    );
    expect(refreshDecision({ hasAccessToken: true, accessExpiresAt: seconds(300), hasRefreshToken: true, now })).toBe(
      "none",
    );
  });

  it("refreshes when the expiry was never recorded", () => {
    expect(refreshDecision({ hasAccessToken: true, accessExpiresAt: null, hasRefreshToken: true, now })).toBe(
      "refresh",
    );
  });
});

describe("session cookies", () => {
  it("is httpOnly, lax and path-scoped, with no domain so it stays host-only", () => {
    const options = sessionCookieOptions(true);

    expect(options).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(options).not.toHaveProperty("domain");
  });

  it("drops the __Host- prefix only where it cannot work, on plain http", () => {
    expect(sessionCookieName("__Host-pk_at", true)).toBe("__Host-pk_at");
    expect(sessionCookieName("__Host-pk_at", false)).toBe("pk_at");
  });

  it("reads the recorded expiry and ignores a damaged one", () => {
    expect(parseExpiry("1790000000")).toEqual(new Date(1790000000 * 1000));
    expect(parseExpiry(undefined)).toBeNull();
    expect(parseExpiry("")).toBeNull();
    expect(parseExpiry("soon")).toBeNull();
    expect(parseExpiry("-1")).toBeNull();
  });

  it("treats a missing expiry as expired rather than as valid", () => {
    expect(isExpiringSoon(null, now)).toBe(true);
    expect(isExpiringSoon(seconds(-1), now)).toBe(true);
  });
});
