import type { Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { acceptCookies } from "../helpers/customer";
import { expect, test } from "./fixture";

const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });

/** T1 "หากล่องไปรษณีย์ … 20×15×8 ซม. หนัก 500 กรัม แล้วดูว่า 500 ใบราคาเท่าไร" — home to a real price. */
test("T1 find a mailer box and its price for 500 pcs", async ({ page, journey }) => {
  const j = journey("T1");
  await acceptCookies(page);
  await j.start(HOSTS.customer);
  j.expectEvents("configurator_opened", "quote_shown");

  // U-F3: the home page's quick start — type, approximate inside size and quantity, priced in one go.
  const quick = page.getByRole("form", { name: "ดูราคาเร็ว" });
  await j.decide("type", () =>
    quick.getByRole("combobox", { name: "ประเภท" }).selectOption({ label: "กล่องไปรษณีย์" }),
  );
  await j.decide("size", async () => {
    await quick.getByRole("textbox", { name: "ยาว" }).fill("20");
    await quick.getByRole("textbox", { name: "กว้าง" }).fill("15");
    await quick.getByRole("textbox", { name: "สูง" }).fill("8");
  });
  await j.decide("quantity", () => quick.getByRole("textbox", { name: "จำนวน (ชิ้น)" }).fill("500"));
  await j.screen(
    "configurator",
    () => quick.getByRole("button", { name: "ดูราคา" }).click(),
    () => expect(dock(page)).toBeVisible(),
  );
  j.gap("no product-weight input: the 500 g in the task has nowhere to go (Structure Advisor, U2.2 / U2.F1)");

  await j.done(async () => {
    await expect(dock(page)).toContainText("500 ชิ้น");
    await expect(dock(page).getByText(/^฿[\d,]+\.\d{2} \/ ชิ้น$/)).toBeVisible();
  });
});
