import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";
import { choiceList } from "./helpers/select";

/**
 * F6.2 — payables, payouts and banking, against the MSW mock of the published B5.3 surface. The
 * mock keeps state for the run and tests run in parallel, so each test owns its records: the one
 * payout run built here, the carrier's bank change, the freelancer's bill, the bank lines named
 * below, and the unidentified receipt of PK-2569-00105 (PG-2569-00065).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectAxeClean(page: Page) {
  // After a client-side navigation the page's <title> streams in with its metadata, and an
  // overlay that has just opened is still fading the page behind it: measure the settled page.
  await expect(page).toHaveTitle(/\S/);
  // A list refetching on load is dimmed until its data arrives.
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
  // A toast is measured mid fade-in (its opacity animates); the toast itself has its own axe story.
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).exclude("[data-sonner-toaster]").analyze();
  const report = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`,
  );
  expect(violations, report.join("\n\n")).toEqual([]);
}

async function confirmTyped(page: Page, button: string, phrase: string) {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: button, exact: true })).toBeDisabled();
  await dialog.getByLabel(`พิมพ์ ${phrase} เพื่อยืนยัน`).fill(phrase);
  await dialog.getByRole("button", { name: button, exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
}

async function approveAs(page: Page, href: string) {
  await gotoHydrated(page, `${HOSTS.admin}${href}`);
  await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "อนุมัติคำขอนี้?" })
    .getByRole("button", { name: "อนุมัติ", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
}

const inTwoWeeks = () => new Date(Date.now() + 7 * 3_600_000 + 14 * 86_400_000).toISOString().slice(0, 10);

test.describe("payout runs (D-022, D-166)", () => {
  test("a run is proposed by Finance, approved by a C-Level, sent as a bank file and posted from the bank's result", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const finance = await (await browser.newContext({ acceptDownloads: true })).newPage();
    await signInAsStaff(finance, "finance");
    await gotoHydrated(finance, `${HOSTS.admin}/finance/payouts`);
    await expectAxeClean(finance);
    await finance.getByRole("button", { name: "สร้างรอบจ่าย" }).click();
    const dialog = finance.getByRole("dialog", { name: "สร้างรอบจ่ายเงิน" });
    await dialog.getByLabel(/^วันที่จ่าย/).fill(inTwoWeeks());
    await expect(dialog.getByRole("table", { name: "รายการที่จะรวมในรอบ" }).getByRole("row")).not.toHaveCount(1);
    await expectAxeClean(finance);
    await dialog.getByRole("button", { name: "สร้างรอบ" }).click();
    await expect(finance).toHaveURL(/\/finance\/payouts\/[0-9a-f-]+$/);
    const runNo = (await finance.getByRole("heading", { level: 1 }).textContent())!.replace("รอบจ่ายเงิน", "").trim();
    // The vendor with no verified account is left out, and said so (§8).
    await expect(finance.getByText("มีรายการที่ไม่ได้รวม")).toBeVisible();
    await expectAxeClean(finance);

    await finance.getByRole("button", { name: "เสนออนุมัติ" }).click();
    await confirmTyped(finance, "เสนออนุมัติ", runNo);
    await expect(finance.getByText("คุณเป็นผู้เสนอรอบนี้ จึงอนุมัติเองไม่ได้")).toBeVisible();
    const approvalHref = await finance.getByRole("link", { name: "ดูคำขออนุมัติ" }).first().getAttribute("href");

    // The proposer is never offered the approval; a C-Level is.
    await gotoHydrated(finance, `${HOSTS.admin}${approvalHref}`);
    await expect(finance.getByRole("button", { name: "อนุมัติ", exact: true })).toHaveCount(0);
    const executive = await (await browser.newContext()).newPage();
    await signInAsStaff(executive, "c_level");
    await approveAs(executive, approvalHref!);

    await gotoHydrated(finance, `${HOSTS.admin}/finance/payouts`);
    await finance.getByRole("link", { name: runNo }).click();
    await finance.getByRole("button", { name: "สร้างไฟล์ธนาคาร" }).click();
    await confirmTyped(finance, "สร้างไฟล์ธนาคาร", runNo);
    const download = finance.waitForEvent("download");
    await finance.getByRole("button", { name: "ดาวน์โหลดไฟล์ธนาคาร" }).click();
    expect((await download).suggestedFilename()).toContain(runNo);

    // The run now offers the file again and the bank's result; the result is behind "more".
    await finance.getByRole("button", { name: "การดำเนินการอื่น" }).click();
    await finance.getByRole("menuitem", { name: "บันทึกผลการโอน" }).click();
    const result = finance.getByRole("dialog", { name: `บันทึกผลการโอนของ ${runNo}` });
    await result.getByRole("button", { name: "ตรวจทาน" }).click();
    await confirmTyped(finance, "บันทึกผล", runNo);
    await expect(finance.getByRole("heading", { level: 1 }).locator("..")).toContainText("จ่ายแล้ว");

    // A paid item has its PV number, remittance advice and 50 ทวิ.
    await finance.getByRole("button", { name: /PV\d/ }).first().click();
    await expect(finance.getByRole("dialog").getByRole("link", { name: "ใบแจ้งการโอนเงิน" })).toBeVisible();
    await expect(
      finance
        .getByRole("dialog")
        .getByText(/หนังสือรับรองการหักภาษี ณ ที่จ่าย WT/)
        .first(),
    ).toBeVisible();
  });
});

test.describe("vendors and bank-account changes (§8, D-169)", () => {
  test("a change needs Finance and then the Finance Manager, and a call-back, before it pays", async ({ browser }) => {
    test.setTimeout(90_000);
    const admin = await (await browser.newContext()).newPage();
    await signInAsStaff(admin, "superadmin");
    await gotoHydrated(admin, `${HOSTS.admin}/finance/payables/vendors`);
    await admin.getByRole("link", { name: /บริษัท ขนส่งด่วนตัวอย่าง/ }).click();
    await expectAxeClean(admin);
    await admin.getByRole("button", { name: "ขอเปลี่ยนบัญชี" }).click();
    const form = admin.getByRole("dialog", { name: /ขอเปลี่ยนบัญชีรับเงินของ/ });
    await form.getByLabel(/^เลขบัญชี/).fill("123-4-56789-0");
    await form.getByRole("button", { name: "ตรวจทาน" }).click();
    await confirmTyped(admin, "ส่งคำขอ", "0105561234567");
    const banks = admin.getByRole("table", { name: "บัญชีรับเงิน" });
    await expect(banks.getByRole("row", { name: /xxx7890/ })).toContainText("รออนุมัติ");
    const approvalHref = await banks
      .getByRole("row", { name: /xxx7890/ })
      .getByRole("link", { name: "ดูคำขออนุมัติ" })
      .getAttribute("href");

    const finance = await (await browser.newContext()).newPage();
    await signInAsStaff(finance, "finance");
    await approveAs(finance, approvalHref!);
    const manager = await (await browser.newContext()).newPage();
    await signInAsStaff(manager, "finance_manager");
    await approveAs(manager, approvalHref!);

    // Approved, but not used until the call-back on the number on record confirms it.
    await gotoHydrated(finance, admin.url());
    const row = finance.getByRole("table", { name: "บัญชีรับเงิน" }).getByRole("row", { name: /xxx7890/ });
    await expect(row).toContainText("รออนุมัติ");
    await row.getByRole("button", { name: "บันทึกการโทรยืนยัน" }).click();
    const call = finance.getByRole("dialog", { name: /บันทึกการโทรยืนยันบัญชีลงท้าย 7890/ });
    await call.getByLabel(/^เบอร์ที่โทร/).fill("021234567");
    await call.getByLabel(/^เวลาที่โทร/).fill(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 16));
    await call.getByRole("button", { name: "บันทึก" }).click();
    await expect(finance.getByText("บันทึกการโทรยืนยันแล้ว")).toBeVisible();
    await expect(
      finance.getByRole("table", { name: "บัญชีรับเงิน" }).getByRole("row", { name: /xxx7890/ }),
    ).toContainText("ใช้งาน");
  });

  test("whoever records a vendor's bill cannot change that vendor's bank account", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/payables/vendors`);
    await page.getByRole("link", { name: /คุณออกแบบ ตัวอย่าง/ }).click();
    await page.getByRole("button", { name: "บันทึกบิล" }).click();
    const bill = page.getByRole("dialog", { name: /บันทึกบิลของ/ });
    await bill.getByLabel(/^เลขที่บิล/).fill("FL-E2E-0001");
    await bill.getByLabel(/^วันที่บิล/).fill(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10));
    await choiceList(bill, /^บัญชี/).click();
    await page.getByRole("option", { name: /^5140/ }).click();
    await bill.getByLabel(/^รายละเอียด/).fill("ออกแบบฉลาก (e2e)");
    await bill.getByLabel(/^มูลค่า/).fill("2500");
    await bill.getByRole("button", { name: "บันทึกบิล" }).click();
    await expect(page.getByText("บันทึกบิลแล้ว")).toBeVisible();

    await page.getByRole("button", { name: "ขอเปลี่ยนบัญชี" }).click();
    const form = page.getByRole("dialog", { name: /ขอเปลี่ยนบัญชีรับเงินของ/ });
    await form.getByLabel(/^เลขบัญชี/).fill("9876543210");
    await form.getByRole("button", { name: "ตรวจทาน" }).click();
    await confirmTyped(page, "ส่งคำขอ", "1100700123458").catch(() => undefined);
    await expect(page.getByText(/ผู้บันทึกบิลของผู้ขายรายนี้เปลี่ยนบัญชีธนาคาร/).first()).toBeVisible();
  });
});

test.describe("banking (§6)", () => {
  test("a line without a reference is matched to the payment the workbench suggests", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/banking/lines`);
    await expectAxeClean(page);
    await page.getByRole("button", { name: /รับโอนเงิน \(ไม่มีเลขอ้างอิง\)/ }).click();
    const sheet = page.getByRole("dialog", { name: "รับโอนเงิน (ไม่มีเลขอ้างอิง)" });
    await expect(sheet.getByText("ยอดตรง").first()).toBeVisible();
    await expectAxeClean(page);
    await sheet.getByRole("button", { name: "จับคู่", exact: true }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "จับคู่", exact: true }).click();
    await expect(page.getByText("จับคู่แล้ว").first()).toBeVisible();
  });

  test("money nobody claims is parked, then identified as an order group's payment", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/banking/lines`);
    await page.getByRole("button", { name: /นาย ตัวอย่าง ใจดี/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "พักเป็นเงินรับไม่ระบุผู้โอน" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "พักเงิน" }).click();
    await expect(page.getByText("พักเป็นเงินรับไม่ระบุผู้โอนแล้ว")).toBeVisible();

    await gotoHydrated(page, `${HOSTS.admin}/finance/banking/unidentified`);
    await expectAxeClean(page);
    await page
      .getByRole("row", { name: /นาย ตัวอย่าง ใจดี/ })
      .getByRole("button", { name: "ระบุผู้โอน" })
      .click();
    const identify = page.getByRole("dialog", { name: /ระบุเจ้าของเงิน/ });
    await identify.getByRole("searchbox").fill("PK-2569-00105");
    await identify.getByRole("button", { name: /PG-2569-00065/ }).click();
    await confirmTyped(page, "บันทึก", "PG-2569-00065");
    await expect(page.getByText("บันทึกเป็นค่าชำระของ PG-2569-00065 แล้ว")).toBeVisible();

    // It is now that group's payment, with its TR out of the clearing account (P29).
    await gotoHydrated(page, `${HOSTS.admin}/finance/documents?docType=tr&q=PK-2569-00105`);
    await expect(
      page.getByRole("table", { name: "ทะเบียนเอกสารลูกค้า" }).getByRole("link", { name: /^TR/ }),
    ).toHaveCount(1);
  });

  test("a statement file imports once; overlapping lines are skipped", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/banking/import`);
    await expectAxeClean(page);
    const csv = `date,description,reference,amount,balance\n${new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)},รับโอน e2e,E2E-REF-01,1500.00,\n`;
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "statement.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: "นำเข้า", exact: true }).click();
    await expect(page.getByText("นำเข้า 1 รายการ จับคู่อัตโนมัติ 0 รายการ").first()).toBeVisible();
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "statement-again.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: "นำเข้า", exact: true }).click();
    await expect(page.getByText("นำเข้า 0 รายการ จับคู่อัตโนมัติ 0 รายการ").first()).toBeVisible();
  });
});

test.describe("every 6.2 screen is axe-clean", () => {
  for (const [path, heading] of [
    ["/finance/payables", "เจ้าหนี้คงค้าง"],
    ["/finance/payables/purchase-orders", "ใบสั่งผลิตถึงโรงงาน"],
    ["/finance/payables/goods-receipts", "ใบรับมอบงาน"],
    ["/finance/payables/statements", "ใบวางบิลของโรงงาน"],
    ["/finance/payables/invoices", "ใบกำกับภาษีและบิลผู้ขาย"],
    ["/finance/payables/vendors", "ผู้ขาย"],
    ["/finance/payouts/exceptions", "รายการจ่ายผิดปกติ"],
    ["/finance/banking", "ธนาคารและเงินสด"],
    ["/finance/banking/accounts", "บัญชีธนาคารของบริษัท"],
  ] as const) {
    test(path, async ({ page }) => {
      await signInAsStaff(page, "finance");
      await gotoHydrated(page, `${HOSTS.admin}${path}`);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.waitForLoadState("networkidle").catch(() => {});
      await expectAxeClean(page);
    });
  }

  test("a statement, a PO and a tax invoice open from their lists", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/payables/statements`);
    await page.getByRole("table", { name: "ใบวางบิลของโรงงาน" }).getByRole("link", { name: /^BS-/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /^ใบวางบิล BS-/ })).toBeVisible();
    await expectAxeClean(page);
    await gotoHydrated(page, `${HOSTS.admin}/finance/payables/purchase-orders`);
    await page.getByRole("table", { name: "ใบสั่งผลิตถึงโรงงาน" }).getByRole("link", { name: /^PO/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /^ใบสั่งผลิต PO/ })).toBeVisible();
    await expectAxeClean(page);
    await gotoHydrated(page, `${HOSTS.admin}/finance/payables/invoices`);
    await page.getByRole("table", { name: "ใบกำกับภาษีและบิลผู้ขาย" }).getByRole("link").first().click();
    await expect(page.getByRole("heading", { level: 1, name: /^ใบกำกับภาษี / })).toBeVisible();
    await expectAxeClean(page);
  });
});
