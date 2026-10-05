import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading } from "./helpers/designer";

/**
 * U4.8 against the mock API (the ordered-design library is in `storefront-studio-order.spec.ts`,
 * serial with the order): "ให้ทีมออกแบบให้"
 * puts the version in the cart with the design service and the brief on the line.
 */

const STUDIO = /\/studio\/([0-9a-f-]{36})\?/;
const BOX = "/studio/new?product=tuck-end-box&style=tuck-end&l=70&w=40&h=150&step=design";

async function newDesign(page: Page): Promise<string> {
  await signInAsCustomer(page, BOX, MOCK_DESIGNER_PHONE);
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });
  return STUDIO.exec(page.url())![1]!;
}

async function toOrderStep(page: Page) {
  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await steps.getByRole("button", { name: /สั่งผลิต/ }).click();
  await expect(page.getByRole("heading", { name: "สั่งผลิตแบบนี้" })).toBeVisible();
  const warning = page.getByText(/คำเตือน \d+ รายการที่ต้องรับทราบ/);
  if (await warning.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole("button", { name: "ไปที่ตรวจงาน" }).click();
    const accept = page.getByRole("button", { name: "รับทราบ ใช้แบบนี้" });
    await expect(accept.first()).toBeVisible({ timeout: 15_000 });
    while ((await accept.count()) > 0) {
      const before = await accept.count();
      await accept.first().click();
      await expect(accept).toHaveCount(before - 1, { timeout: 15_000 });
    }
    await steps.getByRole("button", { name: /สั่งผลิต/ }).click();
  }
}

test("ให้ทีมออกแบบให้: the version in the cart with the design service and the brief", async ({ page }) => {
  test.setTimeout(120_000);
  const id = await newDesign(page);
  await toOrderStep(page);
  await page.getByRole("button", { name: "ให้ทีมออกแบบให้" }).click();
  const dialog = page.getByRole("dialog", { name: "บรีฟสำหรับทีมออกแบบ" });
  const brief = dialog.getByRole("textbox", { name: "บรีฟ" });
  await expect(brief).toHaveValue(/ข้อความบนกล่อง: “/);
  await brief.press("End");
  await brief.pressSequentially("โทนสีธรรมชาติ");
  await dialog.getByRole("button", { name: "ใส่ตะกร้าพร้อมบริการออกแบบ" }).click();
  await expect(page).toHaveURL(/\/cart$/, { timeout: 30_000 });

  const cart = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/cart`)).json();
  const line = cart.items.find((item: { designDocumentId: string | null }) => item.designDocumentId === id);
  expect(line).toMatchObject({ designOption: "hired_design", designVersionNo: expect.any(Number) });
  expect(line.designNote).toContain("โทนสีธรรมชาติ");
  expect(line.designNote).toContain("กล่อง:");
});
