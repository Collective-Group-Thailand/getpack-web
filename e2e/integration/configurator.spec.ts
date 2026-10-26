import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { DEV_INSTANT_PRODUCT, runId, signInCustomer } from "./support";

/**
 * U2.F1's acceptance journey on the real getpack-api (contract v0.41.0): configure the dev seed's
 * corrugated carton on a chosen basis → ask the Structure Advisor (its flag switched on by
 * `prepare.ts`; the dev seed's rule set and F9001's board sheets) → take an alternative board →
 * set a target price → take one of the API's levers → add to the cart. Every figure on screen is
 * the API's; the assertions only check that they arrive and that the flow moves on.
 */

const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });
const step = (page: Page, label: string) =>
  page.getByRole("button", { name: new RegExp(`^ขั้นที่ \\d+ จาก \\d+ ${label}`) }).first();

test("configure → advisor → alternative → target lever → cart, on the real API", async ({ context, page }) => {
  test.slow();
  await signInCustomer(context, runId("configurator-v2"));
  await page.goto(`${HOSTS.customer}/configure/${DEV_INSTANT_PRODUCT}`);
  await page.locator("html[data-hydrated]").waitFor();

  // The standard size is the catalogue's inside size; every other basis comes from the API.
  await expect(page.getByRole("radio", { name: /เบอร์มาตรฐาน/ })).toBeChecked();
  await page.getByRole("radio", { name: "กำหนดเอง" }).click();
  await page.getByRole("radio", { name: /ขนาดภายนอก/ }).click();
  await page.getByRole("textbox", { name: "ยาว" }).fill("406");
  await page.getByRole("textbox", { name: "กว้าง" }).fill("306");
  await page.getByRole("textbox", { name: "สูง" }).fill("256");
  const derived = page.getByRole("region", { name: "ขนาดในแต่ละแบบ" });
  // The dev seed's boards carry no caliper, so the API knows only the entered basis: the screen
  // says so and asks for no price it cannot give, until the size is entered on the inside.
  await expect(derived.getByText(/ยังไม่ทราบความหนาของวัสดุนี้/)).toBeVisible();
  await expect(dock(page)).toContainText("ยังไม่ทราบความหนาของวัสดุนี้");
  await page.getByRole("radio", { name: /ขนาดภายใน/ }).click();
  await page.getByRole("textbox", { name: "ยาว" }).fill("400");
  await page.getByRole("textbox", { name: "กว้าง" }).fill("300");
  await page.getByRole("textbox", { name: "สูง" }).fill("250");

  // The goods and their journey.
  await step(page, "สินค้าและการขนส่ง").click();
  await page.getByLabel("น้ำหนักสินค้าต่อชิ้น").fill("500");
  await page.getByLabel("จำนวนสินค้าต่อกล่อง").fill("10");
  await page.getByLabel("ซ้อนกี่ชั้น").fill("4");

  // A quantity first: the advisor prices the boards at it.
  await step(page, "จำนวน").click();
  await page.getByLabel("เพิ่มจำนวน").fill("1000");
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  await expect(dock(page).getByText(/\/ ชิ้น$/)).toBeVisible({ timeout: 30_000 });

  // The advisor: a recommendation with its range and the indicative notice, then an alternative.
  await step(page, "วัสดุ").click();
  const advisor = page.getByRole("region", { name: "แนะนำลอนกระดาษ" });
  await advisor.getByRole("button", { name: "ดูคำแนะนำ" }).click();
  await expect(advisor.getByText(/ค่าประมาณ ไม่ใช่การรับประกัน/).first()).toBeVisible({ timeout: 30_000 });
  await expect(advisor.getByText(/นิวตัน/).first()).toBeVisible();
  const use = advisor.getByRole("button", { name: "ใช้ลอนนี้" });
  test.info().annotations.push({ type: "boards offered", description: String(await use.count()) });
  if ((await use.count()) > 0) {
    await use.first().click();
    const acknowledge = page.getByRole("alertdialog").getByRole("button", { name: "รับทราบและใช้ลอนนี้" });
    if (await acknowledge.isVisible().catch(() => false)) await acknowledge.click();
    await expect(advisor.getByText("ใช้ลอนนี้อยู่")).toBeVisible();
  }
  await expect(dock(page).getByText(/\/ ชิ้น$/)).toBeVisible({ timeout: 30_000 });

  // A target well below the price: the API's gap, then its levers, one taken.
  await step(page, "จำนวน").click();
  await page.getByLabel(/ราคาเป้าหมายต่อ/).fill("0.50");
  const target = page.getByRole("region", { name: /ราคาเป้าหมาย/ });
  await expect(target.getByText("สูงกว่าเป้าหมาย", { exact: true })).toBeVisible({ timeout: 30_000 });
  await target.getByRole("button", { name: "ดูวิธีลดราคา" }).click();
  const levers = target.getByRole("list", { name: "วิธีลดราคาที่คำนวณได้" });
  await expect(levers.or(target.getByText(/ไม่พบวิธีลดราคา|ไม่มีราคาทันที/))).toBeVisible({ timeout: 30_000 });
  test.info().annotations.push({ type: "levers", description: String(await levers.isVisible()) });
  if (await levers.isVisible()) {
    await levers.getByRole("button", { name: "ใช้ทางเลือกนี้" }).first().click();
    await expect(page.getByText(/สร้างใบเสนอราคา.*จากทางเลือกนี้แล้ว/)).toBeVisible({ timeout: 30_000 });
  }

  // The summary shows the style code the API published for the pattern.
  await step(page, "สรุปและบันทึก").click();
  await expect(page.getByText("รหัสแบบ").first()).toBeVisible();

  await expect(dock(page).getByText(/\/ ชิ้น$/)).toBeVisible({ timeout: 30_000 });
  await dock(page).getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await expect(page.getByText(/ลงตะกร้าแล้ว/)).toBeVisible({ timeout: 30_000 });
});
