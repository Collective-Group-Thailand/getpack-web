import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * U2.F1, the configurator v2, against the mock API: the size on a chosen basis with every other
 * basis from the API's conversion (D-182), the Structure Advisor (D-235–D-240), the target price
 * and its levers (D-247–D-251), and the summary with drafts and share links (D-185).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  // A price being updated is dimmed on purpose; check the settled screen.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    // A toast fades in and out; mid-fade its text is transparent. Toasts are checked on their own.
    .exclude("[data-sonner-toaster]")
    .analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });
const step = (page: Page, label: string) =>
  page.getByRole("button", { name: new RegExp(`^ขั้นที่ \\d+ จาก \\d+ ${label}`) }).first();

test.describe("configurator v2", () => {
  test.beforeEach(async ({ page }) => acceptCookies(page));

  test("a typed size needs its basis, and shows every other basis from the API", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
    // The style is named by its public code (D-184).
    await expect(page.getByText(/PK-[A-Z]+-\d+/).first()).toBeVisible();

    await page.getByRole("radio", { name: "กำหนดเอง" }).click();
    // No silent default: the basis is asked for before anything is priced.
    await page.getByRole("textbox", { name: "ยาว" }).fill("120");
    await page.getByRole("textbox", { name: "กว้าง" }).fill("80");
    await page.getByRole("textbox", { name: "สูง" }).fill("60");
    await expect(page.getByText("เลือกว่าขนาดที่ใส่วัดจากส่วนไหน")).toBeVisible();
    await expect(dock(page)).toContainText("ฐานการวัดขนาด");

    await page.getByRole("radio", { name: /ขนาดภายนอก/ }).click();
    const derived = page.getByRole("region", { name: "ขนาดในแต่ละแบบ" });
    await expect(derived).toContainText("ขนาดภายใน");
    await expect(derived).toContainText("ตามทับเส้น");
    await expect(derived).toContainText("(ที่ใส่)");
    await expect(derived).toContainText(/คำนวณจากความหนาวัสดุ/);
    await expect(dock(page).getByText(/\/ ชิ้น$/)).toBeVisible({ timeout: 15_000 });

    // A size past the style's inside limit is explained in the style's terms.
    await page.getByRole("textbox", { name: "กว้าง" }).fill("520");
    await expect(page.getByText(/ขนาดภายในสูงสุด 500 มม\. สำหรับ/)).toBeVisible();
    await expect(page.getByText(/คิดเป็นขนาดภายใน/)).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoViolations(page);
  });

  test("prints in colour: a process ink is the full-colour pass, and the price follows", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
    const headline = dock(page).getByText(/^฿[\d,]+\.\d{2} \/ ชิ้น$/);
    await expect(headline).toBeVisible();
    const plain = await headline.textContent();
    await step(page, "การพิมพ์").click();
    await page.getByRole("group", { name: "สีพิมพ์ด้านนอก" }).getByRole("checkbox", { name: /CMYK/ }).click();
    await expect(headline).not.toHaveText(plain!, { timeout: 15_000 });
  });

  test("the Structure Advisor recommends a board, and taking one re-prices", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/configure/shipping-box`);
    // The carton opens on its standard sizes (Phase 4); a size of the customer's own asks its basis.
    await page.getByRole("radio", { name: "กำหนดเอง" }).click();
    await page.getByRole("radio", { name: /ขนาดภายใน/ }).click();
    await page.getByRole("textbox", { name: "ยาว" }).fill("400");
    await page.getByRole("textbox", { name: "กว้าง" }).fill("300");
    await page.getByRole("textbox", { name: "สูง" }).fill("250");

    await step(page, "(วัสดุ|ลอนกระดาษ)").click();
    const advisor = page.getByRole("region", { name: "แนะนำลอนกระดาษ" });
    await expect(advisor).toContainText("ใส่น้ำหนักสินค้า");
    await advisor.getByRole("button", { name: "ใส่ข้อมูลสินค้าและการขนส่ง" }).click();
    await page.getByLabel("น้ำหนักสินค้าต่อชิ้น").fill("500");
    await page.getByLabel("จำนวนสินค้าต่อกล่อง").fill("10");
    await page.getByLabel("ซ้อนกี่ชั้น").fill("4");

    await step(page, "(วัสดุ|ลอนกระดาษ)").click();
    await advisor.getByRole("button", { name: "ดูคำแนะนำ" }).click();
    await expect(advisor).toContainText("ค่าประมาณ ไม่ใช่การรับประกัน");
    await expect(advisor.getByText(/นิวตัน/).first()).toBeVisible();
    await expect(advisor).toContainText("ทางเลือกอื่น");

    await advisor.getByRole("button", { name: "ทำไมถึงแนะนำแบบนี้" }).click();
    const why = page.getByRole("dialog", { name: "ทำไมถึงแนะนำลอนนี้" });
    await expect(why).toContainText("น้ำหนักที่กล่องล่างสุดรับ");
    await expectNoViolations(page);
    await why.getByRole("button", { name: "ปิด" }).first().click();

    const headline = dock(page).getByText(/^฿[\d,]+\.\d{2} \/ ชิ้น$/);
    await expect(headline).toBeVisible({ timeout: 15_000 });
    const before = await headline.textContent();
    // The recommended board is the cheapest that passes — not the heavy board the product starts on.
    await advisor.getByRole("button", { name: "ใช้ลอนนี้" }).first().click();
    const acknowledge = page.getByRole("alertdialog").getByRole("button", { name: "รับทราบและใช้ลอนนี้" });
    if (await acknowledge.isVisible().catch(() => false)) await acknowledge.click();
    await expect(advisor.getByText("ใช้ลอนนี้อยู่")).toBeVisible();
    await expect(headline).not.toHaveText(before!, { timeout: 15_000 });
  });

  test("a target above the price brings the API's levers, and one is taken", async ({ page }) => {
    await signInAsCustomer(page, "/configure/tuck-end-box");
    await step(page, "จำนวน").click();
    await page.getByLabel(/ราคาเป้าหมายต่อ/).fill("0.50");
    const target = page.getByRole("region", { name: /ราคาเป้าหมาย/ });
    await expect(target.getByText("สูงกว่าเป้าหมาย", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(dock(page)).toContainText("สูงกว่าเป้าหมาย");
    await expect(target).toContainText("เราไม่แสดงให้โรงงานเห็น");

    await target.getByRole("button", { name: "ดูวิธีลดราคา" }).click();
    const levers = target.getByRole("list", { name: "วิธีลดราคาที่คำนวณได้" });
    await expect(levers.getByRole("listitem").first()).toBeVisible({ timeout: 15_000 });
    await expect(levers.getByText(/→ ฿/).first()).toBeVisible();
    await expectNoViolations(page);
    await levers.getByRole("button", { name: "ใช้ทางเลือกนี้" }).first().click();
    await expect(page.getByText(/จากทางเลือกนี้แล้ว/)).toBeVisible();

    // A generous target meets the price.
    await step(page, "จำนวน").click();
    await page.getByLabel(/ราคาเป้าหมายต่อ/).fill("999");
    await expect(target.getByText("ราคานี้อยู่ในเป้าหมายแล้ว")).toBeVisible({ timeout: 15_000 });
  });

  test("talking to sales turns the quote into a pre-filled request", async ({ page }) => {
    await signInAsCustomer(page, "/configure/tuck-end-box");
    await step(page, "จำนวน").click();
    await page.getByLabel(/ราคาเป้าหมายต่อ/).fill("0.50");
    const target = page.getByRole("region", { name: /ราคาเป้าหมาย/ });
    await target.getByRole("button", { name: "คุยกับทีมขาย" }).click();
    const dialog = page.getByRole("dialog", { name: "ส่งให้ทีมขายช่วยหาราคา" });
    await dialog.getByLabel(/ข้อความถึงทีมขาย/).fill("ยืดหยุ่นเรื่องวัสดุได้");
    await dialog.getByRole("button", { name: "ส่งให้ทีมขาย" }).click();
    await expect(page.getByText(/ส่งให้ทีมขายแล้ว เลขที่คำขอ RFQ-/)).toBeVisible();
  });

  test("the summary saves a draft and shares it; the link reopens the configuration", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsCustomer(page, "/configure/tuck-end-box");
    await page.getByRole("radio", { name: "กำหนดเอง" }).click();
    await page.getByRole("radio", { name: /ขนาดภายใน/ }).click();
    await page.getByRole("textbox", { name: "ยาว" }).fill("180");
    await page.getByRole("textbox", { name: "กว้าง" }).fill("90");
    await page.getByRole("textbox", { name: "สูง" }).fill("60");

    await step(page, "สรุปและบันทึก").click();
    await expect(page.getByRole("meter", { name: "ความครบถ้วน" })).toBeVisible();
    await expect(page.getByText("รหัสแบบ").first()).toBeVisible();
    await expect(page.getByText(/ขนาด: ± 1 มม\./)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "บันทึกเป็นร่าง" }).click();
    await expect(page.getByText(/บันทึกร่างแล้ว เก็บไว้ถึง/)).toBeVisible();
    await expect(page.getByText(/ครบ 100%/).first()).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole("button", { name: "แชร์ลิงก์การตั้งค่า" }).click();
    await expect(page.getByText("คัดลอกลิงก์การตั้งค่าแล้ว")).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/configure\/tuck-end-box\?config=/);
    await page.goto(link);
    await expect(page.getByText(/เปิดจากการตั้งค่าที่มีคนแชร์มา/)).toBeVisible();
    await expect(page.getByRole("img", { name: /ขนาด 180 × 90 × 60 มม./ })).toBeVisible();

    // Back on the product's configurator, the draft is offered to carry on.
    await page.goto(`${HOSTS.customer}/configure/tuck-end-box`);
    await page
      .getByRole("link", { name: /ทำต่อ “/ })
      .first()
      .click();
    await expect(page.getByText(/ทำต่อจากร่าง/)).toBeVisible();
  });
});

test.describe("own file from /studio/upload", () => {
  test.beforeEach(async ({ page }) => acceptCookies(page));

  test("?design=own_file opens with 'มีไฟล์งานแล้ว' chosen, and the collapsed step says so", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/configure/shipping-box?design=own_file`);
    const design = step(page, "งานออกแบบและตัวอย่าง");
    await expect(design).toContainText("มีไฟล์งานแล้ว");
    await expect(design).not.toContainText("ออกแบบออนไลน์");
    await design.click();
    await expect(page.getByRole("radio", { name: /มีไฟล์งานแล้ว/ })).toBeChecked();
  });
});
