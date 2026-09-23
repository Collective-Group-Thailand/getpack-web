import { describe, expect, it } from "vitest";

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
