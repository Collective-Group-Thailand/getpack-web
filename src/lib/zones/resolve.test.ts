import { describe, expect, it } from "vitest";

import { BROWSER_BFF_PATH, browserBffUrl, isUpstreamPathAllowed, upstreamPrefixes, ZONES } from "./zones";
import { isInternalOnlyPath, normaliseHost, resolveZone, type ZoneHosts } from "./resolve";

const hosts: ZoneHosts = {
  customer: "packio.co.th",
  admin: "admin.packio.co.th",
  partner: "partner.packio.co.th",
};

const localHosts: ZoneHosts = {
  customer: "localhost:3000",
  admin: "admin.localhost:3000",
  partner: "partner.localhost:3000",
};

describe("normaliseHost", () => {
  it.each([
    ["Packio.CO.th", "packio.co.th"],
    ["packio.co.th:443", "packio.co.th"],
    // RFC 1034 root dot: the same name, and a classic way past an allow-list.
    ["packio.co.th.", "packio.co.th"],
    ["  admin.localhost:3000  ", "admin.localhost"],
    ["[::1]:3000", "::1"],
    ["[::1]", "::1"],
  ])("normalises %s to %s", (input, expected) => {
    expect(normaliseHost(input)).toBe(expected);
  });

  it.each([null, undefined, "", "   "])("rejects %s", (input) => {
    expect(normaliseHost(input)).toBeNull();
  });
});

describe("resolveZone", () => {
  it.each([
    ["packio.co.th", "customer"],
    ["admin.packio.co.th", "admin"],
    ["partner.packio.co.th", "partner"],
  ] as const)("maps %s to the %s zone", (host, zone) => {
    expect(resolveZone(host, hosts)).toBe(zone);
  });

  it("ignores the port, so one set of hosts serves dev, Playwright and Lighthouse", () => {
    expect(resolveZone("admin.localhost:3100", localHosts)).toBe("admin");
    expect(resolveZone("admin.localhost:3200", localHosts)).toBe("admin");
    expect(resolveZone("localhost", localHosts)).toBe("customer");
  });

  it("does not fall back to a zone for an unknown or missing host", () => {
    expect(resolveZone("evil.example.com", hosts)).toBeNull();
    expect(resolveZone(null, hosts)).toBeNull();
    expect(resolveZone("", hosts)).toBeNull();
  });

  it("does not let a trailing dot or a stray port smuggle a host past the check", () => {
    expect(resolveZone("admin.packio.co.th.", hosts)).toBe("admin");
    expect(resolveZone("admin.packio.co.th.evil.com", hosts)).toBeNull();
    expect(resolveZone("evil.com:80", hosts)).toBeNull();
  });

  it("serves only the zones this deployment is configured for", () => {
    expect(resolveZone("admin.packio.co.th", hosts, ["customer"])).toBeNull();
    expect(resolveZone("packio.co.th", hosts, ["customer"])).toBe("customer");
  });

  it("is case-insensitive", () => {
    expect(resolveZone("ADMIN.Packio.CO.TH", hosts)).toBe("admin");
  });
});

describe("isInternalOnlyPath", () => {
  it.each(["/admin", "/admin/", "/admin/orders", "/partner", "/partner/jobs/1"])("refuses %s", (pathname) => {
    expect(isInternalOnlyPath(pathname)).toBe(true);
  });

  it.each(["/", "/design/new", "/bff/orders", "/administration", "/partners", "/en/admin-guide"])(
    "allows %s",
    (pathname) => {
      expect(isInternalOnlyPath(pathname)).toBe(false);
    },
  );
});

describe("upstream surface allow-list", () => {
  it("gives each zone its own API surface", () => {
    expect(upstreamPrefixes("admin")).toEqual(["/v1/admin"]);
    expect(upstreamPrefixes("partner")).toEqual(["/v1/partner"]);
  });

  it("lets the customer zone reach its own sign-in endpoints as well (ADR-0005)", () => {
    expect(upstreamPrefixes("customer")).toEqual(["/v1/store", "/v1/auth/customer"]);
    expect(isUpstreamPathAllowed("customer", "/v1/auth/customer/otp/request")).toBe(true);
  });

  it("refuses another zone's surface", () => {
    expect(isUpstreamPathAllowed("customer", "/v1/admin/orders")).toBe(false);
    expect(isUpstreamPathAllowed("admin", "/v1/store/orders")).toBe(false);
    expect(isUpstreamPathAllowed("partner", "/v1/admin/me")).toBe(false);
  });

  it("refuses staff and partner sign-in through a zone BFF: those are Server Actions", () => {
    expect(isUpstreamPathAllowed("admin", "/v1/auth/staff/login")).toBe(false);
    expect(isUpstreamPathAllowed("partner", "/v1/auth/partner/login")).toBe(false);
    expect(isUpstreamPathAllowed("customer", "/v1/auth/staff/login")).toBe(false);
  });

  it("matches only at a segment boundary, so a longer name cannot borrow a prefix", () => {
    expect(isUpstreamPathAllowed("customer", "/v1/storefront/orders")).toBe(false);
    expect(isUpstreamPathAllowed("customer", "/v1/store")).toBe(true);
    expect(isUpstreamPathAllowed("customer", "/v1/store/orders")).toBe(true);
  });

  it("refuses traversal, which could otherwise climb out of the allowed surface", () => {
    expect(isUpstreamPathAllowed("customer", "/v1/store/../admin/orders")).toBe(false);
    expect(isUpstreamPathAllowed("admin", "/v1/admin/../../v1/store/me")).toBe(false);
  });
});

describe("browserBffUrl", () => {
  it("always addresses /bff, whatever the zone", () => {
    // The trap this exists for: `ZONE_CONFIG.admin.bffPath` is `/admin/bff`, which is the
    // *internal* segment after the proxy has rewritten the request. A browser that asked for
    // it directly would be refused by `isInternalOnlyPath` before any handler ran.
    expect(browserBffUrl("customer", "/notifications")).toBe("/bff/v1/store/notifications");
    expect(browserBffUrl("admin", "/notifications")).toBe("/bff/v1/admin/notifications");
    expect(browserBffUrl("partner", "/notifications")).toBe("/bff/v1/partner/notifications");
  });

  it("produces a path the BFF allow-list accepts for that zone", () => {
    // The other half: the upstream path has to start with the zone's own prefix, or the
    // handler answers 404 and the feature silently does nothing.
    for (const zone of ZONES) {
      const url = browserBffUrl(zone, "/rum/web-vitals");
      const upstream = url.slice(BROWSER_BFF_PATH.length);
      expect(isUpstreamPathAllowed(zone, upstream), `${zone}: ${upstream}`).toBe(true);
    }
  });

  it("never lets one zone address another's surface", () => {
    const adminUpstream = browserBffUrl("admin", "/notifications").slice(BROWSER_BFF_PATH.length);
    expect(isUpstreamPathAllowed("customer", adminUpstream)).toBe(false);
    expect(isUpstreamPathAllowed("partner", adminUpstream)).toBe(false);
  });
});
