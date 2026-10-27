import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { DEV_INSTANT_PRODUCT, runId, signInCustomer, signInStaff } from "./support";

/**
 * The R1 launch path on the real API (D-110), one order end to end: a customer prices the
 * corrugated test product online, orders it by bank transfer with a slip, and Finance confirms the
 * payment if the automatic check left it for them (D-061). Later steps — artwork, proof,
 * production at F9001, shipping, receipt — continue the same order (serial) once getpack-api's dev
 * seed can carry an order through checkout (`api.dev-seed-launch-path`).
 */

test.describe.configure({ mode: "serial" });

const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });
const customerUid = runId("o2c");
let orderCode = "";
let payUrl = "";

test("a customer prices the carton online and adds it to the cart", async ({ context, page }) => {
  test.slow();
  await signInCustomer(context, customerUid);
  await page.goto(`${HOSTS.customer}/configure/${DEV_INSTANT_PRODUCT}`);
  await page.locator("html[data-hydrated]").waitFor();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The seed's product has no default quantity: the customer asks for 1,000.
  await page.getByLabel(/^จำนวนอื่น/).fill("1000");
  await page.getByRole("button", { name: "ดูราคา", exact: true }).click();

  // The price comes from getpack-api's calculator on F9001's price list.
  await expect(dock(page).getByText(/^฿[\d,]+\.\d{2} \/ ชิ้น$/)).toBeVisible({ timeout: 30_000 });
  await dock(page).getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await expect(page.getByText(/ลงตะกร้าแล้ว/)).toBeVisible({ timeout: 30_000 });
});

// CONTRACT-GAP api.dev-seed-launch-path — the dev seed has no shipping for any address (no zones,
// rates or delivery zones, and F9001's cannot be set: 500), so checkout stops at "no delivery route".
test.fixme("the customer checks out by bank transfer and sends a slip", async ({ context, page }) => {
  test.slow();
  await signInCustomer(context, customerUid);
  await page.goto(`${HOSTS.customer}/checkout`);
  await page.locator("html[data-hydrated]").waitFor();

  // A delivery address on the dev seed's one test area.
  const add = page.getByRole("button", { name: /เพิ่มที่อยู่/ }).first();
  if (await add.isVisible()) {
    await add.click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel(/^ชื่อที่อยู่/).fill("โกดัง o2c");
    await sheet.getByLabel(/^ชื่อผู้รับ/).fill("ผู้รับ o2c");
    await sheet.getByLabel(/^เบอร์ผู้รับ/).fill("0812345678");
    await sheet.getByLabel(/^รหัสไปรษณีย์/).fill("99999");
    await expect(sheet.getByRole("combobox", { name: /^แขวง\/ตำบล/ })).toContainText("[DEV] ตำบลทดสอบ");
    await sheet.getByLabel(/^บ้านเลขที่ อาคาร ถนน/).fill("9 ถนนทดสอบ");
    await sheet.getByRole("button", { name: /บันทึก/ }).click();
  }

  await page.getByRole("radio", { name: /โอนเงินและแนบสลิป/ }).click();
  const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
  await expect(summary.getByRole("button", { name: /ยืนยันและชำระ/ })).toBeEnabled({ timeout: 30_000 });
  await summary.getByRole("button", { name: /ยืนยันและชำระ/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ยืนยันและชำระเงิน" }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\//, { timeout: 30_000 });
  payUrl = page.url();

  await expect(page.getByRole("heading", { name: "โอนเงินเข้าบัญชี" })).toBeVisible();
  const amount = (await page
    .getByText(/^฿[\d,]+\.\d{2}$/)
    .first()
    .textContent())!.replace(/[฿,]/g, "");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "slip.png", mimeType: "image/png", buffer: Buffer.from("integration-slip") });
  await page.getByLabel(/^ยอดที่โอน/).fill(amount);
  await page.getByLabel("วันและเวลาที่โอน").fill(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 16));
  await page.getByRole("button", { name: "ส่งสลิป" }).click();
  await expect(page.getByText(/กำลังตรวจสอบสลิป|ชำระเงินสำเร็จ/).first()).toBeVisible({ timeout: 30_000 });

  await page.goto(`${HOSTS.customer}/account/orders`);
  const link = page.getByRole("link", { name: /PK|ORD|DEV/ }).first();
  await expect(link).toBeVisible();
  orderCode = (await link.textContent())!.trim();
});

// CONTRACT-GAP api.dev-seed-launch-path — follows the checkout above.
test.fixme("Finance confirms the slip if the automatic check left it for them, and the order is paid", async ({
  browser,
  context,
  page,
}) => {
  test.slow();
  await signInCustomer(context, customerUid);
  await page.goto(payUrl);
  if (await page.getByText("ชำระเงินสำเร็จ").first().isVisible()) return;

  const staff = await (await browser.newContext()).newPage();
  await signInStaff(staff, "finance");
  await staff.goto(`${HOSTS.admin}/finance/slips`);
  await staff.locator("html[data-hydrated]").waitFor();
  await staff
    .getByRole("link", { name: new RegExp(orderCode.replace(/[-]/g, "\\-")) })
    .first()
    .click();
  const approve = staff.getByRole("button", { name: "อนุมัติสลิป" }).first();
  await approve.click();
  await staff.getByLabel(/^เลขอ้างอิงรายการจากธนาคาร/).fill(runId("BANK"));
  await staff.getByRole("button", { name: "อนุมัติสลิป" }).last().click();
  const confirm = staff.getByRole("alertdialog");
  const group = (await confirm.textContent())!.match(/พิมพ์ (\S+)/)?.[1];
  if (group) await confirm.getByLabel(/พิมพ์/).fill(group);
  await confirm.getByRole("button", { name: "อนุมัติสลิป" }).click();
  await expect(staff.getByRole("alertdialog")).toHaveCount(0);

  await page.goto(payUrl);
  await expect(page.getByText("ชำระเงินสำเร็จ").first()).toBeVisible({ timeout: 30_000 });
});
