import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff, type Persona } from "./helpers/session";

/**
 * Agent portal P6 (D-472): the management P&L planner at `/finance/pnl` in the admin zone — create a plan that fills
 * itself from the system, enter a manual cell with its first-value note, override a system value with a reason (both
 * values shown), lock it (read-only after), close a month in the mock and compare plan with actual with a variance
 * note; the drill-down from a cell's tooltip and by keyboard; the ARIA grid's keys; RBAC (VP reads, sales roles get
 * the 403 page and a refused BFF call); layouts from 390 to 1920 with the grid scrolling inside its frame only.
 *
 * Runs against the MSW mock server (mocks/admin/pnl.ts), whose state lives as long as the server: the suite expects
 * a freshly started server and runs in order.
 */
test.describe.configure({ mode: "serial" });

const shots = process.env["E2E_SHOTS"];
const PLAN = "แผนทดสอบ e2e";
const now = new Date(Date.now() + 7 * 3_600_000);
const year = now.getUTCFullYear();
const DEC = `${year}-12`;
const JAN = `${year}-01`;

async function shoot(page: Page, name: string, widths: readonly number[] = [1440], fullPage = false, at?: string) {
  if (!shots) return;
  await page
    .locator("[data-sonner-toast]")
    .first()
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(() => undefined);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width >= 1280 ? 1000 : width >= 768 ? 1100 : 844 });
    await page.waitForTimeout(400);
    if (at)
      await page
        .locator(at)
        .first()
        .evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: `${shots}/p6-${name}-${width}.png`, fullPage });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function noHorizontalScroll(page: Page, label: string, widths: readonly number[]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(120);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${label}: page scrolls sideways at ${width}px`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function asStaff(page: Page, persona: Persona, path = "/finance/pnl") {
  await page.context().clearCookies();
  await signInAsStaff(page, persona);
  await gotoHydrated(page, `${HOSTS.admin}${path}`);
}

/** A BFF call from the page itself (same origin: the BFF's CSRF and Origin checks pass). */
async function bff(page: Page, method: "GET" | "POST", path: string): Promise<number> {
  return page.evaluate(
    async ([m, p]) => (await fetch(`/bff${p}`, { method: m, headers: { "x-getpack-csrf": "1" } })).status,
    [method, path] as const,
  );
}

const grid = (page: Page) => page.getByRole("grid").first();
const cell = (page: Page, line: string, month: string) =>
  grid(page).locator(`tr[data-line="${line}"] td[data-month="${month}"]`);

test.describe("P6 management P&L", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("create a plan: it fills itself, a manual cell takes a note, an override keeps both values", async ({
    page,
  }) => {
    await asStaff(page, "finance_manager");
    await expect(page.getByRole("heading", { level: 1, name: "งบกำไรขาดทุนเพื่อการบริหาร" })).toBeVisible();
    await expect(page.getByRole("link", { name: "งบกำไรขาดทุนบริหาร" }).first()).toBeVisible();
    // The seeded baseline of this year opens first: locked, read-only.
    await expect(page.getByText("ล็อกแล้ว", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "สร้างแผน" }).first().click();
    const create = page.getByRole("dialog", { name: "สร้างแผนใหม่" });
    await create.getByLabel(/ชื่อแผน/).fill(PLAN);
    await create.getByLabel(/ปี \(ค\.ศ\.\)/).fill(String(year));
    await create.getByRole("button", { name: "สร้างและคำนวณ" }).click();
    await expect(page.getByText("สร้างแผนแล้ว ระบบเติมตัวเลขจากข้อมูลในระบบให้แล้ว")).toBeVisible();
    await expect(grid(page)).toHaveAccessibleName(new RegExp(`^งบกำไรขาดทุน ${PLAN}`));

    // Auto fill: January's revenue comes from the ledger, marked "ระบบ".
    await expect(cell(page, "revenue_goods", JAN)).toHaveAttribute("data-mode", "auto");
    await expect(cell(page, "revenue_goods", JAN).getByRole("img", { name: "ระบบ" })).toBeVisible();
    await expect(cell(page, "revenue_goods", JAN)).toContainText(/\d{1,3}(,\d{3})*\.\d{2}/);
    await expect(cell(page, "net_revenue", JAN)).toHaveAttribute("data-mode", "calculated");
    // The summary strip is the API's; contribution is never called net profit.
    const strip = page.locator("[data-summary]");
    await expect(strip).toHaveCount(7);
    await expect(page.locator('[data-summary="contribution"]')).toContainText("กำไรหลังหักค่าคอม");
    await expect(page.locator('[data-summary="netProfit"]')).toContainText("กำไรสุทธิ");
    await shoot(page, "summary", [1440]);
    await shoot(page, "grid", [1440, 1920], false, "[data-testid=pnl-grid-scroll]");
    await shoot(page, "grid-tablet", [1024], false, "[data-testid=pnl-grid-scroll]");

    // A manual cell: the first value needs a note.
    await cell(page, "salaries", DEC).click();
    const value = page.getByRole("textbox", { name: /เงินเดือนและสวัสดิการ ·/ });
    await expect(value).toBeFocused();
    await value.fill("420000");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("บอกที่มาของตัวเลขอย่างน้อย 3 ตัวอักษร")).toBeVisible();
    await page.getByLabel("ที่มาของตัวเลข").fill("พนักงาน 14 คน × ค่าจ้างเฉลี่ย 30,000 บาท (ทดสอบ)");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("บันทึกแล้ว", { exact: true })).toBeVisible();
    await expect(cell(page, "salaries", DEC)).toHaveAttribute("data-mode", "manual");
    await expect(cell(page, "salaries", DEC)).toContainText("420,000.00");
    await expect(cell(page, "salaries", DEC)).toBeFocused();

    // An override: Enter on a system cell asks why; both values stay on screen.
    await cell(page, "revenue_goods", DEC).focus();
    await page.keyboard.press("Enter");
    const override = page.getByRole("dialog", { name: "แก้ทับค่าที่ระบบคำนวณ" });
    await expect(override).toBeVisible();
    const system = (await override.getByTestId("override-system-value").textContent())!.trim();
    await override.getByLabel(/ค่าใหม่/).fill("5,000,000");
    await override.getByRole("button", { name: "แก้ทับ", exact: true }).click();
    await expect(override.getByText("บอกเหตุผลอย่างน้อย 3 ตัวอักษร")).toBeVisible();
    await override.getByLabel(/เหตุผล/).fill("ลูกค้ารายใหญ่ยืนยันคำสั่งซื้อแล้ว (ทดสอบ)");
    await shoot(page, "override-dialog");
    await override.getByRole("button", { name: "แก้ทับ", exact: true }).click();
    await expect(page.getByText("แก้ทับแล้ว — ค่าระบบยังแสดงข้างกัน")).toBeVisible();
    const overridden = cell(page, "revenue_goods", DEC);
    await expect(overridden).toHaveAttribute("data-mode", "override");
    await expect(overridden).toContainText("5,000,000.00");
    await expect(overridden.locator("[data-auto-value] s")).toHaveText(system);
    await expect(overridden.getByRole("img", { name: "แก้ทับ" })).toBeVisible();
  });

  test("keyboard: arrows move between cells, Enter edits, Escape cancels, Shift+Enter opens the sources", async ({
    page,
  }) => {
    await asStaff(page, "finance_manager");
    await page.getByRole("combobox", { name: /^แผน/ }).selectOption({ label: `${PLAN} · ฉบับที่ 1` });
    await expect(grid(page)).toHaveAccessibleName(new RegExp(PLAN));
    await cell(page, "revenue_goods", JAN).click();
    await expect(cell(page, "revenue_goods", JAN)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, "revenue_goods", `${year}-02`)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(cell(page, "revenue_shipping", `${year}-02`)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(grid(page).locator('tr[data-line="revenue_shipping"] th')).toBeFocused();

    // Down to salaries November (an empty manual cell): Enter opens the editor, Escape puts focus back.
    await cell(page, "salaries", DEC).click();
    await page.keyboard.press("ArrowLeft");
    const november = cell(page, "salaries", `${year}-11`);
    await expect(november).toBeFocused();
    await page.keyboard.press("Enter");
    const editor = page.getByRole("textbox", { name: /เงินเดือนและสวัสดิการ ·/ });
    await expect(editor).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(editor).toHaveCount(0);
    await expect(november).toBeFocused();
    // Typing a number starts the edit straight away.
    await page.keyboard.press("4");
    await expect(editor).toHaveValue("4");
    await page.keyboard.press("Escape");

    // Shift+Enter on a system cell lists its records.
    await cell(page, "revenue_goods", JAN).focus();
    await page.keyboard.press("Shift+Enter");
    const sheet = page.getByRole("dialog", { name: "รายการที่มา" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("pnl-sources")).toContainText(/รายการ/);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });

  test("a cell's tooltip explains it and opens the drill-down", async ({ page }) => {
    await asStaff(page, "finance_manager");
    await page.getByRole("combobox", { name: /^แผน/ }).selectOption({ label: `${PLAN} · ฉบับที่ 1` });
    const target = cell(page, "revenue_goods", `${year}-03`);
    await target.hover();
    const tip = page.locator(`[data-cell-tip="revenue_goods:${year}-03"]`);
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("มูลค่าสินค้าที่ออกใบกำกับภาษีแล้วในเดือนนั้น");
    await expect(tip).toContainText("สูตร:");
    await expect(tip).toContainText("บัญชีแยกประเภท — รายการที่ลงแล้ว");
    await expect(tip).toContainText("ข้อมูลถึง");
    await shoot(page, "tooltip-drilldown");
    await tip.getByRole("button", { name: /ดูรายการที่มา/ }).click();
    const sheet = page.getByRole("dialog", { name: "รายการที่มา" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link").first()).toHaveAttribute("href", /\/finance\/ledger\/journals\//);
    await shoot(page, "drilldown-sheet");
    await sheet.getByRole("button", { name: "ปิด" }).first().click();

    // A line's own tooltip: the four parts.
    await grid(page).locator('tr[data-line="salaries"] th').hover();
    const line = page.locator('[data-line-tip="salaries"]');
    await expect(line).toContainText("วิธีกรอก:");
    await expect(line).toContainText("จำนวนพนักงาน × ค่าจ้างเฉลี่ย");
  });

  test("lock: the plan freezes, then plan vs actual for the next month with a variance note", async ({ page }) => {
    await asStaff(page, "finance_manager");
    await page.getByRole("combobox", { name: /^แผน/ }).selectOption({ label: `${PLAN} · ฉบับที่ 1` });
    await page.getByRole("button", { name: "ล็อกแผน" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText(/ยังมีช่องที่ต้องกรอกเองว่างอยู่ \d+ ช่อง/);
    await confirm.getByRole("button", { name: "ล็อกแผน" }).click();
    await expect(page.getByText("ล็อกแผนแล้ว")).toBeVisible();
    await expect(page.getByText("แผนนี้ล็อกแล้ว ตัวเลขแก้ไม่ได้")).toBeVisible();
    await expect(grid(page)).toHaveAttribute("aria-readonly", "true");
    await expect(page.getByRole("button", { name: "ล็อกแผน" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "คำนวณใหม่" })).toHaveCount(0);
    await expect(grid(page).getByText("กรอกค่า")).toHaveCount(0);
    await cell(page, "revenue_goods", DEC).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "แก้ทับค่าที่ระบบคำนวณ" })).toHaveCount(0);
    await shoot(page, "locked", [1440], false, "[data-testid=pnl-grid-scroll]");

    // The mock closes a month: the next month now has actual figures.
    expect(await bff(page, "POST", "/v1/admin/mock-jobs/pnl.close_month")).toBe(200);
    await page.getByRole("switch", { name: "เทียบกับจริง" }).click();
    await expect(page).toHaveURL(/view=variance/);
    const december = page.locator(`table[data-view="variance"] tr[data-line="revenue_goods"] td[data-month="${DEC}"]`);
    await expect(december).toHaveAttribute("data-basis", "ledger");
    await expect(december).toContainText("แผน 5,000,000.00");
    await expect(december.locator("[data-variance]")).toBeVisible();
    await expect(page.locator('[data-chart="revenue"]')).toContainText("จริง");

    await december.click();
    const note = page.getByRole("dialog", { name: "หมายเหตุส่วนต่าง" });
    await note.getByLabel(/หมายเหตุ/).fill("ดีลใหญ่เลื่อนส่งมอบไปเดือนถัดไป (ทดสอบ)");
    await note.getByRole("button", { name: "บันทึกหมายเหตุ" }).click();
    await expect(page.getByText("บันทึกหมายเหตุแล้ว")).toBeVisible();
    await expect(december.getByRole("img", { name: "มีหมายเหตุ" })).toBeVisible();
    await shoot(page, "variance", [1440, 1920], false, "[data-testid=pnl-grid-scroll]");

    // Finance Manager exports.
    await expect(page.getByRole("button", { name: "ส่งออก" })).toBeVisible();
  });

  test("RBAC: a VP reads the grid with no edit, lock or export", async ({ page }) => {
    await asStaff(page, "vp", `/finance/pnl?year=${year + 1}&scenario=base`);
    await expect(grid(page)).toBeVisible();
    await expect(page.getByText("ดูอย่างเดียว — แก้แผนได้เฉพาะผู้บริหารระดับสูงและผู้จัดการการเงิน")).toBeVisible();
    await expect(grid(page)).toHaveAttribute("aria-readonly", "true");
    for (const name of ["สร้างแผน", "ล็อกแผน", "คำนวณใหม่", "คัดลอกเป็นสถานการณ์อื่น", "ส่งออก"])
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    await expect(grid(page).getByText("กรอกค่า")).toHaveCount(0);
    // The API refuses a VP's write and export too.
    expect(await bff(page, "POST", "/v1/admin/finance/pnl/plans")).toBe(403);
  });

  for (const persona of ["sales_manager", "sales_rep"] as const) {
    test(`RBAC: ${persona} gets the 403 page and the BFF refuses`, async ({ page }) => {
      await asStaff(page, persona);
      await expect(page.getByText("คุณไม่มีสิทธิ์เปิดหน้านี้")).toBeVisible();
      await expect(page.getByRole("grid")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "งบกำไรขาดทุนบริหาร" })).toHaveCount(0);
      expect(await bff(page, "GET", "/v1/admin/finance/pnl/plans")).toBe(403);
    });
  }

  test("layouts: the grid scrolls inside its frame from 768 to 1920; a phone gets the summary and month cards", async ({
    page,
  }) => {
    await asStaff(page, "c_level");
    await expect(grid(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "ส่งออก" })).toBeVisible();
    await noHorizontalScroll(page, "P&L grid", [768, 1024, 1280, 1440, 1920]);
    await page.setViewportSize({ width: 1024, height: 900 });
    const frame = page.getByTestId("pnl-grid-scroll");
    const inner = await frame.evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(inner, "the grid scrolls sideways inside its frame").toBeGreaterThan(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await expect(page.locator("[data-summary]").first()).toBeVisible();
    await expect(page.locator("[data-month-card]")).toHaveCount(12);
    await expect(page.locator("[data-month-card]").first()).toBeVisible();
    await expect(grid(page)).toBeHidden();
    await expect(page.getByText("บนมือถือดูอย่างเดียว")).toBeVisible();
    await expect(page.getByRole("button", { name: "ล็อกแผน" })).toBeHidden();
    await noHorizontalScroll(page, "P&L phone", [390]);
    await page.setViewportSize({ width: 390, height: 844 });
    await shoot(page, "phone", [390], true);
  });
});
