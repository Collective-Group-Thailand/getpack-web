import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * The /products hub ("สินค้าและราคา", Stage C · C1): head, buying modes, the calculator, the catalogue's
 * URL state (mode, category, sort, view) with Back restoring it, the RFQ tray walking its items through
 * the quotation form, and the category landing page reusing the same catalogue.
 */
test.describe("the products hub", () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test("head, modes and the catalogue's URL state; Back restores it", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/products`);
    await expect(page.getByRole("heading", { level: 1, name: "สินค้าและราคา" })).toBeVisible();
    await expect(page.getByText(/\d+ รายการ · \d+ หมวด/)).toBeVisible();

    const modes = page.getByRole("group", { name: "วิธีซื้อ" });
    await modes.getByRole("button", { name: /^สั่งผลิตตามสเปก/ }).click();
    await expect(page).toHaveURL(/\/products\?mode=quote/);
    await expect(modes.getByRole("button", { name: /^สั่งผลิตตามสเปก/ })).toHaveAttribute("aria-pressed", "true");
    const catalogue = page.locator("#catalog");
    await expect(catalogue.getByRole("link", { name: "กล่องแข็งฝาแม่เหล็ก" })).toBeVisible();
    await expect(catalogue.getByRole("link", { name: "กล่องไปรษณีย์" })).toHaveCount(0);

    await catalogue
      .getByRole("navigation", { name: "วิธีซื้อ" })
      .getByRole("link", { name: /ทั้งหมด/ })
      .click();
    await expect(page).toHaveURL(`${HOSTS.customer}/products`);
    await catalogue.getByRole("link", { name: "ตารางราคา" }).click();
    await expect(page).toHaveURL(/view=table/);
    await expect(catalogue.getByRole("table", { name: "ตารางราคาเริ่มต้น" })).toBeVisible();
    await expect(catalogue.getByRole("columnheader", { name: "ราคาเริ่มต้น (รวม VAT)" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(`${HOSTS.customer}/products`);
    await page.goBack();
    await expect(page).toHaveURL(/mode=quote/);
  });

  test("the quick calculator prices an instant product and opens the configurator on the same choices", async ({
    page,
  }) => {
    await gotoHydrated(page, `${HOSTS.customer}/products`);
    const calc = page.locator("#calc");
    await calc.scrollIntoViewIfNeeded();
    await calc.getByRole("button", { name: "กล่องไปรษณีย์" }).click();
    await expect(calc.getByText("ราคาก่อน VAT")).toBeVisible({ timeout: 30_000 });
    await calc.getByRole("button", { name: "2,000", exact: true }).click();
    await expect(calc.getByText(/ราคาต่อชิ้น · 2,000 ชิ้น · รวม VAT/)).toBeVisible({ timeout: 30_000 });
    const cta = calc.getByRole("link", { name: "ปรับขนาดและสั่งซื้อ" });
    await expect(cta).toHaveAttribute("href", /\/configure\/mailer-box\?(.*&)?qty=2000/);
  });

  test("the RFQ tray keeps its items and walks them through the quotation form", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/products?mode=quote`);
    const catalogue = page.locator("#catalog");
    await catalogue.getByRole("button", { name: "เพิ่ม กล่องแข็งฝาแม่เหล็ก ในใบขอราคา" }).click();
    await catalogue.getByRole("button", { name: "เพิ่ม ถุงกระดาษคราฟท์หูเกลียว ในใบขอราคา" }).click();
    const tray = page.getByRole("region", { name: "ใบขอราคา" });
    await expect(tray).toContainText("ใบขอราคา 2 รายการ");

    // Kept in this browser: a reload still has it.
    await page.reload();
    await expect(page.getByRole("region", { name: "ใบขอราคา" })).toContainText("2 รายการ");
    await expect(catalogue.getByRole("button", { name: "นำ กล่องแข็งฝาแม่เหล็ก ออกจากใบขอราคา" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("region", { name: "ใบขอราคา" }).getByRole("button", { name: "ส่งคำขอราคา" }).click();
    await expect(page).toHaveURL(/\/rfq\/.*from=magnetic-gift-box.*tray=1/);
    await expect(page.getByText("ใบขอราคา: รายการที่ 1 จาก 2")).toBeVisible();
    await page.getByRole("button", { name: "ข้ามรายการนี้" }).click();
    await expect(page).toHaveURL(/\/rfq\/.*from=kraft-paper-bag.*tray=1/);
    await expect(page.getByText("ใบขอราคา: รายการที่ 1 จาก 1")).toBeVisible();
  });

  test("a category page lists with the same tabs, table view and tray", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/products?cat=corrugated`);
    await page
      .locator("#catalog")
      .getByRole("link", { name: /ดูหน้าหมวดกล่องกระดาษลูกฟูก/ })
      .click();
    await expect(page).toHaveURL(`${HOSTS.customer}/products/corrugated`);
    await expect(page.getByRole("heading", { level: 1, name: "กล่องกระดาษลูกฟูก" })).toBeVisible();
    await page.getByRole("link", { name: "ตารางราคา" }).click();
    await expect(page).toHaveURL(/\/products\/corrugated\?view=table/);
    await expect(page.getByRole("table", { name: "ตารางราคาเริ่มต้น" })).toBeVisible();
  });

  test("no horizontal scroll on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHydrated(page, `${HOSTS.customer}/products`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
