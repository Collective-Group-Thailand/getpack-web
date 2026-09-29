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

  const menu = page.getByRole("button", { name: "สินค้าและบรรจุภัณฑ์" });
  await j.screen(
    "products menu",
    () => menu.click(),
    () => expect(menu).toHaveAttribute("aria-expanded", "true"),
  );
  await j.screen(
    "category",
    () => page.getByRole("banner").getByRole("link", { name: "กล่องกระดาษลูกฟูก" }).click(),
    () => expect(page.getByRole("heading", { level: 1, name: "กล่องกระดาษลูกฟูก" })).toBeVisible(),
  );
  await j.screen(
    "mailer box",
    () => page.getByRole("main").getByRole("link", { name: "กล่องไปรษณีย์" }).first().click(),
    () => expect(page.getByRole("heading", { level: 1, name: "กล่องไปรษณีย์" })).toBeVisible(),
  );
  await j.screen(
    "configurator",
    () => page.getByRole("link", { name: "ปรับแต่งและดูราคา" }).click(),
    () => expect(dock(page)).toBeVisible(),
  );

  await j.decide("unit (the task is in cm, the configurator starts in mm)", () =>
    page.getByRole("radio", { name: "ซม." }).click(),
  );
  await j.decide("size", async () => {
    await page.getByRole("textbox", { name: "ยาว" }).fill("20");
    await page.getByRole("textbox", { name: "กว้าง" }).fill("15");
    await page.getByRole("textbox", { name: "สูง" }).fill("8");
  });
  j.gap("no product-weight input: the 500 g in the task has nowhere to go (Structure Advisor, U2.2 / U2.F1)");
  j.gap("no start from the product's size on the home page (quick-start strip, U-F3 / U5.1)");

  await j.decide("quantity", () =>
    dock(page).getByRole("table", { name: "ราคาต่อจำนวน" }).getByRole("button", { name: "เลือก 500 ชิ้น" }).click(),
  );

  await j.done(async () => {
    await expect(dock(page)).toContainText("500 ชิ้น");
    await expect(dock(page).getByText(/^฿[\d,]+\.\d{2} \/ ชิ้น$/)).toBeVisible();
  });
});
