import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F2 2.7 — marketing, customers and B2B companies, against the mock API.
 *
 * Ids are the mocks' (`mockId(namespace, n)`): campaigns `…636d70`, promotions `…70726d`,
 * customers `…637573`, companies `…636d79`. Every test that changes state uses a record no
 * other test reads.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const id = (hex: string, n: number) => `00000000-0000-4000-8000-${hex}${n.toString(16).padStart(6, "0")}`;
const campaign = (n: number) => id("636d70", n);
const promotion = (n: number) => id("70726d", n);
const customer = (n: number) => id("637573", n);
const company = (n: number) => id("636d79", n);

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

test.describe("campaigns (D-154)", () => {
  test("each budget reads against the alert threshold the API reports", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing`);
    const table = page.getByRole("table", { name: "แคมเปญ" });
    const yearEnd = table.getByRole("row", { name: /ส่งท้ายปี 2569/ });
    await expect(yearEnd).toContainText("ใช้ไป ฿126,300.00 จาก ฿150,000.00 · แจ้งเตือนที่ 80%");
    await expect(yearEnd).toContainText("ใช้งบถึง 80% แล้ว");
    // The gauge is the API's `spentPct`; the row also counts the campaign's promotions.
    await expect(yearEnd.getByRole("meter", { name: "งบที่ใช้ไป" })).toBeVisible();
    await expect(yearEnd).toContainText("84.2%");
    await expect(table.getByRole("row", { name: /หน้าฝน 2569/ })).toContainText("งบหมดแล้ว");
    await expectAxeClean(page);
  });

  test("a form says what is wrong in words, not codes", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing`);
    await page.getByRole("button", { name: "สร้างแคมเปญ" }).click();
    const sheet = page.getByRole("dialog", { name: "สร้างแคมเปญ" });
    await sheet.getByLabel(/^รหัสแคมเปญ/).fill("x");
    await sheet.getByRole("button", { name: "บันทึก" }).click();
    await expect(sheet).toContainText("กรุณากรอกข้อมูลนี้");
    await expect(sheet).toContainText("ตัวพิมพ์เล็ก ตัวเลข - หรือ _ อย่างน้อย 2 ตัว");
    await expect(sheet).not.toContainText(/\brequired\b/);
  });

  test("pausing restates the spend and asks why, and a paused campaign is resumed", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing/campaigns/${campaign(2)}`);
    await expect(page.getByText("ผลของแคมเปญ")).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("button", { name: "พักแคมเปญ" }).click();
    const dialog = page.getByRole("alertdialog", { name: "พักแคมเปญ" });
    await expect(dialog).toContainText("฿21,450.00");
    await dialog.getByRole("button", { name: "พักแคมเปญ" }).click();
    // The reason is recorded with the action (`OptionalReasonDto`), so it is asked for.
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^เหตุผล/).fill("รอปรับข้อความโฆษณา");
    await dialog.getByRole("button", { name: "พักแคมเปญ" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(header(page)).toContainText("หยุดชั่วคราว");
    await expect(page.getByRole("button", { name: "เปิดต่อ" })).toBeVisible();
  });
});

test.describe("promotions (D-053)", () => {
  test("a coupon promotion is created, given a code and activated", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing/promotions/new?campaignId=${campaign(3)}`);
    await page.getByLabel(/^ชื่อโปรโมชัน/).fill("ทดสอบโค้ดปีใหม่");
    await page.getByLabel(/^วันเริ่ม/).fill("2026-12-01");
    // `admin.promotions.create` requires the priority.
    await page.getByLabel(/^ลำดับ/).fill("80");
    await page.getByRole("checkbox", { name: "เว็บไซต์" }).check();
    await page.getByLabel(/^ส่วนลด$/).fill("7");
    await page.getByRole("button", { name: "สร้างโปรโมชัน" }).click();
    await expect(page).toHaveURL(/\/marketing\/promotions\/[0-9a-f-]{36}$/);
    await expect(header(page)).toContainText("ฉบับร่าง");
    // The header says the benefit in the API's words (`benefitSummaryTh`).
    await expect(header(page)).toContainText("ลด 7%");

    await page.getByRole("button", { name: "เปิดใช้" }).click();
    let dialog = page.getByRole("alertdialog", { name: "เปิดใช้โปรโมชัน" });
    await dialog.getByRole("button", { name: "เปิดใช้" }).click();
    await expect(page.getByText("สร้างโค้ดก่อนเปิดใช้โปรโมชันแบบโค้ด")).toBeVisible();
    await dialog.getByRole("button", { name: "ยกเลิก" }).click();

    await page.getByRole("button", { name: "สร้างโค้ด" }).click();
    const generate = page.getByRole("dialog", { name: "สร้างโค้ดคูปอง" });
    await generate.getByLabel(/^โค้ด/).fill("NEWYEAR7");
    await generate.getByRole("button", { name: "สร้าง", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("table", { name: "โค้ดคูปอง" })).toContainText("NEWYEAR7");

    await page.getByRole("button", { name: "เปิดใช้" }).click();
    dialog = page.getByRole("alertdialog", { name: "เปิดใช้โปรโมชัน" });
    await dialog.getByRole("button", { name: "เปิดใช้" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(header(page)).toContainText("กำลังใช้งาน");
  });

  test("a redeemed benefit is locked and the margin guard's cap is reported", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing/promotions/${promotion(1)}`);
    await expect(page.getByText("โปรโมชันนี้มีการใช้แล้ว เปลี่ยนสิทธิประโยชน์ไม่ได้")).toBeVisible();
    await expect(page.getByLabel(/^ส่วนลด$/)).toBeDisabled();
    await expect(page.getByText("ตัดเพื่อกำไรขั้นต่ำ")).toBeVisible();
    await expect(page.getByText("฿1,240.00")).toBeVisible();
    await expectAxeClean(page);
  });

  test("a leaked code is disabled with the reason, and codes filter by status", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing/promotions/${promotion(4)}`);
    const codes = page.getByRole("table", { name: "โค้ดคูปอง" });
    await codes.getByRole("button", { name: "ปิดโค้ด FAIR9MXD" }).click();
    const dialog = page.getByRole("alertdialog", { name: "ปิดโค้ด FAIR9MXD" });
    await dialog.getByLabel(/^เหตุผลที่ปิดโค้ด/).fill("โค้ดหลุดในกลุ่มสาธารณะ");
    await dialog.getByRole("button", { name: "ปิดโค้ด" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(codes.getByRole("row", { name: /FAIR9MXD/ })).toContainText("ปิดใช้");
    // Each code names its batch.
    await expect(codes.getByRole("row", { name: /FAIR9MXD/ })).toContainText("ชุดโค้ดไม่ซ้ำ");

    await choose(page, /^สถานะ$/, "ใช้ครบแล้ว");
    await expect(codes.getByRole("row")).toHaveCount(2);
    await expect(codes).toContainText("FAIR7K2Q");
  });

  test("each row says its benefit, campaign and usage in the API's words", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing/promotions`);
    const table = page.getByRole("table", { name: "โปรโมชัน" });
    await expect(table).toContainText("ใช้แล้ว");
    await expect(table.getByRole("link", { name: /^[a-z0-9_-]+$/ }).first()).toBeVisible();
  });

  test("a referral promotion is the system's, so it is read-only", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing/promotions/${promotion(5)}`);
    await expect(page.getByText("โปรโมชันชวนเพื่อนจัดการโดยระบบ")).toBeVisible();
    await expect(page.getByRole("button", { name: "บันทึก" })).toHaveCount(0);
  });

  test("the engine's order is changed and saved", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing/promotions`);
    await page.getByRole("button", { name: "จัดลำดับ" }).click();
    const dialog = page.getByRole("dialog", { name: "ลำดับโปรโมชัน" });
    await dialog.getByRole("button", { name: /^เลื่อน ส่งฟรีเมื่อซื้อครบ .* ขึ้น$/ }).click();
    await dialog.getByRole("button", { name: "บันทึกลำดับ" }).click();
    await expect(page.getByText("บันทึกลำดับแล้ว")).toBeVisible();
    const first = page.getByRole("table", { name: "โปรโมชัน" }).getByRole("row").nth(1);
    await expect(first).toContainText("ส่งฟรีเมื่อซื้อครบ");
  });
});

test.describe("referrals (D-136)", () => {
  test("a held referral is decided in approvals, and the referral follows", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing/referrals?status=under_review`);
    const table = page.getByRole("table", { name: "เพื่อนแนะนำ" });
    await expect(table).toContainText("เบอร์โทรตรงกัน");
    await expectAxeClean(page);

    const row = table.getByRole("row", { name: /เบอร์โทรตรงกัน/ });
    await row.getByRole("link", { name: /^ตรวจรายการ / }).click();
    await expect(page).toHaveURL(/\/approvals\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    const dialog = page.getByRole("alertdialog", { name: "อนุมัติคำขอนี้?" });
    await dialog.getByLabel("ความเห็น").fill("ครอบครัวเดียวกันแต่สั่งซื้อจริง");
    await dialog.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    await expect(page.getByText("อนุมัติแล้ว").first()).toBeVisible();

    await gotoHydrated(page, `${HOSTS.admin}/marketing/referrals?status=rewarded`);
    await expect(page.getByRole("table", { name: "เพื่อนแนะนำ" })).toContainText("เบอร์โทรตรงกัน");
  });
});

test.describe("loyalty rules (D-130…D-136)", () => {
  test("are settings Marketing does not change", async ({ page }) => {
    await signInAsStaff(page, "marketing");
    await gotoHydrated(page, `${HOSTS.admin}/marketing`);
    await expect(
      page.getByRole("navigation", { name: "ส่วนงานการตลาด" }).getByRole("link", { name: "แต้มสะสม" }),
    ).toHaveCount(0);
  });

  test("the setting's owner schedules a new version", async ({ page }) => {
    await signInAsStaff(page, "superadmin");
    await gotoHydrated(page, `${HOSTS.admin}/marketing/loyalty`);
    const card = page.getByRole("heading", { name: /^รางวัลเพื่อนแนะนำ/ }).locator("../..");
    await expect(card).toContainText("500.00");
    await expectAxeClean(page);

    await card.getByRole("button", { name: "ตั้งค่าใหม่" }).click();
    const dialog = page.getByRole("dialog", { name: "ตั้ง รางวัลเพื่อนแนะนำ ใหม่" });
    await dialog.getByLabel("รางวัลผู้แนะนำ (บาท)").fill("600.00");
    await dialog.getByRole("radio", { name: "ตามวันที่" }).click();
    await dialog.getByLabel(/^มีผลตั้งแต่/).fill("2027-01-01");
    await dialog.getByLabel(/^เหตุผล/).fill("เพิ่มแรงจูงใจช่วงต้นปี");
    await dialog.getByRole("button", { name: "บันทึกฉบับใหม่" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(card).toContainText("มีฉบับรอมีผล 1 ฉบับ");
  });
});

test.describe("customers", () => {
  test("a customer's points add up to the balance, and consents are read-only", async ({ page }) => {
    // getpack-api grants customers.read to CS, not to Marketing (docs/rbac.md).
    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/customers`);
    const list = page.getByRole("table", { name: "ลูกค้า" });
    await expect(list).toContainText("บริษัท ตัวอย่างขนม จำกัด");
    await expectAxeClean(page);
    // The API filters by type (v0.5.0): no individual is left on the juristic page.
    await choose(page, /^ประเภท$/, "นิติบุคคล");
    await expect(page).toHaveURL(/customerType=juristic/);
    await expect(list).not.toContainText("ร้านกาแฟตัวอย่าง");

    await gotoHydrated(page, `${HOSTS.admin}/customers/${customer(2)}?tab=points`);
    await expect(page.getByText("แต้มที่ใช้ได้")).toBeVisible();
    await expect(page.getByRole("table", { name: "รายการแต้ม" })).toContainText("รอเข้าบัญชี");
    await expectAxeClean(page);

    // A ledger line opens the order it came from (`orderId`, v0.5.0).
    await expect(page.getByRole("table", { name: "รายการแต้ม" }).getByRole("link").first()).toHaveAttribute(
      "href",
      /\/orders\/[0-9a-f-]{36}$/,
    );

    await page.getByRole("tab", { name: "ความยินยอม" }).click();
    const consents = page.getByRole("table", { name: "ความยินยอม" });
    await expect(consents).toContainText("ประกาศความเป็นส่วนตัว");
    await expect(consents.getByRole("button")).toHaveCount(0);
  });

  test("the friends a customer referred are listed with the API's fraud flags (D-136)", async ({ page }) => {
    // The referral list needs promotions.read, which the CS Lead holds (docs/rbac.md).
    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/customers/${customer(3)}?tab=referrals`);
    const table = page.getByRole("table", { name: /^เพื่อนที่แนะนำด้วยรหัส/ });
    await expect(table.getByRole("row")).toHaveCount(3);
    await expect(table).toContainText("ที่อยู่ซ้ำ");
    await expectAxeClean(page);
  });
});

test.describe("B2B companies (D-120…D-125)", () => {
  test("KYC is reviewed document by document, then the account approved", async ({ page }) => {
    // getpack-api: companies.kyc_review reviews each document and approves the account (approve-kyc, no reason).
    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/companies/${company(3)}?tab=kyc`);
    await expect(header(page)).toContainText("กำลังตรวจเอกสาร");
    await expectAxeClean(page);

    await page.getByRole("button", { name: "อนุมัติ KYC" }).click();
    let confirm = page.getByRole("alertdialog", { name: "อนุมัติเอกสาร KYC" });
    await confirm.getByRole("button", { name: "อนุมัติ KYC" }).click();
    await expect(page.getByText("ต้องตรวจผ่านเอกสารที่จำเป็นครบก่อน (D-120)", { exact: true }).first()).toBeVisible();
    await confirm.getByRole("button", { name: "ยกเลิก" }).click();

    for (const doc of ["หนังสือรับรองบริษัท", "ภ.พ.20", "บัตรผู้มีอำนาจลงนาม"]) {
      await page.getByRole("button", { name: `ตรวจ${doc}` }).click();
      const dialog = page.getByRole("dialog", { name: `ตรวจ${doc}` });
      await dialog.getByRole("button", { name: "บันทึกผล" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }

    await page.getByRole("button", { name: "อนุมัติ KYC" }).click();
    confirm = page.getByRole("alertdialog", { name: "อนุมัติเอกสาร KYC" });
    await confirm.getByRole("button", { name: "อนุมัติ KYC" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(header(page)).toContainText("ใช้งานได้");
  });

  test("a company certificate older than six months is refused (D-120)", async ({ page }) => {
    await signInAsStaff(page, "finance_manager");
    await gotoHydrated(page, `${HOSTS.admin}/companies/${company(5)}?tab=kyc`);
    await page.getByRole("button", { name: "ตรวจหนังสือรับรองบริษัท" }).click();
    const dialog = page.getByRole("dialog", { name: "ตรวจหนังสือรับรองบริษัท" });
    await dialog.getByRole("button", { name: "บันทึกผล" }).click();
    await expect(page.getByText("หนังสือรับรองบริษัทต้องออกไม่เกิน 6 เดือน (D-120)")).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("a credit limit is requested with a term the setting allows (D-121)", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/companies/${company(2)}?tab=credit`);
    await expect(header(page)).toContainText("มีสิทธิ์ขอเครดิต");
    // The eligibility and its reason come with the credit (v0.5.0).
    await expect(page.getByText(/^ขอเครดิตได้: /)).toBeVisible();
    await page.getByRole("button", { name: "ขอวงเงิน" }).click();
    const dialog = page.getByRole("dialog", { name: "ขอวงเงินเครดิต" });
    await dialog.getByLabel(/^วงเงิน/).fill("80000");
    await choose(page, /^ระยะเครดิต/, "30 วัน (ค่าเริ่มต้น)");
    await dialog.getByLabel(/^เหตุผล/).fill("สั่งซื้อสม่ำเสมอ ชำระตรงเวลา");
    await dialog.getByRole("button", { name: "ส่งขออนุมัติ" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // The request answers the credit with its pending version, its approval and the history.
    await expect(page.getByText("มีคำขอวงเงินที่รออนุมัติ")).toBeVisible();
    await expect(page.getByText(/฿80,000\.00 ระยะ 30 วัน/)).toBeVisible();
    await expect(page.getByRole("link", { name: "ดูคำขออนุมัติ" }).first()).toHaveAttribute(
      "href",
      /\/approvals\/[0-9a-f-]{36}$/,
    );
    await expect(page.getByRole("table", { name: "ประวัติวงเงิน" })).toContainText("80,000.00");
    await expect(page.getByRole("button", { name: "ขอวงเงิน" })).toBeDisabled();
  });

  test("an overdue company is blocked from credit orders (D-122)", async ({ page }) => {
    await signInAsStaff(page, "finance");
    // The list filters by credit standing (v0.5.0) and the row carries the receivables.
    await gotoHydrated(page, `${HOSTS.admin}/companies?creditStatus=blocked_overdue`);
    const table = page.getByRole("table", { name: "บริษัทคู่ค้า" });
    const row = table.getByRole("row", { name: /อาหารเสริม/ });
    await expect(row).toContainText("ระงับเครดิต (ค้างชำระ)");
    await expect(row).toContainText(/เกินกำหนด ฿[\d,.]+ · \d+ วัน/);
    await expect(table.getByRole("row")).toHaveCount(2);
    await gotoHydrated(page, `${HOSTS.admin}/companies/${company(4)}`);
    // The block names its day count from the company's receivables (D-122).
    await expect(page.getByText(/^ระงับการสั่งแบบเครดิต: ค้างชำระเกินกำหนด \d+ วัน$/)).toBeVisible();
    await page.getByRole("tab", { name: "ใบแจ้งยอด" }).click();
    // The issued months, each with its PDF (D-125); a statement keeps no due date of its own.
    const issued = page.getByRole("table", { name: "ใบแจ้งยอดที่ออกแล้ว" });
    await expect(issued.getByRole("row")).toHaveCount(4);
    await expect(issued.getByRole("button", { name: /^ดาวน์โหลด PDF ใบแจ้งยอดเดือน/ }).first()).toBeEnabled();
    await expect(page.getByRole("tabpanel")).toContainText("ยกมา");
    await expect(page.getByRole("tabpanel")).toContainText("คงค้าง");
    await expectAxeClean(page);
  });
});
