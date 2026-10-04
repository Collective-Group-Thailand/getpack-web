import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading } from "./helpers/designer";

/**
 * U4.6, ⑤ order from Packio 3D Studio against the mock API: the order sheet's tiers priced for the
 * saved version, "เพิ่มลงตะกร้า" saving the quotation, uploading the version's renders and ordering
 * it (a print job polled to success), then the cart with the version pinned at the studio's price —
 * and, once the order is placed, the design locked by it (editing makes a new version).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const STUDIO = /\/studio\/([0-9a-f-]{36})\?/;
const BOX = "/studio/new?product=tuck-end-box&style=tuck-end&l=70&w=40&h=150&step=design";
const BFF = { "x-packio-csrf": "1", origin: HOSTS.customer };

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .exclude("canvas")
    .exclude("[data-sonner-toaster]")
    .analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

type CartItem = {
  designDocumentId: string | null;
  designVersionNo: number | null;
  quantity: number;
  productGrossAmount: string;
};

test("studio → order sheet → cart: the version pinned at the studio's price", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAsCustomer(page, BOX, MOCK_DESIGNER_PHONE);
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  const id = STUDIO.exec(page.url())![1]!;

  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });

  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await steps.getByRole("button", { name: /สั่งผลิต/ }).click();
  await expect(page.getByRole("heading", { name: "สั่งผลิตแบบนี้" })).toBeVisible();
  // The final pass: a warning still open sends the customer back to ④ to accept it.
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
    await expect(warning).toBeHidden();
  }
  const tiers = page.getByRole("table", { name: "ราคาตามจำนวน" });
  const chosen = tiers.getByRole("row").filter({ has: page.getByRole("button", { pressed: true }) });
  await expect(chosen).toHaveCount(1, { timeout: 15_000 });
  const quantity = Number((await chosen.getByRole("button").innerText()).replace(/[^\d]/g, ""));
  const studioTotal = (await chosen.getByRole("cell").last().innerText()).trim();
  await expectNoViolations(page);

  await expect(page.getByRole("button", { name: "เพิ่มลงตะกร้า" })).toBeEnabled();
  await page.getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await expect(page).toHaveURL(/\/cart$/, { timeout: 30_000 });

  const cart = (await (await page.request.get(`${HOSTS.customer}/bff/v1/store/cart`, { headers: BFF })).json()) as {
    items: CartItem[];
  };
  const line = cart.items.find((item) => item.designDocumentId === id);
  expect(line, "the cart line carries the studio design").toBeTruthy();
  expect(line!.designVersionNo).toBeGreaterThan(0);
  expect(line!.quantity).toBe(quantity);
  // The same price the studio showed for the same options (D-277: one engine, one spec).
  expect(studioTotal.replace(/[^\d.]/g, "")).toBe(line!.productGrossAmount);

  // Placing the order locks the version (D-276): the studio says editing makes a new version.
  await page.goto(`${HOSTS.customer}/checkout`);
  await page.getByRole("radio", { name: /โอนเงินและแนบสลิป/ }).click();
  const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
  await expect(summary.getByRole("button", { name: /ยืนยันและชำระ/ })).toBeEnabled({ timeout: 15_000 });
  await summary.getByRole("button", { name: /ยืนยันและชำระ/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ยืนยันและชำระเงิน" }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\//, { timeout: 15_000 });

  const design = (await (
    await page.request.get(`${HOSTS.customer}/bff/v1/store/designs/${id}`, { headers: BFF })
  ).json()) as {
    lock: { versionNo: number; orderId: string; orderCode: string } | null;
  };
  expect(design.lock?.versionNo).toBe(line!.designVersionNo);
  await page.goto(`${HOSTS.customer}/studio/${id}?step=design`);
  await expect(
    page.getByText(`เวอร์ชัน ${design.lock!.versionNo} สั่งผลิตแล้ว (${design.lock!.orderCode})`),
  ).toBeVisible({
    timeout: 15_000,
  });
  // The order links to the version it locked.
  await page.goto(`${HOSTS.customer}/account/orders/${design.lock!.orderId}`);
  await expect(
    page.getByRole("link", { name: new RegExp(`เวอร์ชัน ${design.lock!.versionNo} ที่สั่งผลิต`) }),
  ).toBeVisible();
});
