import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_RECEIVER_PHONE, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * U2.F5, repeat business against the mock API: the dashboard (where things stand, when to order
 * again, the latest documents), replenishment with its reasoning, a reorder that waives the plates,
 * a call-off agreement asked for, accepted, released into the cart and its release listed, and the
 * company's API keys — only for the Company Admin.
 */

const COMPANY_ADMIN = "0867890123";
const COMPANY_BUYER = "0878901234";
const RECEIVER_ORDER = "00000000-0000-4000-8000-6f7264000020";
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).exclude("[data-sonner-toaster]").analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

test("the dashboard and replenishment: where things stand, when to order again and why", async ({ page }) => {
  await signInAsCustomer(page, "/account", MOCK_RECEIVER_PHONE);
  // The overview since the account redesign (C6): what needs doing, the latest orders, and reordering.
  await expect(page.getByRole("region", { name: "คำสั่งซื้อล่าสุด" })).toBeVisible();
  await expect(page.getByRole("region", { name: "สั่งซ้ำ" })).toBeVisible();
  await expectNoViolations(page);

  await gotoHydrated(page, `${HOSTS.customer}/account/replenishment`);
  const card = page
    .getByRole("listitem")
    .filter({ hasText: /แนะนำให้สั่งภายใน/ })
    .first();
  await expect(card).toBeVisible();
  await expect(card.getByText(/คุณสั่งทุก ๆ 30\.00 วันโดยเฉลี่ย/)).toBeVisible();
  await expect(card.getByRole("link", { name: "สั่งซ้ำ" })).toHaveAttribute(
    "href",
    /\/account\/orders\/[0-9a-f-]+\/reorder$/,
  );
  await expectNoViolations(page);
});

test("a reorder that reuses the approved artwork does not charge the plates again", async ({ page }) => {
  await signInAsCustomer(page, `/account/orders/${RECEIVER_ORDER}/reorder`, MOCK_RECEIVER_PHONE);
  await expect(page.getByText(/ไม่ต้องจ่ายค่าบล็อก\/เพลทซ้ำ ประหยัด/)).toBeVisible();
  await expect(page.getByText("ค่าบล็อก/เพลทที่ไม่ต้องจ่าย")).toBeVisible();
});

test("a call-off: asked for on a saved quotation, accepted, released into the cart", async ({ page }) => {
  await signInAsCustomer(page, "/configure/tuck-end-box", COMPANY_ADMIN);
  const dock = page.getByRole("complementary", { name: "ราคาของคุณ" });
  await expect(dock.getByText(/\/ ชิ้น$/)).toBeVisible();
  // Keeping the price as a quotation is the dock's "ใบเสนอราคา" (C4-11).
  await dock.getByRole("button", { name: "ใบเสนอราคา", exact: true }).click();
  await expect(page.getByText(/บันทึกใบเสนอราคาแล้ว/)).toBeVisible();

  await gotoHydrated(page, `${HOSTS.customer}/account/quotes`);
  // In each saved quotation's "⋯" menu since the customer redesign.
  await page
    .getByRole("button", { name: /^ตัวเลือกเพิ่มเติมของ / })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /^ล็อกราคาไว้เรียกทีละงวด/ }).click();
  const dialog = page.getByRole("dialog", { name: "ขอทำสัญญาเรียกของ" });
  await expectNoViolations(page);
  await dialog.getByRole("button", { name: "ส่งคำขอ" }).click();
  await expect(page).toHaveURL(/\/account\/call-offs\/[0-9a-f-]+$/);
  // The mock's factory accepts on the next read.
  await page.reload();
  await expect(page.getByText("ใช้งานได้").first()).toBeVisible();

  const hint = await page.getByText(/^ขั้นต่ำ/).innerText();
  const min = hint.match(/ขั้นต่ำ ([\d,]+)/)![1]!.replace(/,/g, "");
  await page.getByRole("textbox", { name: /^จำนวน/ }).fill(min);
  await expectNoViolations(page);
  await page.getByRole("button", { name: "เรียกของและใส่ตะกร้า" }).click();
  await expect(page).toHaveURL(/\/cart$/);

  await gotoHydrated(page, `${HOSTS.customer}/account/call-offs`);
  // Called off / the whole (the call-offs table, account/call-offs), with its meter beside it.
  await expect(
    page
      .getByRole("table", { name: "สัญญาเรียกของ" })
      .getByRole("cell", { name: /^[1-9][\d,]* \/ [\d,]+ ชิ้น/ })
      .first(),
  ).toBeVisible();
});

test("API keys: the Company Admin issues one (secret once) and revokes it; a buyer cannot", async ({ page }) => {
  await signInAsCustomer(page, "/business/api", COMPANY_ADMIN);
  const name = `ERP ${Date.now().toString(36)}`;
  await page.getByRole("textbox", { name: "ชื่อคีย์" }).fill(name);
  await page.getByRole("checkbox", { name: "สั่งซื้อ", exact: true }).check();
  await page.getByRole("button", { name: "สร้างคีย์" }).click();
  await expect(page.getByText("คัดลอกรหัสลับเก็บไว้ตอนนี้ — จะไม่แสดงอีก")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "รหัสลับ (client secret)" })).toHaveValue(/^sk_/);
  await expectNoViolations(page);
  const row = page.getByRole("listitem").filter({ hasText: name });
  await row.getByRole("button", { name: new RegExp(`ยกเลิกคีย์ ${name}`) }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ยกเลิกคีย์" }).click();
  await expect(row.getByText("ยกเลิกแล้ว")).toBeVisible();

  await page.context().clearCookies();
  await signInAsCustomer(page, "/business/api", COMPANY_BUYER);
  await expect(page.getByText("เฉพาะผู้ดูแลบริษัทที่จัดการคีย์ API ได้")).toBeVisible();
  await expect(page.getByRole("button", { name: "สร้างคีย์" })).toHaveCount(0);
});
