import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F2 2.3 — the RFQ workspace, against the mock API.
 *
 * Each test that changes state uses an RFQ no other test reads (the mock keeps state for the
 * whole run). RFQ ids are the mock's: `…-726671` + the seed's number in hex.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const rfq = (n: number) => `00000000-0000-4000-8000-726671${n.toString(16).padStart(6, "0")}`;

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

const header = (page: Page) => page.getByRole("heading", { level: 1 }).locator("..");

test.describe("the RFQ desk", () => {
  test("opens on a queue with its SLA timers", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq?queue=new`);
    await expect(page.getByRole("link", { name: /^ใหม่ ยังไม่มีผู้รับผิดชอบ/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const table = page.getByRole("table", { name: "คำขอใบเสนอราคา (RFQ)" });
    await expect(table.getByRole("row")).not.toHaveCount(1);
    await expect(table).toContainText("ได้รับคำขอแล้ว");
    await expectAxeClean(page);
  });

  // CONTRACT-GAP admin.rfqs — the published RFQ carries no SLA target per category
  // (slaTargetHours) and no routedFromCalculator flag.
  test.fixme("each row says its category's SLA target and whether a calculator routed it", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq?queue=new`);
    const table = page.getByRole("table", { name: "คำขอใบเสนอราคา (RFQ)" });
    await expect(table).toContainText("ชม.ทำการ");
    await expect(table).toContainText("ส่งต่อจากเครื่องคำนวณ");
  });

  test("starting a review takes the RFQ and stops nobody owning it", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(1)}`);
    await expect(page.getByText("ยังไม่มีผู้รับผิดชอบ").first()).toBeVisible();
    await page.getByRole("button", { name: "เริ่มพิจารณา" }).click();
    await expect(header(page)).toContainText("กำลังพิจารณาคำขอ");
    await expect(page.getByText("คุณ", { exact: true })).toBeVisible();
  });
});

test.describe("factory consultation", () => {
  test("asks only factories that can make the category, with a deadline", async ({ page }) => {
    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(13)}?tab=factories`);
    await expectAxeClean(page);

    await page.getByRole("main").getByRole("button", { name: "ขอราคาจากโรงงาน" }).first().click();
    const dialog = page.getByRole("dialog", { name: "ขอราคาจากโรงงาน" });
    // F002 has no food-packaging capability (D-043): shown, with the reason, and not pickable.
    await expect(dialog.getByRole("checkbox", { name: /โรงงานกล่องแข็ง/ })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /โรงงานบรรจุภัณฑ์อาหาร/ }).check();

    // No deadline yet: refused in place, nothing sent.
    await dialog.getByRole("button", { name: /^ขอราคา/ }).click();
    await expect(dialog).toContainText("กรุณาระบุเวลาที่ต้องการคำตอบ");

    const tomorrow = new Date(Date.now() + 7 * 3_600_000 + 86_400_000).toISOString().slice(0, 16);
    await dialog.getByLabel(/^ตอบภายใน/).fill(tomorrow);
    await dialog.getByRole("button", { name: /^ขอราคา/ }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    const table = page.getByRole("table", { name: "ราคาจากโรงงาน" });
    await expect(table).toContainText("โรงงานบรรจุภัณฑ์อาหาร");
    await expect(table).toContainText("รอโรงงานตอบ");
  });

  test("CS never sees the factory's cost (D-141)", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(5)}?tab=factories`);
    const table = page.getByRole("table", { name: "ราคาจากโรงงาน" });
    await expect(table).toContainText("โรงงานตอบแล้ว");
    await expect(table).not.toContainText("ทุน");
  });

  // CONTRACT-GAP admin.rfq-consultations — no suggested sell price per response line.
  test.fixme("CS sees the suggested sell price derived from a factory's answer", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(5)}?tab=factories`);
    await expect(page.getByRole("table", { name: "ราคาจากโรงงาน" })).toContainText("ชิ้น: ฿");
  });

  test("the Partner Manager sees the cost, read-only (D-141)", async ({ page }) => {
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(5)}?tab=factories`);
    await expect(page.getByRole("table", { name: "ราคาจากโรงงาน" })).toContainText("ทุน ฿");
    // Read-only for this role: no action is offered.
    await expect(page.getByRole("button", { name: "ขอราคาจากโรงงาน" })).toHaveCount(0);
  });
});

test.describe("quoting", () => {
  // CONTRACT-GAP admin.rfq-quotes — no suggested sell price to copy from a factory's answer.
  test.fixme("copies the suggested sell price from a factory's answer into the draft", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(6)}?tab=quotes`);
    await page.getByRole("tabpanel").getByRole("button", { name: "จัดทำใบเสนอราคา" }).click();
    await choose(page, "ใช้คำตอบจากโรงงาน", /F002/);
    await expect(page.getByLabel(/^ราคาขายต่อชิ้น/).first()).toHaveValue("54.60");
  });

  test("composes a quote, saves it and sends it", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(6)}?tab=quotes`);
    const code = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

    await page.getByRole("tabpanel").getByRole("button", { name: "จัดทำใบเสนอราคา" }).click();
    // CS types the sell price; the API prices the amounts.
    for (const input of await page.getByLabel(/^ราคาขายต่อชิ้น/).all()) await input.fill("54.60");
    for (const input of await page.getByLabel(/^ระยะเวลาผลิต/).all()) await input.fill("20");
    await page.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();

    // The saved draft shows the API's amounts and the send action leads.
    const draft = page.getByRole("table", { name: "ฉบับที่ 1" });
    await expect(draft).toContainText("฿17,526.60");
    // At the top: axe counts content scrolled under the sticky header as crowding its links.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectAxeClean(page);
    await page.getByRole("button", { name: "ส่งใบเสนอราคา" }).first().click();

    const dialog = page.getByRole("alertdialog", { name: "ส่งใบเสนอราคาฉบับที่ 1" });
    await expect(dialog).toContainText(code);
    await expect(dialog).toContainText("฿17,526.60");
    await dialog.getByLabel(new RegExp(`พิมพ์ ${code}`)).fill(code);
    await dialog.getByRole("button", { name: "ส่งให้ลูกค้า" }).click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(header(page)).toContainText("เสนอราคาแล้ว");
  });

  test("a price typed with the wrong shape is refused before it is sent", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(5)}?tab=quotes`);
    await page.getByRole("tabpanel").getByRole("button", { name: "จัดทำใบเสนอราคา" }).click();
    await page
      .getByLabel(/^ราคาขายต่อชิ้น/)
      .first()
      .fill("12,5");
    await page.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
    await expect(page.getByText("ระบุราคามากกว่า 0 ทศนิยมไม่เกิน 6 ตำแหน่ง")).toBeVisible();
    await expect(page.getByRole("table", { name: "ฉบับที่ 1" })).toHaveCount(0);
  });

  test("an acceptance recorded by CS becomes a quotation to order from", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(8)}?tab=quotes`);
    const code = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

    await page.getByRole("button", { name: "บันทึกว่าลูกค้าตอบรับ" }).click();
    const dialog = page.getByRole("alertdialog", { name: "บันทึกว่าลูกค้าตอบรับฉบับที่ 1" });
    await choose(page, "จำนวนที่ลูกค้าเลือก", /^20 ชิ้น/);
    await dialog.getByLabel(/^ลูกค้าตอบรับอย่างไร/).fill("โทรยืนยันกับลูกค้า (ทดสอบ)");
    await dialog.getByLabel(new RegExp(`พิมพ์ ${code}`)).fill(code);
    await dialog.getByRole("button", { name: "บันทึกการตอบรับ" }).click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(header(page)).toContainText("ลูกค้ารับราคาแล้ว");
    await expect(page.getByText("ลูกค้าตอบรับใบเสนอราคาฉบับที่ 1")).toBeVisible();

    // The saved quotation names its quantity; the RFQ names only the quotation.
    await page.getByRole("main").getByRole("button", { name: "สร้างคำสั่งซื้อ" }).first().click();
    await expect(page).toHaveURL(/\/orders\/new\?quote=.+/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("สร้างคำสั่งซื้อแทนลูกค้า");
  });
});

test.describe("closing an RFQ", () => {
  test("declining needs an unmet-demand reason and the code retyped (D-102)", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(14)}`);
    const code = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

    await page.getByRole("button", { name: "การดำเนินการอื่น" }).click();
    await page.getByRole("menuitem", { name: /ปฏิเสธคำขอ/ }).click();
    const dialog = page.getByRole("alertdialog", { name: "ปฏิเสธคำขอราคา" });
    await expect(dialog).toContainText("D-102");
    await choose(page, /^เหตุผล/, "กำลังการผลิตเต็มในช่วงที่ต้องการ");
    await dialog.getByLabel(new RegExp(`พิมพ์ ${code}`)).fill(code);
    await dialog.getByRole("button", { name: "ปฏิเสธคำขอ" }).click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByText("ปฏิเสธแล้ว: กำลังการผลิตเต็มในช่วงที่ต้องการ")).toBeVisible();
  });

  test("an internal note stays with the team", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/rfq/${rfq(7)}?tab=messages`);
    await expectAxeClean(page);
    const note = `ติดตามลูกค้าพรุ่งนี้ ${Date.now()}`;
    await page.getByLabel(/^บันทึกภายในทีม/).fill(note);
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    const item = page.getByRole("listitem").filter({ hasText: note });
    await expect(item).toBeVisible();
    await expect(item).toContainText("ภายในทีม");
  });
});

test.describe("every 2.3 screen is axe-clean", () => {
  for (const path of [`/rfq`, `/rfq?queue=overdue`, `/rfq/${rfq(10)}`, `/rfq/${rfq(9)}?tab=quotes`]) {
    test(path, async ({ page }) => {
      await signInAsStaff(page, "cs");
      await gotoHydrated(page, `${HOSTS.admin}${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectAxeClean(page);
    });
  }
});
