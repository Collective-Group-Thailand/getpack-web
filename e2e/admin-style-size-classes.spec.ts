import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * C1e (owner decisions 2026-10-28 12:07, DECISIONS-STAGE-A §13, D-450) — size classes in the fit-range backfill and
 * uploaded files in the trust-section editor, against the MSW mock. Written in the cloud run and not run there
 * (admin.localhost does not resolve; owner rule 12:32: e2e later).
 */

test.describe("fit-range backfill by size class (§13.2)", () => {
  test("the dry run shows the coverage of applicable styles and lists the not-applicable ones", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/style-library/fit-ranges`);
    await expect(page.getByText("การอ่านขนาดตามประเภทสินค้า")).toBeVisible();
    await page.getByRole("button", { name: "ตรวจสอบก่อน (ยังไม่บันทึก)" }).click();
    await expect(page.getByText("แบบที่ค้นหาด้วยขนาดได้")).toBeVisible();
    const notApplicable = page.getByTestId("fit-not-applicable");
    await expect(notApplicable).toContainText("PK-SP-12");
    // The cleared range shows as a change with its new size reading.
    await expect(page.getByRole("row", { name: /PK-SP-12/ })).toContainText("ล้างช่วงขนาด");
    await expect(page.getByRole("row", { name: /PK-SP-12/ })).toContainText("ไม่ใช้กับการค้นหาด้วยขนาด");
  });
});

test.describe("trust-section files (§13.3)", () => {
  test("photos take an uploaded picture; documents an upload or an external https link", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/style-library/content`);
    await page.getByRole("button", { name: "เพิ่มรูป" }).click();
    const photo = page.locator('[data-row="photo"]').first();
    await expect(photo.getByRole("button", { name: "เลือกไฟล์" })).toBeVisible();
    await expect(photo.getByRole("textbox", { name: /^รูป/ })).toHaveCount(0);

    await page.getByRole("button", { name: "เพิ่มใบรับรอง" }).click();
    const certificate = page.locator('[data-row="certification"]').first();
    await certificate.getByRole("radio", { name: "ลิงก์ภายนอก" }).click();
    await certificate.getByRole("textbox", { name: "ลิงก์ภายนอกของเอกสาร" }).fill("https://issuer.example/c.pdf");
    await certificate.getByRole("radio", { name: "อัปโหลดไฟล์" }).click();
    await expect(certificate.getByRole("button", { name: "เลือกไฟล์" })).toBeVisible();
  });
});
