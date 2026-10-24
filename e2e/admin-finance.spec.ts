import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F6.1 — the finance workspace's queues and customer documents, against the MSW mock of the
 * published B5 surface. The mock keeps state for the whole run and tests run in parallel, so each
 * test works on records no other test touches: the slips of order groups PG-2569-00068 / 00070
 * (admin-orders reads 00067 and approves 00069), the tax invoice of PK-2569-00134.
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

/** Types the phrase a typed confirmation asks for (00-master-plan §8), then presses its confirm button. */
async function confirmTyped(page: Page, button: string, phrase: string, { closes = true } = {}) {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: button, exact: true })).toBeDisabled();
  await dialog.getByLabel(`พิมพ์ ${phrase} เพื่อยืนยัน`).fill(phrase);
  await dialog.getByRole("button", { name: button, exact: true }).click();
  if (closes) await expect(page.getByRole("alertdialog")).toHaveCount(0);
}

test.describe("the finance home", () => {
  test("opens on the finance queues, slips first, with their SLA", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance`);
    await expect(page.getByRole("heading", { level: 1, name: "ภาพรวมการเงิน" })).toBeVisible();
    const queues = page.getByRole("main");
    await expect(queues.getByRole("link", { name: /สลิปรอตรวจ/ })).toBeVisible();
    await expect(queues.getByRole("link", { name: /รอ 50 ทวิ จากลูกค้า/ })).toBeVisible();
    await expect(queues.getByRole("link", { name: /ใบแจ้งหนี้ B2B เกินกำหนด/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "เมนูการเงิน" }).first()).toBeVisible();
    await expectAxeClean(page);
  });
});

test.describe("slip review (D-061)", () => {
  test("Finance approves a slip with the bank reference: the TR is issued and posted by P02", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/slips?q=PG-2569-00070`);
    await expect(page.getByRole("heading", { level: 1, name: "ตรวจสลิปโอนเงิน" })).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("button", { name: "ตรวจสลิป" }).first().click();
    const sheet = page.getByRole("dialog", { name: "ตรวจสลิป PG-2569-00070" });
    await expect(sheet.getByRole("img", { name: /สลิปโอนเงินของ PG-2569-00070/ })).toBeVisible();
    await expectAxeClean(page);

    // Approving without the bank's reference is stopped before anything is sent.
    await sheet.getByRole("button", { name: "อนุมัติสลิป" }).click();
    await expect(sheet.getByText("กรอกเลขอ้างอิงรายการจากธนาคาร")).toBeVisible();
    await sheet.getByLabel(/^เลขอ้างอิงรายการจากธนาคาร/).fill("E2E-SCB-000070");
    await sheet.getByRole("button", { name: "อนุมัติสลิป" }).click();

    const confirm = page.getByRole("alertdialog", { name: "อนุมัติสลิปและรับชำระเงิน" });
    await expect(confirm).toContainText("PG-2569-00070");
    await expect(confirm).toContainText("E2E-SCB-000070");
    await confirmTyped(page, "อนุมัติสลิป", "PG-2569-00070");
    await expect(page.getByText("อนุมัติสลิปของ PG-2569-00070 แล้ว")).toBeVisible();

    // The document it produced, and the journal behind it: document → journal → rule.
    await gotoHydrated(page, `${HOSTS.admin}/finance/documents?docType=tr&q=PG-2569-00070`);
    await page.getByRole("table", { name: "ทะเบียนเอกสารลูกค้า" }).getByRole("link", { name: /^TR/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /ใบกำกับภาษี\/ใบเสร็จรับเงิน \(TR\)/ })).toBeVisible();
    await expect(page.getByText("โอนแนบสลิป")).toBeVisible();
    await expectAxeClean(page);
    await page.getByRole("table", { name: "รายการบัญชีของเอกสารนี้" }).getByRole("link", { name: /^JE-/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^รายการบัญชี JE-/ })).toBeVisible();
    await expect(page.getByText("P02 ฉบับที่ 1")).toBeVisible();
    await expect(page.getByText("1133")).toBeVisible();
    await expectAxeClean(page);
  });

  test("a bank reference already used is refused as a duplicate slip", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/slips?q=PG-2569-00068`);
    await page.getByRole("button", { name: "ตรวจสลิป" }).first().click();
    const sheet = page.getByRole("dialog", { name: "ตรวจสลิป PG-2569-00068" });
    // TXN1011 is the gateway reference of an order paid at seed time.
    await sheet.getByLabel(/^เลขอ้างอิงรายการจากธนาคาร/).fill("TXN1011");
    await sheet.getByRole("button", { name: "อนุมัติสลิป" }).click();
    await confirmTyped(page, "อนุมัติสลิป", "PG-2569-00068", { closes: false });
    await expect(page.getByText(/สลิปซ้ำ/).first()).toBeVisible();
  });

  test("CS reads the queue but is not offered the decision", async ({ page }) => {
    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/finance/slips?q=PG-2569-00068`);
    await page.getByRole("button", { name: "ตรวจสลิป" }).first().click();
    const sheet = page.getByRole("dialog", { name: "ตรวจสลิป PG-2569-00068" });
    await expect(sheet.getByText("คุณดูสลิปได้ แต่การอนุมัติเป็นหน้าที่ของฝ่ายการเงิน")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "อนุมัติสลิป" })).toHaveCount(0);
  });
});

test.describe("credit notes (§2, §8)", () => {
  test("a credit note is requested against a tax invoice and issued only after another person approves", async ({
    browser,
  }) => {
    const finance = await (await browser.newContext()).newPage();
    await signInAsStaff(finance, "finance");
    await gotoHydrated(finance, `${HOSTS.admin}/finance/credit-notes/new`);
    await expect(finance.getByRole("heading", { name: "ขอออกใบลดหนี้" }).first()).toBeVisible();
    await expectAxeClean(finance);

    await finance.getByRole("searchbox", { name: "ค้นหาใบกำกับภาษี" }).fill("PK-2569-00134");
    await finance
      .getByRole("button", { name: /PK-2569-00134/ })
      .first()
      .click();
    await finance
      .getByRole("radio", { name: /ลดราคา/ })
      .first()
      .click();
    await finance.getByRole("button", { name: "ถัดไป" }).first().click();
    await finance.getByLabel(/^ยอดลดหนี้รวมภาษี/).fill("107");
    await finance.getByLabel(/^รายละเอียด/).fill("ลดราคาตามที่ตกลงกับลูกค้า (e2e)");
    await finance.getByRole("button", { name: "ถัดไป" }).last().click();
    await finance.getByRole("button", { name: "ส่งคำขอใบลดหนี้" }).click();
    const confirm = finance.getByRole("alertdialog", { name: "ส่งคำขอใบลดหนี้" });
    await expect(confirm).toContainText("PK-2569-00134");
    await confirmTyped(finance, "ส่งคำขอใบลดหนี้", "PK-2569-00134");
    await expect(finance).toHaveURL(/\/finance\/credit-notes$/);

    const row = finance.getByRole("row", { name: /PK-2569-00134/ }).first();
    await expect(row).toContainText("รออนุมัติ");
    const approvalHref = await row.getByRole("link", { name: "ดูคำขออนุมัติ" }).getAttribute("href");

    // The requester is not offered the approval (maker-checker, D-169).
    await gotoHydrated(finance, `${HOSTS.admin}${approvalHref}`);
    await expect(finance.getByRole("button", { name: "อนุมัติ", exact: true })).toHaveCount(0);

    const manager = await (await browser.newContext()).newPage();
    await signInAsStaff(manager, "finance_manager");
    await gotoHydrated(manager, `${HOSTS.admin}${approvalHref}`);
    await manager.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    const approve = manager.getByRole("alertdialog", { name: "อนุมัติคำขอนี้?" });
    await approve.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    await expect(manager.getByText("อนุมัติแล้ว").first()).toBeVisible();

    await gotoHydrated(manager, `${HOSTS.admin}/finance/credit-notes?q=PK-2569-00134`);
    const issued = manager.getByRole("row", { name: /PK-2569-00134/ }).first();
    await expect(issued).toContainText("ออกใบลดหนี้แล้ว");
    await issued.getByRole("link", { name: /^CN/ }).click();
    await expect(manager.getByRole("heading", { level: 1, name: /ใบลดหนี้ \(CN\)/ })).toBeVisible();
    await expect(manager.getByText("ลดราคาสินค้า/บริการ")).toBeVisible();
  });
});

test.describe("refunds (D-169)", () => {
  test("the requester cannot record the payout; another Finance user does, with the bank reference", async ({
    browser,
  }) => {
    // Finance asked for it and the Finance Manager approved it (the seed).
    const finance = await (await browser.newContext()).newPage();
    await signInAsStaff(finance, "finance");
    await gotoHydrated(finance, `${HOSTS.admin}/finance/refunds?status=approved`);
    await finance
      .getByRole("table", { name: "คืนเงินลูกค้า" })
      .getByRole("row")
      .nth(1)
      .getByRole("button")
      .first()
      .click();
    const sheet = finance.getByRole("dialog", { name: "คำขอคืนเงิน" });
    await expect(sheet.getByText("คุณเป็นผู้ขอคืนเงินรายการนี้")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "บันทึกว่าโอนคืนแล้ว" })).toHaveCount(0);

    const manager = await (await browser.newContext()).newPage();
    await signInAsStaff(manager, "finance_manager");
    await gotoHydrated(manager, `${HOSTS.admin}/finance/refunds?status=approved`);
    await manager
      .getByRole("table", { name: "คืนเงินลูกค้า" })
      .getByRole("row")
      .nth(1)
      .getByRole("button")
      .first()
      .click();
    const other = manager.getByRole("dialog", { name: "คำขอคืนเงิน" });
    await expectAxeClean(manager);
    await other.getByLabel(/^เลขอ้างอิงการโอนจากธนาคาร/).fill("KB-E2E-0500");
    await other.getByRole("button", { name: "บันทึกว่าโอนคืนแล้ว" }).click();
    await confirmTyped(manager, "บันทึกว่าโอนคืนแล้ว", "500.00");
    await expect(manager.getByText("บันทึกการคืนเงินแล้ว")).toBeVisible();
  });
});

test.describe("receivables", () => {
  test("a customer's 50 ทวิ is recorded with its number, date and a copy", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/receivables/wht`);
    await expect(page.getByRole("heading", { level: 1, name: /50 ทวิ/ })).toBeVisible();
    await expectAxeClean(page);
    const table = page.getByRole("table", { name: /50 ทวิ/ });
    const row = table
      .getByRole("row")
      .filter({ has: page.getByRole("button", { name: "บันทึกการรับ" }) })
      .first();
    const receipt = (await row.getByRole("link", { name: /^RC/ }).textContent())!.trim();
    await row.getByRole("button", { name: "บันทึกการรับ" }).click();
    const dialog = page.getByRole("dialog", { name: /บันทึกหนังสือรับรองของ RC/ });
    await dialog.getByLabel(/^เลขที่หนังสือรับรอง/).fill("50T-E2E-0001");
    await dialog
      .getByLabel(/^วันที่ในหนังสือรับรอง/)
      .fill(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10));
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "50tawi.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });
    await dialog.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("บันทึกหนังสือรับรองแล้ว")).toBeVisible();
    // It leaves the list of certificates still awaited.
    await expect(table.getByRole("link", { name: receipt })).toHaveCount(0);
  });

  test("aging reads by bucket, and a company's statement lists its credit-term orders", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/receivables/aging`);
    await expect(page.getByRole("table", { name: "อายุลูกหนี้" })).toContainText("เกิน 1–30 วัน");
    await expectAxeClean(page);
    await gotoHydrated(page, `${HOSTS.admin}/finance/receivables/statements`);
    await expect(page.getByRole("table", { name: "ใบแจ้งยอดรายเดือนของบริษัท" }).getByRole("row")).not.toHaveCount(1);
    await expectAxeClean(page);
  });
});

test.describe("every 6.1 screen is axe-clean", () => {
  for (const [path, heading] of [
    ["/finance/payments", "การรับชำระเงิน"],
    ["/finance/refunds", "คืนเงินลูกค้า"],
    ["/finance/documents", "ทะเบียนเอกสารลูกค้า"],
    ["/finance/documents?docType=iv", "ทะเบียนเอกสารลูกค้า"],
    ["/finance/credit-notes", "ใบลดหนี้"],
    ["/finance/receivables", "ลูกหนี้การค้า"],
    ["/finance/receivables?overdue=true", "ลูกหนี้การค้า"],
    ["/finance/receivables/dunning", "การทวงถามการชำระเงิน"],
    ["/finance/ledger/journals", "รายการบัญชี"],
  ] as const) {
    test(path, async ({ page }) => {
      await signInAsStaff(page, "finance");
      await gotoHydrated(page, `${HOSTS.admin}${path}`);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.waitForLoadState("networkidle").catch(() => {});
      await expectAxeClean(page);
    });
  }

  test("a customer's balance page, and a payment's detail", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/receivables?overdue=true`);
    await page
      .getByRole("table", { name: "ลูกหนี้การค้า" })
      .getByRole("link", { name: /บริษัท/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("บริษัท");
    await expect(page.getByText("เกิน 1–30 วัน").first()).toBeVisible();
    await expectAxeClean(page);

    await gotoHydrated(page, `${HOSTS.admin}/finance/payments`);
    await page.getByRole("table", { name: "การรับชำระเงิน" }).getByRole("link", { name: /^REF/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /^การชำระเงิน REF/ })).toBeVisible();
    await expectAxeClean(page);
  });
});
