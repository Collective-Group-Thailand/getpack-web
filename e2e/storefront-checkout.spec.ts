import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F3 3.3 end to end: two items in the cart, one split across two addresses; a coupon and points;
 * the 50/50 schedule; the QR deposit settled by the (mocked) gateway webhook; a slip Finance
 * approves in the back office; the 2C2P return; re-pricing confirmed; the instalment centre.
 * Against the mock API, whose orders are the back office's own rows.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });

/** Configures a tuck-end box at `quantity` and puts it in the cart. */
async function addBox(page: Page, quantity: string) {
  await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
  await dock(page)
    .getByRole("table", { name: "ราคาต่อจำนวน" })
    .getByRole("button", { name: new RegExp(`เลือก\\S*\\s*${quantity} ชิ้น`) })
    .click();
  await expect(dock(page)).toContainText(`${quantity} ชิ้น`);
  await dock(page).getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await expect(page.getByText("เพิ่มกล่องฝาเสียบลงตะกร้าแล้ว")).toBeVisible();
}

/** Empties whatever an earlier test left in the shared mock cart. */
async function emptyCart(page: Page) {
  await gotoHydrated(page, `${HOSTS.customer}/cart`);
  const remove = page.getByRole("button", { name: /^นำออก/ });
  while ((await remove.count()) > 0) {
    const before = await remove.count();
    await remove.first().click();
    await expect(remove).toHaveCount(before - 1);
  }
}

/** Stands in for the QR gateway's webhook (a mock-only endpoint, reached through the BFF). */
async function settle(page: Page, paymentId: string) {
  const response = await page.request.post(`${HOSTS.customer}/bff/v1/store/mock-gateway/payments/${paymentId}/settle`, {
    headers: { "x-packio-csrf": "1", origin: HOSTS.customer },
  });
  expect(response.ok()).toBe(true);
}

test.describe.configure({ mode: "serial" });

test.describe("cart and checkout", () => {
  test("two items to two addresses, a coupon and points, 50/50, the QR deposit settled by the webhook", async ({
    page,
  }) => {
    test.slow();
    await signInAsCustomer(page, "/cart");
    await emptyCart(page);
    await addBox(page, "1,000");
    await addBox(page, "2,000");

    await gotoHydrated(page, `${HOSTS.customer}/cart`);
    const lines = page.getByRole("list", { name: "รายการในตะกร้า" }).locator(":scope > li");
    await expect(lines).toHaveCount(2);

    // Split the first line: add an address on the spot, then 400 + 600.
    const first = lines.first();
    await first.getByRole("button", { name: "แบ่งส่งหลายที่อยู่" }).click();
    await first.getByRole("button", { name: "เพิ่มที่อยู่ใหม่" }).click();
    const sheet = page.getByRole("dialog", { name: "เพิ่มที่อยู่ใหม่" });
    await sheet.getByLabel(/^ชื่อที่อยู่/).fill("โกดังเชียงใหม่ (ทดสอบ)");
    await sheet.getByLabel(/^ชื่อผู้รับ/).fill("ผู้รับทดสอบ");
    await sheet.getByLabel(/^เบอร์ผู้รับ/).fill("0899999999");
    await sheet.getByLabel(/^รหัสไปรษณีย์/).fill("50200");
    await sheet.getByRole("combobox", { name: "แขวง/ตำบล" }).click();
    await page.getByRole("option").first().click();
    await expect(sheet.getByText("เมืองเชียงใหม่ เชียงใหม่")).toBeVisible();
    await sheet.getByLabel(/^บ้านเลขที่/).fill("99 ถนนทดสอบ");
    await sheet.getByRole("button", { name: "บันทึกที่อยู่" }).click();
    await expect(sheet).toBeHidden();

    await first.getByRole("spinbutton", { name: "จำนวน" }).fill("400");
    await first.getByRole("button", { name: "เพิ่มที่อยู่ปลายทาง" }).click();
    await first.getByRole("combobox", { name: "ที่อยู่ที่ 2" }).click();
    await page.getByRole("option", { name: /โกดังเชียงใหม่/ }).click();
    await first.getByRole("spinbutton", { name: "จำนวน" }).nth(1).fill("600");
    await expect(first.getByText("รวม 1,000 จาก 1,000 ชิ้น")).toBeVisible();
    await first.getByRole("button", { name: "บันทึกการแบ่งส่ง" }).click();
    await expect(first.getByText(/400 ชิ้น → ผู้รับ/)).toBeVisible();
    await expect(first.getByText(/600 ชิ้น → ผู้รับทดสอบ \(เชียงใหม่\)/)).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole("link", { name: "ดำเนินการชำระเงิน" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "ชำระเงิน" })).toBeVisible();
    await page.locator("html[data-hydrated]").waitFor();
    // The split in the cart is the default: each line goes where it was set.
    await expect(page.getByRole("radio", { name: /ตามที่แบ่งไว้ในตะกร้า/ })).toBeChecked();
    await expect(page.getByText(/600 ชิ้น → ผู้รับทดสอบ · เชียงใหม่/)).toBeVisible();

    const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
    await page.getByLabel("โค้ดส่วนลด").fill("packio10");
    await page.getByRole("button", { name: "ใช้โค้ด" }).click();
    await expect(page.getByText(/PACKIO10 · ลด 10% ค่าสินค้า/)).toBeVisible();
    await expect(summary).toContainText("ส่วนลด");

    await page.getByRole("button", { name: "ใช้สูงสุด" }).click();
    await expect(page.getByText(/ใช้ [\d,]+ คะแนน ลด ฿/)).toBeVisible();
    await expect(summary).toContainText("คะแนนสะสม");

    // Above THB 20,000: 50/50 is offered and chosen; what is due today is half.
    await expect(page.getByRole("radio", { name: /มัดจำ 50%/ })).toBeChecked();
    await expect(summary).toContainText("ชำระวันนี้");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoViolations(page);

    await summary.getByRole("button", { name: /ยืนยันและชำระ/ }).click();
    const confirm = page.getByRole("alertdialog", { name: "ยืนยันคำสั่งซื้อ" });
    await expect(confirm).toContainText("พร้อมเพย์ QR");
    await confirm.getByRole("button", { name: "ยืนยันและชำระเงิน" }).click();

    await expect(page).toHaveURL(/\/checkout\/pay\//);
    await expect(page.getByRole("img", { name: /คิวอาร์โค้ดพร้อมเพย์ ยอด ฿/ })).toBeVisible();
    await expect(page.getByText(/QR ใช้ได้อีก \d+:\d{2} นาที/)).toBeVisible();
    await expect(page.getByText("รอชำระเงิน", { exact: true })).toBeVisible();
    await expectNoViolations(page);

    await settle(page, page.url().split("/").at(-1)!);
    await expect(page.getByText("ชำระเงินสำเร็จ").first()).toBeVisible({ timeout: 15_000 });

    // The instalment centre: the deposit paid with its receipt, the balance before shipping to come.
    await gotoHydrated(page, `${HOSTS.customer}/account/instalments`);
    const deposit = page.getByRole("row", { name: /มัดจำ 50%/ }).first();
    await expect(deposit).toContainText("ชำระแล้ว");
    await expect(deposit.getByRole("link", { name: /ใบเสร็จ/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /ส่วนที่เหลือก่อนจัดส่ง/ }).first()).toContainText("ก่อนจัดส่ง");
  });

  test("a slip that fails the automatic check waits for Finance, who approves it in the back office", async ({
    page,
    browser,
  }) => {
    test.slow();
    await signInAsCustomer(page, "/cart");
    await emptyCart(page);
    await addBox(page, "500");
    await gotoHydrated(page, `${HOSTS.customer}/checkout`);
    await page.getByRole("radio", { name: /โอนเงินและแนบสลิป/ }).click();
    const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
    await expect(summary.getByRole("button", { name: /ยืนยันและชำระ/ })).toBeEnabled();
    await summary.getByRole("button", { name: /ยืนยันและชำระ/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ยืนยันและชำระเงิน" }).click();
    await expect(page).toHaveURL(/\/checkout\/pay\//);

    await expect(page.getByRole("heading", { name: "โอนเงินเข้าบัญชี" })).toBeVisible();
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "slip.png", mimeType: "image/png", buffer: Buffer.from("fake-slip") });
    await page.getByLabel(/^ยอดที่โอน/).fill("100.00");
    await page.getByLabel("วันและเวลาที่โอน").fill("2026-09-27T10:30");
    await page.getByRole("button", { name: "ส่งสลิป" }).click();
    await expect(page.getByText("กำลังตรวจสอบสลิป")).toBeVisible();
    await expect(page.getByText(/ทีมการเงินจะตรวจสอบภายใน/)).toBeVisible();
    const payUrl = page.url();

    await gotoHydrated(page, `${HOSTS.customer}/account/instalments`);
    const code = (await page
      .getByRole("row", { name: /ชำระต่อ/ })
      .first()
      .getByRole("link")
      .first()
      .textContent())!.trim();

    const staff = await (await browser.newContext()).newPage();
    await signInAsStaff(staff, "finance");
    await gotoHydrated(staff, `${HOSTS.admin}/orders?q=${code}`);
    await staff.getByRole("link", { name: code }).first().click();
    await expect(staff.getByRole("heading", { level: 1 })).toHaveText(code);
    await gotoHydrated(staff, `${staff.url().split("?")[0]}?tab=payments`);
    await staff.getByRole("main").getByRole("button", { name: "อนุมัติสลิป" }).first().click();
    const dialog = staff.getByRole("alertdialog", { name: "อนุมัติสลิปนี้?" });
    await dialog.getByLabel(new RegExp(`พิมพ์ ${code}`)).fill(code);
    await dialog.getByRole("button", { name: "อนุมัติสลิป" }).click();
    await expect(staff.getByRole("alertdialog")).toHaveCount(0);

    await gotoHydrated(page, payUrl);
    await expect(page.getByText("ชำระเงินสำเร็จ").first()).toBeVisible();
  });

  test("a card payment goes to the gateway and back", async ({ page }) => {
    await signInAsCustomer(page, "/cart");
    await emptyCart(page);
    await addBox(page, "500");
    await gotoHydrated(page, `${HOSTS.customer}/checkout`);
    await page.getByRole("radio", { name: /บัตรเครดิต\/เดบิต/ }).click();
    const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
    await expect(summary.getByRole("button", { name: /ยืนยันและชำระ/ })).toBeEnabled();
    await summary.getByRole("button", { name: /ยืนยันและชำระ/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ยืนยันและชำระเงิน" }).click();
    await page.getByRole("link", { name: "ไปหน้าชำระเงิน" }).click();
    await expect(page).toHaveURL(/\/checkout\/return\?payment=/);
    await expect(page.getByRole("heading", { level: 1, name: "ผลการชำระเงิน" })).toBeVisible();
    await expect(page.getByText("ชำระเงินสำเร็จ").first()).toBeVisible();
  });

  test("a price that moved after review is shown old and new, and confirmed again", async ({ page }) => {
    await signInAsCustomer(page, "/cart");
    await emptyCart(page);
    await addBox(page, "500");
    await addBox(page, "1,000");
    await gotoHydrated(page, `${HOSTS.customer}/checkout`);
    const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
    await expect(summary.getByRole("button", { name: /ยืนยันและชำระ/ })).toBeEnabled();

    // Another tab removes a line after this page was priced.
    const cart = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/cart`)).json();
    const removed = await page.request.delete(`${HOSTS.customer}/bff/v1/store/cart/items/${cart.items[0].id}`, {
      headers: { "x-packio-csrf": "1", origin: HOSTS.customer },
    });
    expect(removed.ok()).toBe(true);

    await summary.getByRole("button", { name: /ยืนยันและชำระ/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ยืนยันและชำระเงิน" }).click();
    await expect(summary.getByText("ราคาเปลี่ยนไป")).toBeVisible();
    await expect(summary).toContainText(/ยอดรวมเปลี่ยนจาก ฿[\d,.]+ เป็น ฿[\d,.]+/);
    await expect(page).toHaveURL(`${HOSTS.customer}/checkout`);

    await summary.getByRole("button", { name: /ยืนยันและชำระ/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ยืนยันและชำระเงิน" }).click();
    await expect(page).toHaveURL(/\/checkout\/pay\//);
  });

  test("a tax invoice profile needs a valid tax id", async ({ page }) => {
    await signInAsCustomer(page, "/cart");
    await emptyCart(page);
    await addBox(page, "500");
    await gotoHydrated(page, `${HOSTS.customer}/checkout`);
    await page.getByRole("button", { name: "เพิ่มข้อมูลใบกำกับภาษี" }).click();
    const sheet = page.getByRole("dialog", { name: "เพิ่มข้อมูลใบกำกับภาษี" });
    await sheet.getByLabel(/^ชื่อบริษัท/).fill("บริษัท ทดสอบ จำกัด");
    await sheet.getByLabel(/^เลขประจำตัวผู้เสียภาษี/).fill("1234567890123");
    await sheet.getByLabel(/^ที่อยู่ตามทะเบียน/).fill("1 ถนนทดสอบ กรุงเทพมหานคร 10110");
    await sheet.getByRole("button", { name: "บันทึก" }).click();
    await expect(sheet.getByText(/เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง/)).toBeVisible();
    // A valid one (its checksum digit is 7): saved and chosen for the invoice.
    await sheet.getByLabel(/^เลขประจำตัวผู้เสียภาษี/).fill("0105556000017");
    await sheet.getByRole("button", { name: "บันทึก" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("radio", { name: /บริษัท ทดสอบ จำกัด/ })).toBeChecked();
    await expect(page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" })).toContainText(
      "ใบกำกับภาษีในนาม บริษัท ทดสอบ จำกัด",
    );
  });
});
