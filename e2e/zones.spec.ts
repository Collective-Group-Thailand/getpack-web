import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInAsStaff } from "./helpers/session";

/**
 * The zone boundary, in a real browser (F1 Deliverable 1.1).
 *
 * Unit tests pin the rules; this pins that they are actually wired to the three hosts — that
 * the rewrite reaches the right root layout, that a cross-zone path is refused before any
 * app code runs, and that the headers a crawler and a browser see are the per-zone ones.
 */

/** `page.goto` with the response, so headers and status can be asserted together. */
async function open(page: Page, url: string) {
  const response = await page.goto(url);
  expect(response, `no response for ${url}`).not.toBeNull();
  return response!;
}

test.describe("each host renders its own zone", () => {
  test("the customer host serves the storefront in Thai at the root", async ({ page }) => {
    await open(page, HOSTS.customer);

    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the customer host serves English under /en", async ({ page }) => {
    await open(page, `${HOSTS.customer}/en`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("/th is not a URL — Thai lives at the root", async ({ page }) => {
    await open(page, `${HOSTS.customer}/th`);
    expect(new URL(page.url()).pathname).toBe("/");
  });

  // Since F1 1.2 every admin and partner screen needs a session, so an anonymous visit
  // lands on that zone's login page — which is still that zone's root layout, theme, fonts
  // and messages, and is what these tests are actually about.
  test("the admin host serves the admin zone, light and Thai", async ({ page }) => {
    await open(page, HOSTS.admin);

    await expect(page.getByRole("heading", { name: "เข้าสู่ระบบสำหรับพนักงาน" })).toBeVisible();
    // Admin is a light-first workspace whatever the OS says (00-master-plan.md §2).
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
  });

  test("the admin zone renders its own screens once there is a session", async ({ page }) => {
    await signInAsStaff(page);

    await expect(page.getByRole("heading", { name: "โซนผู้ดูแลระบบ" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("the partner host serves the partner zone", async ({ page }) => {
    await open(page, HOSTS.partner);
    await expect(page.getByRole("heading", { name: "เข้าสู่ระบบโรงงานพันธมิตร" })).toBeVisible();
  });

  test("admin takes its language from a cookie rather than the URL", async ({ page, context }) => {
    await context.addCookies([{ name: "pk_locale", value: "en", url: HOSTS.admin }]);
    await open(page, HOSTS.admin);

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
    // …and the URL still carries no locale prefix.
    expect(new URL(page.url()).pathname).toBe("/login");
  });
});

test.describe("cross-zone paths are refused", () => {
  for (const [name, url] of [
    ["/admin on the customer host", `${HOSTS.customer}/admin`],
    ["/admin/orders on the customer host", `${HOSTS.customer}/admin/orders`],
    ["/partner/jobs on the customer host", `${HOSTS.customer}/partner/jobs`],
    ["another zone's BFF on the customer host", `${HOSTS.customer}/admin/bff/v1/admin/orders`],
    // On the admin host the real URL of an admin screen is `/orders`; `/admin/orders` there
    // is the internal path leaking, and is refused just the same.
    ["the internal /admin prefix on the admin host itself", `${HOSTS.admin}/admin`],
    ["/admin on the partner host", `${HOSTS.partner}/admin`],
  ] as const) {
    test(`${name} answers 404`, async ({ page }) => {
      const response = await open(page, url);

      expect(response.status()).toBe(404);
      // Not a redirect to a login page, and not the admin shell either.
      expect(new URL(page.url()).pathname).toBe(new URL(url).pathname);
      await expect(page.getByRole("heading", { name: "โซนผู้ดูแลระบบ" })).toHaveCount(0);
    });
  }

  test("a real miss inside a zone gets that zone's own 404 page", async ({ page }) => {
    // Signed in first: the catch-all sits inside the guarded route group, so a signed-out
    // visitor is asked to sign in rather than told which admin paths do not exist.
    await signInAsStaff(page);
    const response = await open(page, `${HOSTS.admin}/nope`);

    expect(response.status()).toBe(404);
    await expect(page.getByText("ไม่พบหน้านี้").first()).toBeVisible();
  });

  test("an unknown admin path asks a signed-out visitor to sign in, and reveals nothing", async ({ page }) => {
    await open(page, `${HOSTS.admin}/nope`);

    await expect(page).toHaveURL(`${HOSTS.admin}/login?returnTo=%2Fnope`);
    await expect(page.getByText("ไม่พบหน้านี้")).toHaveCount(0);
  });
});

test.describe("security headers", () => {
  test("admin and partner are noindex; the storefront is indexable", async ({ page }) => {
    expect((await open(page, HOSTS.admin)).headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect((await open(page, HOSTS.partner)).headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect((await open(page, HOSTS.customer)).headers()["x-robots-tag"]).toBeUndefined();
  });

  test("every zone gets a nonce CSP, and only partner may open the camera", async ({ page }) => {
    for (const [zone, url] of Object.entries(HOSTS)) {
      const headers = (await open(page, url)).headers();

      expect(headers["content-security-policy"], zone).toMatch(/'nonce-[^']+'/);
      expect(headers["content-security-policy"], zone).toContain("'strict-dynamic'");
      expect(headers["referrer-policy"], zone).toBe("strict-origin-when-cross-origin");
      expect(headers["x-content-type-options"], zone).toBe("nosniff");
      expect(headers["permissions-policy"], zone).toContain(zone === "partner" ? "camera=(self)" : "camera=()");
    }
  });

  test("the nonce Next stamps on its own scripts is the one in the CSP", async ({ page }) => {
    const response = await open(page, HOSTS.customer);
    const nonce = response.headers()["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];

    expect(nonce).toBeTruthy();
    // Read from the served HTML, not the DOM: the CSP spec has browsers blank the `nonce`
    // content attribute once the document is parsed, so no selector can see it.
    // If these ever diverge, the CSP silently blocks Next's bootstrap and the page is dead.
    expect(await response.text()).toContain(`nonce="${nonce}"`);
  });

  test("no script is blocked by the policy the page was served with", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });

    for (const url of Object.values(HOSTS)) {
      await open(page, url);
      await page.waitForLoadState("networkidle");
    }

    expect(violations).toEqual([]);
  });
});
