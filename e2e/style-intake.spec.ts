import { readFileSync } from "node:fs";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, signInAsPartner, signInAsStaff } from "./helpers/session";

/**
 * U3.6 against the mock API, across the three zones:
 * - a customer who cannot find a style asks for a structural design; CS assigns a designer, the
 *   designer delivers the dieline, Prepress approves and publishes it, and the customer sees it;
 * - a factory offers a dieline under the intake terms; Prepress lays the seeded offer's DXF over
 *   the closest recipe, reads a match within 0.5 mm, saves it and approves it as a new style.
 */

const RECEIVER = "0845678901";
const DXF = readFileSync(join(process.cwd(), "e2e/fixtures/intake-mailer.dxf"));
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).exclude("[data-sonner-toaster]").analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

test.describe.configure({ mode: "serial" });

let requestUrl = "";

test("a customer who cannot find a style asks for a structural design", async ({ page }) => {
  await signInAsCustomer(page, "/styles", RECEIVER);
  await page.getByRole("link", { name: "ขอให้ออกแบบโครงสร้าง" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ขอให้ออกแบบโครงสร้างกล่อง" })).toBeVisible();
  await page
    .getByRole("textbox", { name: /ใส่อะไร ใช้อย่างไร/ })
    .fill("กล่องใส่เทียนหอมสามชิ้นแยกช่อง ส่งพัสดุได้ (ทดสอบ)");
  await page.getByRole("textbox", { name: "ยาว (มม.)" }).fill("180");
  await page.getByRole("textbox", { name: "กว้าง (มม.)" }).fill("70");
  await page.getByRole("textbox", { name: "สูง (มม.)" }).fill("90");
  await page.getByRole("textbox", { name: "จำนวนที่คาดว่าจะสั่ง" }).fill("1000");
  await expectNoViolations(page);
  await page.getByRole("button", { name: "ส่งคำขอ" }).click();
  await expect(page).toHaveURL(/\/account\/structural-requests\/[0-9a-f-]+$/);
  requestUrl = page.url();
  await expect(page.getByText("ทีมได้รับคำขอแล้ว กำลังหาผู้ออกแบบที่เหมาะกับงาน")).toBeVisible();
  await expectNoViolations(page);
});

test("CS assigns a designer, the designer delivers, Prepress approves and publishes", async ({ page }) => {
  await signInAsStaff(page, "cs");
  await gotoHydrated(page, `${HOSTS.admin}/orders`);
  await page.getByRole("link", { name: "คำขอออกแบบโครงสร้าง" }).click();
  await expect(page).toHaveURL(/\/structural-requests$/);
  // Newest first: this run's request (a rerun on the same server leaves the last one below it).
  await page
    .getByRole("link", { name: /กล่องใส่เทียนหอม/ })
    .first()
    .click();
  await page.getByRole("button", { name: "มอบหมาย" }).click();
  const assign = page.getByRole("dialog", { name: "มอบหมายนักออกแบบโครงสร้าง" });
  await assign.getByRole("combobox").click();
  await page.getByRole("option", { name: /ฝ่ายเตรียมพิมพ์/ }).click();
  await assign.getByRole("button", { name: "มอบหมาย" }).click();
  await expect(page.getByText("มีผู้ออกแบบรับงาน").first()).toBeVisible();
  await expectNoViolations(page);
  const adminUrl = page.url();

  await page.context().clearCookies();
  await signInAsStaff(page, "prepress");
  await gotoHydrated(page, adminUrl);
  await page.getByRole("button", { name: "ส่งแบบไดคัท" }).click();
  const deliver = page.getByRole("dialog", { name: "ส่งแบบไดคัท" });
  await deliver
    .locator('input[type="file"]')
    .setInputFiles({ name: "candles.dxf", mimeType: "application/dxf", buffer: DXF });
  await deliver.getByRole("button", { name: "ส่งแบบไดคัท" }).click();
  await expect(page.getByText("ส่งแบบแล้ว", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "อนุมัติแบบ" }).click();
  await page.getByRole("dialog", { name: "อนุมัติแบบไดคัท" }).getByRole("button", { name: "อนุมัติแบบ" }).click();
  await expect(page.getByText("อนุมัติแบบแล้ว").first()).toBeVisible();
  await page.getByRole("button", { name: "เผยแพร่ในคลังแบบ" }).click();
  const publish = page.getByRole("dialog", { name: "เผยแพร่เป็นแบบในคลัง" });
  await publish.getByRole("textbox", { name: /รหัสแบบ/ }).fill("pk-sp-21");
  await publish.getByRole("button", { name: "เผยแพร่ในคลังแบบ" }).click();
  await expect(page.getByText("เผยแพร่ในคลังแบบแล้ว").first()).toBeVisible();
  await expectNoViolations(page);

  await page.context().clearCookies();
  await signInAsCustomer(page, "/", RECEIVER);
  await gotoHydrated(page, requestUrl);
  await expect(page.getByText("แบบนี้อยู่ในคลังแบบแล้ว สั่งผลิตได้เหมือนแบบอื่น")).toBeVisible();
  await expect(page.getByRole("link", { name: "PK-SP-21" })).toBeVisible();
});

test("a factory offers a dieline under the intake terms", async ({ page }) => {
  await signInAsPartner(page, "owner");
  await gotoHydrated(page, `${HOSTS.partner}/style-intakes`);
  await expect(page.getByRole("heading", { level: 1, name: "เสนอแบบไดคัท" })).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "tray.dxf", mimeType: "application/dxf", buffer: DXF });
  await page.getByRole("textbox", { name: /ชื่อแบบ/ }).fill("ถาดลิ้นเสียบของโรงงาน (ทดสอบ)");
  await page.getByRole("checkbox", { name: "ยอมรับเงื่อนไขการรับแบบ" }).click();
  await expectNoViolations(page);
  await page.getByRole("button", { name: "ส่งแบบ" }).click();
  await expect(page.getByText("ถาดลิ้นเสียบของโรงงาน (ทดสอบ)").first()).toBeVisible();
});

test("Prepress lays the offer's DXF over a recipe, matches it within 0.5 mm and approves it", async ({ page }) => {
  await signInAsStaff(page, "prepress");
  await gotoHydrated(page, `${HOSTS.admin}/prepress`);
  await page.getByRole("link", { name: "แบบไดคัทจากโรงงาน" }).click();
  await page.getByRole("link", { name: "กล่องไปรษณีย์ลิ้นล็อกคู่ (ข้อมูลจำลอง)" }).click();
  await expect(page.getByText("ฉบับที่ 1")).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "F001-mailer.dxf", mimeType: "application/dxf", buffer: DXF });
  await expect(page.getByText("ตรงกัน", { exact: true })).toBeVisible();
  await expect(page.getByText(/คลาดสูงสุด 0(\.0\d)? มม\./)).toBeVisible();
  await expectNoViolations(page);
  await page.getByRole("button", { name: "บันทึกการจับคู่" }).click();
  await expect(page.getByText("max_deviation_mm")).toBeVisible();
  await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  const approve = page.getByRole("dialog", { name: "อนุมัติแบบนี้" });
  await approve.getByRole("button", { name: "อนุมัติ" }).click();
  await expect(page.getByText("อนุมัติเป็นแบบใหม่").first()).toBeVisible();
});
