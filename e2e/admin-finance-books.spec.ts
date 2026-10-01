import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F6.3 — the general ledger, tax and fixed assets, against the MSW mock of the published B5.1 /
 * B5.4 / B5.5 surface. The mock keeps state for the run and tests run in parallel, so each test
 * owns its records: the manual journal and the account it proposes, next month's soft close,
 * the ภ.ง.ด.53 of this month, and the asset registered and written off here.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectAxeClean(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).exclude("[data-sonner-toaster]").analyze();
  const report = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`,
  );
  expect(violations, report.join("\n\n")).toEqual([]);
}

async function confirm(page: Page, button: string, phrase?: string) {
  const dialog = page.getByRole("alertdialog");
  if (phrase) {
    await expect(dialog.getByRole("button", { name: button, exact: true })).toBeDisabled();
    await dialog.getByLabel(`พิมพ์ ${phrase} เพื่อยืนยัน`).fill(phrase);
  }
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

async function pickAccount(page: Page, label: string, code: string) {
  const box = page.getByRole("combobox", { name: label });
  const option = page.getByRole("option", { name: new RegExp(`^${code} `) });
  // The chart of accounts may still be loading when the code is typed: type it again until it is offered.
  await expect(async () => {
    await box.fill("");
    await box.fill(code);
    await expect(option).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await option.click();
}

async function choose(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

const bangkok = (offsetDays = 0) =>
  new Date(Date.now() + 7 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
const thisMonth = () => bangkok().slice(0, 7);
// The mock's seeded payout run is paid five days back (`mocks/admin/finance/payouts.ts`), so its
// WHT certificates, and the ภ.ง.ด.53 lines they make, fall in that day's month — the previous one
// during a month's first five days.
const seededRunMonth = () => bangkok(-5).slice(0, 7);
const nextMonth = () => {
  const [year, month] = thisMonth().split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 15)).toISOString().slice(0, 10);
};

test.describe("the general ledger (§1, §8)", () => {
  test("a manual journal is refused unbalanced, saved as a draft, approved by a Finance Manager and posted with a JV number", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const finance = await (await browser.newContext()).newPage();
    await signInAsStaff(finance, "finance");
    await gotoHydrated(finance, `${HOSTS.admin}/finance/ledger/journals`);
    await finance.getByRole("link", { name: "บันทึกรายการด้วยมือ" }).click();
    await expect(finance).toHaveURL(/\/finance\/ledger\/journals\/new$/);
    await finance.getByLabel(/^คำอธิบาย(?!บรรทัด)/).fill("ตั้งค้างจ่ายค่าที่ปรึกษาภาษี (ทดสอบ E2E)");
    await pickAccount(finance, "บัญชีของบรรทัด 1", "6900");
    await finance.getByLabel("จำนวนเงินของบรรทัด 1").fill("2500.00");
    await choose(finance, "ศูนย์ต้นทุนของบรรทัด 1", /^ADMIN/);
    await pickAccount(finance, "บัญชีของบรรทัด 2", "2410");
    await choose(finance, "ด้านของบรรทัด 2", "เครดิต");
    await finance.getByLabel("จำนวนเงินของบรรทัด 2").fill("2400.00");
    await expectAxeClean(finance);

    // The API totals the lines, not the screen: an entry that does not balance is not saved.
    await finance.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
    await expect(finance.getByText("รายการไม่สมดุล")).toBeVisible();
    await expect(finance).toHaveURL(/\/new$/);
    await finance.getByLabel("จำนวนเงินของบรรทัด 2").fill("2500.00");
    await finance.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
    await expect(finance).toHaveURL(/\/finance\/ledger\/journals\/[0-9a-f-]+$/);
    await expect(finance.getByText("ฉบับร่าง").first()).toBeVisible();
    await expectAxeClean(finance);

    await finance.getByRole("button", { name: "ส่งอนุมัติ" }).click();
    await confirm(finance, "ส่งอนุมัติ");
    await expect(finance.getByText("คุณเป็นผู้จัดทำรายการนี้", { exact: false })).toBeVisible();
    const approval = await finance.getByRole("link", { name: "ดูคำขออนุมัติ" }).first().getAttribute("href");
    const journalUrl = finance.url();

    // The maker is never offered the approval; a Finance Manager is.
    await gotoHydrated(finance, `${HOSTS.admin}${approval}`);
    await expect(finance.getByRole("button", { name: "อนุมัติ", exact: true })).toHaveCount(0);
    const manager = await (await browser.newContext()).newPage();
    await signInAsStaff(manager, "finance_manager");
    await approveAs(manager, approval!);

    await gotoHydrated(finance, journalUrl);
    await expect(finance.getByText("บันทึกแล้ว").first()).toBeVisible();
    await expect(finance.getByRole("heading", { level: 1 })).toContainText("JE-");
    // A posted manual entry is corrected by a reversal, never edited.
    await expect(finance.getByRole("button", { name: "แก้ไข" })).toHaveCount(0);
    await expect(finance.getByRole("button", { name: "กลับรายการ" })).toBeVisible();
  });

  test("the chart of accounts takes a proposal for approval, and a posting rule is tried without posting", async ({
    page,
  }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/ledger/accounts`);
    await expect(page.getByRole("table", { name: "ผังบัญชี" })).toContainText("ลูกหนี้การค้า");
    await expectAxeClean(page);
    await page.getByRole("button", { name: "เสนอบัญชีใหม่" }).click();
    const dialog = page.getByRole("dialog", { name: "เสนอบัญชีใหม่" });
    await dialog.getByLabel(/^รหัส/).fill("6910");
    await dialog.getByLabel(/^ชื่อ \(ไทย\)/).fill("ค่าที่ปรึกษา (ทดสอบ)");
    await dialog.getByLabel(/^เหตุผล/).fill("แยกค่าที่ปรึกษาออกจากค่าใช้จ่ายอื่น");
    await dialog.getByRole("button", { name: "ส่งอนุมัติ" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const changes = page.getByRole("table", { name: "การเปลี่ยนแปลงที่เสนอ" });
    await expect(changes.getByRole("row", { name: /6910/ })).toContainText("เสนอแล้ว");

    await gotoHydrated(page, `${HOSTS.admin}/finance/ledger/rules`);
    await page.getByRole("link", { name: "P02", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("P02");
    // The sample puts 1,000.00 on every amount, which does not balance; a real event does.
    await page.getByRole("button", { name: "ทดลอง", exact: true }).click();
    await expect(page.getByText("ไม่สมดุล", { exact: true })).toBeVisible();
    await page
      .getByLabel("ข้อมูลเหตุการณ์ตัวอย่าง (JSON)")
      .fill('{ "grossAmount": "1070.00", "netAmount": "1000.00", "vatAmount": "70.00" }');
    await page.getByRole("button", { name: "ทดลอง", exact: true }).click();
    await expect(page.getByText("สมดุล", { exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "บรรทัดที่จะบันทึก" }).getByRole("row")).toHaveCount(4);
    await expectAxeClean(page);
  });

  test("a soft-closed month sends a posting to the next open month, said before anyone saves (§1.4)", async ({
    browser,
  }) => {
    const manager = await (await browser.newContext()).newPage();
    await signInAsStaff(manager, "finance_manager");
    await gotoHydrated(manager, `${HOSTS.admin}/finance/ledger/periods`);
    await expectAxeClean(manager);
    const month = nextMonth().slice(0, 7);
    const row = manager
      .getByRole("row")
      .filter({ has: manager.getByRole("cell", { name: String(Number(month.slice(5, 7))), exact: true }) });
    await row.getByRole("button", { name: "ปิดชั่วคราว" }).click();
    await confirm(manager, "ปิดชั่วคราว");
    await expect(row).toContainText("ปิดชั่วคราว");

    // Finance drafting into that month is told where it will land before saving.
    const finance = await (await browser.newContext()).newPage();
    await signInAsStaff(finance, "finance");
    await gotoHydrated(finance, `${HOSTS.admin}/finance/ledger/journals/new`);
    await finance.getByLabel(/^วันที่เอกสาร/).fill(nextMonth());
    await expect(finance.getByText("เดือนนี้ปิดชั่วคราวแล้ว")).toBeVisible();
    await expect(finance.getByText(/จะลงในเดือน/)).toBeVisible();

    await row.getByRole("button", { name: "เปิดอีกครั้ง" }).click();
    await manager
      .getByRole("alertdialog")
      .getByLabel(/^เหตุผล/)
      .fill("ทดสอบเสร็จแล้ว");
    await confirm(manager, "เปิดอีกครั้ง");
    await expect(row).toContainText("เปิด");
    // Finance does not move periods.
    await gotoHydrated(finance, `${HOSTS.admin}/finance/ledger/periods`);
    await expect(finance.getByRole("button", { name: "ปิดชั่วคราว" })).toHaveCount(0);
  });
});

test.describe("tax (§6, D-033)", () => {
  test("the month's papers reconcile to the GL at zero; ภ.ง.ด.53 is finalised, its attachment exported and its filing recorded", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const finance = await (await browser.newContext({ acceptDownloads: true })).newPage();
    await signInAsStaff(finance, "finance");
    await gotoHydrated(finance, `${HOSTS.admin}/finance/tax?period=${seededRunMonth()}`);
    const papers = finance.getByRole("table", { name: "รายงานภาษีของเดือน" });
    await finance.getByRole("button", { name: "สร้าง", exact: true }).first().waitFor();
    for (const name of ["รายงานภาษีขาย", "รายงานภาษีซื้อ", "ภ.ง.ด.53 (นิติบุคคล)"]) {
      const row = papers.getByRole("row", { name: new RegExp(name.replace(/[.()]/g, "\\$&")) });
      const build = row.getByRole("button", { name: /^(สร้าง|สร้างใหม่)$/ });
      if (await build.count()) await build.click();
      await expect(row).toContainText("ตรงกับบัญชีแยกประเภท");
    }
    await expectAxeClean(finance);

    await papers.getByRole("link", { name: "ภ.ง.ด.53 (นิติบุคคล)" }).click();
    await expect(finance.getByRole("heading", { level: 1 })).toContainText("ภ.ง.ด.53");
    await expect(finance.getByText("ผลต่างเป็นศูนย์ ปิดรายงานได้")).toBeVisible();
    await expect(
      finance
        .getByRole("table", { name: /^รายการ \(/ })
        .getByRole("row")
        .nth(1),
    ).toContainText("WT");
    await expectAxeClean(finance);
    await finance.getByRole("button", { name: "ปิดรายงาน" }).click();
    await confirm(finance, "ปิดรายงาน", seededRunMonth());
    await expect(finance.getByText("ปิดแล้ว").first()).toBeVisible();

    const download = finance.waitForEvent("download");
    await finance.getByRole("button", { name: "ส่งออกใบแนบ" }).click();
    const csv = await readFile((await (await download).path())!, "utf8");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")[0]).toBe(
      "\uFEFFseq,wtNumber,form,taxId,branch,name,address,paidOn,incomeType,ratePct,paidAmount,whtAmount,condition,status",
    );

    await finance.getByRole("button", { name: "บันทึกการยื่นแบบ" }).click();
    const dialog = finance.getByRole("dialog", { name: "บันทึกการยื่นแบบ" });
    await dialog.getByLabel(/^เลขอ้างอิงการยื่นแบบ/).fill("RD-E2E-000123");
    await dialog.getByRole("button", { name: "บันทึกการยื่นแบบ" }).click();
    await expect(finance.getByText("ยื่นแล้ว").first()).toBeVisible();
    // Paying the Revenue Department is a Finance Manager's.
    await expect(finance.getByRole("button", { name: "บันทึกการชำระ" })).toHaveCount(0);

    await gotoHydrated(finance, `${HOSTS.admin}/finance/tax/calendar`);
    await expect(finance.getByRole("table", { name: "ปฏิทินภาษี" })).toContainText("ภ.พ.30");
    await expectAxeClean(finance);
  });

  test("rates change only by an approved version, the nature of sale is read from settings, and e-Tax stays off until R2", async ({
    page,
  }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/tax/settings`);
    await expect(page.getByRole("table", { name: "อัตราภาษี" })).toContainText("ภาษีมูลค่าเพิ่ม อัตราทั่วไป");
    await expect(page.getByText("จ้างทำของ").first()).toBeVisible();
    await expect(page.getByRole("switch", { name: "ส่งใบกำกับภาษีอิเล็กทรอนิกส์" })).toBeDisabled();
    await expectAxeClean(page);
    const row = page.getByRole("row", { name: /wht_service/ });
    await row.getByRole("button", { name: "เสนออัตราใหม่" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^อัตราใหม่/).fill("2");
    await dialog.getByLabel(/^เหตุผล/).fill("ตามประกาศกรมสรรพากร (ทดสอบ)");
    await dialog.getByRole("button", { name: "ส่งอนุมัติ" }).click();
    await expect(row).toContainText("เสนอแล้ว");
    await expect(row.getByRole("button", { name: "เสนออัตราใหม่" })).toBeDisabled();

    await gotoHydrated(page, `${HOSTS.admin}/finance/tax/series`);
    await expect(page.getByRole("table", { name: "เลขที่เอกสาร" })).toContainText("ใบสำคัญทั่วไป (JV)");
    await expectAxeClean(page);
  });
});

test.describe("fixed assets (D-150)", () => {
  test("an asset is registered and written off, the month's depreciation is previewed then posted once, and the register agrees with the GL", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const finance = await (await browser.newContext()).newPage();
    await signInAsStaff(finance, "finance");
    await gotoHydrated(finance, `${HOSTS.admin}/finance/assets`);
    await expectAxeClean(finance);
    await finance.getByRole("button", { name: "ขึ้นทะเบียนสินทรัพย์" }).click();
    const dialog = finance.getByRole("dialog", { name: "ขึ้นทะเบียนสินทรัพย์" });
    await choose(finance, /^หมวด/, /^คอมพิวเตอร์และอุปกรณ์/);
    await dialog.getByLabel(/^ชื่อ/).fill("จอภาพฝ่ายเตรียมพิมพ์ (ทดสอบ)");
    await dialog.getByLabel(/^ราคาทุน/).fill("18000.00");
    await pickAccount(finance, "บัญชีที่บันทึกเครดิต", "3100");
    await dialog.getByRole("button", { name: "ขึ้นทะเบียน", exact: true }).click();
    await expect(finance).toHaveURL(/\/finance\/assets\/[0-9a-f-]+$/);
    await expect(finance.getByRole("heading", { level: 1 })).toContainText("จอภาพฝ่ายเตรียมพิมพ์");
    await expectAxeClean(finance);

    // The seeded furniture has last month's depreciation, so it can be written off this month.
    const manager = await (await browser.newContext()).newPage();
    await signInAsStaff(manager, "finance_manager");
    await gotoHydrated(manager, `${HOSTS.admin}/finance/assets?q=${encodeURIComponent("ชุดโต๊ะประชุม")}`);
    await manager.getByRole("link", { name: /^FA-/ }).first().click();
    await expect(manager).toHaveURL(/\/finance\/assets\/[0-9a-f-]+$/);
    await expect(manager.getByRole("heading", { level: 1 })).toContainText("ชุดโต๊ะประชุม");
    const assetNo = (await manager.getByRole("heading", { level: 1 }).textContent())!.split(" · ")[0]!.trim();
    await manager.getByRole("button", { name: "จำหน่ายหรือตัดบัญชี" }).click();
    await manager.getByRole("alertdialog").getByRole("radio", { name: "ตัดบัญชี" }).click();
    await manager
      .getByRole("alertdialog")
      .getByLabel(/^เหตุผล/)
      .fill("ชำรุดเสียหายจากน้ำท่วม (ทดสอบ)");
    await confirm(manager, "ตัดบัญชี", assetNo);
    await expect(manager.getByText("ตัดบัญชีแล้ว").first()).toBeVisible();

    await gotoHydrated(finance, `${HOSTS.admin}/finance/assets/depreciation`);
    const preview = finance.getByRole("table", { name: "สิ่งที่จะบันทึก" });
    await expect(preview).toContainText("จอภาพฝ่ายเตรียมพิมพ์");
    await expect(preview).not.toContainText("ชุดโต๊ะประชุม");
    await expectAxeClean(finance);
    await finance.getByRole("button", { name: "บันทึกค่าเสื่อมราคา" }).click();
    await confirm(finance, "บันทึกค่าเสื่อมราคา", thisMonth());
    await expect(finance.getByText("บันทึกแล้ว", { exact: true })).toBeVisible();
    await expect(finance.getByRole("button", { name: "บันทึกค่าเสื่อมราคา" })).toBeDisabled();

    await gotoHydrated(finance, `${HOSTS.admin}/finance/assets/roll-forward`);
    const recon = finance.getByRole("table", { name: "ทะเบียนเทียบกับบัญชีแยกประเภท" });
    await expect(recon.getByRole("row", { name: /1510/ })).toContainText("ตรงกัน");
    await expect(recon.getByRole("row", { name: /1519/ })).toContainText("ตรงกัน");
    await expectAxeClean(finance);
  });
});
