import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F2 2.2 — orders and the CS desk, against the mock API.
 *
 * Each test that changes state uses an order no other test reads (the mock keeps state for the
 * whole run). Order ids are the mock's: `…-6f7264` + the seed's number in hex.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const order = (n: number) => `00000000-0000-4000-8000-6f7264${n.toString(16).padStart(6, "0")}`;
const QUOTE = "00000000-0000-4000-8000-71756f000384";

async function expectAxeClean(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

async function choose(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).first().click();
}

test.describe("the CS queues", () => {
  test("open on packio-api's first queue, with its count and the orders in it", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/orders`);
    const tab = page.getByRole("link", { name: /^รอชำระ/ });
    await expect(tab).toHaveAttribute("aria-current", "page");
    const table = page.getByRole("table", { name: "คำสั่งซื้อ" });
    await expect(table.getByRole("row")).not.toHaveCount(1);
    // The queue row carries no SLA timer (CONTRACT-GAP admin.orders); the queue is the SLA order.
    await page.getByRole("link", { name: /^รอตรวจไฟล์/ }).click();
    await expect(page).toHaveURL(/queue=artwork_review/);
    await expectAxeClean(page);
  });
});

test.describe("slip review (D-061)", () => {
  test("Finance reviews the order's slip with the bank reference, restating the group code", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/orders/${order(10)}?tab=payments`);
    await expect(page.getByText("มีสลิปรอการเงินตรวจ")).toBeVisible();
    await expectAxeClean(page);

    // Read before the sheet opens: a modal hides the page behind it from the accessibility tree.
    // The group is read after the order: wait for its code before reading it.
    const header = page.getByText(/· กลุ่ม [A-Z]/).first();
    await expect(header).toBeVisible();
    const headline = (await header.textContent())!;
    const group = headline.match(/กลุ่ม (\S+)/)![1]!;

    // The slip is reviewed in Finance's own sheet (D-061), opened from the order.
    await page.getByRole("main").getByRole("button", { name: "อนุมัติสลิป" }).first().click();
    const sheet = page.getByRole("dialog", { name: `ตรวจสลิป ${group}` });
    await sheet.getByLabel(/^เลขอ้างอิงรายการจากธนาคาร/).fill("E2E-ORDER-000010");
    await sheet.getByRole("button", { name: "อนุมัติสลิป" }).click();
    const confirm = page.getByRole("alertdialog", { name: "อนุมัติสลิปและรับชำระเงิน" });
    await expect(confirm).toContainText(group);
    await confirm.getByLabel(new RegExp(`พิมพ์ ${group}`)).fill(group);
    await confirm.getByRole("button", { name: "อนุมัติสลิป" }).click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("ชำระเงินแล้ว");
  });

  test("a CS agent is not offered slip approval", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/orders/${order(8)}?tab=payments`);
    await expect(page.getByRole("heading", { name: "งวดการชำระเงิน" })).toBeVisible();
    await expect(page.getByRole("button", { name: "อนุมัติสลิป" })).toHaveCount(0);
  });

  // CONTRACT-GAP admin.orders — only the slip queue (payments.verify_slip) says a slip waits; CS
  // cannot tell until the order carries `hasSlipToReview`.
  test.fixme("a CS agent is told a slip waits for Finance", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/orders/${order(8)}?tab=payments`);
    await expect(page.getByText("มีสลิปรอการเงินตรวจ")).toBeVisible();
  });
});

test.describe("order actions", () => {
  test("manual start of production is an exception with a reason (D-073)", async ({ page }) => {
    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/orders/${order(20)}`);
    const code = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

    await page.getByRole("button", { name: "เริ่มผลิต" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("D-073");
    await dialog.getByLabel(/พิมพ์/).fill(code);
    await dialog.getByLabel(/เหตุผลของกรณียกเว้น/).fill("ลูกค้าเร่งงานเปิดตัวสินค้า");
    await dialog.getByRole("button", { name: "เริ่มผลิต" }).click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("กำลังผลิต");
  });

  test("cancelling needs a reason code and the order code retyped", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/orders/${order(2)}`);
    const code = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

    await page.getByRole("button", { name: "การดำเนินการอื่น" }).click();
    await page.getByRole("menuitem", { name: /ยกเลิกคำสั่งซื้อ/ }).click();
    const dialog = page.getByRole("alertdialog");
    await choose(page, /เหตุผล/, "ลูกค้าขอยกเลิก");
    await dialog.getByLabel(/พิมพ์/).fill(code);
    await dialog.getByRole("button", { name: "ยกเลิกคำสั่งซื้อ" }).click();

    await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("ยกเลิกแล้ว");
  });

  test("an internal note lands on the order", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/orders/${order(3)}`);
    await page.getByLabel("เพิ่มบันทึก").fill("ลูกค้าขอเลื่อนรับของเป็นสัปดาห์หน้า");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("ลูกค้าขอเลื่อนรับของเป็นสัปดาห์หน้า")).toBeVisible();
  });
});

test.describe("the CS calculator", () => {
  async function priceAFoldingBox(page: Page) {
    await gotoHydrated(page, `${HOSTS.admin}/cs/folding`);
    await choose(page, /รูปแบบกล่อง/, "กล่องฝาเสียบ (RSC)");
    await page.getByRole("button", { name: /M 120 × 80 × 60/ }).click();
    await choose(page, /^วัสดุ/, /อาร์ตการ์ด/);
    await choose(page, /^แกรม/, "350 gsm");
    await page.getByRole("button", { name: "1,000", exact: true }).click();
    await page.getByRole("button", { name: "3,000", exact: true }).click();
    await page.getByLabel(/รหัสไปรษณีย์ปลายทาง/).fill("10110");
    await page.getByRole("button", { name: "คำนวณราคา" }).click();
    await expect(page.getByRole("table", { name: /จำนวน 1,000/ })).toBeVisible();
  }

  test("prices, saves a quotation and places the order", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await priceAFoldingBox(page);
    await expect(page.getByText("ถูกที่สุด").first()).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("radio", { name: "เลือก ดิจิทัล 1000" }).check();
    await page.getByRole("combobox", { name: /^ลูกค้า/ }).fill("กาแฟ");
    await page.getByRole("option", { name: /ร้านกาแฟตัวอย่าง/ }).click();
    await page.getByRole("button", { name: "บันทึกใบเสนอราคา" }).click();
    await expect(page.getByText(/ใบเสนอราคา QT-2569-\d+ ใช้ได้ถึง/)).toBeVisible();

    await page.getByRole("button", { name: "สร้างคำสั่งซื้อ" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "สร้างคำสั่งซื้อแทนลูกค้า" })).toBeVisible();
    await page.getByLabel(/จำนวนที่ส่งไป ที่อยู่หลัก/).fill("1000");
    await expect(page.getByText("จัดสรรแล้ว 1,000 จาก 1,000")).toBeVisible();
    await page.getByRole("button", { name: "สร้างคำสั่งซื้อ" }).click();
    await expect(page).toHaveURL(/\/orders\/00000000-/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PK-2569-");
  });

  test("a discount above the CS limit asks for a memo instead of saving", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await priceAFoldingBox(page);
    await page.getByRole("combobox", { name: /^ลูกค้า/ }).fill("กาแฟ");
    await page.getByRole("option", { name: /ร้านกาแฟตัวอย่าง/ }).click();
    // The limit comes from the input data (the setting), not the UI.
    await expect(page.getByText(/ให้เองได้ไม่เกิน 5%/)).toBeVisible();
    await page.getByLabel(/^ส่วนลด/).fill("8");
    await expect(page.getByRole("button", { name: "ขออนุมัติส่วนลด" })).toBeVisible();
    await expect(page.getByRole("button", { name: "บันทึกใบเสนอราคา" })).toBeDisabled();
  });
});

test.describe("every 2.2 list is axe-clean", () => {
  for (const [path, heading] of [
    ["/cs", "คำนวณราคา (CS)"],
    ["/quotations", "ใบเสนอราคา"],
    [`/quotations/${QUOTE}`, "QT-2569-00118"],
    [`/orders/new?quote=${QUOTE}&quantity=3000`, "สร้างคำสั่งซื้อแทนลูกค้า"],
    ["/discount-memos", "บันทึกขอส่วนลด"],
  ] as const) {
    test(path, async ({ page }) => {
      await signInAsStaff(page, "cs");
      await gotoHydrated(page, `${HOSTS.admin}${path}`);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectAxeClean(page);
    });
  }
});
