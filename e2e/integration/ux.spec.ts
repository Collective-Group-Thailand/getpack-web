import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { runId, signInCustomer, signInStaff } from "./support";

/**
 * U5.1, U5.3, U5.4 on the real packio-api (`v0.41.0`, U5.B1–B3): a new customer's launchpad, a
 * support message that reaches the CS inbox and is answered there, an RFQ basket of two items sent
 * as one submission, and a notification link that is not the customer's.
 */

test("launchpad, messaging and the RFQ basket, on the real API", async ({ browser }) => {
  test.slow();
  const customerContext = await browser.newContext();
  await signInCustomer(customerContext, runId("u5"));
  const customer = await customerContext.newPage();

  // A customer with no history is told to start a configuration (D-297's last step).
  await customer.goto(`${HOSTS.customer}/account`);
  await expect(customer.getByText("ขั้นต่อไปที่แนะนำ")).toBeVisible({ timeout: 30_000 });
  await expect(customer.getByRole("heading", { name: "เริ่มกล่องแรกของคุณ" })).toBeVisible();

  // A link that is not this customer's: not found, with a way on (D-299).
  // Well-formed (`s` + 32), but issued to nobody.
  await customer.goto(`${HOSTS.customer}/l/s${"0".repeat(32)}`);
  await expect(customer.getByText("เปิดลิงก์นี้จากบัญชีนี้ไม่ได้").last()).toBeVisible({ timeout: 30_000 });

  // A support message (D-300) — answered from the inbox.
  await customer.goto(`${HOSTS.customer}/account/messages`);
  await customer.locator("html[data-hydrated]").waitFor();
  const text = `ขอคำแนะนำเรื่องกล่อง (integration ${Date.now()})`;
  await customer.getByRole("textbox", { name: "พิมพ์ข้อความ" }).fill(text);
  await customer.getByRole("button", { name: "ส่ง", exact: true }).click();
  await expect(customer).toHaveURL(/\/account\/messages\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(customer.getByText(text)).toBeVisible({ timeout: 30_000 });
  const threadId = customer.url().split("/").at(-1)!;

  const staff = await (await browser.newContext()).newPage();
  await signInStaff(staff, "cs");
  await staff.goto(`${HOSTS.admin}/inbox/${threadId}`);
  await staff.locator("html[data-hydrated]").waitFor();
  await expect(staff.getByText(text)).toBeVisible({ timeout: 30_000 });
  const reply = `ตอบแล้ว (integration ${Date.now()})`;
  await staff.getByRole("textbox", { name: "ตอบลูกค้า" }).fill(reply);
  await staff.getByRole("button", { name: "ส่งคำตอบ" }).click();
  await expect(staff.getByText(reply)).toBeVisible({ timeout: 30_000 });

  await customer.reload();
  await expect(customer.getByText(reply)).toBeVisible({ timeout: 30_000 });

  // An RFQ basket of two items, one submission (D-301).
  for (const [l, w, h] of [
    [200, 150, 60],
    [120, 80, 40],
  ] as const) {
    await customer.goto(`${HOSTS.customer}/rfq/rigid-box`);
    await customer.locator("html[data-hydrated]").waitFor();
    await customer.getByLabel(/^ยาว/).fill(String(l));
    await customer.getByLabel(/^กว้าง/).fill(String(w));
    await customer.getByLabel(/^สูง/).fill(String(h));
    await customer.getByRole("button", { name: "เพิ่มลงตะกร้าคำขอ" }).click();
    await expect(customer).toHaveURL(/\/rfq\/basket\?added=1$/, { timeout: 30_000 });
  }
  await expect(customer.getByText("รายการในตะกร้า (2)")).toBeVisible();
  await customer.getByLabel(/รหัสไปรษณีย์ปลายทาง/).fill("10110");
  await customer.getByRole("button", { name: "ส่งคำขอ 2 รายการ" }).click();
  await expect(customer).toHaveURL(/\/account\/rfq-baskets\/[0-9a-f-]+\?submitted=1$/, { timeout: 30_000 });
  await expect(customer.getByRole("link", { name: /RFQ-\d{4}-\d+/ })).toHaveCount(2);
});
