import type { Page } from "@playwright/test";

import { signInAsCustomer } from "../helpers/customer";
import { expect, test } from "./fixture";

const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });

/**
 * T5 "ขอตัวอย่างก่อนสั่งผลิตจริง" — from the T1 box's product page, signed in, to a sample request
 * sent to Packio's CS (D-253: a standalone sample of a saved quotation, quoted by CS and bought like
 * any quotation). Since U5.8 the configurator's dock asks for it directly: the quotation is kept on
 * the way (`store.quotes.save`), and the postcode comes from the configuration or the default
 * delivery address. The task card stops before submitting with a participant; the walk submits to
 * the mock.
 */
test("T5 ask for a sample before the production run", async ({ page, journey }) => {
  const j = journey("T5");
  await signInAsCustomer(page, "/products/mailer-box");
  await j.startHere();
  j.gap("the measurement basis is asked before a price (D-182: no silent default), one step over the budget");

  await j.screen(
    "configurator",
    () => page.getByRole("link", { name: "ปรับแต่งและดูราคา" }).click(),
    () => expect(dock(page)).toBeVisible(),
  );
  await page.locator("html[data-hydrated]").waitFor();
  // D-182: the customer chooses the basis (no silent default), then the T1 box's size.
  await j.decide("measurement basis", () => page.getByRole("radio", { name: /ขนาดภายใน/ }).click());
  await j.decide("size", async () => {
    await page.getByRole("textbox", { name: "ยาว" }).fill("200");
    await page.getByRole("textbox", { name: "กว้าง" }).fill("150");
    await page.getByRole("textbox", { name: "สูง" }).fill("80");
  });
  await expect(dock(page).getByText(/^฿[\d,]+\.\d{2} \/ ชิ้น$/)).toBeVisible({ timeout: 15_000 });
  const dialog = page.getByRole("dialog", { name: "ขอตัวอย่างก่อนสั่งผลิต" });
  await j.screen(
    "sample request",
    () => dock(page).getByRole("button", { name: "ขอตัวอย่างก่อนสั่งผลิต" }).click(),
    () => expect(dialog).toBeVisible({ timeout: 15_000 }),
  );
  // A printed sample is the default; accepting it costs nothing (rule 4).
  const postcode = dialog.getByRole("textbox", { name: "รหัสไปรษณีย์ที่จะส่งตัวอย่าง" });
  // Filled from the default delivery address as the dialog opens (D-298).
  await expect(postcode)
    .not.toHaveValue("", { timeout: 5_000 })
    .catch(() => undefined);
  if ((await postcode.inputValue()) === "") {
    j.gap("the sample's postcode is asked: no postcode in the configuration and no default address");
    await j.decide("postcode", () => postcode.fill("10110"));
  }
  await j.screen(
    "sample requested",
    () => dialog.getByRole("button", { name: "ส่งคำขอ" }).click(),
    () => expect(page).toHaveURL(/\/account\/samples\/[0-9a-f-]+$/),
  );

  await j.done(() => expect(page.getByText("ทีมงานกำลังเสนอราคาค่าตัวอย่าง เราจะแจ้งเมื่อพร้อม")).toBeVisible());
});
