import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { DEV_INSTANT_PRODUCT, runId, signInCustomer } from "./support";

/**
 * U4.1 on the real packio-api (`v0.41.0`): a studio design on the dev seed's instant corrugated
 * carton is created with its box and calculator spec (D-275), the dock prices that version through
 * `store.studio.quote` (D-277), and another quantity is re-priced with the API's reason. Every
 * figure is the API's; the assertions check that they arrive and follow the change.
 */

test("studio → saved box and spec → studio price → quantity → new price, on the real API", async ({
  context,
  page,
}) => {
  test.slow();
  await signInCustomer(context, runId("studio"));
  const query = new URLSearchParams({ product: DEV_INSTANT_PRODUCT, style: "rsc", l: "400", w: "300", h: "250" });
  await page.goto(`${HOSTS.customer}/studio/new?${query.toString()}`);
  await page.locator("html[data-hydrated]").waitFor();

  const setup = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await expect(setup).toBeVisible();
  await setup.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?/, { timeout: 30_000 });

  const dock = page.getByRole("region", { name: "ราคาและการสั่งผลิต" });
  const perPiece = dock.locator("span.font-semibold").filter({ hasText: "฿" });
  await expect(perPiece.or(dock.getByText("ขอใบเสนอราคา").first())).toBeVisible({ timeout: 30_000 });
  test.skip(!(await perPiece.isVisible()), "the dev seed quotes this product on request");
  const first = await perPiece.textContent();

  await dock.getByRole("combobox", { name: "จำนวน" }).click();
  await page.getByRole("option").last().click();
  await expect(perPiece).not.toHaveText(first!, { timeout: 30_000 });
  await expect(dock.getByText(/เปลี่ยนจำนวน/)).toBeVisible();
});
