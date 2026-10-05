import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { DEV_INSTANT_PRODUCT, runId, signInCustomer } from "./support";

/**
 * U4.8 on the real packio-api (`v0.41.0`): "ให้ทีมออกแบบให้" from the studio's order step puts the
 * saved version in the cart with the design service (`store.studio.requestDesignService`, D-286) and
 * the brief on the line (`designNote`).
 */
test("the design service from the studio: the version and its brief in the cart, on the real API", async ({
  context,
  page,
}) => {
  test.slow();
  await signInCustomer(context, runId("handoff"));
  const query = new URLSearchParams({ product: DEV_INSTANT_PRODUCT, style: "rsc", l: "400", w: "300", h: "250" });
  await page.goto(`${HOSTS.customer}/studio/new?${query.toString()}`);
  await page.locator("html[data-hydrated]").waitFor();
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?/, { timeout: 30_000 });
  const id = /\/studio\/([0-9a-f-]{36})/.exec(page.url())![1]!;
  await page
    .getByRole("navigation", { name: "เครื่องมือออกแบบ" })
    .getByRole("button", { name: "ข้อความ", exact: true })
    .click();
  await page.getByRole("button", { name: "เพิ่มหัวข้อ", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 30_000 });

  await page
    .getByRole("navigation", { name: "ขั้นตอนการออกแบบ" })
    .getByRole("button", { name: /สั่งผลิต/ })
    .click();
  await expect(page.getByRole("heading", { name: "สั่งผลิตแบบนี้" })).toBeVisible();
  // The dev product has no quantity presets: typed in the price bar.
  if (await page.getByText("ระบุจำนวนที่แถบราคาเพื่อดูราคาของแบบนี้").isVisible()) {
    await page.getByRole("spinbutton", { name: "จำนวน" }).fill("1000");
    await page.getByRole("spinbutton", { name: "จำนวน" }).blur();
  }
  await expect(page.getByRole("button", { name: "ให้ทีมออกแบบให้" })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "ให้ทีมออกแบบให้" }).click();
  const dialog = page.getByRole("dialog", { name: "บรีฟสำหรับทีมออกแบบ" });
  const brief = dialog.getByRole("textbox", { name: "บรีฟ" });
  await brief.press("End");
  await brief.pressSequentially("ขอโลโก้ใหญ่ขึ้น");
  await dialog.getByRole("button", { name: "ใส่ตะกร้าพร้อมบริการออกแบบ" }).click();
  await expect(page).toHaveURL(/\/cart$/, { timeout: 60_000 });

  const cart = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/cart`)).json();
  const line = cart.items.find((item: { designDocumentId: string | null }) => item.designDocumentId === id);
  expect(line, JSON.stringify(cart.items)).toBeTruthy();
  expect(line.designNote).toContain("ขอโลโก้ใหญ่ขึ้น");
  expect(line.designVersionNo).toBeGreaterThan(0);
});
