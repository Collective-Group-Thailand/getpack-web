import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F2 2.5 — catalogue and CMS, against the stateful mock of packio-api B2.1's published tables.
 * Each test that changes state uses its own rows or names (the mock keeps state for the run).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function expectAxeClean(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

async function choose(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).first().click();
}

test.describe("the catalogue", () => {
  test("opens as a map of its tables, grouped", async ({ page }) => {
    await signInAsStaff(page, "admin");
    await gotoHydrated(page, `${HOSTS.admin}/catalogue`);
    await expect(page.getByRole("heading", { name: "วัสดุและงานตกแต่ง" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^ประเภทสินค้า/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^นำเข้าและส่งออก Excel/ })).toBeVisible();
    await expectAxeClean(page);
  });

  test("a material is added, then edited under its ETag; a duplicate code is refused on the field", async ({
    page,
  }) => {
    await signInAsStaff(page, "admin");
    await gotoHydrated(page, `${HOSTS.admin}/catalogue/materials`);
    const code = `e2e-board-${Date.now().toString(36)}`;

    await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    let sheet = page.getByRole("dialog", { name: "เพิ่มในวัสดุ" });
    await sheet.getByRole("textbox", { name: /^รหัส/ }).fill(code);
    await choose(page, /^ชนิด/, /^กระดาษแข็ง$/);
    await sheet.getByRole("textbox", { name: /^ชื่อ(?! \()/ }).fill("บอร์ดทดสอบ");
    await sheet.getByRole("textbox", { name: /^ชื่อ \(อังกฤษ\)/ }).fill("Test board");
    await sheet.getByRole("spinbutton", { name: /^แกรม/ }).fill("320");
    await expectAxeClean(page);
    await sheet.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const table = page.getByRole("table", { name: "วัสดุ" });
    await expect(table).toContainText(code);

    await page.getByRole("button", { name: `แก้ไข ${code}` }).click();
    sheet = page.getByRole("dialog", { name: `แก้ไข ${code}` });
    await sheet.getByRole("textbox", { name: /^ชื่อ(?! \()/ }).fill("บอร์ดทดสอบ (แก้ไข)");
    await sheet.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(table).toContainText("บอร์ดทดสอบ (แก้ไข)");

    await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    sheet = page.getByRole("dialog", { name: "เพิ่มในวัสดุ" });
    await sheet.getByRole("textbox", { name: /^รหัส/ }).fill(code);
    await choose(page, /^ชนิด/, /^กระดาษ$/);
    await sheet.getByRole("textbox", { name: /^ชื่อ(?! \()/ }).fill("ซ้ำ");
    await sheet.getByRole("textbox", { name: /^ชื่อ \(อังกฤษ\)/ }).fill("Duplicate");
    await sheet.getByRole("button", { name: "บันทึก" }).click();
    await expect(sheet).toContainText("ซ้ำกับรายการที่มีอยู่");
  });

  test("a CS agent reads the catalogue but is offered no edits", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/catalogue/materials`);
    await expect(page.getByRole("table", { name: "วัสดุ" })).toContainText("art-card-350");
    await expect(page.getByRole("button", { name: "เพิ่ม", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^แก้ไข / })).toHaveCount(0);
  });
});

test.describe("quote mode (D-100)", () => {
  test("instant is refused where no calculator has shipped; RFQ is a reasoned change", async ({ page }) => {
    await signInAsStaff(page, "admin");
    await gotoHydrated(page, `${HOSTS.admin}/catalogue/product-types`);
    const table = page.getByRole("table", { name: "ประเภทสินค้า" });

    await table
      .getByRole("row", { name: /rigid_box/ })
      .getByRole("button", { name: "เปิดราคาทันที" })
      .click();
    let dialog = page.getByRole("alertdialog", { name: "เปิดราคาทันที" });
    await dialog.getByLabel(/^เหตุผล/).fill("ทดลองเปิดราคา");
    await dialog.getByLabel(/พิมพ์ rigid_box/).fill("rigid_box");
    await dialog.getByRole("button", { name: "เปลี่ยน" }).click();
    await expect(page.getByText("ยังไม่มีเครื่องคำนวณราคาสำหรับประเภทนี้").first()).toBeVisible();
    await dialog.getByRole("button", { name: "ยกเลิก" }).click();

    await table
      .getByRole("row", { name: /label_sticker/ })
      .getByRole("button", { name: "เปลี่ยนเป็นขอใบเสนอราคา" })
      .click();
    dialog = page.getByRole("alertdialog", { name: "เปลี่ยนเป็นขอใบเสนอราคา" });
    await dialog.getByLabel(/^เหตุผล/).fill("โรงงานฉลากหยุดรับงานชั่วคราว");
    await dialog.getByLabel(/พิมพ์ label_sticker/).fill("label_sticker");
    await dialog.getByRole("button", { name: "เปลี่ยน" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(table.getByRole("row", { name: /label_sticker/ })).toContainText("ขอใบเสนอราคา");
  });
});

test.describe("Excel import (D-005)", () => {
  test("a workbook is previewed, then confirmed exactly as previewed", async ({ page }) => {
    await signInAsStaff(page, "admin");
    await gotoHydrated(page, `${HOSTS.admin}/catalogue/import?kind=stock_products`);
    await expect(page.getByText("ชีต stock_products").first()).toBeVisible();
    await expectAxeClean(page);

    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "stock.xlsx", mimeType: XLSX, buffer: Buffer.from("PK") });
    await expect(page.getByRole("heading", { name: "ผลการตรวจก่อนนำเข้า" })).toBeVisible();
    await page.getByRole("button", { name: "นำเข้าตามผลตรวจนี้" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "นำเข้าตามผลตรวจนี้" }).click();
    await expect(page.getByText("นำเข้าเรียบร้อย")).toBeVisible();
  });

  test("a workbook with invalid rows cannot be confirmed", async ({ page }) => {
    await signInAsStaff(page, "admin");
    await gotoHydrated(page, `${HOSTS.admin}/catalogue/import?kind=materials`);
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "materials-error.xlsx", mimeType: XLSX, buffer: Buffer.from("PK") });
    await expect(page.getByText("มี 2 แถวที่ผิดพลาด")).toBeVisible();
    await expect(page.getByText("รหัสซ้ำกับแถวที่ 4")).toBeVisible();
    await expect(page.getByRole("button", { name: "นำเข้าตามผลตรวจนี้" })).toHaveCount(0);
  });
});

test.describe("site content", () => {
  test("home sections move up and down, and the order is saved", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/cms/home-sections`);
    const table = page.getByRole("table", { name: "ส่วนของหน้าแรก" });
    await expect(table.getByRole("row").nth(1)).toContainText("สินค้าขายดี");
    await page.getByRole("button", { name: "เลื่อน ประเภทบรรจุภัณฑ์ ขึ้น" }).click();
    await expect(page.getByText("บันทึกลำดับแล้ว")).toBeVisible();
    await expect(table.getByRole("row").nth(1)).toContainText("ประเภทบรรจุภัณฑ์");
  });

  test("an article is written in the rich text editor and saved", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/cms/articles/new`);
    const slug = `e2e-article-${Date.now().toString(36)}`;
    await page.getByRole("textbox", { name: /^ชื่อเรื่อง/ }).fill("บทความทดสอบ");
    await page.getByRole("textbox", { name: /^Slug/ }).fill(slug);
    const body = page.getByRole("textbox", { name: "เนื้อหาภาษาไทย" });
    await body.click();
    await page.getByRole("button", { name: "หัวข้อใหญ่" }).click();
    await expect(body).toBeFocused();
    await expect(body.locator("h2")).toHaveCount(1);
    await page.keyboard.type("หัวข้อแรก");
    await page.keyboard.press("Enter");
    await page.keyboard.type("ย่อหน้าแรกของบทความ");
    await expect(body.locator("h2")).toHaveText("หัวข้อแรก");
    await expectAxeClean(page);

    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page).toHaveURL(/\/cms\/articles\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("บทความทดสอบ");
    await expect(page.getByRole("textbox", { name: "เนื้อหาภาษาไทย" })).toContainText("ย่อหน้าแรกของบทความ");
  });

  test("the article form refuses a slug that is not a URL slug", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/cms/articles/new`);
    await page.getByRole("textbox", { name: /^ชื่อเรื่อง/ }).fill("บทความ");
    await page.getByRole("textbox", { name: /^Slug/ }).fill("Not A Slug");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("ใช้ตัวพิมพ์เล็ก ตัวเลข และขีดกลางเท่านั้น")).toBeVisible();
    await expect(page).toHaveURL(/\/cms\/articles\/new$/);
  });
});

test.describe("every 2.5 screen is axe-clean", () => {
  const screens: [string, string][] = [
    ["admin", "/catalogue/product-types"],
    ["admin", "/catalogue/standard-sizes"],
    ["admin", "/catalogue/subdistricts"],
    ["marketing", "/cms"],
    ["marketing", "/cms/banners"],
    ["marketing", "/cms/articles"],
    ["marketing", "/cms/seo-pages"],
  ];
  for (const [persona, path] of screens) {
    test(`${path} (${persona})`, async ({ page }) => {
      await signInAsStaff(page, persona as "admin");
      await gotoHydrated(page, `${HOSTS.admin}${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectAxeClean(page);
    });
  }
});
