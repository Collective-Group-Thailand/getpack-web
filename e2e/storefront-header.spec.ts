import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * The storefront header never overlaps itself (styles redesign, PLAN.md §2): at every width from the
 * 1040 px collapse point up, in Thai and English, signed in and out, no box of the logo, a nav link
 * or a tool intersects another, and the nav keeps clear of the tools. Only "no horizontal scroll"
 * was tested before, and that cannot see one control painted over another.
 */

const WIDTHS = [1024, 1054, 1100, 1180, 1280, 1366, 1440] as const;
/** At and above this the bar is the full nav; below it, the drawer. */
const COLLAPSE_BELOW = 1040;
const MIN_CLEARANCE = 8;

type Box = { name: string; x: number; y: number; width: number; height: number };

async function boxes(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const r = element.getBoundingClientRect();
      const s = getComputedStyle(element);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const read = (element: Element, name: string) => {
      const r = element.getBoundingClientRect();
      return { name, x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const header = document.querySelector("header")!;
    const logo = [...header.querySelectorAll("a")].find(
      (a) => /^\/(en)?\/?$/.test(new URL(a.href).pathname) && visible(a) && a.closest("nav") === null,
    );
    const nav = [...header.querySelectorAll("[data-header-nav] a")].filter(visible);
    const tools = [...header.querySelectorAll("[data-header-tools] a, [data-header-tools] button")].filter(visible);
    return {
      logo: logo ? read(logo, "logo") : null,
      nav: nav.map((el) => read(el, `nav:${el.textContent?.trim()}`)),
      tools: tools.map((el, i) => read(el, `tool${i}:${el.getAttribute("aria-label") ?? el.textContent?.trim()}`)),
    };
  });
}

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function expectNoOverlap(page: Page, where: string, cta: string) {
  const { logo, nav, tools } = await boxes(page);
  expect(logo, `${where}: logo`).not.toBeNull();
  expect(nav.length, `${where}: nav links`).toBe(5);
  expect(tools.length, `${where}: tools`).toBeGreaterThanOrEqual(3);
  // The primary action is in the bar at every width from the collapse point up (polish 1).
  expect(
    tools.some((b) => b.name.endsWith(cta)),
    `${where}: primary action`,
  ).toBe(true);
  const all: Box[] = [logo!, ...nav, ...tools];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      expect(intersects(all[i]!, all[j]!), `${where}: ${all[i]!.name} overlaps ${all[j]!.name}`).toBe(false);
    }
  }
  const navStart = Math.min(...nav.map((b) => b.x));
  const navEnd = Math.max(...nav.map((b) => b.x + b.width));
  expect(navStart - (logo!.x + logo!.width), `${where}: logo to nav`).toBeGreaterThanOrEqual(MIN_CLEARANCE);
  expect(Math.min(...tools.map((b) => b.x)) - navEnd, `${where}: nav to tools`).toBeGreaterThanOrEqual(MIN_CLEARANCE);
  // Nothing leaves the viewport either.
  const viewport = page.viewportSize()!.width;
  for (const box of all)
    expect(box.x + box.width, `${where}: ${box.name} inside viewport`).toBeLessThanOrEqual(viewport);
}

for (const signedIn of [false, true]) {
  for (const locale of ["th", "en"] as const) {
    test(`header: no overlap, ${locale}, ${signedIn ? "signed in" : "signed out"}`, async ({ page }) => {
      const path = locale === "en" ? "/en" : "/";
      if (signedIn) await signInAsCustomer(page);
      else await acceptCookies(page);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await gotoHydrated(page, `${HOSTS.customer}${path}`);
        const where = `${locale} ${signedIn ? "in" : "out"} @${width}`;
        if (width < COLLAPSE_BELOW) {
          // The drawer: the menu button shows and the desktop nav does not.
          await expect(page.locator("header [data-header-nav]"), where).toBeHidden();
          continue;
        }
        await expectNoOverlap(page, where, locale === "en" ? "Start designing free" : "เริ่มออกแบบฟรี");
      }
    });
  }
}

test("header: the current section's link is marked and tinted", async ({ page }) => {
  await acceptCookies(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoHydrated(page, `${HOSTS.customer}/styles`);
  const current = page.locator("header [data-header-nav] a[aria-current='page']");
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("href", /\/styles$/);
});

test("header: signed in, the account is initials with the full name as its tooltip, and the cart is an icon", async ({
  page,
}) => {
  await signInAsCustomer(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoHydrated(page, HOSTS.customer);
  const account = page.locator("header button[title]").first();
  await expect(account).toBeVisible();
  const name = await account.getAttribute("title");
  expect(name?.length ?? 0).toBeGreaterThan(0);
  expect(((await account.innerText()) ?? "").trim().length).toBeLessThanOrEqual(3);
  await expect(page.locator("header").getByRole("link", { name: /ตะกร้าสินค้า/ })).toBeVisible();
});
