import { describe, expect, it } from "vitest";

import { BROWSER_BFF_PATH, browserBffUrl, isUpstreamPathAllowed, upstreamPrefixes, ZONES } from "./zones";
import { isInternalOnlyPath, normaliseHost, resolveZone, type ZoneHosts } from "./resolve";

const hosts: ZoneHosts = {
  customer: "getpack.co",
  admin: "admin.getpack.co",
  partner: "partner.getpack.co",
  agent: "agent.getpack.co",
};

const localHosts: ZoneHosts = {
  customer: "localhost:3000",
  admin: "admin.localhost:3000",
  partner: "partner.localhost:3000",
  agent: "agent.localhost:3000",
};

describe("normaliseHost", () => {
  it.each([
    ["Getpack.CO", "getpack.co"],
    ["getpack.co:443", "getpack.co"],
    // RFC 1034 root dot: the same name, and a classic way past an allow-list.
    ["getpack.co.", "getpack.co"],
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
    ["getpack.co", "customer"],
    ["admin.getpack.co", "admin"],
    ["partner.getpack.co", "partner"],
    ["agent.getpack.co", "agent"],
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
    expect(resolveZone("admin.getpack.co.", hosts)).toBe("admin");
    expect(resolveZone("admin.getpack.co.evil.com", hosts)).toBeNull();
    expect(resolveZone("evil.com:80", hosts)).toBeNull();
  });

  it("serves only the zones this deployment is configured for", () => {
    expect(resolveZone("admin.getpack.co", hosts, ["customer"])).toBeNull();
    expect(resolveZone("getpack.co", hosts, ["customer"])).toBe("customer");
  });

  it("is case-insensitive", () => {
    expect(resolveZone("ADMIN.Getpack.CO", hosts)).toBe("admin");
  });
});

describe("isInternalOnlyPath", () => {
  it.each(["/admin", "/admin/", "/admin/orders", "/partner", "/partner/jobs/1", "/agent-zone", "/agent-zone/leads"])(
    "refuses %s",
    (pathname) => {
      expect(isInternalOnlyPath(pathname)).toBe(true);
    },
  );

  it.each([
    "/",
    "/design/new",
    "/bff/orders",
    "/administration",
    "/partners",
    "/en/admin-guide",
    "/agent",
    "/agent/apply",
  ])("allows %s", (pathname) => {
    expect(isInternalOnlyPath(pathname)).toBe(false);
  });
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

describe("agent zone allow-list (D-467)", () => {
  it("reaches the agent surface and customer sign-in, the named store paths first", () => {
    expect(upstreamPrefixes("agent")).toEqual([
      "/v1/store/me/sessions",
      "/v1/store/me/consents",
      "/v1/store/catalog/products",
      "/v1/store/catalog/images",
      "/v1/store/files",
      "/v1/store/rum",
      "/v1/store/agent",
      "/v1/auth/customer",
    ]);
  });

  it.each([
    "/v1/store/agent",
    "/v1/store/agent/leads",
    "/v1/store/agent/statements/abc/wht-certificate",
    "/v1/store/agent/notification-preferences",
    "/v1/store/agent/push/subscriptions",
    "/v1/auth/customer/otp/verify",
    "/v1/auth/customer/handoff/actions/redeem",
    "/v1/store/me",
    "/v1/store/me/sessions",
    "/v1/store/me/sessions/actions/revoke",
    "/v1/store/me/consents",
    "/v1/store/files/presign",
    "/v1/store/files/{fileId}/actions/complete",
    "/v1/store/rum/web-vitals",
    // Phase 3 (D-468): the pipeline, quotes on behalf and the catalogue they price from.
    "/v1/store/agent/leads/pipeline",
    "/v1/store/agent/leads/actions/scan-card",
    "/v1/store/agent/quotes/abc/discount-requests",
    "/v1/store/agent/commissions/forecast",
    "/v1/store/agent/playbook",
    "/v1/store/catalog/products",
    "/v1/store/catalog/products/rsc-carton/configurator",
    "/v1/store/catalog/images/abc",
    "/v1/store/quotes/actions/calculate",
  ])("allows %s", (path) => {
    expect(isUpstreamPathAllowed("agent", path)).toBe(true);
  });

  it.each([
    "/v1/store/orders",
    "/v1/store/cart",
    "/v1/store/notifications",
    "/v1/store/me/preferences",
    "/v1/store/me/privacy-requests",
    "/v1/store/customer-profile",
    "/v1/store/agents",
    "/v1/store/agentx/leads",
    "/v1/store/agent/../orders",
    // The catalogue and pricing an agent quotes from, and nothing beside them (D-468).
    "/v1/store/quotes",
    "/v1/store/quotes/shared/abc",
    "/v1/store/quotes/actions/calculate-batch",
    "/v1/store/quotes/actions/calculate/x",
    "/v1/store/catalog/search",
    "/v1/store/catalog/price-hints",
    "/v1/store/catalog/productsx",
    "/v1/store/catalog/products/../../orders",
    "/v1/admin/agents",
    "/v1/partner/me",
    "/v1/auth/staff/login",
    "/v1/auth/partner/login",
  ])("refuses %s", (path) => {
    expect(isUpstreamPathAllowed("agent", path)).toBe(false);
  });

  it("keeps the storefront off nothing it had: the customer zone still reaches the agent programme", () => {
    expect(isUpstreamPathAllowed("customer", "/v1/store/agent/programme")).toBe(true);
    expect(isUpstreamPathAllowed("customer", "/v1/store/orders")).toBe(true);
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
    // The agent zone's token is a customer token: its surface is /v1/store, its allow-list far narrower.
    expect(browserBffUrl("agent", "/rum/web-vitals")).toBe("/bff/v1/store/rum/web-vitals");
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
