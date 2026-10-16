import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { DEV_INSTANT_PRODUCT, runId, signInCustomer, signInStaff } from "./support";

/**
 * U2.F3 on the real getpack-api (`v0.41.0`): a customer asks for a sample from a saved quotation
 * (`store.samples.request`) and sees it waiting for a quote; CS (lead) finds it in the sample queue
 * (`admin.samples.list`) and quotes it when the dev seed has a service item.
 */
test("a sample asked for from a saved quotation reaches the CS queue, on the real API", async ({
  context,
  page,
  browser,
}) => {
  test.slow();
  await signInCustomer(context, runId("sample"));
  await page.goto(`${HOSTS.customer}/configure/${DEV_INSTANT_PRODUCT}`);
  await page.locator("html[data-hydrated]").waitFor();
  await page
    .getByRole("button", { name: /^ขั้นที่ \d+ จาก \d+ จำนวน/ })
    .first()
    .click();
  await page.getByLabel("เพิ่มจำนวน").fill("1000");
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  const dock = page.getByRole("complementary", { name: "ราคาของคุณ" });
  await expect(dock.getByText(/\/ ชิ้น$/)).toBeVisible({ timeout: 30_000 });
  await dock.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText(/บันทึกใบเสนอราคาแล้ว/)).toBeVisible({ timeout: 30_000 });

  await page.goto(`${HOSTS.customer}/account/quotes`);
  await page.locator("html[data-hydrated]").waitFor();
  await page
    .getByRole("button", { name: /^ขอตัวอย่างก่อนสั่งผลิต/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "ขอตัวอย่างก่อนสั่งผลิต" });
  const note = `integration ${runId("note")}`;
  await dialog.getByRole("textbox", { name: "รหัสไปรษณีย์ที่จะส่งตัวอย่าง" }).fill("10110");
  await dialog.getByRole("textbox", { name: "ถึงทีมงาน (ถ้ามี)" }).fill(note);
  await dialog.getByRole("button", { name: "ส่งคำขอ" }).click();
  await expect(page).toHaveURL(/\/account\/samples\/[0-9a-f-]+$/, { timeout: 30_000 });
  const sampleId = /\/account\/samples\/([0-9a-f-]+)$/.exec(page.url())![1]!;
  await expect(page.getByText("ทีมงานกำลังเสนอราคาค่าตัวอย่าง เราจะแจ้งเมื่อพร้อม")).toBeVisible();

  const staff = await browser.newContext();
  const admin = await staff.newPage();
  await signInStaff(admin, "cs_lead");
  await admin.goto(`${HOSTS.admin}/samples/${sampleId}`);
  await admin.locator("html[data-hydrated]").waitFor();
  await expect(admin.getByText(note)).toBeVisible({ timeout: 30_000 });
  await admin.getByRole("button", { name: "เสนอราคาตัวอย่าง" }).click();
  const quote = admin.getByRole("dialog", { name: "เสนอราคาตัวอย่าง" });
  await quote.getByRole("combobox", { name: "บริการ" }).click();
  const options = admin.getByRole("option");
  // The service items load when the dialog opens.
  await options
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => undefined);
  test.skip((await options.count()) === 0, "the dev seed has no service items to quote a sample with");
  await options.first().click();
  await quote.getByRole("textbox", { name: "ราคาขายรวม VAT (บาท)" }).fill("450");
  await quote.getByRole("textbox", { name: "ทำเสร็จใน (วัน)" }).fill("5");
  await quote.getByRole("textbox", { name: "น้ำหนักพัสดุ (กรัม)" }).fill("300");
  const answer = admin.waitForResponse((r) => r.url().includes(`/samples/${sampleId}/actions/quote`));
  await quote.getByRole("button", { name: "เสนอราคาตัวอย่าง" }).click();
  const response = await answer;
  const body = await response.json();
  console.log("sample quote:", response.status(), body.code ?? body.status);
  if (response.ok()) await expect(admin.getByText("เสนอราคาแล้ว", { exact: true }).first()).toBeVisible();
  else expect(["samples.freight_unavailable", "pricing.vat_rate_missing"], JSON.stringify(body)).toContain(body.code);
  await staff.close();
});
