import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F2 2.8 — logistics, claims, the demand dashboard and reports, against the mock API.
 *
 * Shipments are `…736870` + n (n = the commerce order's index + 1; 60+ are the ones waiting at a
 * factory), claims `…636c6d` + n. Every test that changes state uses a record no other reads.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const id = (hex: string, n: number) => `00000000-0000-4000-8000-${hex}${n.toString(16).padStart(6, "0")}`;
const shipment = (n: number) => id("736870", n);
const claim = (n: number) => id("636c6d", n);

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
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).first().click();
}

const header = (page: Page) => page.getByRole("heading", { level: 1 }).locator("..").locator("..");

test.describe("the logistics desk (D-013, D-114)", () => {
  test("the failed tab holds a failed attempt, with the shipment's note", async ({ page }) => {
    await signInAsStaff(page, "logistics");
    // CONTRACT-GAP admin.shipments — no exceptions queue: the published list filters by status only,
    // so an area the factory cannot serve (a ready shipment) is not on this tab.
    await gotoHydrated(page, `${HOSTS.admin}/shipments?status=failed`);
    const table = page.getByRole("table", { name: "การจัดส่ง" });
    await expect(table).toContainText("ไม่มีผู้รับสินค้า โทรไม่ติด");
    await expectAxeClean(page);
  });

  test("a fallback carrier is quoted and booked by carrier", async ({ page }) => {
    await signInAsStaff(page, "logistics");
    await gotoHydrated(page, `${HOSTS.admin}/shipments/${shipment(61)}`);
    await expect(page.getByText("โรงงานไม่ส่งในพื้นที่นี้ ต้องจองขนส่งสำรอง")).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("button", { name: "จองขนส่งสำรอง" }).click();
    const dialog = page.getByRole("dialog", { name: "จองขนส่งสำรอง" });
    // admin.shipments.bookCarrier takes the carrier; no reason is recorded (CONTRACT-GAP admin.shipments).
    await dialog.getByRole("radio", { name: /Flash Express/ }).click();
    await dialog.getByRole("button", { name: "จองขนส่งสำรอง" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(header(page)).toContainText("Flash Express");
    await expect(header(page)).toContainText(/TH\d{9}/);
  });

  test("a shipment held by an unpaid instalment cannot be booked out", async ({ page }) => {
    await signInAsStaff(page, "logistics");
    await gotoHydrated(page, `${HOSTS.admin}/shipments/${shipment(62)}`);
    // CONTRACT-GAP admin.shipments — no blockedByPayment on the shipment: the hold shows when the API
    // refuses the booking (`shipments.payment_pending`).
    await page.getByRole("button", { name: "จองขนส่งสำรอง" }).click();
    const dialog = page.getByRole("dialog", { name: "จองขนส่งสำรอง" });
    await dialog.getByRole("radio", { name: /Deliveree/ }).click();
    await dialog.getByRole("button", { name: "จองขนส่งสำรอง" }).click();
    await expect(page.getByText("ยังมียอดที่ต้องชำระก่อนจัดส่ง ส่งของไม่ได้")).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("part of a shipment is split into a new one", async ({ page }) => {
    await signInAsStaff(page, "logistics");
    await gotoHydrated(page, `${HOSTS.admin}/shipments/${shipment(60)}`);
    await page.getByRole("button", { name: "แยกการจัดส่ง" }).click();
    const dialog = page.getByRole("dialog", { name: "แยกการจัดส่ง" });
    await dialog.getByLabel(/^จำนวนที่แยก/).fill("100");
    await dialog.getByLabel(/^เหตุผล/).fill("รถคันแรกบรรทุกไม่พอ");
    await dialog.getByRole("button", { name: "แยกการจัดส่ง" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(/^แยกเป็น S-2569-/)).toBeVisible();
  });

  test("a POD short within tolerance is accepted (D-080)", async ({ page }) => {
    await signInAsStaff(page, "logistics");
    await gotoHydrated(page, `${HOSTS.admin}/shipments/${shipment(33)}`);
    await expect(page.getByText(/ขาดในค่าเผื่อ ลูกค้าได้เครดิตตามสัดส่วน/)).toBeVisible();
    await page.getByRole("button", { name: "รับหลักฐาน", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "รับหลักฐานการส่งมอบ" });
    await dialog.getByRole("button", { name: "รับหลักฐาน", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("รับหลักฐานแล้ว").first()).toBeVisible();
    // The review is known in this session only (CONTRACT-GAP admin.shipments, no POD review state).
    await expect(page.getByRole("button", { name: "รับหลักฐาน", exact: true })).toHaveCount(0);
  });

  test("a failed delivery is sent out again", async ({ page }) => {
    await signInAsStaff(page, "logistics");
    await gotoHydrated(page, `${HOSTS.admin}/shipments/${shipment(30)}`);
    await expect(header(page)).toContainText("นำส่งไม่สำเร็จ");
    await page.getByRole("button", { name: "แก้ปัญหาการจัดส่ง" }).click();
    const dialog = page.getByRole("dialog", { name: "แก้ปัญหาการจัดส่ง" });
    await dialog.getByLabel(/^เหตุผล/).fill("นัดผู้รับใหม่วันพรุ่งนี้");
    await dialog.getByRole("button", { name: "แก้ปัญหาการจัดส่ง" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(header(page)).toContainText("กำลังนำส่ง");
  });
});

test.describe("claims (D-082, D-083)", () => {
  test("a claim is reviewed, approved and resolved through a credit note", async ({ page }) => {
    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/claims/${claim(1)}`);
    await expect(page.getByText("รูปสินค้า", { exact: true })).toBeVisible();
    await expect(page.getByText("รูปกล่องขนส่ง", { exact: true })).toBeVisible();
    await expect(page.getByText(/ตามกฎ: โรงงาน/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^รูปสินค้า 1/ })).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("button", { name: "อนุมัติเคลม" }).click();
    const approve = page.getByRole("alertdialog", { name: "อนุมัติเคลม" });
    await approve.getByLabel(/^เหตุผล/).fill("รูปแสดงกล่องบุบจากการขนส่ง");
    await approve.getByRole("button", { name: "อนุมัติเคลม" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(header(page)).toContainText("อนุมัติเคลม");

    await page.getByRole("button", { name: "ดำเนินการแก้ไข" }).click();
    const resolve = page.getByRole("dialog", { name: "ดำเนินการแก้ไขเคลม" });
    await choose(page, /^วิธีแก้ไข/, "ใบลดหนี้");
    await resolve.getByLabel(/^จำนวนเงิน/).fill("1800");
    await resolve.getByLabel(/^หมายเหตุ/).fill("ลดหนี้ตามจำนวนที่เสียหาย");
    await resolve.getByRole("button", { name: "ดำเนินการ" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(header(page)).toContainText("ดำเนินการเรียบร้อย");
    // CONTRACT-GAP admin.claims — a resolution names no document reference (the credit note's number).
    await expect(page.getByText(/^ใบลดหนี้ · /)).toBeVisible();
  });

  test("an undetermined liability must be set, with a reason, before approval", async ({ page }) => {
    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/claims/${claim(4)}`);
    await page.getByRole("button", { name: "เริ่มตรวจสอบ" }).click();
    // admin.claims.review takes no note.
    let dialog = page.getByRole("alertdialog", { name: "เริ่มตรวจสอบเคลม" });
    await dialog.getByRole("button", { name: "เริ่มตรวจสอบ" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    await page.getByRole("button", { name: "อนุมัติเคลม" }).click();
    dialog = page.getByRole("alertdialog", { name: "อนุมัติเคลม" });
    await dialog.getByLabel(/^เหตุผล/).fill("ส่งช้าจริง");
    await dialog.getByRole("button", { name: "อนุมัติเคลม" }).click();
    await expect(page.getByText("ต้องระบุผู้รับผิดชอบก่อนอนุมัติ (D-083)")).toBeVisible();
    await dialog.getByRole("button", { name: "ยกเลิก" }).click();

    await page.getByRole("button", { name: "เปลี่ยน", exact: true }).click();
    const override = page.getByRole("dialog", { name: "เปลี่ยนผู้รับผิดชอบ" });
    await choose(page, /^ผู้รับผิดชอบ/, "โรงงาน");
    await override.getByLabel(/^เหตุผล/).fill("โรงงานเริ่มผลิตช้ากว่าแผน");
    await override.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // CONTRACT-GAP admin.claims — who overrode is not published, only the reason.
    await expect(page.getByText("เปลี่ยนจากที่กฎกำหนด")).toBeVisible();
  });

  test("a role without claims.manage reads a claim but cannot move it", async ({ page }) => {
    await signInAsStaff(page, "logistics");
    await gotoHydrated(page, `${HOSTS.admin}/claims/${claim(2)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("CL-2569-00042");
    await expect(page.getByRole("button", { name: "เริ่มตรวจสอบ" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "เปลี่ยน", exact: true })).toHaveCount(0);
  });
});

test.describe("demand analytics (D-102)", () => {
  test("the dashboard reads as tables too, and small groups are withheld", async ({ page }) => {
    await signInAsStaff(page, "c_level");
    await gotoHydrated(page, `${HOSTS.admin}/analytics`);
    const funnel = page.getByRole("figure", { name: "เส้นทางการซื้อ" });
    await expect(funnel.getByRole("table", { name: "เส้นทางการซื้อ" })).toContainText("ชำระแล้ว");
    await funnel.getByRole("button", { name: "ดูเป็นตาราง" }).click();
    await expect(funnel.getByRole("button", { name: "ดูเป็นกราฟ" })).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("radio", { name: "จังหวัด" }).click();
    await expect(page.getByText(/ซ่อน \d+ กลุ่มที่มีไม่ถึง 5 รายการ/)).toBeVisible();
    await expectAxeClean(page);
  });

  test("a journey's funnel shows the week's drop the API flagged (U5.0)", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/analytics`);
    await expect(page.getByRole("heading", { name: "เส้นทางผู้ใช้" })).toBeVisible();
    // The threshold is the API's setting, shown as it comes.
    await expect(page.getByText(/ลดลงเกิน 15\s?%/)).toBeVisible();

    await page.getByRole("radio", { name: "แจ้งปัญหาสินค้า" }).click();
    await expect(page.getByText("1 ขั้นลดลงเกินเกณฑ์ในสัปดาห์นี้")).toBeVisible();
    const row = page.getByRole("row", { name: /ส่งเรื่อง/ });
    await expect(row).toContainText("ลดลงผิดปกติ");
    await expect(row).toContainText("52");
    await expectAxeClean(page);
  });

  test("the prospectus is for those who recruit factories", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/analytics`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "รายงานสำหรับโรงงาน (PDF)" })).toHaveCount(0);
  });
});

test.describe("operational reports (B6.2)", () => {
  test("a report runs for a period with the API's totals, and exports", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/reports`);
    await page.getByRole("link", { name: /^ยอดขาย/ }).click();
    await expect(page).toHaveURL(/\/reports\/sales$/);
    await page.getByLabel(/^ตั้งแต่/).fill("2026-09-01");
    await page.getByLabel(/^ถึง/).fill("2026-09-03");
    await page.getByRole("button", { name: "แสดงรายงาน" }).click();
    const table = page.getByRole("table", { name: "ยอดขาย" });
    await expect(table.locator("tfoot")).toContainText("รวม");
    await expect(table.locator("tfoot")).toContainText("฿");
    await expect(page.getByRole("button", { name: /ส่งออก/ })).toBeVisible();
    await expectAxeClean(page);
  });

  test("a report outside the role is not offered", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/reports`);
    await expect(page.getByRole("link", { name: /^การใช้โปรโมชัน/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^อายุเจ้าหนี้/ })).toHaveCount(0);
  });
});
