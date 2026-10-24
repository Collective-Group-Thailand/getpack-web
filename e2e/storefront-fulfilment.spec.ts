import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, MOCK_RECEIVER_PHONE, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F3 3.6 end to end: an order delivered yesterday, a little short. Its stages and the public
 * tracking page (nothing personal), what arrived, receipt confirmed,
 * a claim filed with product and carton photos that lands on the logistics desk, and a
 * one-click reorder into checkout. The `receiver` persona owns the order, so parallel specs
 * never touch it.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PHOTO = (name: string) => ({
  name,
  mimeType: "image/png",
  // A 1×1 PNG.
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
});

async function expectNoViolations(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // Scrolled, the sticky header overlaps the account menu and axe's target-size reads it as obscured.
  await page.evaluate(() => window.scrollTo(0, 0));
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

/** `mocks/admin/commerce.ts` order 32 (the eighth fake customer's): delivered yesterday, 970 of 1,000. */
const ORDER = "00000000-0000-4000-8000-6f7264000020";
const CODE = "PK-2569-00131";

test.describe.configure({ mode: "serial" });

test.describe("after production", () => {
  test("the order shows its stages, and the public tracking page shows nothing personal", async ({ page, browser }) => {
    await signInAsCustomer(page, `/account/orders/${ORDER}`, MOCK_RECEIVER_PHONE);
    // The factory's own steps, under the order's seven-stage journey (account/orders/[orderId]).
    const stages = page.getByRole("list", { name: "ขั้นตอนที่โรงงาน" });
    await expect(stages).toContainText("รับสินค้า · ขั้นตอนปัจจุบัน");
    await expect(stages).toContainText("จัดส่ง · เสร็จแล้ว");
    await page.getByRole("button", { name: "ลิงก์ติดตามสถานะสำหรับแชร์" }).click();
    await expect(page).toHaveURL(/\/track\/trk/);
    const href = new URL(page.url()).pathname;

    const guest = await browser.newContext();
    const visitor = await guest.newPage();
    await acceptCookies(visitor);
    await gotoHydrated(visitor, `${HOSTS.customer}${href}`);
    // By decision the public page names neither the order nor where it goes (D-224).
    await expect(visitor.getByRole("heading", { level: 1, name: "ติดตามคำสั่งซื้อ" })).toBeVisible();
    await expect(visitor.getByRole("list", { name: "ความคืบหน้าของคำสั่งซื้อ" })).toContainText("จัดส่ง · เสร็จแล้ว");
    const text = await visitor.locator("main").innerText();
    expect(text).not.toContain(CODE);
    expect(text).not.toMatch(/ผู้รับ|บริษัท|฿/);
    await expectNoViolations(visitor);
    await guest.close();
  });

  test("what arrived is shown, and receipt is confirmed (D-080, D-081)", async ({ page }) => {
    await signInAsCustomer(page, `/account/orders/${ORDER}`, MOCK_RECEIVER_PHONE);
    await page
      .getByRole("link", { name: /ยืนยันรับ/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "รับสินค้า" })).toBeVisible();
    await expect(page.getByText(/รับสินค้า จำนวน 970 เมื่อ/)).toBeVisible();
    // How that compares with the order, as the API evaluated it (D-021, D-080).
    await expect(page.getByText(/ได้รับ 970 จาก/).first()).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole("button", { name: "ยืนยันรับสินค้า" }).click();
    const dialog = page.getByRole("alertdialog", { name: `ยืนยันรับสินค้า ${CODE}?` });
    await expect(dialog).toContainText("แจ้งได้ถึง");
    await dialog.getByRole("button", { name: "ยืนยันรับสินค้า" }).click();
    await expect(page.getByText("ยืนยันรับสินค้าแล้ว", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "ยืนยันรับสินค้า" })).toHaveCount(0);
  });

  test("a claim needs product and carton photos, and reaches the logistics desk (D-082)", async ({ page, browser }) => {
    await signInAsCustomer(page, `/account/orders/${ORDER}/claim`, MOCK_RECEIVER_PHONE);
    await expect(page.getByText(new RegExp(`แจ้งปัญหาของ ${CODE} ได้ถึง`))).toBeVisible();

    await page.getByRole("button", { name: "ส่งเรื่อง" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "กรุณาแก้" });
    await expect(summary).toContainText("แนบรูปกล่องขนส่งอย่างน้อย 1 รูป");
    await expect(summary).toContainText("แนบรูปสินค้าอย่างน้อย 1 รูป");

    await page.getByRole("radio", { name: "สินค้าเสียหาย" }).click();
    await page.getByLabel(/^จำนวนที่มีปัญหา/).fill("20");
    await page.getByLabel(/^รายละเอียด/).fill("กล่องบุบ 20 ใบ มุมกล่องยุบ ฝาฉีก");
    await page.getByRole("radio", { name: /^ผลิตใหม่/ }).click();
    const pickers = page.locator('input[type="file"]');
    await pickers.nth(0).setInputFiles(PHOTO("dent.png"));
    await expect(page.getByRole("img", { name: "อัปโหลดแล้ว" })).toHaveCount(1);
    await page.getByRole("button", { name: "ส่งเรื่อง" }).click();
    await expect(summary).toContainText("แนบรูปกล่องขนส่งอย่างน้อย 1 รูป");
    await expect(summary).not.toContainText("แนบรูปสินค้า");

    await pickers.nth(1).setInputFiles(PHOTO("carton.png"));
    await expect(page.getByRole("img", { name: "อัปโหลดแล้ว" })).toHaveCount(2);
    await expectNoViolations(page);
    await page.getByRole("button", { name: "ส่งเรื่อง" }).click();

    await expect(page).toHaveURL(/\/claims\/[0-9a-f-]+$/);
    const heading = page.getByRole("heading", { level: 1, name: /^เคลม CL-2569-/ });
    await expect(heading).toBeVisible();
    const claimNo = (await heading.textContent())!.replace("เคลม ", "").trim();
    const claimId = page.url().split("/").at(-1)!;
    // The photos open as signed files; there is no free thread (D-225): the customer answers only
    // when the claim offers `claim.answer_info`.
    await expect(page.getByText("2 รูป", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "รูปที่ 2" })).toBeVisible();
    await expect(page.getByLabel("ตอบกลับ")).toHaveCount(0);
    // The claim's clock (U2.F4, D-263): who acts now, by when, and the guarantee it follows.
    const clock = page.getByRole("region", { name: "สถานะเคลม" });
    await expect(clock.getByText("รอทีม getpack")).toBeVisible();
    await expect(clock.getByText(/ตัดสินภายใน/)).toBeVisible();
    await expect(clock.getByRole("link", { name: "ตามเงื่อนไขการรับประกันฉบับที่ 1" })).toHaveAttribute(
      "href",
      "/guarantee",
    );
    // The "received" toast animates over the header; axe reads it mid-fade.
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10_000 });
    await expectNoViolations(page);

    const staff = await browser.newContext();
    const desk = await staff.newPage();
    await signInAsStaff(desk, "logistics");
    await gotoHydrated(desk, `${HOSTS.admin}/claims/${claimId}`);
    await expect(desk.getByRole("heading", { level: 1 })).toContainText(claimNo);
    await expect(desk.getByRole("main")).toContainText("กล่องบุบ 20 ใบ");
    await staff.close();
  });

  test("the customer writes to the team in the claim's thread", async ({ page }) => {
    test.fixme(
      true,
      "D-225 — claims have no free thread by decision; the customer answers CS's request for information only",
    );
    await signInAsCustomer(page, `/account/orders/${ORDER}`, MOCK_RECEIVER_PHONE);
  });

  test("one click reorders it, re-priced, into checkout (D-153)", async ({ page }) => {
    await signInAsCustomer(page, `/account/orders/${ORDER}`, MOCK_RECEIVER_PHONE);
    await page
      .getByRole("link", { name: new RegExp(`^สั่งซ้ำ ${CODE}`) })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1, name: `สั่งซ้ำ ${CODE}` })).toBeVisible();
    await expect(page.getByText("ใช้ไฟล์งานเดิม")).toBeVisible();
    const total = page.getByRole("complementary", { name: "ราคาวันนี้" });
    const before = await total
      .getByText(/^฿[\d,.]+$/)
      .last()
      .textContent();

    await page.getByLabel(/^จำนวน/).fill("2000");
    await expect(total.getByText(/^฿[\d,.]+$/).last()).not.toHaveText(before!);
    await expect(total.getByText("สินค้า 2,000 ชิ้น")).toBeVisible();
    const repriced = (await total
      .getByText(/^฿[\d,.]+$/)
      .last()
      .textContent())!;
    await expectNoViolations(page);

    await page.getByRole("button", { name: "สั่งซ้ำและไปชำระเงิน" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" })).toContainText(repriced);
  });
});
