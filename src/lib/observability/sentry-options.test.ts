import { describe, expect, it } from "vitest";

import { sentryOptions, TRACE_PROPAGATION_TARGETS, TRACES_SAMPLE_RATE, zoneFromHost } from "./sentry-options";

const base = { dsn: "https://k@o0.ingest.sentry.io/1", environment: undefined, release: undefined, zone: undefined };

describe("sentryOptions", () => {
  it("returns null without a DSN, so nothing starts", () => {
    // A local checkout and a CI run must not reach an ingest endpoint.
    expect(sentryOptions({ ...base, dsn: undefined, isDev: true })).toBeNull();
    expect(sentryOptions({ ...base, dsn: "", isDev: false })).toBeNull();
  });

  it("samples every trace in development and a tenth in production", () => {
    expect(sentryOptions({ ...base, isDev: true })?.tracesSampleRate).toBe(TRACES_SAMPLE_RATE.development);
    expect(sentryOptions({ ...base, isDev: false })?.tracesSampleRate).toBe(TRACES_SAMPLE_RATE.production);
  });

  it("names the environment when nothing else does", () => {
    expect(sentryOptions({ ...base, isDev: false })?.environment).toBe("production");
    expect(sentryOptions({ ...base, environment: "uat", isDev: false })?.environment).toBe("uat");
  });

  it("tags the zone, so one DSN still answers 'where'", () => {
    expect(sentryOptions({ ...base, zone: "admin", isDev: false })?.initialScope.tags).toEqual({ zone: "admin" });
    expect(sentryOptions({ ...base, zone: undefined, isDev: false })?.initialScope.tags).toEqual({});
  });

  it("never sends PII by default (D-144)", () => {
    expect(sentryOptions({ ...base, isDev: false })?.sendDefaultPii).toBe(false);
  });

  it("propagates a trace header to this origin only", () => {
    // A trace header on a third-party endpoint leaks that this page is instrumented and can
    // trip a CORS preflight that looks like the feature is broken.
    const [pattern] = TRACE_PROPAGATION_TARGETS as RegExp[];
    expect(pattern.test("/bff/v1/store/orders")).toBe(true);
    expect(pattern.test("https://api.line.me/v2/profile")).toBe(false);
  });
});

describe("zoneFromHost", () => {
  it.each([
    ["admin.packio.co.th", "admin"],
    ["admin.localhost:3000", "admin"],
    ["partner.packio.co.th", "partner"],
    ["packio.co.th", "customer"],
    ["www.packio.co.th", "customer"],
    ["localhost:3000", "customer"],
  ])("reads %s as the %s zone", (hostname, zone) => {
    expect(zoneFromHost(hostname)).toBe(zone);
  });

  it("does not let a hostname claim to be the customer zone by name", () => {
    // "customer" is not a host label Packio uses; treating it as one would let
    // `customer.example.com` tag itself, and the fallback already covers the storefront.
    expect(zoneFromHost("customer.example.com")).toBe("customer");
  });
});
