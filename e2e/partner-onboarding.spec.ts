import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsPartner, signInAsStaff } from "./helpers/session";

/**
 * F5 5.1 — the partner zone's onboarding and price tables, on a phone, against the mock API.
 *
 * The factories are the back office's own rows: F005 applies (applicant), F006 is in assisted
 * onboarding (Packio entered its capability and capacity, sent a rate card, entered a tier-B
 * price list), F001 is active in factory price-list mode. Each test changes a factory no other
 * partner test changes.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PHONE = { width: 390, height: 844 };

async function expectAxeClean(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // A toast animates over the sticky header; axe reads it mid-fade (as storefront-fulfilment).
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10_000 });
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

const dialog = (page: Page) => page.getByRole("alertdialog");

test.use({ viewport: PHONE });

test.describe("an applicant's onboarding wizard (F005)", () => {
  test("fills its application step by step and submits it to the Partner team", async ({ page }) => {
    await signInAsPartner(page, "applicant");
    await expect(page.getByText("กรอกใบสมัครให้ครบเพื่อเริ่มงานกับ Packio")).toBeVisible();
    const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
    await expect(nav.getByRole("link", { name: "เริ่มงาน" })).toBeVisible();
    await expectAxeClean(page);

    await nav.getByRole("link", { name: "เริ่มงาน" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "การเริ่มงานกับ Packio" })).toBeVisible();
    await expect(page.getByRole("list", { name: "ขั้นตอนสู่การเปิดใช้งาน" })).toBeVisible();
    await expectAxeClean(page);

    // The KYC step: a document straight to storage, then referenced.
    await page.getByRole("link", { name: /เอกสารยืนยันตัวตนบริษัท/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "เอกสารยืนยันตัวตนบริษัท" })).toBeVisible();
    await choose(page, "ประเภทเอกสาร", "ภ.พ.20");
    await page.locator('input[type="file"]').setInputFiles({
      name: "pp20.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mock"),
    });
    await page.getByRole("button", { name: "ส่งเอกสาร" }).click();
    await expect(page.getByText("ส่งเอกสารแล้ว รอ Packio ตรวจ")).toBeVisible();
    await expectAxeClean(page);

    // The application step: company details, a contact, then submit.
    await gotoHydrated(page, `${HOSTS.partner}/onboarding/application`);
    await page.getByLabel(/^ชื่อทางการค้า/).fill("ลูกฟูกใหม่ สาขาบางนา (ข้อมูลจำลอง)");
    await page.getByRole("button", { name: "บันทึกข้อมูลบริษัท" }).click();
    await expect(page.getByText("บันทึกข้อมูลบริษัทแล้ว")).toBeVisible();

    await page.getByLabel(/^ชื่อ-นามสกุล/).fill("คุณผู้ประสานงาน ทดสอบ");
    await page.getByLabel(/^เบอร์โทรศัพท์/).fill("0812223333");
    await page.getByRole("button", { name: "เพิ่มผู้ติดต่อ" }).click();
    await expect(page.getByText("เพิ่มผู้ติดต่อแล้ว")).toBeVisible();
    await expect(page.getByText("คุณผู้ประสานงาน ทดสอบ")).toBeVisible();

    await page.getByRole("button", { name: "ส่งใบสมัคร" }).click();
    await expect(dialog(page)).toContainText("ลูกฟูกใหม่ สาขาบางนา");
    await dialog(page).getByRole("button", { name: "ส่งใบสมัคร" }).click();
    await expect(page.getByText("ส่งใบสมัครแล้ว ทีมพาร์ตเนอร์จะติดต่อกลับ")).toBeVisible();
    // The step is submitted, and the factory moves to review on the tracker.
    await expect(page.getByText("ส่งตรวจแล้ว").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "ส่งใบสมัคร" })).toHaveCount(0);
    await gotoHydrated(page, `${HOSTS.partner}/onboarding`);
    await expect(page.getByRole("main").getByText("กำลังพิจารณา").first()).toBeVisible();

    // The Partner team sees it in its pipeline.
    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners?status=under_review`);
    await expect(page.getByRole("table", { name: "พาร์ตเนอร์โรงงาน" })).toContainText("ลูกฟูกใหม่");
  });
});

test.describe("assisted onboarding (F006)", () => {
  test("signs off what Packio entered, accepts the rate card and the delivery rates", async ({ page }) => {
    await signInAsPartner(page, "assisted");
    await expect(page.getByRole("link", { name: /รับรองข้อมูล 2 ขั้นตอน/ })).toBeVisible();

    await page.getByRole("link", { name: /รับรองข้อมูล 2 ขั้นตอน/ }).click();
    await expect(page.getByText("มี 2 ขั้นตอนรอคุณรับรอง")).toBeVisible();
    await page.getByRole("link", { name: /ความสามารถในการผลิต/ }).click();
    await expect(page.getByText("ขั้นตอนนี้รอคุณรับรอง")).toBeVisible();
    await expectAxeClean(page);
    await page.getByRole("button", { name: "ตรวจแล้ว ข้อมูลถูกต้อง — รับรอง" }).click();
    await dialog(page).getByRole("button", { name: "รับรอง", exact: true }).click();
    await expect(page.getByText("รับรอง “ความสามารถในการผลิต” แล้ว")).toBeVisible();
    await expect(page.getByText(/โรงงานรับรองข้อมูลนี้แล้วเมื่อ/)).toBeVisible();

    // The rate card Packio sent for the tier-A type (D-042 a): accepted whole.
    await gotoHydrated(page, `${HOSTS.partner}/prices`);
    await expectAxeClean(page);
    await page.getByRole("link", { name: /ใหม่จาก Packio/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: /จาก Packio$/ })).toBeVisible();
    await expectAxeClean(page);
    await page.getByRole("button", { name: "ยอมรับอัตราทั้งฉบับ" }).click();
    await dialog(page).getByRole("button", { name: "ยอมรับอัตราทั้งฉบับ" }).click();
    await expect(page.getByText("ยอมรับอัตราแล้ว")).toBeVisible();
    await expect(page.getByText("โรงงานยอมรับแล้ว").first()).toBeVisible();

    // The tier-B list Packio entered for it: signed off, so it applies.
    await gotoHydrated(page, `${HOSTS.partner}/prices`);
    await page.getByRole("button", { name: "ตรวจแล้ว ราคาถูกต้อง — รับรอง" }).click();
    await dialog(page).getByRole("button", { name: "รับรองราคา" }).click();
    await expect(page.getByText("รับรองราคาแล้ว")).toBeVisible();

    // What Packio pays for delivering with its own fleet (D-013).
    await gotoHydrated(page, `${HOSTS.partner}/prices/shipping`);
    await expectAxeClean(page);
    await page.getByRole("button", { name: /ยอมรับทั้ง \d+ บรรทัด/ }).click();
    await dialog(page).getByRole("button", { name: "ยอมรับ", exact: true }).click();
    await expect(page.getByText("ยอมรับอัตราค่าส่งแล้ว")).toBeVisible();
  });
});

test.describe("a factory price-list proposal (F001)", () => {
  test("proposes a change with a future effective date and the Partner team receives it", async ({ page }) => {
    await signInAsPartner(page, "owner");
    await gotoHydrated(page, `${HOSTS.partner}/prices/food_packaging`);
    await expect(page.getByText("ระดับ B").first()).toBeVisible();
    await expectAxeClean(page);

    await page.getByLabel(/^เหตุผล/).fill("ค่าแรงขั้นต่ำปรับขึ้น");
    await page.getByRole("button", { name: "เริ่มร่างข้อเสนอ" }).click();
    await expect(page).toHaveURL(/\/prices\/proposals\//);
    const proposalId = page.url().split("/").pop()!;
    await expect(page.getByText("ฉบับร่าง").first()).toBeVisible();

    await choose(page, "ส่วนประกอบราคา", "ของเสียงานพิมพ์");
    await choose(page, "บรรทัดในราคาปัจจุบัน", /จำนวนตั้งแต่/);
    await page.getByLabel(/^แผ่นเผื่อเสีย/).fill("60");
    await page.getByRole("button", { name: "เพิ่มการแก้ไขบรรทัดนี้" }).click();
    await expect(page.getByText("เพิ่มในข้อเสนอแล้ว")).toBeVisible();
    await expect(page.getByRole("list", { name: "บรรทัดในร่างข้อเสนอ" }).getByRole("listitem")).toHaveCount(1);
    await expectAxeClean(page);

    await page.getByRole("button", { name: "ส่งข้อเสนอให้ Packio" }).click();
    await dialog(page).getByRole("button", { name: "ส่งข้อเสนอ" }).click();
    await expect(page.getByText("ส่งข้อเสนอแล้ว รอ Packio ตรวจ")).toBeVisible();
    await expect(page.getByText("ส่งแล้ว").first()).toBeVisible();

    await signInAsStaff(page, "partner_manager");
    await gotoHydrated(page, `${HOSTS.admin}/partners/proposals/${proposalId}`);
    await expect(page.getByText("F001").first()).toBeVisible();
    await expect(page.getByText("ค่าแรงขั้นต่ำปรับขึ้น")).toBeVisible();
  });
});

test.describe("the partner zone's permissions", () => {
  test("an operator sees no prices and cannot open them", async ({ page }) => {
    await signInAsPartner(page, "operator");
    await gotoHydrated(page, `${HOSTS.partner}/more`);
    await expect(page.getByRole("link", { name: /คำขอถึง Packio/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /ราคาของโรงงาน/ })).toHaveCount(0);
    await gotoHydrated(page, `${HOSTS.partner}/prices`);
    await expect(page.getByText("คุณไม่มีสิทธิ์เปิดหน้านี้")).toBeVisible();
  });

  test("another factory's proposal is not found, and an unknown step is a 404", async ({ page }) => {
    await signInAsPartner(page, "owner");
    // F006's rate card, by id: D-044 says not found, not forbidden.
    await gotoHydrated(page, `${HOSTS.partner}/prices/proposals/00000000-0000-4000-8000-707072000004`);
    await expect(page.getByText("ไม่พบรายการนี้")).toBeVisible();
    const response = await page.goto(`${HOSTS.partner}/onboarding/not-a-step`);
    expect(response?.status()).toBe(404);
  });

  test("the requests screen asks the Partner team and lists the answers", async ({ page }) => {
    // Everyone at the factory reads the answers; only the owner asks (`factory_profile.manage`).
    await signInAsPartner(page, "planner");
    await gotoHydrated(page, `${HOSTS.partner}/requests`);
    await expect(page.getByText("ปรับกำลังผลิตให้แล้ว มีผลตั้งแต่สัปดาห์หน้า")).toBeVisible();
    await expect(page.getByText("เจ้าของโรงงานเป็นผู้ส่งคำขอถึงทีมพาร์ตเนอร์")).toBeVisible();

    await signInAsPartner(page, "owner");
    await gotoHydrated(page, `${HOSTS.partner}/requests`);
    await expect(page.getByText(/^ตอบโดย /).first()).toBeVisible();
    await choose(page, "เรื่อง", "กำลังผลิต");
    await page.getByLabel(/^รายละเอียด/).fill("ปิดซ่อมเครื่องพิมพ์ 2 วันสัปดาห์หน้า");
    await page.getByRole("button", { name: "ส่งคำขอ" }).click();
    await expect(page.getByText("ส่งคำขอแล้ว ทีมพาร์ตเนอร์จะตอบกลับ")).toBeVisible();
    await expect(page.getByText("ปิดซ่อมเครื่องพิมพ์ 2 วันสัปดาห์หน้า")).toBeVisible();
    await expectAxeClean(page);
  });
});
