import { describe, expect, it } from "vitest";

import { ZONES } from "@/lib/zones";

import { contentSecurityPolicy, cspDirectives } from "./csp";
import { isHttpsRequest, securityHeaders } from "./headers";

const options = { nonce: "test-nonce", isDev: false, origins: {} };

describe("securityHeaders", () => {
  it.each(ZONES)("gives the %s zone the baseline headers", (zone) => {
    const headers = securityHeaders(zone, { isHttps: true });

    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Cross-Origin-Opener-Policy"]).toBeDefined();
  });

  it("keeps staff and factory screens fully cross-origin isolated", () => {
    expect(securityHeaders("admin", { isHttps: true })["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(securityHeaders("partner", { isHttps: true })["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("lets the storefront hear back from a sign-in popup it opened", () => {
    // Firebase's Google and Apple sign-in talks to its popup through `window.opener`, which
    // `same-origin` severs: the popup completes and the opener never learns of it. The
    // storefront still stays isolated from anything that opened *it*.
    expect(securityHeaders("customer", { isHttps: true })["Cross-Origin-Opener-Policy"]).toBe(
      "same-origin-allow-popups",
    );
  });

  it("marks admin and partner noindex and leaves the storefront indexable", () => {
    expect(securityHeaders("customer", { isHttps: true })["X-Robots-Tag"]).toBeUndefined();
    expect(securityHeaders("admin", { isHttps: true })["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(securityHeaders("partner", { isHttps: true })["X-Robots-Tag"]).toBe("noindex, nofollow");
  });

  it("allows the camera on the partner PWA only", () => {
    expect(securityHeaders("partner", { isHttps: true })["Permissions-Policy"]).toContain("camera=(self)");
    expect(securityHeaders("customer", { isHttps: true })["Permissions-Policy"]).toContain("camera=()");
    expect(securityHeaders("admin", { isHttps: true })["Permissions-Policy"]).toContain("camera=()");
  });

  it("sends HSTS over TLS only", () => {
    expect(securityHeaders("customer", { isHttps: true })["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
    expect(securityHeaders("customer", { isHttps: false })["Strict-Transport-Security"]).toBeUndefined();
  });
});

describe("isHttpsRequest", () => {
  it("trusts x-forwarded-proto ahead of the local protocol", () => {
    expect(isHttpsRequest(new Headers({ "x-forwarded-proto": "https" }), "http:")).toBe(true);
    expect(isHttpsRequest(new Headers({ "x-forwarded-proto": "https, http" }), "http:")).toBe(true);
    expect(isHttpsRequest(new Headers({ "x-forwarded-proto": "http" }), "https:")).toBe(false);
  });

  it("falls back to the request protocol when nothing is in front of the app", () => {
    expect(isHttpsRequest(new Headers(), "https:")).toBe(true);
    expect(isHttpsRequest(new Headers(), "http:")).toBe(false);
  });
});

describe("contentSecurityPolicy", () => {
  it("carries the nonce and strict-dynamic, and no unsafe-eval in production", () => {
    const csp = contentSecurityPolicy("customer", options);

    expect(csp).toContain("'nonce-test-nonce'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
  });

  it("relaxes only what HMR needs, and only in development", () => {
    const dev = cspDirectives("customer", { ...options, isDev: true });

    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");

    expect(dev["upgrade-insecure-requests"]).toBeUndefined();
    expect(cspDirectives("customer", options)["upgrade-insecure-requests"]).toEqual([]);
  });

  it("allows inline styles without a nonce, because a nonce would void the allowance", () => {
    // sonner, Turbopack and Radix all apply styles that cannot carry a nonce; listing both
    // makes the browser ignore `'unsafe-inline'` and block every one of them. The reasoning
    // is in src/lib/security/csp.ts — this pins the outcome so it cannot be "tightened" back
    // into a policy that reports violations on every page load.
    for (const isDev of [true, false]) {
      expect(cspDirectives("customer", { ...options, isDev })["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    }
    expect(contentSecurityPolicy("customer", options)).not.toContain("style-src-attr");
  });

  it("keeps third-party analytics off the admin and partner zones (F1 1.1)", () => {
    for (const zone of ["admin", "partner"] as const) {
      const csp = contentSecurityPolicy(zone, options);
      expect(csp).not.toContain("googletagmanager.com");
      expect(csp).not.toContain("google-analytics.com");
    }
    expect(contentSecurityPolicy("customer", options)).toContain("googletagmanager.com");
  });

  it("lets LINE frame the storefront but never a staff or factory screen", () => {
    expect(cspDirectives("customer", options)["frame-ancestors"]).toEqual(["'self'"]);
    expect(cspDirectives("admin", options)["frame-ancestors"]).toEqual(["'none'"]);
    expect(cspDirectives("partner", options)["frame-ancestors"]).toEqual(["'none'"]);
  });

  it("allows the configured origins to be reached and nothing else", () => {
    const csp = contentSecurityPolicy("admin", {
      ...options,
      origins: { asset: "https://cdn.packio.co.th", sentry: "https://o1.ingest.sentry.io" },
    });

    expect(csp).toContain("connect-src 'self' https://cdn.packio.co.th https://o1.ingest.sentry.io");
    expect(csp).toContain("img-src 'self' data: blob: https://cdn.packio.co.th");
  });
});

describe("sign-in origins", () => {
  const withSignIn = { ...options, origins: { firebaseAuthDomain: "packio.firebaseapp.com", line: true } };

  it("admits Firebase and LINE on the storefront when they are configured", () => {
    const directives = cspDirectives("customer", withSignIn);

    expect(directives["connect-src"]).toEqual(
      expect.arrayContaining([
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://packio.firebaseapp.com",
        "https://api.line.me",
      ]),
    );
    // The provider's consent screen renders in an iframe on the auth domain.
    expect(directives["frame-src"]).toEqual(
      expect.arrayContaining(["https://packio.firebaseapp.com", "https://access.line.me"]),
    );
  });

  it("admits nothing when the deployment has no credentials", () => {
    const directives = cspDirectives("customer", options);

    expect(directives["connect-src"]).not.toContain("https://identitytoolkit.googleapis.com");
    expect(directives["frame-src"]).toEqual(["'self'"]);
  });

  it("adds only what is configured: LINE alone does not admit Firebase", () => {
    const directives = cspDirectives("customer", { ...options, origins: { line: true } });

    expect(directives["connect-src"]).toContain("https://api.line.me");
    expect(directives["connect-src"]).not.toContain("https://identitytoolkit.googleapis.com");
  });

  it("never widens admin or partner, which have no third-party sign-in", () => {
    for (const zone of ["admin", "partner"] as const) {
      const directives = cspDirectives(zone, withSignIn);

      expect(directives["frame-src"]).toEqual(["'self'"]);
      expect(directives["connect-src"]).not.toContain("https://identitytoolkit.googleapis.com");
    }
  });
});
