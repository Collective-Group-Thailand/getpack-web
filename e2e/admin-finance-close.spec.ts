import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F6.4 — period close, financial reports and the auditor, against the MSW mock of the published
 * B5.6 surface. The mock keeps state for the run and tests run in parallel, so each test owns
 * its records: last month's close (its tax papers, checklist and lock), the reports of this
 * month (read, never changed here), and the auditor's samples and PBC pack.
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
  if (phrase) await dialog.getByLabel(`พิมพ์ ${phrase} เพื่อยืนยัน`).fill(phrase);
  await dialog.getByRole("button", { name: button, exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
}

/** Builds every paper not built yet — once the list has loaded (another test may have built some). */
async function buildAllPapers(page: Page) {
  const papers = page.getByRole("table", { name: "รายงานภาษีของเดือน" });
  await expect(papers.getByRole("row").nth(7)).toBeVisible();
  await expect(papers.getByText(/ยังไม่ได้สร้าง|ตรงกับบัญชีแยกประเภท|^ต่างกัน/).first()).toBeVisible();
  await expect(async () => {
    const buildAll = page.getByRole("button", { name: "สร้างฉบับร่างทั้งหมด" });
    if ((await papers.getByText("ยังไม่ได้สร้าง").count()) > 0 && (await buildAll.isEnabled())) await buildAll.click();
    await expect(papers.getByText("ยังไม่ได้สร้าง")).toHaveCount(0, { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

const bangkok = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const thisMonth = () => bangkok().slice(0, 7);
const lastMonth = () => {
  const [year, month] = thisMonth().split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
};

test.describe("the month in numbers (§6, §7)", () => {
  test("a month on the mocks: the trial balance balances, the statements agree, every sub-ledger and tax paper reconciles at zero", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/finance/reports`);
    await expect(page.getByText("สมดุล: เดบิตเท่ากับเครดิต")).toBeVisible();
    await expect(page.getByRole("table", { name: "งบทดลอง" })).toContainText("2330");
    await expectAxeClean(page);

    // The export is the API's figures as they came, with the totals row.
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "ส่งออก CSV" }).click();
    const csv = await readFile((await (await download).path())!, "utf8");
    const rows = csv
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");
    expect(rows[0]).toBe("accountCode,nameTh,nameEn,accountType,opening,debit,credit,closing");
    const total = rows.at(-1)!.split(",");
    expect(total[0]).toBe("TOTAL");
    expect(total[5]).toBe(total[6]);
    expect(total[7]).toBe("0.00");

    await page.getByRole("link", { name: "งบแสดงฐานะการเงิน" }).click();
    await expect(page.getByText("สินทรัพย์เท่ากับหนี้สินและส่วนของผู้ถือหุ้น")).toBeVisible();
    await expectAxeClean(page);
    await page.getByRole("link", { name: "งบกระแสเงินสด" }).click();
    await expect(page.getByText("ตรงกับบัญชีเงินสด")).toBeVisible();
    await page.getByRole("link", { name: "งบกำไรขาดทุน" }).click();
    await page.getByRole("combobox", { name: "จัดกลุ่มตาม" }).click();
    await page.getByRole("option", { name: "ศูนย์ต้นทุน" }).click();
    await expect(page.getByRole("table", { name: "งบกำไรขาดทุน" })).toContainText("ADMIN");
    await expectAxeClean(page);
    await page.getByRole("link", { name: "รายงานความเคลื่อนไหว" }).click();
    await expect(page.getByRole("table", { name: "หนี้สินคะแนนสะสม (2330)" }).getByRole("row")).not.toHaveCount(1);
    await expectAxeClean(page);
    await page.getByRole("link", { name: "กระทบยอดบัญชีย่อย" }).click();
    const recon = page.getByRole("table", { name: "กระทบยอดบัญชีย่อย" });
    await expect(recon.getByRole("row")).toHaveCount(8);
    for (const row of await recon.getByRole("row").all()) {
      if ((await row.getByRole("columnheader").count()) > 0) continue;
      await expect(row).toContainText("ตรงกัน");
    }
    await expectAxeClean(page);

    // The month's tax papers, built from the same books.
    await gotoHydrated(page, `${HOSTS.admin}/finance/tax?period=${thisMonth()}`);
    const papers = page.getByRole("table", { name: "รายงานภาษีของเดือน" });
    await buildAllPapers(page);
    await expect(papers.getByText("ตรงกับบัญชีแยกประเภท")).toHaveCount(7);
    await expect(papers.getByText(/^ต่างกัน/)).toHaveCount(0);
  });
});

test.describe("the period close (§7, §8)", () => {
  test("last month closes through its checklist, a Finance Manager other than the submitter approves, and once locked nothing posts into it", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const month = lastMonth();
    const finance = await (await browser.newContext()).newPage();
    await signInAsStaff(finance, "finance");
    const manager = await (await browser.newContext()).newPage();
    await signInAsStaff(manager, "finance_manager");

    // Step 7 needs the month's VAT and WHT papers final at a difference of zero.
    await gotoHydrated(finance, `${HOSTS.admin}/finance/tax?period=${month}`);
    const papers = finance.getByRole("table", { name: "รายงานภาษีของเดือน" });
    await buildAllPapers(finance);
    await expect(papers.getByText("ตรงกับบัญชีแยกประเภท")).toHaveCount(7);
    for (const name of [
      "รายงานภาษีขาย",
      "รายงานภาษีซื้อ",
      "กระดาษทำการ ภ.พ.30",
      "ภ.ง.ด.3 (บุคคลธรรมดา)",
      "ภ.ง.ด.53 (นิติบุคคล)",
    ]) {
      await gotoHydrated(finance, `${HOSTS.admin}/finance/tax?period=${month}`);
      await finance.getByRole("table", { name: "รายงานภาษีของเดือน" }).getByRole("link", { name, exact: true }).click();
      await expect(finance.getByRole("heading", { level: 1 })).toContainText(name.split(" (")[0]!);
      const finalise = finance.getByRole("button", { name: "ปิดรายงาน" });
      if (await finalise.count()) {
        await finalise.click();
        await confirm(finance, "ปิดรายงาน", month);
      }
      await expect(finance.getByText("ปิดแล้ว").first()).toBeVisible();
    }

    await gotoHydrated(finance, `${HOSTS.admin}/finance/close`);
    await expectAxeClean(finance);
    await gotoHydrated(finance, `${HOSTS.admin}/finance/close/${month}`);
    await expect(finance.getByText("ยังไม่เริ่มปิดงวดของเดือนนี้")).toBeVisible();
    await finance.getByRole("button", { name: "เริ่มปิดงวด" }).click();
    await expect(finance.getByRole("region", { name: /^ขั้นตอนที่ 1(?!\d)/ })).toBeVisible();
    await expectAxeClean(finance);

    for (let step = 1; step <= 8; step++) {
      const card = finance.getByRole("region", { name: new RegExp(`^ขั้นตอนที่ ${step}(?!\\d)`) });
      await card.getByRole("button", { name: "ทำเครื่องหมายว่าเสร็จ" }).click();
      const dialog = finance.getByRole("dialog");
      await dialog.getByLabel("หมายเหตุ").fill(`ตรวจขั้นตอนที่ ${step} แล้ว (ทดสอบ E2E)`);
      const answer = finance.waitForResponse((response) => response.url().includes("/actions/complete"));
      await dialog.getByRole("button", { name: "ทำเครื่องหมายว่าเสร็จ" }).click();
      // A blocking check that fails keeps the step open; a Finance Manager may waive it with a reason.
      const blocked = !(await answer).ok();
      if (blocked) await dialog.getByRole("button", { name: "ยกเลิก" }).click();
      if (blocked) {
        await gotoHydrated(manager, `${HOSTS.admin}/finance/close/${month}`);
        const managerCard = manager.getByRole("region", { name: new RegExp(`^ขั้นตอนที่ ${step}(?!\\d)`) });
        await managerCard.getByRole("button", { name: "ยกเว้น" }).click();
        await manager
          .getByRole("alertdialog")
          .getByLabel(/^เหตุผล/)
          .fill("รายการค้างอยู่ระหว่างติดตาม มีคำอธิบายแนบ");
        await confirm(manager, "ยกเว้น");
        await gotoHydrated(finance, `${HOSTS.admin}/finance/close/${month}`);
      }
      await expect(card.getByRole("heading", { level: 2 })).toContainText(/เสร็จแล้ว|ยกเว้นแล้ว/);
    }

    // Finance submits; Finance is never offered the approval.
    await finance.getByRole("button", { name: "ส่งตรวจทาน" }).click();
    await confirm(finance, "ส่งตรวจทาน");
    await expect(finance.getByText("รอตรวจทาน").first()).toBeVisible();
    await expect(finance.getByRole("button", { name: "อนุมัติและปิดงวด" })).toHaveCount(0);

    await gotoHydrated(manager, `${HOSTS.admin}/finance/close/${month}`);
    await expectAxeClean(manager);
    await manager.getByRole("button", { name: "อนุมัติและปิดงวด" }).click();
    await confirm(manager, "อนุมัติและปิดงวด", month);
    await expect(manager.getByText("ปิดงวดแล้ว").first()).toBeVisible();
    await manager.getByRole("button", { name: "ล็อกงวด" }).click();
    await confirm(manager, "ล็อกงวด", month);
    await expect(manager.getByText(/เดือนนี้รับรายการไม่ได้อีก/)).toBeVisible();

    // The locked month says so before anyone posts, and the depreciation run is not offered.
    await gotoHydrated(finance, `${HOSTS.admin}/finance/ledger/journals/new`);
    await finance.getByLabel(/^วันที่เอกสาร/).fill(`${month}-20`);
    await expect(finance.getByText("เดือนนี้ล็อกแล้ว")).toBeVisible();
    await expect(finance.getByText(/จะลงในเดือน/)).toBeVisible();
    await gotoHydrated(finance, `${HOSTS.admin}/finance/assets/depreciation`);
    await finance.getByRole("combobox", { name: "เดือน" }).click();
    await finance.getByRole("option").nth(1).click();
    await expect(finance.getByText("เดือนนี้ไม่รับรายการแล้ว")).toBeVisible();
    await expect(finance.getByRole("button", { name: "บันทึกค่าเสื่อมราคา" })).toBeDisabled();
    await gotoHydrated(finance, `${HOSTS.admin}/finance/ledger/periods`);
    await expect(finance.getByRole("table").first()).toContainText("ล็อกแล้ว");
  });
});

test.describe("the auditor (§8, D-168)", () => {
  test("reads for a set period, draws the same sample from the same seed, lists the exceptions and takes a hashed PBC pack", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const auditor = await (await browser.newContext({ acceptDownloads: true })).newPage();
    await signInAsStaff(auditor, "auditor");
    await gotoHydrated(auditor, `${HOSTS.admin}/finance/audit`);
    await expect(auditor.getByText(/ได้รับสิทธิ์ตั้งแต่ .+ ถึง .+ และสิ้นสุดเองอัตโนมัติ/)).toBeVisible();
    await expect(auditor.getByRole("link", { name: /ร่องรอยการตรวจสอบ/ })).toBeVisible();
    await expectAxeClean(auditor);

    await auditor.getByRole("link", { name: "รายงานข้อยกเว้น" }).click();
    await expect(auditor.getByRole("heading", { name: /เลขที่เอกสารขาดช่วง/ })).toBeVisible();
    await expect(auditor.getByRole("heading", { name: /รายการบันทึกด้วยมือแยกตามผู้จัดทำ/ })).toBeVisible();
    await expectAxeClean(auditor);

    await auditor.getByRole("link", { name: "การสุ่มตัวอย่าง" }).click();
    await auditor.getByRole("combobox", { name: "วิธี" }).click();
    await auditor.getByRole("option", { name: "แบ่งชั้นตามมูลค่า" }).click();
    await auditor.getByLabel("จำนวน").fill("4");
    await auditor.getByLabel(/^ค่าเริ่มต้น/).fill("20260929");
    await auditor.getByRole("button", { name: "สุ่ม", exact: true }).click();
    await expect(auditor.getByText(/ค่าเริ่มต้น 20260929/)).toHaveCount(1);
    await auditor.getByRole("button", { name: "สุ่ม", exact: true }).click();
    await expect(auditor.getByText(/ค่าเริ่มต้น 20260929/)).toHaveCount(2);
    const tables = auditor.getByRole("table", { name: "รายการที่สุ่มได้" });
    expect(await tables.nth(0).innerText()).toBe(await tables.nth(1).innerText());
    await expectAxeClean(auditor);

    await auditor.getByRole("link", { name: "ชุดเอกสาร PBC" }).click();
    await auditor.getByRole("button", { name: "จัดเตรียมชุดเอกสาร" }).click();
    const packs = auditor.getByRole("table", { name: "ชุดเอกสาร PBC" });
    await expect(packs.getByText(/^[0-9a-f]{64}$/)).toHaveCount(1);
    const download = auditor.waitForEvent("download");
    await packs.getByRole("button", { name: "ดาวน์โหลด" }).first().click();
    const pack = await readFile((await (await download).path())!, "utf8");
    for (const sheet of ["## TrialBalance", "## GLDetail", "## TaxReports", "## CloseChecklist", "## Exceptions"])
      expect(pack).toContain(sheet);
    await expectAxeClean(auditor);

    // Read-only: nothing that writes to the books is offered.
    await gotoHydrated(auditor, `${HOSTS.admin}/finance/ledger/journals`);
    await expect(auditor.getByRole("link", { name: "บันทึกรายการด้วยมือ" })).toHaveCount(0);
    await gotoHydrated(auditor, `${HOSTS.admin}/finance/assets/depreciation`);
    await expect(auditor.getByRole("button", { name: "บันทึกค่าเสื่อมราคา" })).toHaveCount(0);
  });
});
