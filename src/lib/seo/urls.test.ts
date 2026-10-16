import { describe, expect, it, vi } from "vitest";

import { routing } from "@/i18n/routing";

import { alternateUrls, localePath } from "./urls";
import { organizationSchema } from "./structured-data";

const ORIGIN = "https://getpack.co";

describe("localePath", () => {
  it("serves the default locale at the root, with no prefix", () => {
    // This mirrors `localePrefix: "as-needed"` in src/i18n/routing.ts. If that ever changes,
    // this is the test that says the URLs in the sitemap changed with it.
    expect(routing.defaultLocale).toBe("th");
    expect(localePath("/", "th")).toBe("/");
    expect(localePath("/products", "th")).toBe("/products");
  });

  it("prefixes the other locale", () => {
    expect(localePath("/", "en")).toBe("/en");
    expect(localePath("/products", "en")).toBe("/en/products");
  });

  it("does not leave a trailing slash for a crawler to treat as a second URL", () => {
    expect(localePath("/products/", "th")).toBe("/products");
    expect(localePath("/products/", "en")).toBe("/en/products");
  });
});

describe("alternateUrls", () => {
  it("makes each locale canonical to itself", () => {
    // A shared canonical would tell a crawler the English page is a duplicate of the Thai one
    // and drop it from the index.
    expect(alternateUrls(ORIGIN, "/products", "th").canonical).toBe("https://getpack.co/products");
    expect(alternateUrls(ORIGIN, "/products", "en").canonical).toBe("https://getpack.co/en/products");
  });

  it("lists every locale plus an x-default pointing at Thai", () => {
    const { languages } = alternateUrls(ORIGIN, "/help", "en");

    expect(languages).toEqual({
      th: "https://getpack.co/help",
      en: "https://getpack.co/en/help",
      // Thailand is where the customers are; the English pages exist for the minority.
      "x-default": "https://getpack.co/help",
    });
  });

  it("covers every locale the router knows, not a hard-coded pair", () => {
    const { languages } = alternateUrls(ORIGIN, "/", "th");
    for (const locale of routing.locales) expect(languages[locale]).toBeDefined();
  });
});

describe("organizationSchema", () => {
  it("names the brand and the legal entity separately (D-010, D-092)", () => {
    const schema = organizationSchema(ORIGIN);

    expect(schema.name).toBe("getpack");
    expect(schema.legalName).toBe("Collective Group (Thailand)");
    expect(schema.url).toBe(ORIGIN);
  });

  it("claims nothing it cannot back", () => {
    // design-system.md §5: trust elements only from real data. No ratings or review counts
    // until F3 has an API to read them from.
    const keys = Object.keys(organizationSchema(ORIGIN));
    expect(keys).not.toContain("aggregateRating");
    expect(keys).not.toContain("review");
  });
});

describe("currentPathname", () => {
  // Mocked rather than exercised end to end: the e2e suite asserts the resulting `<link>`
  // tags in a real browser, and this pins the locale-stripping rule on its own.
  const cases: [string, string][] = [
    ["/", "/"],
    ["/products", "/products"],
    ["/en", "/"],
    ["/en/products", "/products"],
    ["/products?page=2", "/products"],
    // `/energy` starts with the letters of `/en` but is not the English locale.
    ["/energy", "/energy"],
    ["/english-summary", "/english-summary"],
  ];

  it.each(cases)("reads %s as %s", async (header, expected) => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({ headers: async () => new Headers({ "x-getpack-path": header }) }));
    const { currentPathname } = await import("./urls");
    expect(await currentPathname()).toBe(expected);
    vi.doUnmock("next/headers");
  });

  it("falls back to the root when the proxy header is missing", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({ headers: async () => new Headers() }));
    const { currentPathname } = await import("./urls");
    expect(await currentPathname()).toBe("/");
    vi.doUnmock("next/headers");
  });
});
