import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import {
  acceptCookies,
  completeSignIn,
  MOCK_DESIGNER_PHONE,
  MOCK_RECEIVER_PHONE,
  signInAsCustomer,
} from "./helpers/customer";
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
    // C2 (category Phase 1): up to eight items list as rows ⇄ the comparison table.
    await page.getByRole("link", { name: "ตารางเปรียบเทียบ" }).click();
    await expect(page).toHaveURL(/\/products\/corrugated\?view=table/);
    await expect(page.getByRole("table", { name: "ตารางเปรียบเทียบสินค้าในหมวด" })).toBeVisible();
  });

  test("no horizontal scroll on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/products", "/products?view=table", "/products/corrugated?view=table"]) {
      await gotoHydrated(page, `${HOSTS.customer}${path}`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        path,
      ).toBeLessThanOrEqual(0);
    }
  });

  /** C1c (DECISIONS-STAGE-A §11.7): the LINE hours are worded per locale from storefront.support_hours. */
  test("the LINE hours are written in the page's language", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/en/products`);
    await expect(page.getByText("chat with the team on LINE Daily, 09:00–18:00")).toBeVisible();
    await gotoHydrated(page, `${HOSTS.customer}/products`);
    await expect(page.getByText("คุยกับทีมทาง LINE ทุกวัน 09:00–18:00")).toBeVisible();
  });

  /** C1b (D-447 / DECISIONS-STAGE-A §10.2, §10.4, §10.5): stock items — mock data. */
  test("stock: the price at the minimum order, cart and quote tray side by side, out of stock without a cart", async ({
    page,
  }) => {
    await gotoHydrated(page, `${HOSTS.customer}/products?mode=stock`);
    const catalogue = page.locator("#catalog");
    const bottle = catalogue.getByRole("listitem").filter({ has: page.getByRole("link", { name: "ขวด PET 500 มล." }) });
    await expect(bottle).toContainText("สั่งขั้นต่ำ 100");
    await expect(bottle).toContainText("พร้อมส่ง");
    await expect(bottle.getByRole("button", { name: /ใส่ตะกร้า 100 ชิ้น/ })).toBeVisible();
    await expect(bottle.getByRole("button", { name: "เพิ่ม ขวด PET 500 มล. ในใบขอราคา" })).toBeVisible();

    const jar = catalogue.getByRole("listitem").filter({ has: page.getByRole("link", { name: "กระปุก PP 100 มล." }) });
    await expect(jar).toContainText("สินค้าหมด");
    await expect(jar.getByRole("button", { name: /ใส่ตะกร้า/ })).toHaveCount(0);
    await jar.getByRole("button", { name: "เพิ่ม กระปุก PP 100 มล. ในใบขอราคา" }).click();
    await expect(page.getByRole("region", { name: "ใบขอราคา" })).toContainText("1 รายการ");
  });

  /** C1b (D-447 §10.6): "ราคารวม VAT / ไม่รวม VAT" shows the API's own ex-VAT figure; inclusive by default. */
  test("the VAT switch shows each price with or without VAT", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/products?mode=stock`);
    const vat = page.getByRole("radiogroup", { name: "แสดงราคา" });
    await expect(vat.getByRole("radio", { name: "ราคารวม VAT" })).toHaveAttribute("aria-checked", "true");
    const bottle = page
      .locator("#catalog")
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: "ขวด PET 500 มล." }) });
    await expect(bottle.getByText("รวม VAT", { exact: true })).toBeVisible();
    await vat.getByRole("radio", { name: "ไม่รวม VAT" }).click();
    await expect(bottle.getByText("ไม่รวม VAT", { exact: true })).toBeVisible();
    await expect(bottle.getByText("รวม VAT", { exact: true })).toBeHidden();
    // Remembered in this browser.
    await page.reload();
    await expect(
      page.getByRole("radiogroup", { name: "แสดงราคา" }).getByRole("radio", { name: "ไม่รวม VAT" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  /** C1b (D-447 §10.9): signed in, the quote tray is the draft basket — products wait there for their form. */
  test("signed in, the quote tray is the draft basket and follows the account", async ({ page }) => {
    await signInAsCustomer(page, "/products?mode=quote", MOCK_DESIGNER_PHONE);
    const catalogue = page.locator("#catalog");
    await catalogue.getByRole("button", { name: "เพิ่ม กล่องแข็งฝาแม่เหล็ก ในใบขอราคา" }).click();
    await expect(page.getByRole("region", { name: "ใบขอราคา" })).toContainText("1 รายการ");
    // Not in this browser's storage: in the account's basket.
    expect(await page.evaluate(() => window.localStorage.getItem("pk_rfq_tray"))).toBeNull();
    await gotoHydrated(page, `${HOSTS.customer}/rfq/basket`);
    await expect(page.getByText("ยังไม่ได้กรอกรายละเอียด")).toBeVisible();
    await expect(page.getByRole("button", { name: /^ส่งคำขอ/ })).toBeDisabled();
    await page.getByRole("link", { name: "กรอกรายละเอียด" }).click();
    await expect(page).toHaveURL(/\/rfq\/.*from=magnetic-gift-box.*tray=1/);
    await expect(page.getByText("ใบขอราคา: รายการที่ 1 จาก 1")).toBeVisible();
  });

  test("a guest tray joins the basket at sign-in", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/products?mode=quote`);
    await page.locator("#catalog").getByRole("button", { name: "เพิ่ม ถุงกระดาษคราฟท์หูเกลียว ในใบขอราคา" }).click();
    await expect(page.getByRole("region", { name: "ใบขอราคา" })).toContainText("1 รายการ");
    await gotoHydrated(page, `${HOSTS.customer}/sign-in?returnTo=${encodeURIComponent("/products?mode=quote")}`);
    await completeSignIn(page, MOCK_RECEIVER_PHONE, "page");
    await expect(page).toHaveURL(/\/products\?mode=quote$/, { timeout: 15_000 });
    await expect(page.getByRole("region", { name: "ใบขอราคา" })).toContainText("1 รายการ", { timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("pk_rfq_tray") ?? "[]").length))
      .toBe(0);
  });
});
