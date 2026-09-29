import { signInAsCustomer } from "../helpers/customer";
import { expect, test } from "./fixture";
import { INVOICED } from "./seeds";

/** T10 "ขอใบกำกับภาษีของออร์เดอร์นี้" — from the order list to the open tax invoice. */
test("T10 get the tax invoice for an order", async ({ page, journey }) => {
  const j = journey("T10");
  await signInAsCustomer(page, "/account/orders");
  await j.startHere();
  j.gap("there is no list of documents: a tax invoice is found through its order (U5.1)");

  await j.screen(
    "completed orders",
    () => page.getByRole("link", { name: "เสร็จสิ้น" }).click(),
    () => expect(page.getByText(INVOICED.code).first()).toBeVisible(),
  );
  await j.screen(
    "order",
    () => page.getByRole("article").filter({ hasText: INVOICED.code }).getByRole("heading").getByRole("link").click(),
    () => expect(page).toHaveURL(new RegExp(`/account/orders/${INVOICED.id}$`)),
  );
  // A signed link is asked for, then opened by a second click (api-conventions §3).
  await j.decide("ask for the tax invoice's link", () =>
    page.getByRole("button", { name: /^ขอลิงก์ดาวน์โหลด TR-/ }).click(),
  );
  // The mock signs a `data:` URL, which Chromium will not open in a new tab; the API's is https.
  const open = page.getByRole("link", { name: /^เปิดเอกสาร TR-/ });
  await j.screen(
    "tax invoice",
    () => open.click(),
    async () => {
      await expect(open).toHaveAttribute("href", /^(data|https?):/);
      await expect(open).toHaveAttribute("target", "_blank");
    },
  );

  await j.done(() => expect(page.getByText("ใบกำกับภาษี/ใบเสร็จรับเงิน").first()).toBeVisible());
});
