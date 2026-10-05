import type { Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { MOCK_BUYER_PHONE, signInAsCustomer } from "../helpers/customer";
import { addHeading } from "../helpers/designer";
import { gotoHydrated } from "../helpers/session";
import { expect, test } from "./fixture";

const BOX = "/studio/new?product=tuck-end-box&style=tuck-end&l=70&w=40&h=150&step=design";

/** Whatever the buyer's cart already holds is not part of this task. */
async function emptyCart(page: Page) {
  await gotoHydrated(page, `${HOSTS.customer}/cart`);
  const remove = page.getByRole("button", { name: /^นำออก/ });
  while ((await remove.count()) > 0) {
    const before = await remove.count();
    await remove.first().click();
    await expect(remove).toHaveCount(before - 1);
  }
}

/**
 * T4 "สั่งผลิต 1,000 ใบ ส่งมาที่บริษัท" — from the studio to the payment page (nothing is paid). Since
 * U4.6 the studio orders on its own: ⑤ Order prices the design, "สั่งเลย" goes straight to checkout.
 */
test("T4 order 1,000 pcs from the studio, up to payment", async ({ page, journey }) => {
  test.slow();
  const j = journey("T4");
  await signInAsCustomer(page, "/cart", MOCK_BUYER_PHONE);
  await emptyCart(page);
  // The task card's start: a design of the box open in the studio, saved.
  await gotoHydrated(page, `${HOSTS.customer}${BOX}`);
  const setup = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  if (await setup.isVisible()) await setup.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });
  await j.startHere();
  j.expectEvents("studio_add_to_cart", "checkout_started", "order_placed");

  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await j.screen(
    "the studio's order step",
    () => steps.getByRole("button", { name: /สั่งผลิต/ }).click(),
    () => expect(page.getByRole("heading", { name: "สั่งผลิตแบบนี้" })).toBeVisible(),
  );
  const tiers = page.getByRole("table", { name: "ราคาตามจำนวน" });
  await expect(tiers.getByRole("button", { pressed: true })).toHaveCount(1, { timeout: 15_000 });
  if ((await tiers.getByRole("button", { name: /1,000/, pressed: true }).count()) === 0) {
    await j.decide("quantity", () => tiers.getByRole("button", { name: /1,000/ }).first().click());
  }
  await j.screen(
    "checkout",
    () => page.getByRole("button", { name: "สั่งเลย" }).click(),
    () => expect(page.getByRole("heading", { level: 1, name: "ชำระเงิน" })).toBeVisible({ timeout: 60_000 }),
  );
  await page.locator("html[data-hydrated]").waitFor();
  // The company address and tax profile are the account's defaults: accepting them costs nothing.
  const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
  await j.screen(
    "confirm",
    () => summary.getByRole("button", { name: /ยืนยันและชำระ/ }).click(),
    () => expect(page.getByRole("alertdialog", { name: "ยืนยันคำสั่งซื้อ" })).toBeVisible(),
  );
  await j.screen(
    "payment",
    () => page.getByRole("alertdialog").getByRole("button", { name: "ยืนยันและชำระเงิน" }).click(),
    () => expect(page).toHaveURL(/\/checkout\/pay\//),
  );

  await j.done(() => expect(page.getByText("รอชำระเงิน", { exact: true })).toBeVisible());
});
