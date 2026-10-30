import { HOSTS } from "../../playwright.config";
import { MOCK_RECEIVER_PHONE, signInAsCustomer } from "../helpers/customer";
import { expect, test } from "./fixture";
import { DELIVERED } from "./seeds";

/** T8 "สั่งซ้ำงานเดิม 2,000 ใบ" — from the order list to checkout (D-153). */
test("T8 reorder the previous job, 2,000 pcs", async ({ page, journey }) => {
  const j = journey("T8");
  await signInAsCustomer(page, "/account/orders", MOCK_RECEIVER_PHONE);
  await j.startHere();
  j.expectEvents("reorder_started", "reorder_added_to_cart");

  // A table row per order since the customer redesign: a delivered order's row offers receipt and a claim, so
  // reordering is on the order's page (scorecard §5 exception).
  const row = page.getByRole("row").filter({ hasText: DELIVERED.code });
  await j.screen(
    "order",
    () => row.getByRole("cell").first().getByRole("link").click(),
    () => expect(page.getByRole("heading", { level: 2, name: "สั่งซ้ำ" })).toBeVisible(),
  );
  const reorder = page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: "สั่งซ้ำ" }) });
  await j.screen(
    "reorder page",
    () =>
      reorder
        .getByRole("link", { name: /สั่งซ้ำ/ })
        .first()
        .click(),
    () => expect(page.getByRole("heading", { level: 1, name: `สั่งซ้ำ ${DELIVERED.code}` })).toBeVisible(),
  );

  const total = page.getByRole("complementary", { name: "ราคาวันนี้" });
  await j.decide("quantity", async () => {
    await page.getByLabel(/^จำนวน/).fill("2000");
    await expect(total.getByText(/2,000 ชิ้น/)).toBeVisible();
  });
  const repriced = (await total
    .getByText(/^฿[\d,.]+$/)
    .last()
    .textContent())!;

  await j.screen(
    "checkout",
    () => page.getByRole("button", { name: "สั่งซ้ำและไปชำระเงิน" }).click(),
    () => expect(page).toHaveURL(`${HOSTS.customer}/checkout`),
  );

  await j.done(() => expect(page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" })).toContainText(repriced));
});
