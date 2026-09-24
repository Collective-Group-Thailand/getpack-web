// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

import { ZONE_HEADER } from "@/lib/zones";

let proxy: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  // The hosts come from the environment, and `src/lib/env/server.ts` validates once on
  // first import — so they have to be in place before the proxy is loaded.
  process.env.PUBLIC_HOST = "packio.co.th";
  process.env.ADMIN_HOST = "admin.packio.co.th";
  process.env.PARTNER_HOST = "partner.packio.co.th";
  proxy = (await import("./proxy")).default;
});

function request(host: string, path = "/", headers: Record<string, string> = {}) {
  return new NextRequest(`https://${host}${path}`, { headers: { host, ...headers } });
}

/** Where the proxy told Next to send the request, or `null` when it did not rewrite. */
function rewriteTarget(response: Response): string | null {
  const value = response.headers.get("x-middleware-rewrite");
  return value ? new URL(value, "https://packio.co.th").pathname : null;
}

describe("host → zone", () => {
  it("rewrites the admin host onto the /admin segment", async () => {
    expect(rewriteTarget(await proxy(request("admin.packio.co.th", "/orders")))).toBe("/admin/orders");
    expect(rewriteTarget(await proxy(request("admin.packio.co.th", "/")))).toBe("/admin");
  });

  it("rewrites the partner host onto the /partner segment, including its BFF", async () => {
    expect(rewriteTarget(await proxy(request("partner.packio.co.th", "/jobs/7")))).toBe("/partner/jobs/7");
    expect(rewriteTarget(await proxy(request("partner.packio.co.th", "/bff/v1/partner/me")))).toBe(
      "/partner/bff/v1/partner/me",
    );
  });

  it("prefixes the customer host with the locale and leaves its BFF alone", async () => {
    expect(rewriteTarget(await proxy(request("packio.co.th", "/design/new")))).toBe("/th/design/new");
    expect(rewriteTarget(await proxy(request("packio.co.th", "/en/design/new")))).toBeNull();
    // The BFF is a route handler outside `[locale]`; a locale prefix would 404 it.
    expect(rewriteTarget(await proxy(request("packio.co.th", "/bff/v1/store/cart")))).toBeNull();
  });

  it("refuses a host no zone claims, rather than picking a default", async () => {
    expect((await proxy(request("evil.example.com"))).status).toBe(404);
  });

  it("tells every zone which one it is", async () => {
    const response = await proxy(request("admin.packio.co.th", "/orders"));
    expect(response.headers.get(`x-middleware-request-${ZONE_HEADER}`)).toBe("admin");
  });
});

describe("cross-zone paths", () => {
  it.each([
    ["packio.co.th", "/admin"],
    ["packio.co.th", "/admin/orders"],
    ["packio.co.th", "/partner/jobs"],
    ["packio.co.th", "/admin/bff/v1/admin/orders"],
    // The real URL of an admin screen is /orders on the admin host; /admin/orders there is
    // the internal path leaking, and is refused just the same.
    ["admin.packio.co.th", "/admin/orders"],
    ["partner.packio.co.th", "/admin"],
  ])("answers 404 for %s%s", async (host, path) => {
    const response = await proxy(request(host, path));

    expect(response.status).toBe(404);
    expect(rewriteTarget(response)).toBeNull();
    // Nothing about the route, and nothing for a crawler either.
    expect(await response.text()).toBe("");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("security headers", () => {
  it("stamps a fresh nonce on every request, in the response and on the way in", async () => {
    const first = await proxy(request("packio.co.th"));
    const second = await proxy(request("packio.co.th"));

    const nonceOf = (response: Response) =>
      response.headers.get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1];

    expect(nonceOf(first)).toBeTruthy();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
    // Next reads the nonce from the request-side CSP to stamp its own bootstrap scripts.
    expect(first.headers.get("x-middleware-request-content-security-policy")).toContain(`'nonce-${nonceOf(first)}'`);
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonceOf(first));
  });

  it("marks admin and partner noindex and leaves the storefront indexable", async () => {
    expect((await proxy(request("admin.packio.co.th"))).headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect((await proxy(request("partner.packio.co.th"))).headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect((await proxy(request("packio.co.th"))).headers.get("x-robots-tag")).toBeNull();
  });

  it("allows the camera on the partner host only", async () => {
    const policy = async (host: string) => (await proxy(request(host))).headers.get("permissions-policy") ?? "";

    expect(await policy("partner.packio.co.th")).toContain("camera=(self)");
    expect(await policy("admin.packio.co.th")).toContain("camera=()");
    expect(await policy("packio.co.th")).toContain("camera=()");
  });

  it("sends HSTS over TLS and not over plain http", async () => {
    const secure = await proxy(request("packio.co.th"));
    expect(secure.headers.get("strict-transport-security")).toMatch(/max-age=\d+/);

    const local = new NextRequest("http://packio.co.th/", { headers: { host: "packio.co.th" } });
    expect((await proxy(local)).headers.get("strict-transport-security")).toBeNull();
  });

  it("replaces a client-supplied nonce or zone header instead of trusting it", async () => {
    const response = await proxy(request("packio.co.th", "/", { "x-nonce": "attacker", [ZONE_HEADER]: "admin" }));

    expect(response.headers.get("x-middleware-request-x-nonce")).not.toBe("attacker");
    expect(response.headers.get(`x-middleware-request-${ZONE_HEADER}`)).toBe("customer");
  });
});

describe("root assets", () => {
  it("serves them unprefixed on every host — they belong to no zone", async () => {
    for (const host of ["packio.co.th", "admin.packio.co.th", "partner.packio.co.th"]) {
      expect(rewriteTarget(await proxy(request(host, "/icon.svg")))).toBeNull();
    }
  });
});

describe("crawler files", () => {
  it("serves robots.txt and sitemap.xml unprefixed on the indexed zone", async () => {
    // Unprefixed matters: passed to next-intl these become `/th/robots.txt`, and a crawler
    // gets a 404 — the kind of failure nobody notices until the site is not in the index.
    for (const path of ["/robots.txt", "/sitemap.xml"]) {
      const response = await proxy(request("packio.co.th", path));
      expect(response.status).toBe(200);
      expect(rewriteTarget(response)).toBeNull();
    }
  });

  it("does not answer them at all on a zone that is noindex", async () => {
    // Answering on admin.packio.co.th would publish the shape of the back office to anyone.
    for (const host of ["admin.packio.co.th", "partner.packio.co.th"]) {
      for (const path of ["/robots.txt", "/sitemap.xml"]) {
        expect((await proxy(request(host, path))).status, `${host}${path}`).toBe(404);
      }
    }
  });
});
