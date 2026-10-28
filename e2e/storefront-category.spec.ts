import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * The category page (Stage C · C2, category redesign Phase 1) on the mock backend: the head with facts from the
 * API and the sibling chips (no "1 · ประเภท" counts), the sticky section bar built from the sections that render,
 * rows ⇄ the comparison table, the standard-size finder (fit rule +0.5 cm per dimension, L/W turn, `size=` in the
 * URL, "สั่งเบอร์ X" → the configurator on that size), the flute guide, "ต้องการแบบอื่น", a quote-only category
 * without prices, and no horizontal scroll on a phone.
 */
const CATEGORY = `${HOSTS.customer}/products/corrugated`;
const price = /฿[\d,]+\.\d{2}/;

test.describe("the category page", () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test("head: breadcrumb, facts, sibling chips and the section bar", async ({ page }) => {
    await gotoHydrated(page, CATEGORY);
    await expect(page.getByRole("heading", { level: 1, name: "กล่องกระดาษลูกฟูก" })).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "เส้นทางนำทาง" });
    await expect(crumbs.getByRole("link", { name: "สินค้าและราคา" })).toHaveAttribute("href", "/products");
    const facts = page.getByRole("list", { name: "ข้อมูลสรุปของหมวด" });
    await expect(facts.getByText(/เริ่มต้น \(รวม VAT/)).toBeVisible();
    await expect(facts.getByText("ราคาทันทีทุกรายการ")).toBeVisible();
    const siblings = page.getByRole("navigation", { name: "หมวดอื่น" });
    await expect(siblings.getByRole("link", { name: "กล่องกระดาษลูกฟูก" })).toHaveAttribute("aria-current", "page");
    await expect(siblings.getByText(/ประเภท/)).toHaveCount(0);
    const bar = page.getByRole("navigation", { name: "ส่วนของหน้า" });
    for (const name of ["สินค้าในหมวดนี้", "หาเบอร์กล่อง", "เลือกลอน", "สั่งผลิตตามสเปก"])
      await expect(bar.getByRole("link", { name })).toBeVisible();
  });

  test("rows ⇄ comparison table", async ({ page }) => {
    await gotoHydrated(page, CATEGORY);
    const list = page.locator("#list");
    await expect(list.getByRole("link", { name: "ปรับแต่งและดูราคา" }).first()).toHaveAttribute(
      "href",
      /^\/configure\//,
    );
    await list.getByRole("link", { name: "ตารางเปรียบเทียบ" }).click();
    await expect(page).toHaveURL(/view=table/);
    const table = page.getByRole("table", { name: "ตารางเปรียบเทียบสินค้าในหมวด" });
    await expect(table.getByRole("rowheader", { name: "ราคาเริ่มต้น" })).toBeVisible();
    await expect(table.getByText(price).first()).toBeVisible();
  });

  test("size finder: recommends, keeps the size in the URL and opens the configurator on it", async ({ page }) => {
    await gotoHydrated(page, CATEGORY);
    const finder = page.locator("#sizes");
    await finder.getByLabel("ยาว (ซม.)").fill("25");
    await finder.getByLabel("กว้าง (ซม.)").fill("17");
    await finder.getByLabel("สูง (ซม.)").fill("7");
    await expect(finder.getByText(/แนะนำเบอร์ C/)).toBeVisible();
    await expect(page).toHaveURL(/size=C/);
    await expect(finder.getByRole("link", { name: "สั่งเบอร์ C" })).toHaveAttribute("href", /size=C/);
    await finder.getByLabel("สูง (ซม.)").fill("90");
    await expect(finder.getByText("ไม่มีเบอร์มาตรฐานที่ใส่ได้")).toBeVisible();
    await finder.getByRole("button", { name: /^เบอร์ A:/ }).click();
    await expect(page).toHaveURL(/size=A/);
  });

  test("a quote-only category shows no price and asks for a quotation", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/products/rigid-box`);
    await expect(page.getByRole("list", { name: "ข้อมูลสรุปของหมวด" }).getByText("ภายในวันทำการ")).toBeVisible();
    await expect(page.locator("#list").getByText(price)).toHaveCount(0);
    await expect(page.locator("#list").getByRole("button", { name: /เพิ่ม .* ในใบขอราคา/ })).toBeVisible();
    await expect(page.locator("#sizes")).toHaveCount(0);
  });

  test("no horizontal scroll on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/products/corrugated", "/products/corrugated?view=table", "/products/rigid-box"]) {
      await gotoHydrated(page, `${HOSTS.customer}${path}`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        path,
      ).toBeLessThanOrEqual(0);
    }
  });
});
