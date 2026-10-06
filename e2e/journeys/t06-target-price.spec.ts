import type { Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { signInAsCustomer } from "../helpers/customer";
import { gotoHydrated } from "../helpers/session";
import { expect, test } from "./fixture";

const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });
const step = (page: Page, label: string) =>
  page.getByRole("button", { name: new RegExp(`^ขั้นที่ \\d+ จาก \\d+ ${label}`) }).first();

/**
 * T6 "งบของคุณคือ 8 บาท/ใบ — ทำให้ได้ราคาใกล้เคียงที่สุด" — judged by whether a lever is found unaided
 * (`step-counting.md`): the walk finishes only when a lever the API computed (D-248) has been taken,
 * so a completed walk is "found"; its steps are reported, not budgeted. Levers belong to a saved
 * quotation, so the person is signed in (task card: configurator for the T1 box at 500 pcs).
 */
test("T6 get as close as possible to 8 ฿ a piece", async ({ page, journey }) => {
  const j = journey("T6");
  await signInAsCustomer(page, "/");
  // The task card's start: the T1 box at 500 pcs, priced above 8 ฿ — reached the T1 way, not counted.
  await gotoHydrated(page, HOSTS.customer);
  const quick = page.getByRole("form", { name: "ดูราคาเร็ว" });
  await quick.getByRole("combobox", { name: "ประเภท" }).selectOption({ label: "กล่องไปรษณีย์" });
  await quick.getByRole("textbox", { name: "ยาว" }).fill("20");
  await quick.getByRole("textbox", { name: "กว้าง" }).fill("15");
  await quick.getByRole("textbox", { name: "สูง" }).fill("8");
  await quick.getByRole("textbox", { name: "จำนวน (ชิ้น)" }).fill("500");
  await quick.getByRole("button", { name: "ดูราคา" }).click();
  await expect(dock(page).getByText(/^฿[\d,]+\.\d{2} \/ ชิ้น$/)).toBeVisible({ timeout: 15_000 });
  await j.startHere();

  const target = page.getByRole("region", { name: /ราคาเป้าหมาย/ });
  await j.screen(
    "quantity step",
    () => step(page, "จำนวน").click(),
    () => expect(page.getByLabel(/ราคาเป้าหมายต่อ/)).toBeVisible(),
  );
  await j.decide("target 8 ฿", () => page.getByLabel(/ราคาเป้าหมายต่อ/).fill("8"));
  await expect(target.getByText("สูงกว่าเป้าหมาย", { exact: true })).toBeVisible({ timeout: 15_000 });
  await j.decide("ways to lower the price", () => target.getByRole("button", { name: "ดูวิธีลดราคา" }).click());
  const levers = target.getByRole("list", { name: "วิธีลดราคาที่คำนวณได้" });
  await expect(levers.getByRole("listitem").first()).toBeVisible({ timeout: 15_000 });
  await j.decide("take a lever", () => levers.getByRole("button", { name: "ใช้ทางเลือกนี้" }).first().click());

  await j.done(() => expect(page.getByText(/จากทางเลือกนี้แล้ว/)).toBeVisible({ timeout: 15_000 }));
});
