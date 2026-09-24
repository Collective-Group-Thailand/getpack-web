import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInAsStaff } from "./helpers/session";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * PDPA consent and analytics (D-102, D-144).
 *
 * The assertion that matters is the negative one: no Google request may leave the browser
 * before someone has answered. It cannot be checked by looking at the page.
 */

/** Any request to a Google analytics or tag origin. */
const GOOGLE = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/;

test.describe("consent gate", () => {
  test("asks before anything third-party loads", async ({ page }) => {
    const googleRequests: string[] = [];
    page.on("request", (request) => {
      if (GOOGLE.test(request.url())) googleRequests.push(request.url());
    });

    await page.goto(HOSTS.customer);
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByRole("region", { name: "การใช้คุกกี้" })).toBeVisible();
    expect(googleRequests, "a tag fired before consent").toEqual([]);

    // Not merely absent because nothing was configured — a container id *is* set for this
    // run (`playwright.config.ts`). The container is genuinely withheld.
    await expect(page.locator("script").filter({ hasText: "googletagmanager" })).toHaveCount(0);
    expect(await page.evaluate(() => window.dataLayer?.length ?? 0)).toBe(0);
  });

  test("loads the container once consent is given, with consent mode set first", async ({ page }) => {
    await page.goto(HOSTS.customer);

    await expect(async () => {
      await page.getByRole("button", { name: "ยอมรับ", exact: true }).click();
      await expect(page.getByRole("region", { name: "การใช้คุกกี้" })).toBeHidden({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });

    // `router.refresh()` re-renders the server tree, and now the container is there.
    await expect
      .poll(async () => page.evaluate(() => window.dataLayer?.length ?? 0), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // Consent mode must be the *first* entry: a tag firing before it has already dropped a
    // cookie, and no later `consent update` un-drops it.
    const first = await page.evaluate(() => {
      // `gtag()` pushes its `arguments` object, which is array-*like* but not an Array — so
      // `Array.isArray` says no and `Array.from` is what reads it.
      const entry = (window.dataLayer ?? [])[0];
      return entry && typeof entry === "object" ? Array.from(entry as ArrayLike<unknown>) : null;
    });
    expect(first?.[0]).toBe("consent");
    expect(first?.[1]).toBe("default");
    expect(first?.[2]).toMatchObject({ analytics_storage: "granted" });
  });

  test("offers refusing as plainly as accepting", async ({ page }) => {
    // Consent that is harder to refuse than to give is not freely given — the PDPA's own
    // test, and the reason both are buttons rather than one button and a corner link.
    await page.goto(HOSTS.customer);

    const banner = page.getByRole("region", { name: "การใช้คุกกี้" });
    // `exact` matters here: "ไม่ยอมรับ" (reject) contains "ยอมรับ" (accept), so a substring
    // match finds both buttons and Playwright refuses the ambiguity.
    await expect(banner.getByRole("button", { name: "ยอมรับ", exact: true })).toBeVisible();
    await expect(banner.getByRole("button", { name: "ไม่ยอมรับ", exact: true })).toBeVisible();
  });

  test("remembers a refusal and does not ask again", async ({ page }) => {
    await page.goto(HOSTS.customer);

    await expect(async () => {
      await page.getByRole("button", { name: "ไม่ยอมรับ", exact: true }).click();
      await expect(page.getByRole("region", { name: "การใช้คุกกี้" })).toBeHidden({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    // A cookie saying "denied" is an answer, not an absence of one.
    await page.reload();
    await expect(page.getByRole("region", { name: "การใช้คุกกี้" })).toHaveCount(0);
  });

  test("does not block the page while it is up", async ({ page }) => {
    // A region, not a dialog: someone reading the cookie policy to decide has to reach it.
    await page.goto(HOSTS.customer);
    await expect(page.getByRole("region", { name: "การใช้คุกกี้" })).toBeVisible();

    await page.getByRole("link", { name: "เริ่มออกแบบ" }).first().click();
    await expect(page).toHaveURL(new RegExp("/design/new"));
  });

  test("never appears in the back office", async ({ page }) => {
    // D-102: no third-party analytics on admin or partner, so nothing to consent to.
    await signInAsStaff(page);
    await expect(page.getByRole("region", { name: "การใช้คุกกี้" })).toHaveCount(0);
  });
});
