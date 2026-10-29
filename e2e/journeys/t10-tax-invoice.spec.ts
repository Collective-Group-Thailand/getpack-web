import { signInAsCustomer } from "../helpers/customer";
import { expect, test } from "./fixture";

/**
 * T10 "ขอใบกำกับภาษีของออร์เดอร์นี้" — from the order list to the open tax invoice. Since U5.1 the
 * latest documents sit on the order list itself; the order page remains the way to an older one.
 */
test("T10 get the tax invoice for an order", async ({ page, journey }) => {
  const j = journey("T10");
  await signInAsCustomer(page, "/account/orders");
  await j.startHere();

  // The latest documents left the order list in the account redesign (C6): they are under "เอกสาร" in the
  // account menu (scorecard §5 exception).
  await j.screen(
    "documents",
    () => page.getByRole("navigation", { name: "บัญชีของฉัน" }).getByRole("link", { name: "เอกสาร" }).click(),
    () => expect(page.getByRole("heading", { level: 1, name: "เอกสารของฉัน" })).toBeVisible(),
  );
  const documents = page.getByRole("table", { name: "เอกสารของฉัน" });
  // A signed link is asked for, then opened by a second click (api-conventions §3).
  await j.decide("ask for the tax invoice's link", () =>
    documents
      .getByRole("button", { name: /^ดาวน์โหลด TR-/ })
      .first()
      .click(),
  );
  // The mock signs a `data:` URL, which Chromium will not open in a new tab; the API's is https.
  const open = documents.getByRole("link", { name: /^เปิดไฟล์ PDF TR-/ }).first();
  await j.screen(
    "tax invoice",
    () => open.click(),
    async () => {
      await expect(open).toHaveAttribute("href", /^(data|https?):/);
      await expect(open).toHaveAttribute("target", "_blank");
    },
  );

  await j.done(() => expect(documents.getByText(/^TR-/).first()).toBeVisible());
});
