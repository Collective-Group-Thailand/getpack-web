import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * Stage C block C10 (business pack Phases 1–3, D-458) end to end against the mock backend: /business (simulator on
 * real prices, ROI with its formula, the device-only document checklist, the sales form as a routed contact ticket),
 * /contact (intents with their answers and fields, a call back on an offered day and window, the CS- request
 * tracked inline with the guest's phone and more information added) and /partner-with-us (getpack Factory: modules
 * from the roadmap, comparison table, application). No horizontal scroll at 390 / 1054 / 1440, no axe violations,
 * nothing about partner factories outside /partner-with-us.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

for (const path of ["/business", "/contact", "/partner-with-us"]) {
  test(`${path} has no horizontal scroll at 390, 1054 and 1440`, async ({ page }) => {
    for (const width of [390, 1054, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoHydrated(page, `${HOSTS.customer}${path}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}

test.describe("/business (C10 Phase 1)", () => {
  test("the simulator routes a priced order over the amount to the approver, and back when the amount rises", async ({
    page,
  }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/business`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ได้ราคาจริงทันที");
    const flow = page.getByRole("list", { name: "เส้นทางของคำสั่งซื้อนี้" });
    const orders = page.getByRole("radiogroup", { name: "ตัวอย่างคำสั่งซื้อ" }).getByRole("radio");
    await expect(orders.first()).toContainText("฿");
    await orders.last().click();
    await expect(flow).toContainText("ต้องอนุมัติ");
    await orders.first().click();
    await expect(flow).toContainText("ผ่านอัตโนมัติ");
    // An amount of 0 means every order waits for the approver.
    await page.getByRole("slider").first().focus();
    await page.keyboard.press("Home");
    await expect(page.getByText("ทุกคำสั่งซื้อ").first()).toBeVisible();
    await expect(flow).toContainText("ต้องอนุมัติ");
    await expectNoViolations(page);
  });

  test("the ROI calculator shows hours and baht with its formula; the checklist is kept on this device", async ({
    page,
  }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/business`);
    await expect(page.getByText("222 ชั่วโมง")).toBeVisible();
    await expect(page.getByText(/สมมติว่าการอนุมัติในระบบใช้เวลาน้อยกว่าทางแชตรายการละ 15 นาที/)).toBeVisible();
    await page.getByRole("checkbox", { name: /^หนังสือรับรองบริษัท/ }).click();
    await page.getByRole("checkbox", { name: /ภ\.พ\.20/ }).click();
    await expect(page.getByText("พร้อม 2 จาก 3 อย่างที่จำเป็น").first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /^หนังสือรับรองบริษัท/ })).toBeChecked();
  });

  test("the sales form opens a ticket and offers to open a company account meanwhile", async ({ page }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/business#sales`);
    const sales = page.locator("#sales");
    await sales.getByRole("button", { name: "นัดคุยกับทีมขาย" }).click();
    await expect(sales.getByText("กรุณาใส่ชื่อบริษัท")).toBeVisible();
    await expect(sales.getByLabel(/^ชื่อบริษัท/)).toBeFocused();
    await sales.getByLabel(/^ชื่อบริษัท/).fill("บริษัท ทดสอบอีทูอี จำกัด");
    await sales.getByLabel(/^ชื่อผู้ติดต่อ/).fill("ผู้ติดต่อทดสอบ");
    await sales.getByLabel(/^อีเมลงาน/).fill("sales.e2e@example.invalid");
    await sales.getByRole("button", { name: "หลายสาขา" }).click();
    await sales.getByRole("button", { name: "นัดคุยกับทีมขาย" }).click();
    await expect(sales.getByRole("status")).toContainText(/เลขเรื่อง CS-/);
    await expect(sales.getByRole("link", { name: "เปิดบัญชีบริษัทระหว่างรอ" })).toBeVisible();
  });
});

test.describe("/contact (C10 Phase 2)", () => {
  test("an intent shows its answers and fields; a call back is booked on an offered day and window", async ({
    page,
  }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/contact`);
    await expect(page.getByRole("heading", { level: 1, name: "มีอะไรให้ช่วยครับ" })).toBeVisible();
    await page.getByRole("radio", { name: /การจัดส่ง/ }).click();
    await expect(page.getByRole("heading", { name: "การจัดส่ง: คำตอบที่ใช้บ่อย" })).toBeVisible();
    await expect(page.getByLabel("รหัสไปรษณีย์ปลายทาง")).toBeVisible();
    await page.getByLabel(/^ชื่อ/).fill("ผู้ติดต่อทดสอบ");
    await page.getByLabel(/^ข้อความ/).fill("ส่งต่างจังหวัดได้ไหมครับ ขอบคุณครับ");
    await page.getByRole("radio", { name: "โทรกลับ" }).click();
    await page.getByRole("button", { name: "ส่งข้อความ" }).click();
    await expect(page.getByText("โทรกลับต้องมีเบอร์มือถือ").last()).toBeVisible();
    await page.locator("form input[type=tel]").last().fill("0812345678");
    await page.getByRole("radiogroup", { name: "วันที่สะดวก" }).getByRole("radio").first().click();
    await page.getByRole("radiogroup", { name: "ช่วงเวลา" }).getByRole("radio").first().click();
    await expectNoViolations(page);
    await page.getByRole("button", { name: "ส่งข้อความ" }).click();
    const done = page.getByRole("status").filter({ hasText: /เลขเรื่อง CS-/ });
    await expect(done).toContainText("ทีมจะโทรกลับ");
    await expect(done).toContainText("เรื่อง: การจัดส่ง");
  });

  test("a guest tracks a request with the phone they left and adds information to it", async ({ page }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/contact?topic=other`);
    await page.getByLabel(/^ชื่อ/).fill("ผู้ติดต่อทดสอบ");
    await page.locator("form input[type=tel]").last().fill("0812345678");
    await page.getByLabel(/^ข้อความ/).fill("ขอข้อมูลเพิ่มเติมเรื่องตัวอย่างครับ");
    await page.getByRole("button", { name: "ส่งข้อความ" }).click();
    const done = page.getByRole("status").filter({ hasText: /เลขเรื่อง CS-/ });
    const ticket = ((await done.textContent()) ?? "").match(/CS-\d{4}-\d+/)?.[0] ?? "";
    expect(ticket).not.toBe("");
    await page.locator("#track input").first().fill(ticket);
    await page.getByRole("button", { name: "ติดตาม", exact: true }).click();
    await page.getByLabel("เบอร์มือถือหรืออีเมล").fill("0899999999");
    await page.getByRole("button", { name: "ดูสถานะ" }).click();
    // Next's route announcer is an (empty) alert too.
    await expect(page.getByRole("alert").filter({ hasText: "ไม่พบเรื่องนี้" })).toBeVisible();
    await page.getByLabel("เบอร์มือถือหรืออีเมล").fill("081-234-5678");
    await page.getByRole("button", { name: "ดูสถานะ" }).click();
    await expect(page.getByText("ได้รับเรื่อง").first()).toBeVisible();
    await page.getByLabel("เพิ่มข้อมูลในเรื่องนี้").fill("ขอชุดตัวอย่างกระดาษลูกฟูกด้วยครับ");
    await page.getByRole("button", { name: "ส่งข้อมูลเพิ่ม" }).click();
    await expect(page.getByText("ส่งข้อมูลเพิ่มแล้ว")).toBeVisible();
  });

  test("an order number opens my orders after sign-in", async ({ page }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/contact`);
    await page.locator("#track input").first().fill("pk-2569-00100");
    await page.getByRole("button", { name: "ติดตาม", exact: true }).click();
    await expect(page).toHaveURL(/sign-in\?returnTo=%2Faccount%2Forders%3Fq%3DPK-2569-00100/);
  });
});

test.describe("/partner-with-us (C10 Phase 3)", () => {
  test("getpack Factory lists its modules without status chips and takes an application", async ({ page }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/partner-with-us`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ฟรี");
    // Every module is live (product owner, 2026-10-30): no "ใช้ได้แล้ว" / "กำลังพัฒนา" chip anywhere.
    await expect(page.locator("#modules")).toContainText("รับงานจาก getpack");
    await expect(page.getByText("กำลังพัฒนา")).toHaveCount(0);
    await expect(page.getByRole("table")).toContainText("บัญชีและบัญชีแยกประเภท");
    const apply = page.locator("#apply");
    // C12 (D-460, legal draft): the partner agreement's key clauses next to the application.
    await expect(apply.getByRole("heading", { name: "สาระสำคัญของสัญญาพาร์ตเนอร์" })).toBeVisible();
    await expect(apply).toContainText("12 เดือน");
    await expect(page.getByText("รับงานจาก getpack แล้ว ติดต่อลูกค้ารายนั้นเองได้ไหม")).toBeVisible();
    await apply.getByRole("button", { name: "สมัครเป็นโรงงานพาร์ตเนอร์" }).click();
    await expect(apply.getByLabel(/^ชื่อโรงงาน/)).toBeFocused();
    await apply.getByLabel(/^ชื่อโรงงาน/).fill("โรงงานทดสอบอีทูอี");
    await apply.getByLabel(/^ผู้ติดต่อ/).fill("ผู้ติดต่อทดสอบ");
    await apply.locator("input[type=tel]").fill("0812345678");
    await apply.locator("select").first().selectOption({ index: 1 });
    await apply.getByRole("group").getByRole("button").first().click();
    await expectNoViolations(page);
    await apply.getByRole("button", { name: "สมัครเป็นโรงงานพาร์ตเนอร์" }).click();
    await expect(apply.getByRole("status")).toContainText(/เลขเรื่อง CS-/);
  });

  test("customer pages say nothing about partner factories outside /partner-with-us", async ({ page }) => {
    for (const path of ["/business", "/contact"]) {
      await gotoHydrated(page, `${HOSTS.customer}${path}`);
      const text = (await page.locator("main").innerText()).replace(
        /getpack Factory|โรงงานพาร์ตเนอร์|โรงงานบรรจุภัณฑ์/g,
        "",
      );
      expect(text, path).not.toMatch(/\d+\s*(แห่ง|โรงงาน)|ยังไม่มีโรงงานรับ/);
    }
  });
});
