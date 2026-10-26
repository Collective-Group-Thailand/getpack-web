import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { DEV_INSTANT_PRODUCT, runId, signInCustomer } from "./support";

/**
 * U2.F5 on the real getpack-api (`v0.41.0`): a new customer's dashboard and replenishment render (no
 * history, no suggestion), and a call-off asked for on a saved quotation awaits confirmation
 * (`pending_confirmation`), or getpack-api says why not.
 */
test("dashboard, replenishment and a call-off request, on the real API", async ({ context, page }) => {
  test.slow();
  await signInCustomer(context, runId("repeat"));
  await page.goto(`${HOSTS.customer}/account`);
  await expect(page.getByRole("heading", { name: "ตอนนี้งานของคุณอยู่ไหน" })).toBeVisible({ timeout: 30_000 });
  await page.goto(`${HOSTS.customer}/account/replenishment`);
  await expect(page.getByRole("heading", { level: 1, name: "สั่งซ้ำตามรอบ" })).toBeVisible();

  await page.goto(`${HOSTS.customer}/configure/${DEV_INSTANT_PRODUCT}`);
  await page.locator("html[data-hydrated]").waitFor();
  await page
    .getByRole("button", { name: /^ขั้นที่ \d+ จาก \d+ จำนวน/ })
    .first()
    .click();
  await page.getByLabel("เพิ่มจำนวน").fill("1000");
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  const dock = page.getByRole("complementary", { name: "ราคาของคุณ" });
  await expect(dock.getByText(/\/ ชิ้น$/)).toBeVisible({ timeout: 30_000 });
  await dock.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText(/บันทึกใบเสนอราคาแล้ว/)).toBeVisible({ timeout: 30_000 });

  await page.goto(`${HOSTS.customer}/account/quotes`);
  await page.locator("html[data-hydrated]").waitFor();
  await page
    .getByRole("button", { name: /^ล็อกราคาไว้เรียกทีละงวด/ })
    .first()
    .click();
  const answer = page.waitForResponse(
    (r) => r.url().endsWith("/call-off-agreements") && r.request().method() === "POST",
  );
  await page.getByRole("dialog", { name: "ขอทำสัญญาเรียกของ" }).getByRole("button", { name: "ส่งคำขอ" }).click();
  const response = await answer;
  const body = await response.json();
  console.log("call-off request:", response.status(), body.status ?? body.code);
  if (response.ok()) {
    await expect(page).toHaveURL(/\/account\/call-offs\/[0-9a-f-]+$/, { timeout: 30_000 });
    await expect(page.getByText("รอยืนยัน").first()).toBeVisible();
  } else {
    await expect(page.getByText(body.detail)).toBeVisible();
  }
});
