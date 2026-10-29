import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading } from "./helpers/designer";
import { gotoHydrated } from "./helpers/session";

/**
 * C11 (DECISIONS-STAGE-A §16.3, D-459): "เปลี่ยนเป็น CMYK" shows the price now and with CMYK before it is applied —
 * a signed-in design priced through `store.studio.quote` (`alternativeSpec`, nothing saved), against the mock API.
 * The artwork gets two flat colours on a product whose automatic print prices fewer spot inks than that, so the
 * Studio shows its spot-colour warning (C0). Written, not run in the cloud (owner rule 2026-10-28).
 */

const STUDIO = /\/studio\/[0-9a-f-]{36}\?/;

test("เปลี่ยนเป็น CMYK: the price now and with CMYK first, the switch only on confirm", async ({ page }) => {
  await signInAsCustomer(page, "/account", MOCK_DESIGNER_PHONE);
  await gotoHydrated(page, `${HOSTS.customer}/styles/pk-te-01`);
  await page.getByRole("button", { name: "ออกแบบใน 3D Studio" }).click();
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });

  // Two headings in two flat colours.
  await addHeading(page);
  await addHeading(page);
  await page.getByRole("tabpanel", { name: "ออกแบบ" }).locator('input[type="color"]').first().fill("#c0392b");

  const warning = page.locator("[data-spot-shortfall]");
  await expect(warning).toBeVisible({ timeout: 15_000 });
  await warning.getByRole("button", { name: "เปลี่ยนเป็น CMYK" }).click();

  const confirm = page.getByRole("alertdialog", { name: "เปลี่ยนเป็นพิมพ์ 4 สี (CMYK)?" });
  await expect(confirm).toBeVisible();
  const preview = confirm.locator("[data-cmyk-preview]");
  await expect(preview.getByText("กำลังคำนวณราคา…")).toHaveCount(0, { timeout: 15_000 });
  await expect(preview.locator('[data-price="now"]')).toContainText("฿");
  await expect(preview.locator('[data-price="cmyk"]')).toContainText("฿");

  // Cancel changes nothing: the warning is still there.
  await confirm.getByRole("button", { name: "ยังไม่เปลี่ยน" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(warning).toBeVisible();

  // Confirm applies CMYK: the warning goes (a process ink prints every colour).
  await warning.getByRole("button", { name: "เปลี่ยนเป็น CMYK" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "เปลี่ยนเป็น CMYK" }).click();
  await expect(page.locator("[data-spot-shortfall]")).toHaveCount(0, { timeout: 15_000 });
});
