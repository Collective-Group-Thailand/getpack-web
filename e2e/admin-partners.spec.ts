import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";
import { choiceList } from "./helpers/select";

/**
 * F2 2.6 — partner factories, price governance and the production floor, against the mock API.
 *
 * The factories are F001 (the commerce mock's partner) and F002–F007 (`…-666163` + the number);
 * every test that changes state uses a factory, proposal or inspection no other test reads.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const factory = (n: number) =>
  n === 1 ? "00000000-0000-4000-8000-0000000000f1" : `00000000-0000-4000-8000-666163${n.toString().padStart(6, "0")}`;
const proposal = (n: number) => `00000000-0000-4000-8000-707072${n.toString().padStart(6, "0")}`;

async function expectAxeClean(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

async function choose(page: Page, label: string | RegExp, option: string | RegExp) {
  await choiceList(page, label).click();
  await page.getByRole("option", { name: option }).first().click();
}

const header = (page: Page) => page.getByRole("heading", { level: 1 }).locator("..").locator("..");

test.describe("the partner pipeline", () => {
  test("lists factories by onboarding stage", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners`);
    const table = page.getByRole("table", { name: "พาร์ตเนอร์โรงงาน" });
    await expect(table).toContainText("F001");
    await expect(table).toContainText("F005");
    await expectAxeClean(page);

    await page.getByRole("link", { name: /^สมัครแล้ว/ }).click();
    await expect(page).toHaveURL(/status=applied/);
    await expect(table).toContainText("F005");
    await expect(table).not.toContainText("F001");
  });

  test("a role that only reads partners gets no status changes", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/partners/${factory(1)}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "เปลี่ยนสถานะ" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "เชิญเจ้าของโรงงาน" })).toHaveCount(0);
  });
});

test.describe("the factory workspace", () => {
  test("a status change needs a reason and lands in the header", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/${factory(6)}`);
    await expect(header(page)).toContainText("กำลังพิจารณา");
    await expect(page.getByRole("meter", { name: "ความคืบหน้าการรับเข้า" })).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("button", { name: "เปลี่ยนสถานะ" }).click();
    await page.getByRole("menuitem", { name: "เริ่มช่วงทดลอง" }).click();
    const dialog = page.getByRole("alertdialog", { name: "เริ่มช่วงทดลอง" });
    await dialog.getByLabel(/^เหตุผล/).fill("เอกสารครบและผ่านการตรวจเยี่ยม");
    await dialog.getByRole("button", { name: "เริ่มช่วงทดลอง" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(header(page)).toContainText("ทดลองผลิต");
  });

  test("suspending retypes the factory code", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/${factory(3)}`);
    await page.getByRole("button", { name: "เปลี่ยนสถานะ" }).click();
    await page.getByRole("menuitem", { name: "ระงับชั่วคราว" }).click();
    const dialog = page.getByRole("alertdialog", { name: "ระงับโรงงานชั่วคราว" });
    await dialog.getByLabel(/^เหตุผล/).fill("ส่งงานล่าช้าติดต่อกันสามงาน");
    await dialog.getByLabel(/พิมพ์/).fill("F003");
    await dialog.getByRole("button", { name: "ระงับชั่วคราว" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(header(page)).toContainText("ระงับชั่วคราว");
  });

  test("a KYC document is reviewed; a rejection says what to fix", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/${factory(5)}?tab=compliance`);
    const kyc = page.getByRole("table", { name: "เอกสารยืนยันตัวตน (KYC)" });
    await expect(kyc).toContainText("รอตรวจ");
    await expectAxeClean(page);

    await page.getByRole("button", { name: "ตรวจหนังสือรับรองบริษัท" }).click();
    const dialog = page.getByRole("dialog", { name: "ตรวจหนังสือรับรองบริษัท" });
    await dialog.getByRole("radio", { name: "ไม่ผ่าน" }).click();
    await dialog.getByLabel(/^หมายเหตุ/).fill("หนังสือรับรองเกิน 6 เดือน กรุณาขอฉบับใหม่");
    await dialog.getByRole("button", { name: "บันทึกผล" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(kyc.getByRole("row", { name: /หนังสือรับรองบริษัท/ })).toContainText("ไม่ผ่าน");
  });

  test("a new bank account waits on Finance's approval (D-033)", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/${factory(1)}?tab=compliance`);
    await page.getByRole("button", { name: "เสนอบัญชีใหม่" }).click();
    const dialog = page.getByRole("dialog", { name: "เสนอบัญชีใหม่" });
    await expect(dialog).toContainText("ต้องผ่านการโทรยืนยัน");
    await dialog.getByLabel(/^รหัสธนาคาร/).fill("014");
    await dialog.getByLabel(/^เลขที่บัญชี/).fill("1234567890");
    await dialog.getByRole("button", { name: "ส่งขออนุมัติ" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const banks = page.getByRole("table", { name: "บัญชีธนาคาร" });
    const row = banks.getByRole("row", { name: /xxx7890/ });
    await expect(row).toContainText("รออนุมัติ");
    await expect(row.getByRole("link", { name: "เปิดรายการอนุมัติ" })).toBeVisible();
  });

  test("a tier changes at once; a tolerance override goes to approval (D-043, D-173)", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/${factory(2)}?tab=terms`);
    await expectAxeClean(page);

    await page.getByRole("button", { name: "เปลี่ยนระดับ" }).first().click();
    let dialog = page.getByRole("dialog", { name: "เปลี่ยนระดับการเข้าร่วม" });
    await choose(page, /^ระดับ/, "ระดับ A");
    await dialog.getByLabel(/^เหตุผล/).fill("ส่งราคาครบทุกขนาดแล้ว");
    await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("ส่งราคาครบทุกขนาดแล้ว")).toBeVisible();

    const tolerance = page.getByRole("heading", { name: "ค่าเผื่อจำนวน" }).locator("../..");
    await tolerance.getByRole("button", { name: "ตั้งฉบับใหม่" }).first().click();
    dialog = page.getByRole("dialog", { name: "ตั้งค่าเผื่อจำนวนใหม่" });
    await expect(dialog).toContainText("ต้องได้รับอนุมัติจาก Superadmin");
    await dialog.getByLabel(/^ขาดได้/).fill("3");
    await dialog.getByLabel(/^เกินได้/).fill("5");
    await dialog.getByLabel(/^เหตุผล/).fill("งานกล่องแข็งเสียมากช่วงขึ้นรูป");
    await dialog.getByRole("button", { name: "ส่งขออนุมัติ" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const proposed = page.getByRole("row", { name: /งานกล่องแข็งเสียมากช่วงขึ้นรูป/ });
    await expect(proposed).toContainText("เสนอแล้ว");
    await expect(proposed.getByRole("link", { name: "เปิดรายการอนุมัติ" })).toBeVisible();
  });

  test("activation needs a passed site visit (D-041)", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/${factory(4)}?tab=visits`);
    await expect(page.getByText("ต้องมีผลตรวจเยี่ยมที่ผ่านก่อนเปิดใช้งาน")).toBeVisible();

    await page.getByRole("button", { name: "บันทึกการตรวจเยี่ยม" }).click();
    const dialog = page.getByRole("dialog", { name: "บันทึกการตรวจเยี่ยม" });
    await dialog.getByLabel(/^วันที่ตรวจ/).fill("2026-09-20");
    await dialog.getByLabel(/^หมายเหตุ/).fill("พื้นที่จัดเก็บเรียบร้อย");
    await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("ต้องมีผลตรวจเยี่ยมที่ผ่านก่อนเปิดใช้งาน")).toHaveCount(0);
    await expect(page.getByText("พื้นที่จัดเก็บเรียบร้อย")).toBeVisible();

    await page.getByRole("button", { name: "ขออนุมัติเปิดใช้งาน" }).click();
    const confirm = page.getByRole("alertdialog", { name: "ขออนุมัติเปิดใช้งานโรงงาน" });
    await confirm.getByLabel(/^เหตุผล/).fill("ผ่านงานทดลองครบ 3 งาน");
    await confirm.getByRole("button", { name: "ส่งขออนุมัติ" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByText("ส่งขออนุมัติเปิดใช้งานแล้ว")).toBeVisible();
  });
});

test.describe("price proposals (D-040, D-042)", () => {
  test("lines are decided against the suggestion, and the impact simulated", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/proposals/${proposal(1)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("F001 · กล่องกระดาษแข็ง");
    await expect(page.getByText("ราคาวัสดุ").first()).toBeVisible();
    await expect(page.getByText("แนะนำ").first()).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("button", { name: "จำลองผลกระทบ" }).click();
    await expect(page.getByRole("heading", { name: "ผลกระทบต่อใบเสนอราคาที่ผ่านมา" })).toBeVisible();
    await expect(page.getByText("ใบเสนอราคาที่คำนวณใหม่")).toBeVisible();
    // The window is a setting (partners.impact_simulation_window_days): the page shows its dates.
    await expect(page.getByText(/^ช่วงเวลา/)).toBeVisible();

    await page
      .getByRole("radiogroup", { name: "การตัดสินรายการที่ 1" })
      .getByRole("radio", { name: "รับ", exact: true })
      .click();
    await page
      .getByRole("radiogroup", { name: "การตัดสินรายการที่ 2" })
      .getByRole("radio", { name: "เสนอกลับ" })
      .click();
    await page.getByLabel("ค่าเสนอกลับ rate").fill("11.900000");
    await page.getByRole("button", { name: "บันทึกการตัดสิน (2)" }).click();
    await expect(page.getByText("บันทึกการตัดสินแล้ว")).toBeVisible();
    await expect(page.getByText(/เสนอกลับ:/)).toContainText("11.900000");
  });

  test("a getpack rate card is drafted line by line and sent to the factory", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/proposals/${proposal(2)}`);
    await expect(header(page)).toContainText("ฉบับร่าง");

    await page.getByRole("button", { name: "เพิ่มรายการ" }).click();
    await choose(page, "องค์ประกอบราคา", "ส่วนเพิ่มของโรงงาน");
    await page.getByLabel(/^printTypeId/).fill("0192f3a0-7c1e-7d2a-9b1f-00000000c004");
    await page.getByLabel(/^pct/).fill("15.0000");
    await page.getByRole("button", { name: "บันทึกรายการ" }).click();
    await expect(page.getByText("บันทึกรายการแล้ว")).toBeVisible();
    await expect(page.getByRole("button", { name: "ลบรายการที่ 2" })).toBeVisible();

    await page.getByRole("button", { name: "ส่งให้โรงงาน" }).click();
    const dialog = page.getByRole("alertdialog", { name: "ส่งอัตราให้โรงงานยอมรับ" });
    await expect(dialog).toContainText("2 รายการ");
    await dialog.getByRole("button", { name: "ส่งให้โรงงาน" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(header(page)).toContainText("ส่งแล้ว");
  });

  test("coverage says which types quote instantly (D-043)", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/coverage`);
    await expect(page.getByText("ราคาทันที").first()).toBeVisible();
    await expect(page.getByText("ขอราคาเท่านั้น").first()).toBeVisible();
    await expectAxeClean(page);
  });

  test("an index month is recorded (D-040)", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/indices`);
    await page.getByRole("button", { name: /ค่าแรงขั้นต่ำ/ }).click();
    await page.getByLabel("เดือน", { exact: true }).fill("2027-01");
    await page.getByLabel("ค่า", { exact: true }).fill("412");
    await page.getByLabel("แหล่งที่มา").fill("ประกาศคณะกรรมการค่าจ้าง");
    await page.getByRole("button", { name: "บันทึกค่า" }).click();
    await expect(page.getByText("บันทึกค่าแล้ว")).toBeVisible();
    await expect(page.getByRole("row", { name: /2027-01/ })).toContainText("ประกาศคณะกรรมการค่าจ้าง");
    await expectAxeClean(page);
  });
});

test.describe("the production floor", () => {
  test("the board filters to jobs at risk (D-074, D-075)", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/production`);
    const board = page.getByRole("region", { name: "บอร์ดงานผลิต" });
    await expect(board.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("link", { name: "เฉพาะงานเสี่ยงล่าช้า" }).click();
    await expect(page).toHaveURL(/atRisk=true/);
    await expect(board.getByText(/เสี่ยง|คาดว่าเสร็จ/).first()).toBeVisible();
  });

  test("an inspection is recorded and judged by the API (D-076)", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/production/inspections`);
    const table = page.getByRole("table", { name: "งานตรวจคุณภาพ" });
    await expect(table).toContainText("นัดตรวจแล้ว");
    await expectAxeClean(page);

    await table
      .getByRole("button", { name: /^บันทึกผล / })
      .first()
      .click();
    const dialog = page.getByRole("alertdialog", { name: /^บันทึกผลตรวจ/ });
    await dialog.getByLabel("หลัก", { exact: true }).fill("1");
    await dialog.getByRole("button", { name: "บันทึกผล" }).click();
    await expect(page.getByText("ผลตรวจ: ผ่าน")).toBeVisible();
  });

  test("scorecards show a factory's months", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/production/scorecards?factoryId=${factory(2)}`);
    await expect(page.getByText("ส่งตรงเวลา").first()).toBeVisible();
    const table = page.getByRole("table", { name: /^คะแนนโรงงาน / });
    await expect(table.getByRole("row")).toHaveCount(13);
    await expect(page.getByRole("link", { name: /^เปิดโรงงาน / })).toHaveAttribute("href", `/partners/${factory(2)}`);
    // Every factory side by side for one month (admin.inspections.monthScorecards).
    const month = page.getByRole("table", { name: /^คะแนนทุกโรงงาน / });
    await expect(month.getByRole("row").nth(1)).toBeVisible();
    await expectAxeClean(page);
  });
});
