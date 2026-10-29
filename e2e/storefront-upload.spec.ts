import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, completeSignIn, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * C9 (upload redesign Phase 1 → 2, D-457) on the mock backend: `/studio/upload` is file-first — the drop zone and the
 * template downloader, then the check workspace and the spec & price card. The mock's check is obviously fake:
 * version 1 must fix its bleed, a corrected version passes.
 */
const PDF = { name: "box-artwork.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") };
const FIXED = { name: "box-artwork-v2.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") };

test.describe("upload page (C9)", () => {
  test.beforeEach(async ({ page }) => acceptCookies(page));

  test("shows the drop zone, the template downloader and the 12 checks; no horizontal scroll at 390", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHydrated(page, `${HOSTS.customer}/studio/upload`);
    await expect(page.getByRole("heading", { level: 1, name: "มีไฟล์แล้ว อัปโหลดเลย" })).toBeVisible();
    await expect(page.getByRole("button", { name: "อัปโหลดไฟล์ PDF หรือ AI" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ยังไม่มีไฟล์ที่ตรงแบบ?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ดาวน์โหลดแผ่นคลี่ PDF" })).toBeVisible();
    await expect(page.locator("#upload-checks ~ ol > li, section[aria-labelledby=upload-checks] li")).toHaveCount(12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("the drop zone opens the file dialog from the keyboard", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/studio/upload`);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "อัปโหลดไฟล์ PDF หรือ AI" }).focus();
    await page.keyboard.press("Enter");
    expect((await chooser).isMultiple()).toBe(true);
  });

  test("refuses a file that is not PDF or AI", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/studio/upload`);
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("png") });
    await expect(page.getByText("logo.png: รับเฉพาะไฟล์ PDF หรือ AI")).toBeVisible();
  });

  test("the template downloads as a PDF for the product and size chosen", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/studio/upload`);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "ดาวน์โหลดแผ่นคลี่ PDF" }).click();
    expect((await download).suggestedFilename()).toMatch(/^getpack-template-.+\.pdf$/);
  });

  test("a guest signs in over the page and the chosen file goes on uploading", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/studio/upload`);
    await page.locator('input[type="file"]').first().setInputFiles(PDF);
    await completeSignIn(page);
    // The sheet waits for its button once the code is in (the sign-in page submits on its own).
    const confirm = page
      .getByRole("dialog", { name: "เข้าสู่ระบบ" })
      .getByRole("button", { name: "ยืนยันและเข้าสู่ระบบ" });
    await confirm.click({ timeout: 10_000 }).catch(() => undefined);
    await expect(page).toHaveURL(/\?check=/, { timeout: 30_000 });
  });

  test("check → must fix blocks the cart → corrected version passes → in the cart with the file", async ({ page }) => {
    await signInAsCustomer(page, "/studio/upload");
    await page.locator('input[type="file"]').first().setInputFiles(PDF);
    await expect(page).toHaveURL(/\?check=/, { timeout: 30_000 });
    await expect(page.getByText("กำลังตรวจ box-artwork.pdf")).toBeVisible();
    await expect(page.getByText(/ไฟล์นี้คือ.+เบอร์ B/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /ระยะตัดตก/ }).first()).toHaveAttribute("aria-expanded", "true");
    const add = page.getByRole("button", { name: "เพิ่มลงตะกร้าพร้อมไฟล์" });
    await expect(add).toBeDisabled();
    await expect(page.getByText("แก้ข้อที่ต้องแก้ก่อน แล้วจึงเพิ่มลงตะกร้าได้")).toBeVisible();

    // A size that no longer matches the die lines: must fix, with "ใช้ขนาดตามไฟล์".
    await page.getByLabel("ขนาดที่สั่ง").selectOption("A");
    await expect(page.getByText("ไม่ตรงกับไฟล์")).toBeVisible();
    await page.getByRole("button", { name: "ใช้ขนาดตามไฟล์" }).first().click();
    await expect(page.getByText(/ไฟล์นี้คือ.+เบอร์ B/)).toBeVisible();

    // The corrected file: a new version, checked again, kept in the history.
    await page.locator('input[type="file"]').last().setInputFiles(FIXED);
    await expect(page.getByRole("button", { name: /^box-artwork-v2\.pdf/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("ไม่มีข้อที่ต้องแก้").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("ประวัติไฟล์ 2 รุ่น")).toBeVisible();

    await expect(add).toBeEnabled({ timeout: 30_000 });
    await add.click();
    await expect(page.getByText("เพิ่มลงตะกร้าพร้อมไฟล์แล้ว")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "ไปที่ตะกร้า" })).toBeVisible();
  });

  test("the workspace has no axe violations", async ({ page }) => {
    await signInAsCustomer(page, "/studio/upload");
    await page.locator('input[type="file"]').first().setInputFiles(PDF);
    await expect(page.getByText(/ไฟล์นี้คือ/)).toBeVisible({ timeout: 30_000 });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
});
