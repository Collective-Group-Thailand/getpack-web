import type { Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { MOCK_BUYER_PHONE, signInAsCustomer } from "../helpers/customer";
import { addHeading } from "../helpers/designer";
import { gotoHydrated } from "../helpers/session";
import { expect, test } from "./fixture";

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
  // The task card's start: a design of the box open in the studio, saved. Only a style-library box
  // prints from the studio (OrderSheet's `catalogueOnly`), so it is opened from its style page.
  await gotoHydrated(page, `${HOSTS.customer}/styles/pk-te-01`);
  await page.getByRole("button", { name: "ออกแบบใน 3D Studio" }).click();
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?/, { timeout: 15_000 });
  await page.getByRole("button", { name: "ใช้กล่องนี้ แล้วเริ่มออกแบบ" }).click();
  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกอัตโนมัติ" })).toBeVisible({ timeout: 15_000 });
  // The task card starts T4 from "the T3 design" — checked and fixed. The heading lands near a fold
  // on this narrow box, so its one-click fix is applied here, before counting: that is T3's work.
  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await steps.getByRole("button", { name: /ตรวจงาน/ }).click();
  await expect(page.getByRole("heading", { name: "ตรวจงานก่อนสั่งผลิต" })).toBeVisible();
  const fixes = page.getByRole("button", { name: "ย้ายเข้าเขตปลอดภัย" });
  for (let left = await fixes.count(); left > 0; left--) await fixes.first().click();
  await expect(fixes).toHaveCount(0);
  await j.startHere();
  j.expectEvents("studio_add_to_cart", "checkout_started", "order_placed");

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
  // Checkout redesign Phase 1: address → tax invoice & payment → review, then confirm (no dialog).
  await summary.getByRole("button", { name: /^ต่อไป: ใบกำกับภาษี/ }).click();
  await j.screen(
    "confirm",
    () => summary.getByRole("button", { name: "ต่อไป: ทบทวนและยืนยัน" }).click(),
    () => expect(page.getByRole("region", { name: "ทบทวนคำสั่งซื้อ" })).toBeVisible(),
  );
  await page.getByRole("checkbox", { name: /ยอมรับข้อกำหนดการใช้งาน/ }).check();
  await j.screen(
    "payment",
    () => summary.getByRole("button", { name: "ยืนยันคำสั่งซื้อและชำระเงิน" }).click(),
    () => expect(page).toHaveURL(/\/checkout\/pay\//),
  );

  await j.done(() => expect(page.getByText("รอชำระเงิน", { exact: true })).toBeVisible());
});
