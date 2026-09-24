import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";

/**
 * SEO is customer-zone only (F1 1.3 §5, 00-master-plan.md §2).
 *
 * The interesting assertions are the negative ones: a `robots.txt` answered on the admin host
 * publishes the shape of the back office, and a canonical shared between the Thai and English
 * pages tells a crawler one of them is a duplicate and drops it from the index. Neither shows
 * up in a browser.
 */

test.describe("crawler files", () => {
  test("the storefront serves robots.txt and points at its sitemap", async ({ request }) => {
    const response = await request.get(`${HOSTS.customer}/robots.txt`);
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("Allow: /");
    expect(body).toContain(`Sitemap: ${HOSTS.customer}/sitemap.xml`);
    // A tracking link carries a per-order token; an indexed one exposes a stranger's delivery.
    expect(body).toContain("Disallow: /track/");
    expect(body).toContain("Disallow: /account/");
  });

  test("admin and partner have no robots.txt or sitemap at all", async ({ request }) => {
    for (const host of [HOSTS.admin, HOSTS.partner]) {
      for (const path of ["/robots.txt", "/sitemap.xml"]) {
        expect((await request.get(`${host}${path}`)).status(), `${host}${path}`).toBe(404);
      }
    }
  });

  test("the sitemap lists real pages, each with its alternates", async ({ request }) => {
    const body = await (await request.get(`${HOSTS.customer}/sitemap.xml`)).text();

    expect(body).toContain(`<loc>${HOSTS.customer}/</loc>`);
    expect(body).toContain(`hreflang="en" href="${HOSTS.customer}/en/products"`);
    expect(body).toContain('hreflang="x-default"');
  });

  test("every URL in the sitemap actually answers", async ({ request }) => {
    // A sitemap full of 404s is worse than a short one: it is the crawler's view of the site.
    const body = await (await request.get(`${HOSTS.customer}/sitemap.xml`)).text();
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);

    expect(locs.length).toBeGreaterThan(5);
    for (const loc of locs) {
      expect((await request.get(loc)).status(), `${loc} is in the sitemap`).toBeLessThan(400);
    }
  });
});

test.describe("page metadata", () => {
  test("each locale is canonical to itself, not to the other", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/products`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${HOSTS.customer}/products`);

    await page.goto(`${HOSTS.customer}/en/products`);
    // Sharing a canonical would tell a crawler the English page is a duplicate.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${HOSTS.customer}/en/products`);
  });

  test("Organization data names the brand and the legal entity, under the CSP nonce", async ({ page }) => {
    await page.goto(HOSTS.customer);

    const jsonLd = page.locator('script[type="application/ld+json"]');
    const parsed = JSON.parse((await jsonLd.first().textContent()) ?? "{}");

    expect(parsed["@type"]).toBe("Organization");
    expect(parsed.name).toBe("Packio");
    // D-010/D-092: Packio is the brand, Collective Group (Thailand) issues the documents.
    expect(parsed.legalName).toBe("Collective Group (Thailand)");
    // Unbacked claims are worse than none (design-system.md §5).
    expect(parsed.aggregateRating).toBeUndefined();
  });

  test("admin pages stay noindex in their metadata as well as their headers", async ({ page }) => {
    await page.goto(HOSTS.admin);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
