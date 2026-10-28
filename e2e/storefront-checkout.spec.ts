import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_BUYER_PHONE, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, signInAsStaff } from "./helpers/session";
import { choiceList } from "./helpers/select";

/**
 * F3 3.3 end to end: two items in the cart, one split across two addresses; a coupon and points;
 * the 50/50 schedule; the QR deposit settled by the (mocked) gateway webhook; a slip Finance
 * approves in the back office; the 2C2P return; re-pricing confirmed; the instalment centre.
 * Against the mock API, whose orders are the back office's own rows. Signed in as the mock's
 * `buyer`, so no parallel test shares this cart.
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
  // The quantity step's tier cards (C4-7): "3,000 ฿x/ชิ้น".
  await page
    .getByRole("radiogroup", { name: "จำนวนที่ต้องการเปรียบเทียบ" })
    .getByRole("radio", { name: new RegExp(`^${quantity} `) })
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

/** Step 3 → step 4: review, accept the terms, confirm (checkout redesign Phase 1: no confirm dialog). */
async function confirmOrder(page: Page) {
  const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
  const next = summary.getByRole("button", { name: "ต่อไป: ทบทวนและยืนยัน" });
  if (await next.isVisible()) await next.click();
  const terms = page.getByRole("checkbox", { name: /ยอมรับข้อกำหนดการใช้งาน/ });
  if (!(await terms.isChecked())) await terms.check();
  await summary.getByRole("button", { name: "ยืนยันคำสั่งซื้อและชำระเงิน" }).click();
}

/** Stands in for the QR gateway's webhook (a mock-only endpoint, reached through the BFF). */
async function settle(page: Page, paymentId: string) {
  const response = await page.request.post(`${HOSTS.customer}/bff/v1/store/mock-gateway/payments/${paymentId}/settle`, {
    headers: { "x-getpack-csrf": "1", origin: HOSTS.customer },
  });
  expect(response.ok()).toBe(true);
}

test.describe.configure({ mode: "serial" });

test.describe("cart and checkout", () => {
  test("two items to two addresses, a coupon and points, 50/50, the QR deposit settled by the webhook", async ({
    page,
  }) => {
    test.slow();
    await signInAsCustomer(page, "/cart", MOCK_BUYER_PHONE);
    await emptyCart(page);
    await addBox(page, "1,000");
    await addBox(page, "2,000");

    await gotoHydrated(page, `${HOSTS.customer}/cart`);
    const lines = page.getByRole("list", { name: "รายการในตะกร้า" }).locator(":scope > li");
    await expect(lines).toHaveCount(2);

    // Step 1 asks for no address: "ดำเนินการต่อ" goes to step 2.
    await expect(page.getByText("ที่อยู่จัดส่งเลือกในขั้นถัดไป")).toBeVisible();
    await expectNoViolations(page);
    await page
      .getByRole("complementary", { name: "สรุปคำสั่งซื้อ" })
      .getByRole("link", { name: "ดำเนินการต่อ" })
      .click();
    await expect(page).toHaveURL(/\/checkout\?step=address/);
    await page.locator("html[data-hydrated]").waitFor();

    // Split the first line across the two saved addresses, 400 + 600 ("แบ่งส่งหลายที่อยู่").
    await page.getByRole("switch", { name: "แบ่งส่งหลายที่อยู่" }).click();
    const first = page.getByRole("region", { name: "ที่อยู่จัดส่ง" }).locator("li").first();
    await first.getByRole("button", { name: /แบ่งส่งหลายที่อยู่|แก้ไขการแบ่งส่ง/ }).click();
    await first.getByRole("spinbutton", { name: "จำนวน" }).fill("400");
    await first.getByRole("button", { name: "เพิ่มที่อยู่ปลายทาง" }).click();
    await choiceList(first, "ที่อยู่ที่ 2").click();
    await page.getByRole("option", { name: /โกดังเชียงใหม่/ }).click();
    await first.getByRole("spinbutton", { name: "จำนวน" }).nth(1).fill("600");
    await expect(first.getByText("รวม 1,000 จาก 1,000")).toBeVisible();
    await first.getByRole("button", { name: "บันทึกการแบ่งส่ง" }).click();
    await expect(first.getByText(/600 → ผู้รับทดสอบ \(เชียงใหม่\)/)).toBeVisible();
    await expectNoViolations(page);
    await page
      .getByRole("complementary", { name: "สรุปคำสั่งซื้อ" })
      .getByRole("button", { name: /^ต่อไป: ใบกำกับภาษี/ })
      .click();
    await expect(page).toHaveURL(/step=payment/);

    // A code is applied to the cart (store.cart.applyCode); the preview says what it took off.
    const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
    await page.getByRole("textbox", { name: "โค้ดส่วนลด" }).fill("getpack10");
    await page.getByRole("button", { name: "ใช้โค้ด" }).click();
    await expect(page.getByRole("list", { name: "โค้ดในตะกร้า" })).toContainText("GETPACK10ใช้ได้");
    await expect(summary).toContainText("ส่วนลด");

    await page.getByLabel(/^คะแนนที่ใช้/).fill("10");
    await expect(summary.getByText(/ใช้ 10 คะแนน ลด ฿/)).toBeVisible();

    // Above THB 20,000 the rules choose 50/50 (D-020); what is due today is the deposit.
    // CONTRACT-GAP store.checkout: the schedule is shown, not chosen.
    await expect(page.getByText(/มัดจำ 50%/).first()).toBeVisible();
    await expect(summary).toContainText("ชำระวันนี้");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoViolations(page);

    await summary.getByRole("button", { name: "ต่อไป: ทบทวนและยืนยัน" }).click();
    await expect(page.getByRole("region", { name: "ทบทวนคำสั่งซื้อ" })).toContainText("พร้อมเพย์ QR");
    await confirmOrder(page);

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
    await signInAsCustomer(page, "/cart", MOCK_BUYER_PHONE);
    await emptyCart(page);
    await addBox(page, "500");
    await gotoHydrated(page, `${HOSTS.customer}/checkout?step=payment`);
    await page.getByRole("radio", { name: /โอนเงินและแนบสลิป/ }).click();
    const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
    await expect(summary.getByRole("button", { name: "ต่อไป: ทบทวนและยืนยัน" })).toBeVisible();
    await confirmOrder(page);
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
    // Finance reviews it in its own sheet (D-061): the bank reference, then the group code retyped.
    // The group is read after the order: wait for its code before reading it.
    const header = staff.getByText(/· กลุ่ม [A-Z]/).first();
    await expect(header).toBeVisible();
    const headline = (await header.textContent())!;
    const group = headline.match(/กลุ่ม (\S+)/)![1]!;
    await staff.getByRole("main").getByRole("button", { name: "อนุมัติสลิป" }).first().click();
    const sheet = staff.getByRole("dialog", { name: `ตรวจสลิป ${group}` });
    await sheet.getByLabel(/^เลขอ้างอิงรายการจากธนาคาร/).fill(`E2E-CHECKOUT-${code}`);
    await sheet.getByRole("button", { name: "อนุมัติสลิป" }).click();
    const confirm = staff.getByRole("alertdialog", { name: "อนุมัติสลิปและรับชำระเงิน" });
    await confirm.getByLabel(new RegExp(`พิมพ์ ${group}`)).fill(group);
    await confirm.getByRole("button", { name: "อนุมัติสลิป" }).click();
    await expect(staff.getByRole("alertdialog")).toHaveCount(0);

    await gotoHydrated(page, payUrl);
    await expect(page.getByText("ชำระเงินสำเร็จ").first()).toBeVisible();
  });

  test("a card payment goes to the gateway and back", async ({ page }) => {
    await signInAsCustomer(page, "/cart", MOCK_BUYER_PHONE);
    await emptyCart(page);
    await addBox(page, "500");
    await gotoHydrated(page, `${HOSTS.customer}/checkout?step=payment`);
    await page.getByRole("radio", { name: /บัตรเครดิต\/เดบิต/ }).click();
    const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
    await expect(summary.getByRole("button", { name: "ต่อไป: ทบทวนและยืนยัน" })).toBeVisible();
    await confirmOrder(page);
    await page.getByRole("link", { name: "ไปหน้าชำระเงิน" }).click();
    await expect(page).toHaveURL(/\/checkout\/return\?payment=/);
    await expect(page.getByRole("heading", { level: 1, name: "ผลการชำระเงิน" })).toBeVisible();
    await expect(page.getByText("ชำระเงินสำเร็จ").first()).toBeVisible();
  });

  test("the order is kept when its payment cannot start: the customer lands on it with the pay button (round 2, B1)", async ({
    page,
  }) => {
    await signInAsCustomer(page, "/cart", MOCK_BUYER_PHONE);
    await emptyCart(page);
    await addBox(page, "500");
    await gotoHydrated(page, `${HOSTS.customer}/checkout?step=payment`);
    // The payment gateway refuses once; every key the page sends must be a UUID (the API's rule).
    const keys: string[] = [];
    await page.route("**/bff/v1/store/order-groups/*/payments", async (route) => {
      keys.push(route.request().headers()["idempotency-key"] ?? "");
      await route.fulfill({
        status: 502,
        contentType: "application/problem+json",
        body: JSON.stringify({
          type: "about:blank",
          title: "Bad gateway",
          status: 502,
          code: "payments.provider_error",
        }),
      });
    });
    await confirmOrder(page);
    await expect(page).toHaveURL(/\/account\/orders.*payment=not_started/);
    await expect(page.getByText("สร้างคำสั่งซื้อแล้ว แต่ยังเริ่มชำระเงินไม่สำเร็จ")).toBeVisible();
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys)
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await page.unroute("**/bff/v1/store/order-groups/*/payments");
  });

  test("a price that moved after review is shown old and new, and confirmed again", async ({ page }) => {
    await signInAsCustomer(page, "/cart", MOCK_BUYER_PHONE);
    await emptyCart(page);
    await addBox(page, "500");
    await addBox(page, "1,000");
    await gotoHydrated(page, `${HOSTS.customer}/checkout?step=payment`);
    const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
    await expect(summary.getByRole("button", { name: "ต่อไป: ทบทวนและยืนยัน" })).toBeVisible();

    // Another tab removes a line after this page was priced.
    const cart = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/cart`)).json();
    const removed = await page.request.delete(`${HOSTS.customer}/bff/v1/store/cart/items/${cart.items[0].id}`, {
      headers: { "x-getpack-csrf": "1", origin: HOSTS.customer },
    });
    expect(removed.ok()).toBe(true);

    await confirmOrder(page);
    await expect(summary.getByText("ราคาเปลี่ยนไป")).toBeVisible();
    await expect(summary).toContainText(/ยอดรวมเปลี่ยนจาก ฿[\d,.]+ เป็น ฿[\d,.]+/);
    await expect(page).toHaveURL(`${HOSTS.customer}/checkout?step=review`);

    await confirmOrder(page);
    await expect(page).toHaveURL(/\/checkout\/pay\//);
  });

  test("the customer picks the payment schedule", async ({ page }) => {
    test.fixme(
      true,
      "CONTRACT-GAP store.checkout — scheduleKey stays requested (proposed rejection); the rules choose",
    );
    await signInAsCustomer(page, "/checkout", MOCK_BUYER_PHONE);
    await expect(page.getByRole("radio", { name: /มัดจำ 50%/ })).toBeChecked();
  });

  test("a new address is added at the address step", async ({ page }) => {
    await signInAsCustomer(page, "/cart", MOCK_BUYER_PHONE);
    await emptyCart(page);
    await addBox(page, "500");
    await gotoHydrated(page, `${HOSTS.customer}/checkout?step=address`);
    const box = page.getByRole("region", { name: "ที่อยู่จัดส่ง" });
    await box.getByRole("button", { name: "เพิ่มที่อยู่ใหม่" }).click();
    await box.getByLabel(/^ชื่อที่อยู่/).fill("หน้าร้าน e2e");
    await box.getByLabel(/^ชื่อผู้รับ/).fill("ผู้รับหน้าร้าน");
    await box.getByLabel(/^เบอร์ผู้รับ/).fill("0812345678");
    await box.getByLabel(/^รหัสไปรษณีย์/).fill("20000");
    await expect(choiceList(box, /^แขวง\/ตำบล/)).toContainText("ชลบุรี");
    await box.getByLabel(/^บ้านเลขที่ อาคาร ถนน/).fill("5 ถนนทดสอบ");
    await expectNoViolations(page);
    await box.getByRole("button", { name: "บันทึกที่อยู่" }).click();
    // Saved, chosen, and every line ships there (one address, no allocation table).
    await expect(box.getByRole("radio", { name: /หน้าร้าน e2e/ })).toBeChecked();
  });

  test("form errors move focus to the first invalid field", async ({ page }) => {
    await signInAsCustomer(page, "/cart", MOCK_BUYER_PHONE);
    await emptyCart(page);
    await addBox(page, "500");
    await gotoHydrated(page, `${HOSTS.customer}/checkout?step=address`);
    const box = page.getByRole("region", { name: "ที่อยู่จัดส่ง" });
    await box.getByRole("button", { name: "เพิ่มที่อยู่ใหม่" }).click();
    await box.getByRole("button", { name: "บันทึกที่อยู่" }).click();
    await expect(box.getByLabel(/^ชื่อที่อยู่/)).toBeFocused();
  });

  test("a tax invoice profile needs a valid tax id", async ({ page }) => {
    await signInAsCustomer(page, "/cart", MOCK_BUYER_PHONE);
    await emptyCart(page);
    await addBox(page, "500");
    await gotoHydrated(page, `${HOSTS.customer}/checkout?step=payment`);
    await page.getByRole("switch", { name: "ขอใบกำกับภาษีเต็มรูปแบบ" }).click();
    const form = page.getByRole("region", { name: "ข้อมูลใบกำกับภาษี" });
    const add = form.getByRole("button", { name: "เพิ่มข้อมูลใบกำกับภาษี" });
    if (await add.isVisible()) await add.click();
    await form.getByLabel(/^ชื่อที่พิมพ์ในใบกำกับภาษี/).fill("บริษัท ทดสอบ จำกัด");
    await form.getByLabel(/^เลขประจำตัวผู้เสียภาษี/).fill("1234567890123");
    const same = form.getByRole("checkbox", { name: "ใช้ที่อยู่เดียวกับที่อยู่จัดส่ง" });
    if ((await same.count()) > 0 && (await same.isChecked())) await same.uncheck();
    await form.getByLabel(/^รหัสไปรษณีย์/).fill("10110");
    await expect(form.getByRole("button", { name: /^แขวง\/ตำบล/ })).toContainText("คลองเตย");
    await form.getByLabel(/^ที่อยู่ตามทะเบียน/).fill("1 ถนนทดสอบ");
    await form.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(form.getByText("เลขประจำตัวผู้เสียภาษี 13 หลักไม่ถูกต้อง")).toBeVisible();
    // Focus moved to the field with the error.
    await expect(form.getByLabel(/^เลขประจำตัวผู้เสียภาษี/)).toBeFocused();
    // A valid one (its checksum digit is 7): saved and chosen for the invoice — the full tax id shown (DECISIONS §3).
    await form.getByLabel(/^เลขประจำตัวผู้เสียภาษี/).fill("0105556000017");
    await form.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByRole("radio", { name: /บริษัท ทดสอบ จำกัด/ })).toBeChecked();
    await page
      .getByRole("complementary", { name: "สรุปคำสั่งซื้อ" })
      .getByRole("button", { name: "ต่อไป: ทบทวนและยืนยัน" })
      .click();
    await expect(page.getByRole("region", { name: "ทบทวนคำสั่งซื้อ" })).toContainText(
      "บริษัท ทดสอบ จำกัด · 0-1055-56000-01-7",
    );
  });
});
