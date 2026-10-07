import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsPartner, signInAsStaff } from "./helpers/session";

/**
 * F5 5.3 — the factory's money and account on a phone, against the mock API: a billing statement
 * confirmed and the factory's tax invoice uploaded, the payout schedule and the statement of
 * account, a claim answered back to the claims desk, the scorecard, and settings — with the
 * permission rules the prompt's gates name (an operator cannot manage users or see billing).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PDF = Buffer.from("%PDF-1.4\n%mock tax invoice\n%%EOF");

async function expectAxeClean(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10_000 });
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

const dialog = (page: Page) => page.getByRole("alertdialog");

test.use({ viewport: { width: 390, height: 844 } });

test.describe("billing and payouts (F001)", () => {
  test("confirms a statement, uploads the tax invoice, and the payout statement shows it", async ({ page }) => {
    test.setTimeout(90_000);
    await signInAsPartner(page, "accountant");
    const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
    await nav.getByRole("link", { name: "วางบิล" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "วางบิล" })).toBeVisible();
    await expectAxeClean(page);

    await page
      .getByRole("link", { name: /รอโรงงานตรวจ/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/billing\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: /^BS-/ })).toBeVisible();
    const bsNumber = (await page.getByRole("heading", { level: 1 }).textContent())!;
    await expect(page.getByText("ค่าผลิต").first()).toBeVisible();
    await expect(page.getByText(/^Packio สร้างเมื่อ /)).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("button", { name: "ยืนยันใบวางบิล" }).click();
    await expect(dialog(page)).toContainText(bsNumber);
    await dialog(page).getByRole("textbox").fill(bsNumber);
    await dialog(page).getByRole("button", { name: "ยืนยัน", exact: true }).click();
    await expect(page.getByText(`ยืนยัน ${bsNumber} แล้ว`)).toBeVisible();

    // The factory's own tax invoice (D-090), a PDF, with the amounts as printed on it (backend wins).
    await page.getByLabel(/^เลขที่ใบกำกับภาษี/).fill("INV-6910-0001");
    await page.getByLabel(/^มูลค่าก่อน VAT/).fill("12500");
    await page.getByRole("button", { name: "บันทึกใบกำกับภาษี" }).click();
    await expect(page.getByText("ใส่ตัวเลขทศนิยม 2 ตำแหน่ง เช่น 12500.00").first()).toBeVisible();
    await page.getByLabel(/^มูลค่าก่อน VAT/).fill("12500.00");
    await page.getByLabel(/^VAT ตามใบกำกับภาษี/).fill("875.00");
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "invoice.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByText("เลือกไฟล์ invoice.pdf แล้ว")).toBeVisible();
    await expectAxeClean(page);
    await page.getByRole("button", { name: "บันทึกใบกำกับภาษี" }).click();
    await expect(page.getByText("บันทึกใบกำกับภาษีแล้ว รอฝ่ายการเงินตรวจ")).toBeVisible();
    await expect(page.getByText("รอฝ่ายการเงินตรวจ").first()).toBeVisible();

    await gotoHydrated(page, `${HOSTS.partner}/payouts`);
    // The terms the job snapshot (`PayoutScheduleJobDto.terms`, D-022, D-164).
    await expect(page.getByText(/ล่วงหน้า 30%/).first()).toBeVisible();
    await expect(page.getByText(/เงินประกัน 5%/).first()).toBeVisible();
    await expectAxeClean(page);
    await page.getByRole("link", { name: /^PV-/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /^PV-/ })).toBeVisible();
    const pvNumber = (await page.getByRole("heading", { level: 1 }).textContent())!;
    // The documents of a paid payout (`partner.payables.payoutDocuments`).
    await expect(page.getByRole("link", { name: /ใบแจ้งการโอนเงิน/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /หนังสือรับรองการหักภาษี ณ ที่จ่าย/ })).toBeVisible();
    await expectAxeClean(page);

    await gotoHydrated(page, `${HOSTS.partner}/payouts/statement`);
    await expect(page.getByRole("table")).toContainText(pvNumber);
    await expect(page.getByRole("table")).toContainText("รับสินค้า");
    await expectAxeClean(page);
  });
});

test.describe("claims, performance and settings", () => {
  test("the owner answers a claim, and the claims desk sees the factory's answer", async ({ page }) => {
    await signInAsPartner(page, "owner");
    await expect(page.getByRole("link", { name: /ตอบเคลม/ })).toBeVisible();
    await page
      .getByRole("link", { name: /ตอบเคลม/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1, name: /^CL-/ })).toBeVisible();
    const claimNo = (await page.getByRole("heading", { level: 1 }).textContent())!;
    await expectAxeClean(page);
    await page.getByRole("radio", { name: /โต้แย้ง/ }).click();
    await page.getByLabel(/^รายละเอียด/).fill("ผลิตตาม Proof ที่ลูกค้าอนุมัติ กล่องแพ็กแน่นก่อนส่ง");
    await page.getByRole("button", { name: "ส่งคำตอบ" }).click();
    await dialog(page).getByRole("button", { name: "ส่งคำตอบ" }).click();
    await expect(page.getByText(`ส่งคำตอบเคลม ${claimNo} แล้ว`)).toBeVisible();
    await expect(page.getByText("โรงงานโต้แย้งเคลม")).toBeVisible();

    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/claims`);
    await page.getByRole("link", { name: claimNo }).first().click();
    await expect(page.getByText("ผลิตตาม Proof ที่ลูกค้าอนุมัติ กล่องแพ็กแน่นก่อนส่ง").first()).toBeVisible();
  });

  test("performance and settings read, add a user, and switch to high contrast", async ({ page }) => {
    await signInAsPartner(page, "owner");
    await gotoHydrated(page, `${HOSTS.partner}/performance`);
    await expect(page.getByText("รับงานตรงเวลา").first()).toBeVisible();
    await expectAxeClean(page);

    await gotoHydrated(page, `${HOSTS.partner}/settings`);
    // The owner's own row is read-only, and there is no owner role to give (D-171).
    await expect(page.getByText("นี่คือบัญชีของคุณ")).toBeVisible();
    const create = page.locator("form").filter({ has: page.getByRole("button", { name: "เพิ่มผู้ใช้" }) });
    await expect(create.getByRole("checkbox", { name: "เจ้าของโรงงาน" })).toHaveCount(0);
    await create.getByRole("textbox", { name: /^ชื่อ/ }).fill("ฝ่าย QC ใหม่ (ข้อมูลจำลอง)");
    await create.getByRole("textbox", { name: /^อีเมล/ }).fill("qc.new@factory.invalid");
    // The first password is handed over out of band, typed into a password field the browser won't autofill.
    const password = create.getByLabel(/^รหัสผ่านแรก/);
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveAttribute("autocomplete", "new-password");
    await password.fill("short");
    await create.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
    await expect(create.getByText("รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร")).toBeVisible();
    await password.fill("first-sign-in-2569");
    await create.getByRole("checkbox", { name: /ฝ่ายควบคุมคุณภาพ/ }).click();
    await create.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
    await expect(page.getByText("เพิ่มผู้ใช้แล้ว แจ้งรหัสผ่านแรกให้เจ้าตัวโดยตรง")).toBeVisible();
    await expect(page.getByText("qc.new@factory.invalid")).toBeVisible();
    await expect(page.getByText("first-sign-in-2569")).toHaveCount(0);
    await page.getByRole("radio", { name: "4 × 6 นิ้ว" }).click();
    await expect(page.getByText("บันทึกขนาดฉลากแล้ว")).toBeVisible();
    // The shop floor's high-contrast theme, from the settings screen's own toggle.
    await page.getByRole("main").getByRole("button", { name: "ธีม" }).click();
    await page.getByRole("menuitemradio", { name: "คอนทราสต์สูง" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "hc");
    await expectAxeClean(page);
  });

  test("an operator cannot manage users or see billing", async ({ page }) => {
    await signInAsPartner(page, "operator");
    const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
    await expect(nav.getByRole("link", { name: "วางบิล" })).toHaveCount(0);
    await gotoHydrated(page, `${HOSTS.partner}/billing`);
    await expect(page.getByText("คุณไม่มีสิทธิ์เปิดหน้านี้")).toBeVisible();
    await gotoHydrated(page, `${HOSTS.partner}/settings`);
    await expect(page.getByRole("heading", { name: "ผู้ใช้และสิทธิ์" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "การแจ้งเตือน" })).toBeVisible();
    await gotoHydrated(page, `${HOSTS.partner}/more`);
    await expect(page.getByRole("link", { name: /การจ่ายเงิน/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /ตั้งค่า/ })).toBeVisible();
  });
});
