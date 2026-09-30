import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * F3 3.4 end to end: the account's overview, orders and one order's page (timeline, instalments,
 * documents, delivery), paying a due instalment from it, saved quotations reopened in the
 * configurator, the address book, notification preferences, consents and data requests, points,
 * referral and the wallet. The returning customer owns the first fake customer's orders, seeded
 * in every state.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

/** The first fake customer's seeded orders (`mocks/admin/commerce.ts`, one in every twelve). */
const COMPLETED_ORDER = "00000000-0000-4000-8000-6f7264000025";
const UNPAID_ORDER = "00000000-0000-4000-8000-6f7264000001";

test.describe("the account", () => {
  test("a guest is sent to sign in and brought back", async ({ page }) => {
    await acceptCookies(page);
    await page.goto(`${HOSTS.customer}/account/orders`);
    await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Faccount%2Forders/);
  });

  test("the overview lists what needs doing, and the orders list filters by where they stand", async ({ page }) => {
    await signInAsCustomer(page, "/account");
    await expect(page.getByRole("heading", { level: 1, name: /สวัสดี/ })).toBeVisible();
    const todo = page
      .getByRole("region", { name: "สิ่งที่ต้องทำ" })
      .or(page.locator("section[aria-labelledby=account-todo]"));
    await expect(todo.getByRole("link", { name: /ส่งไฟล์งาน/ }).first()).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole("navigation", { name: "บัญชีของฉัน" }).getByRole("link", { name: "คำสั่งซื้อ" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "คำสั่งซื้อของฉัน" })).toBeVisible();
    await page.getByRole("link", { name: "เสร็จสิ้น" }).click();
    await expect(page).toHaveURL(/view=completed/);
    await expect(page.getByText("PK-2569-00136").first()).toBeVisible();
    await expectNoViolations(page);
  });

  test("an order's page: timeline, instalments, documents as signed downloads, delivery, tracking", async ({
    page,
  }) => {
    await signInAsCustomer(page, `/account/orders/${COMPLETED_ORDER}`);
    await expect(page.getByText("PK-2569-00136").first()).toBeVisible();
    await expect(page.getByRole("list", { name: "ความคืบหน้า" }).getByText("ส่งถึงแล้ว")).toBeVisible();
    await expect(page.getByRole("list", { name: "ความคืบหน้า" }).getByText(/กำหนด/).first()).toBeVisible();
    await expect(page.getByText("ได้รับครบ 500 จาก 500 ชิ้น")).toBeVisible();
    await expect(page.getByRole("link", { name: "สั่งซ้ำ PK-2569-00136" })).toBeVisible();

    await page.getByRole("button", { name: /ขอลิงก์ดาวน์โหลด/ }).click();
    const open = page.getByRole("link", { name: /เปิดเอกสาร/ });
    await expect(open).toBeVisible();
    await expect(open).toHaveAttribute("href", /^data:/);

    await page.getByRole("link", { name: "ลิงก์ติดตามสถานะสำหรับแชร์" }).click();
    await expect(page).toHaveURL(/\/track\/trk/);
    await page.goBack();
    await expectNoViolations(page);
  });

  test("a due instalment is paid from the order page", async ({ page }) => {
    await signInAsCustomer(page, `/account/orders/${UNPAID_ORDER}`);
    await page.getByRole("button", { name: /ชำระงวดถัดไป/ }).click();
    const dialog = page.getByRole("dialog", { name: /ชำระ PK-2569-00100/ });
    await dialog.getByRole("radio", { name: /พร้อมเพย์ QR/ }).click();
    await dialog.getByRole("button", { name: "ไปชำระเงิน" }).click();
    await expect(page).toHaveURL(/\/checkout\/pay\//);
    await expect(page.getByRole("img", { name: /คิวอาร์โค้ดพร้อมเพย์/ })).toBeVisible();
  });

  test("a saved quotation is listed with its price and validity", async ({ page }) => {
    await signInAsCustomer(page, "/configure/tuck-end-box");
    const dock = page.getByRole("complementary", { name: "ราคาของคุณ" });
    await expect(dock.getByText(/\/ ชิ้น$/)).toBeVisible();
    await dock.getByRole("button", { name: "บันทึก" }).click();
    // A saved quotation has no code until it is shared or put in a PDF (store.quotes.save).
    await expect(page.getByText(/บันทึกใบเสนอราคาแล้ว ราคาคงที่ถึง/)).toBeVisible();

    await gotoHydrated(page, `${HOSTS.customer}/account/quotes`);
    await expect(page.getByText(/ราคาคงที่ถึง/).first()).toBeVisible();
    await expectNoViolations(page);
  });

  test("a saved quotation reopens in the configurator", async ({ page }) => {
    test.fixme(
      true,
      "CONTRACT-GAP store.catalog-product-ref — a saved quote names its product by id, and the catalogue has no read by id",
    );
    await signInAsCustomer(page, "/account/quotes");
    await page
      .getByRole("link", { name: /เปิดอีกครั้ง/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/configure\/tuck-end-box\?quote=/);
  });

  test("a saved address is edited under its ETag; a new one cannot be added yet", async ({ page }) => {
    await signInAsCustomer(page, "/account/addresses");
    const card = page.getByRole("listitem").filter({ hasText: "ที่อยู่หลัก" }).first();
    await card.getByRole("button", { name: /แก้ไข/ }).click();
    await page.getByLabel(/^รายละเอียดเพิ่มเติม/).fill("ชั้น 2 (e2e)");
    await page.getByRole("button", { name: "บันทึกที่อยู่" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "ชั้น 2 (e2e)" })).toBeVisible();
    await expectNoViolations(page);

    // CONTRACT-GAP store.geo-ids: the form says why instead of offering fields it cannot save.
    await page.getByRole("button", { name: "เพิ่มที่อยู่" }).click();
    await expect(page.getByText("ยังเพิ่มที่อยู่ใหม่ไม่ได้")).toBeVisible();
  });

  test("addresses and tax profiles are added and removed", async ({ page }) => {
    test.fixme(true, "CONTRACT-GAP store.geo-ids — no store geo read gives the province id an address needs");
    await signInAsCustomer(page, "/account/addresses");
    await page.getByRole("button", { name: "เพิ่มที่อยู่" }).click();
    await page.getByLabel(/^รหัสไปรษณีย์/).fill("10400");
  });

  test("notification preferences: order e-mail stays on, marketing is the customer's choice", async ({ page }) => {
    await signInAsCustomer(page, "/account/notifications");
    const locked = page.getByRole("switch", { name: "คำสั่งซื้อและการชำระเงิน ทางอีเมล" });
    await expect(locked).toBeChecked();
    await expect(locked).toBeDisabled();
    const sms = page.getByRole("switch", { name: "ข่าวสารและโปรโมชัน ทางSMS" });
    const before = await sms.isChecked();
    await sms.click();
    await expect(sms).toBeChecked({ checked: !before });
    await page.reload();
    await expect(page.getByRole("switch", { name: "ข่าวสารและโปรโมชัน ทางSMS" })).toBeChecked({ checked: !before });
    await expect(page.getByRole("button", { name: "เชื่อมต่อ LINE" })).toBeDisabled();
    await expectNoViolations(page);
  });

  test("privacy: an optional consent is withdrawn, and a copy of the data is requested", async ({ page }) => {
    await signInAsCustomer(page, "/account/privacy");
    const email = page.getByRole("switch", { name: "รับข่าวสารและโปรโมชันทางอีเมล" });
    await expect(email).toBeChecked();
    await email.click();
    await expect(page.getByText("ถอนความยินยอมแล้ว")).toBeVisible();
    await expect(email).not.toBeChecked();
    await email.click();
    await expect(email).toBeChecked();

    await page.getByRole("button", { name: "ขอสำเนาข้อมูล" }).click();
    await page.getByRole("alertdialog", { name: "ขอสำเนาข้อมูล" }).getByRole("button", { name: "ส่งคำขอ" }).click();
    await expect(page.getByText(/ขอสำเนาข้อมูล · ได้รับคำขอแล้ว/)).toBeVisible();
    await expectNoViolations(page);
  });

  test("points, referral and the wallet", async ({ page }) => {
    await signInAsCustomer(page, "/account/points");
    await expect(page.getByText("คะแนนที่ใช้ได้")).toBeVisible();
    await expect(page.getByRole("table", { name: "ประวัติคะแนน" }).getByText("สมัครสมาชิก")).toBeVisible();
    await expect(page.getByText(/คะแนนจะหมดอายุวันที่/)).toBeVisible();
    await expectNoViolations(page);

    await gotoHydrated(page, `${HOSTS.customer}/account/referral`);
    await expect(page.getByText("PK1000", { exact: true })).toBeVisible();
    // The share link is the API's (`store.referral.get`), and the friends are counts by status.
    await expect(page.getByText(/\/r\/PK1000$/)).toBeVisible();
    await expect(page.getByRole("list").getByText("1 คน").first()).toBeVisible();

    await gotoHydrated(page, `${HOSTS.customer}/account/wallet`);
    await expect(page.getByText("เครดิตจากสินค้าขาดตามเกณฑ์")).toBeVisible();
    await expect(page.getByText("CN-2569-00007")).toBeVisible();
    await expectNoViolations(page);
  });

  test("the wallet lists the promotion codes a customer holds", async ({ page }) => {
    test.fixme(true, "CONTRACT-GAP store.wallet — v0.2.0 has no customer-facing list of held codes");
    await signInAsCustomer(page, "/account/wallet");
    await expect(page.getByText("PACKIO10")).toBeVisible();
  });

  test("the referral page names each friend it brought", async ({ page }) => {
    test.fixme(true, "CONTRACT-GAP store.loyalty — store.referral.get gives counts, not the friends");
    await signInAsCustomer(page, "/account/referral");
    await expect(page.getByText("ส*** ต***")).toBeVisible();
  });
});
