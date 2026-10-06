import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * U-F3 / U-F4 against the mock API: the home page's eight sections and its quick start into a
 * prefilled configurator, the header's product menu into the catalogue's type filter, the
 * catalogue's chips and list view, the newsletter's consent, and the footer's company line.
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

test("the home page: sections in order, the quick start lands in a priced configurator", async ({ page }) => {
  await gotoHydrated(page, HOSTS.customer);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  for (const heading of ["ขั้นตอนการสั่งผลิต", "ทำไมต้อง Packio", "ผลงานและเสียงจากลูกค้า", "รับข่าวสารจาก Packio"])
    await expect(main.getByRole("heading", { level: 2, name: heading })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText(/เลขประจำตัวผู้เสียภาษี/);
  await expectNoViolations(page);

  const quick = page.getByRole("form", { name: "ดูราคาเร็ว" });
  await quick.getByRole("textbox", { name: "ยาว" }).fill("20");
  await quick.getByRole("textbox", { name: "กว้าง" }).fill("15");
  await quick.getByRole("textbox", { name: "สูง" }).fill("8");
  await quick.getByRole("textbox", { name: "จำนวน (ชิ้น)" }).fill("500");
  await quick.getByRole("button", { name: "ดูราคา" }).click();
  await expect(page).toHaveURL(/\/configure\/[^?]+\?.*qty=500/);
  await expect(page).toHaveURL(/l=200&w=150&d=80/);
  const dock = page.getByRole("complementary", { name: "ราคาของคุณ" });
  await expect(dock).toContainText("500 ชิ้น");
});

test("the newsletter asks for consent before it signs anyone up", async ({ page }) => {
  await gotoHydrated(page, HOSTS.customer);
  const form = page.getByRole("form", { name: "รับข่าวสารจาก Packio" });
  await form.getByRole("textbox", { name: "อีเมล" }).fill("buyer@example.com");
  const subscribe = form.getByRole("button", { name: "สมัครรับข่าวสาร" });
  await expect(subscribe).toBeDisabled();
  await form.getByRole("checkbox").check();
  await subscribe.click();
  await expect(page.getByText("สมัครแล้ว ขอบคุณที่ติดตาม")).toBeVisible();
});

test("the product menu leads to the catalogue filtered by type, with chips and a list view", async ({ page }) => {
  await gotoHydrated(page, HOSTS.customer);
  const banner = page.getByRole("banner");
  await banner.getByRole("button", { name: "สินค้าและบริการ" }).click();
  const typeLink = banner.locator('a[href*="productType="]').first();
  const typeName = (await typeLink.innerText()).split("\n")[0]!.trim();
  await typeLink.click();
  await expect(page).toHaveURL(/\/products\?productType=/);

  const chips = page.getByRole("list", { name: "ตัวกรองที่ใช้" });
  await expect(chips).toContainText(typeName);
  await expect(page.getByRole("main").getByText(/^\d+ รายการ$/)).toBeVisible();

  await page.getByRole("navigation", { name: "มุมมอง" }).getByRole("link", { name: "รายการ" }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(page).toHaveURL(/productType=/);
  await expectNoViolations(page);

  await page.getByRole("link", { name: "ล้างทั้งหมด" }).click();
  await expect(page).not.toHaveURL(/productType=/);
  await expect(page.getByRole("list", { name: "ตัวกรองที่ใช้" })).toHaveCount(0);
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
  await expect(page.getByRole("link", { name: "ดูเกณฑ์ในการรับประกัน" })).toBeVisible();
});

test("on a tablet the header fits and the menu sheet carries every page", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await gotoHydrated(page, HOSTS.customer);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  await page.getByRole("banner").getByRole("button", { name: "เมนู" }).click();
  const sheet = page.getByRole("dialog", { name: "เมนู" });
  await expect(sheet.getByRole("link", { name: "ราคาและตัวอย่าง" })).toBeVisible();
  await sheet.getByRole("link", { name: "ติดต่อ" }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(sheet).toBeHidden();
});
