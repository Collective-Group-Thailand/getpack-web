import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { runId, signInCustomer } from "./support";

/**
 * The storefront on the real API, as a guest and as a signed-in customer: the dev seed's catalogue
 * (`dev-tuck-end-box`, `dev-rsc-carton`), the account, and an address and a tax profile created on
 * the dev seed's one test area (postcode 99999, `[DEV] ตำบลทดสอบ`).
 */

const ERROR = /เกิดข้อผิดพลาด|Something went wrong|โหลดข้อมูลไม่สำเร็จ/;

test("a guest browses the catalogue to a product", async ({ page }) => {
  await page.goto(HOSTS.customer);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto(`${HOSTS.customer}/products`);
  await expect(page.getByText("[DEV] กล่องฝาเสียบทดสอบ").first()).toBeVisible();
  await page.goto(`${HOSTS.customer}/products/dev-tuck-end-box`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("[DEV] กล่องฝาเสียบทดสอบ");
  await expect(page.getByText(ERROR)).toHaveCount(0);
});

test("a signed-in customer reads the account, and adds and removes an address and a tax profile", async ({
  context,
  page,
}) => {
  await signInCustomer(context, runId("account"));
  for (const path of ["/account", "/account/orders", "/account/points", "/account/notifications"]) {
    await page.goto(`${HOSTS.customer}${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(ERROR)).toHaveCount(0);
  }

  await page.goto(`${HOSTS.customer}/account/addresses`);
  await page.locator("html[data-hydrated]").waitFor();
  await page.getByRole("button", { name: "เพิ่มที่อยู่" }).click();
  await page.getByLabel(/^ชื่อที่อยู่/).fill("โกดัง integration");
  await page.getByLabel(/^ชื่อผู้รับ/).fill("ผู้รับ integration");
  await page.getByLabel(/^เบอร์ผู้รับ/).fill("0812345678");
  await page.getByLabel(/^รหัสไปรษณีย์/).fill("99999");
  await expect(page.getByRole("combobox", { name: /^แขวง\/ตำบล/ })).toContainText("[DEV] ตำบลทดสอบ");
  await page.getByLabel(/^บ้านเลขที่ อาคาร ถนน/).fill("9 ถนนทดสอบ");
  await page.getByRole("button", { name: "บันทึกที่อยู่" }).click();
  const address = page.getByRole("listitem").filter({ hasText: "โกดัง integration" });
  await expect(address).toContainText("[DEV] จังหวัดทดสอบ");
  await expect(address).toContainText("99999");

  await page.getByRole("button", { name: "เพิ่มข้อมูลใบกำกับภาษี" }).click();
  await page.getByLabel(/^เลขประจำตัวผู้เสียภาษี/).fill("0105556000017");
  await page.getByLabel(/^ชื่อที่พิมพ์ในใบกำกับภาษี/).fill("บริษัท อินทิเกรชัน จำกัด");
  await page.getByLabel(/^รหัสไปรษณีย์/).fill("99999");
  await expect(page.getByRole("combobox", { name: /^แขวง\/ตำบล/ }).last()).toContainText("[DEV] ตำบลทดสอบ");
  await page.getByLabel(/^ที่อยู่ตามทะเบียน/).fill("1 ถนนทดสอบ");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  const profile = page.getByRole("listitem").filter({ hasText: "บริษัท อินทิเกรชัน จำกัด" });
  await expect(profile).toContainText("[DEV] จังหวัดทดสอบ");

  await profile.getByRole("button", { name: /^ลบ/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ลบ", exact: true }).click();
  await expect(profile).toHaveCount(0);
  await address.getByRole("button", { name: /^ลบ/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ลบ", exact: true }).click();
  await expect(address).toHaveCount(0);
});
