import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, signInAsCustomer } from "./helpers/customer";
import { expectHeroParity } from "./helpers/hero";
import { gotoHydrated } from "./helpers/session";

/**
 * Phase 4 (V4 "Main" board) against the mock API: the home page's sections in order, the hero's
 * Studio panel priced exactly as the configurator prices the same choices, the newsletter's
 * consent, the header's five links, the tablet menu, no horizontal scroll at four widths, and a
 * session that survives leaving the studio (B4).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).exclude("[data-sonner-toaster]").analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await acceptCookies(page);
});

test("the home page: the v10 sections in the board's order, and no stories without three approved", async ({
  page,
}) => {
  await gotoHydrated(page, HOSTS.customer);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: /กล่องที่ลูกค้าจำได้/ })).toBeVisible();
  const headings = [
    "ไม่ต้องเริ่มจากศูนย์",
    /^กล่องใบเดียวกัน/,
    /^สิ่งที่โปรแกรมทั่วไปไม่บอกคุณ/,
    /^คุมคุณภาพทุกงาน/,
    "สิ่งที่เราผลิต",
    /^ติดอยู่ตรงไหนในสตูดิโอ/,
  ];
  const tops: number[] = [];
  for (const name of headings) {
    const heading = main.getByRole("heading", { level: 2, name });
    await expect(heading).toBeVisible();
    tops.push((await heading.boundingBox())!.y);
  }
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  // The mock's CMS has no approved customer stories: the section is left out, not a placeholder.
  await expect(main.getByRole("heading", { name: "แบรนด์เล็กที่อยากดูเป็นแบรนด์ใหญ่" })).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toContainText(/เลขประจำตัวผู้เสียภาษี/);
  await expectNoViolations(page);
});

for (const shape of ["mailer", "lid", "tuck"] as const) {
  test(`the hero prices the ${shape} shape exactly as the configurator prices the same choices`, async ({ page }) => {
    await gotoHydrated(page, HOSTS.customer);
    // Every shape is offered by the mock's presets; the lid is a two-part box (body and lid).
    expect(await expectHeroParity(page, shape)).toBe(true);
  });
}

test("the panel's shapes and quantities are the catalogue's, not fixed in the page", async ({ page }) => {
  await gotoHydrated(page, HOSTS.customer);
  const panel = page.getByRole("region", { name: "สตูดิโอ · แบบร่างใหม่" });
  await expect(panel.getByRole("group", { name: "ทรงกล่อง" }).getByRole("button")).toHaveText([
    "ไปรษณีย์",
    "ฝาครอบ",
    "ฝาเสียบ",
  ]);
  // The mock's `catalog.hero_presets` quantities, within the opening shape's limits.
  await expect(panel.getByRole("group", { name: "จำนวน" }).getByRole("button")).toHaveText([
    "300",
    "500",
    "1,000",
    "2,000",
  ]);
});

test("the newsletter asks for consent before it signs anyone up", async ({ page }) => {
  await gotoHydrated(page, HOSTS.customer);
  const form = page.getByRole("form", { name: "คู่มือเตรียมไฟล์และเรื่องกระดาษ" });
  await form.getByRole("textbox", { name: "อีเมล" }).fill("buyer@example.com");
  const subscribe = form.getByRole("button", { name: "สมัคร" });
  await expect(subscribe).toBeDisabled();
  await form.getByRole("checkbox").check();
  await subscribe.click();
  await expect(page.getByText("สมัครแล้ว ขอบคุณที่ติดตาม")).toBeVisible();
});

test("the header's five links, in the board's order, lead to the studio, templates, products, business and contact", async ({
  page,
}) => {
  await gotoHydrated(page, HOSTS.customer);
  const nav = page.getByRole("banner").getByRole("navigation", { name: "เมนูหลัก" });
  await expect(nav.getByRole("link")).toHaveText([
    "สตูดิโอออกแบบ",
    "แบบกล่อง",
    "สินค้าและราคา",
    "สำหรับธุรกิจ",
    "ติดต่อ",
  ]);
  await page.getByRole("banner").getByRole("link", { name: "เริ่มออกแบบฟรี" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("heading", { level: 1, name: "วันนี้อยากเริ่มจากอะไร" })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "แบบกล่อง" }).click();
  await expect(page).toHaveURL(/\/styles$/);
});

test("a product page states its MOQ and where tolerances are explained", async ({ page }) => {
  await gotoHydrated(page, `${HOSTS.customer}/products/tuck-end-box`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByText(/ขั้นต่ำ/)
      .first(),
  ).toBeVisible();
  // The PDP (C3) links the guarantee from the buy box and "อ่านราคาอย่างไร".
  await expect(page.getByRole("main").getByRole("link", { name: "การรับประกันงาน" }).first()).toHaveAttribute(
    "href",
    /\/guarantee$/,
  );
});

test("on a tablet the header fits and the menu sheet carries the same five links", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await gotoHydrated(page, HOSTS.customer);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  await page.getByRole("banner").getByRole("button", { name: "เมนู" }).click();
  const sheet = page.getByRole("dialog", { name: "เมนู" });
  for (const name of ["สตูดิโอออกแบบ", "แบบกล่อง", "สินค้าและราคา", "สำหรับธุรกิจ"])
    await expect(sheet.getByRole("link", { name, exact: true })).toBeVisible();
  await sheet.getByRole("link", { name: "ติดต่อ" }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(sheet).toBeHidden();
});

for (const path of ["/", "/studio"]) {
  test(`${path} has no horizontal scroll at 390, 768, 1054 and 1440`, async ({ page }) => {
    for (const width of [390, 768, 1054, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoHydrated(page, `${HOSTS.customer}${path}`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${path} at ${width}`,
      ).toBeLessThanOrEqual(width);
    }
  });
}

test("leaving the studio keeps the customer signed in (B4)", async ({ page }) => {
  await signInAsCustomer(page, "/studio");
  await expect(page.getByRole("heading", { level: 1, name: "วันนี้อยากเริ่มจากอะไร" })).toBeVisible();
  await page.getByRole("link", { name: /เลือกแบบกล่องแล้วออกแบบ/ }).click();
  await expect(page).toHaveURL(/\/styles/);
  await gotoHydrated(page, `${HOSTS.customer}/studio/new?style=tuck-end&l=70&w=40&h=150&step=design`);
  await gotoHydrated(page, HOSTS.customer);
  await expect(page.getByRole("banner").getByRole("button", { name: "บัญชีของฉัน" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "เข้าสู่ระบบ" })).toHaveCount(0);
});
