import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * C1f (owner 2026-10-28 13:58, D-451, DECISIONS-STAGE-A §14.7) — the customer file access log page against the MSW
 * mock: Superadmin and Auditor read it with its filters and the typed reasons; a role without
 * `customer_file_access_logs.read` has no menu entry. Written in the cloud run and not run there (admin.localhost
 * does not resolve; owner rule 12:32: e2e later).
 */
test.describe("customer file access log", () => {
  test("a Superadmin filters to accesses opened with a typed reason and reads the reason", async ({ page }) => {
    await signInAsStaff(page, "superadmin");
    await gotoHydrated(page, `${HOSTS.admin}/customer-file-access-logs`);
    await expect(page.getByRole("heading", { level: 1, name: "บันทึกการเปิดไฟล์ลูกค้า" })).toBeVisible();
    const table = page.getByRole("table", { name: "บันทึกการเปิดไฟล์ลูกค้า" });
    await expect(table.getByRole("row")).not.toHaveCount(1);

    // A Radix Select (`src/ui` Select), not a native <select>.
    await page.getByLabel("ชนิดไฟล์").click();
    await page.getByRole("option", { name: "ซูเปอร์แอดมินเปิดพร้อมเหตุผล" }).click();
    await expect(page).toHaveURL(/kind=reason/);
    await expect(table.getByText("ระบุเหตุผล").first()).toBeVisible();
    await expect(table.getByText("ตรวจไฟล์ต้นฉบับตามคำขอลูกค้า (ข้อมูลจำลอง)")).toBeVisible();

    await table
      .getByRole("button", { name: /ดูรายละเอียดการเปิดไฟล์/ })
      .first()
      .click();
    const sheet = page.getByRole("dialog", { name: "รายละเอียดการเปิดไฟล์" });
    await expect(sheet).toContainText("เหตุผลที่ระบุ");

    await page.keyboard.press("Escape");
    await page.getByLabel("คำสั่งซื้อ").fill("DEVOR-2610-00003");
    await expect(page).toHaveURL(/orderCode=DEVOR-2610-00003/);
    await expect(page.getByRole("button", { name: "ส่งออก" })).toBeVisible();
  });

  test("the Auditor reads it from the menu; Prepress has no entry", async ({ page }) => {
    await signInAsStaff(page, "auditor");
    await gotoHydrated(page, `${HOSTS.admin}/`);
    // The sidebar groups fold (AdminSidebar); the entry is under "ระบบ".
    const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
    await nav.getByRole("button", { name: "ระบบ" }).click();
    await nav.getByRole("link", { name: "บันทึกการเปิดไฟล์ลูกค้า" }).click();
    await expect(page).toHaveURL(/\/customer-file-access-logs$/);

    await signInAsStaff(page, "prepress");
    await gotoHydrated(page, `${HOSTS.admin}/`);
    await expect(
      page
        .getByRole("navigation", { name: "เมนูหลัก" })
        .getByRole("link", { name: "บันทึกการเปิดไฟล์ลูกค้า", includeHidden: true }),
    ).toHaveCount(0);
  });
});
