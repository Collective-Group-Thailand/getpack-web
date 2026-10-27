import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInAsCustomer } from "./helpers/customer";
import { adminMenuLink, gotoHydrated, signInAsPartner, signInAsStaff } from "./helpers/session";
import { choiceList } from "./helpers/select";

/** Opens the first sample in `status` from the account's samples table, by its "ดูรายละเอียด" link. */
async function openSampleWith(page: Page, status: string) {
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: status, exact: true }) })
    .first()
    .getByRole("link", { name: /^ดูรายละเอียด/ })
    .click();
}

/**
 * U2.F3, the sample arc against the mock API, across the three zones: the customer asks for a
 * sample from a saved quotation; CS (lead) quotes it from the sample queue; the customer buys a
 * quoted sample; the factory records a sample's evidence on a phone; the customer checks a delivered
 * sample with the checklist, approves it and orders the bulk with the credit. The mock's founder
 * persona holds the seeded samples (no other suite uses its cart).
 */

const FOUNDER = "0889012345";
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).exclude("[data-sonner-toaster]").analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

test.describe.configure({ mode: "serial" });

test("the customer asks for a sample from a saved quotation", async ({ page }) => {
  await signInAsCustomer(page, "/configure/tuck-end-box", FOUNDER);
  const dock = page.getByRole("complementary", { name: "ราคาของคุณ" });
  await expect(dock.getByText(/\/ ชิ้น$/)).toBeVisible();
  // Keeping the price as a quotation is the dock's "ใบเสนอราคา" (C4-11).
  await dock.getByRole("button", { name: "ใบเสนอราคา", exact: true }).click();
  await expect(page.getByText(/บันทึกใบเสนอราคาแล้ว/)).toBeVisible();

  await gotoHydrated(page, `${HOSTS.customer}/account/quotes`);
  await page
    .getByRole("button", { name: /^ขอตัวอย่างก่อนสั่งผลิต/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "ขอตัวอย่างก่อนสั่งผลิต" });
  await dialog.getByRole("radio", { name: /ไม่พิมพ์/ }).click();
  await dialog.getByRole("textbox", { name: "รหัสไปรษณีย์ที่จะส่งตัวอย่าง" }).fill("10110");
  await dialog.getByRole("textbox", { name: "ถึงทีมงาน (ถ้ามี)" }).fill("ขอดูโครงสร้างก่อน");
  await expectNoViolations(page);
  await dialog.getByRole("button", { name: "ส่งคำขอ" }).click();
  await expect(page).toHaveURL(/\/account\/samples\/[0-9a-f-]+$/);
  await expect(page.getByText("ทีมงานกำลังเสนอราคาค่าตัวอย่าง เราจะแจ้งเมื่อพร้อม")).toBeVisible();
  await expect(page.getByRole("list", { name: "ขั้นตอนของตัวอย่าง" })).toBeVisible();
  await expectNoViolations(page);
});

test("CS quotes the requested sample from the sample queue", async ({ page }) => {
  await signInAsStaff(page, "cs_lead");
  await gotoHydrated(page, `${HOSTS.admin}/orders`);
  await (await adminMenuLink(page, "ตัวอย่างสินค้า")).click();
  await expect(page).toHaveURL(/\/samples/);
  await page.getByRole("link", { name: "รอใบเสนอราคา" }).click();
  await page.getByRole("link", { name: "ตัวอย่างไม่พิมพ์" }).first().click();
  await expect(page.getByText("ขอดูโครงสร้างก่อน")).toBeVisible();
  await page.getByRole("button", { name: "เสนอราคาตัวอย่าง" }).click();
  const dialog = page.getByRole("dialog", { name: "เสนอราคาตัวอย่าง" });
  await choiceList(dialog, "บริการ").click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("textbox", { name: "ราคาขายรวม VAT (บาท)" }).fill("450");
  await dialog.getByRole("textbox", { name: "ทำเสร็จใน (วัน)" }).fill("5");
  await dialog.getByRole("textbox", { name: "น้ำหนักพัสดุ (กรัม)" }).fill("300");
  await dialog.getByRole("button", { name: "เสนอราคาตัวอย่าง" }).click();
  await expect(page.getByText("เสนอราคาแล้ว", { exact: true }).first()).toBeVisible();
  await expectNoViolations(page);
});

test("the customer buys a quoted sample through the cart", async ({ page }) => {
  await signInAsCustomer(page, "/account/samples", FOUNDER);
  await openSampleWith(page, "เสนอราคาแล้ว");
  await expect(page.getByRole("heading", { name: "ใบเสนอราคาค่าตัวอย่าง" })).toBeVisible();
  await page.getByRole("button", { name: "ซื้อตัวอย่างนี้" }).click();
  await expect(page).toHaveURL(/\/cart$/);
});

test("the factory records a sample's evidence on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsPartner(page, "planner");
  await gotoHydrated(page, `${HOSTS.partner}/samples`);
  const job = page.getByRole("region", { name: /^งาน SJ-0002/ });
  await job.getByRole("textbox", { name: "ยาว (มม.)" }).fill("120");
  await job.getByRole("textbox", { name: "กว้าง (มม.)" }).fill("80");
  await job.getByRole("textbox", { name: "สูง (มม.)" }).fill("60");
  await job.getByRole("textbox", { name: "วัสดุที่ใช้จริง" }).fill("อาร์ตการ์ด 350 แกรม");
  await job.locator("input[type=file]").setInputFiles({
    name: "front.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expectNoViolations(page);
  await job.getByRole("button", { name: "บันทึกหลักฐาน" }).click();
  await expect(page.getByText("บันทึกหลักฐานแล้ว").first()).toBeVisible();
});

test("the customer checks a delivered sample, approves it and orders the bulk", async ({ page }) => {
  await signInAsCustomer(page, "/account/samples", FOUNDER);
  await openSampleWith(page, "ถึงแล้ว รอตรวจ");
  await expect(page.getByRole("heading", { name: "หลักฐานการตรวจ" })).toBeVisible();
  await expect(page.getByRole("img", { name: "รูปตัวอย่างที่ 1" })).toBeVisible();

  const approve = page.getByRole("button", { name: "อนุมัติตัวอย่าง" });
  await expect(approve).toBeDisabled();
  for (const point of ["ขนาดถูกต้อง", "สีตรงตามที่ต้องการ", "วัสดุถูกต้อง", "ประกอบและพับได้ถูกต้อง"])
    await page.getByRole("checkbox", { name: point }).check();
  await expectNoViolations(page);
  await approve.click();
  await expect(page.getByRole("heading", { name: "สั่งผลิตจากตัวอย่างนี้" })).toBeVisible();
  await expect(page.getByText(/ได้หักค่าตัวอย่าง/)).toBeVisible();
  await expect(page.getByText(/ตรวจแล้ว: ขนาดถูกต้อง/)).toBeVisible();

  await page.getByRole("textbox", { name: "จำนวนที่จะสั่ง" }).fill("1000");
  await page.getByRole("button", { name: "ใส่ตะกร้าเพื่อสั่งผลิต" }).click();
  await expect(page).toHaveURL(/\/cart$/);
});
