import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { runId, signInCustomer, signInStaff } from "./support";

/**
 * The RFQ path on the real API (D-100): a customer asks for a rigid box (an RFQ-only type), CS
 * starts the review and sends a quote from the desk, and the customer accepts it into the cart.
 */

test("a customer asks, CS quotes on the desk, and the customer accepts into the cart", async ({ browser }) => {
  test.slow();
  const customerContext = await browser.newContext();
  await signInCustomer(customerContext, runId("rfq"));
  const customer = await customerContext.newPage();
  await customer.goto(`${HOSTS.customer}/rfq/rigid-box`);
  await customer.locator("html[data-hydrated]").waitFor();

  await customer.getByLabel(/^ยาว/).fill("200");
  await customer.getByLabel(/^กว้าง/).fill("150");
  await customer.getByLabel(/^สูง/).fill("60");
  await customer.getByRole("spinbutton", { name: "จำนวนที่ 1" }).fill("500");
  await customer.getByRole("button", { name: "เพิ่มจำนวน" }).click();
  await customer.getByRole("spinbutton", { name: "จำนวนที่ 2" }).fill("1000");
  await customer.getByLabel(/รหัสไปรษณีย์ปลายทาง/).fill("99999");
  await customer.getByLabel("หมายเหตุถึงทีมงาน").fill("กล่องใส่ขวดเซรั่ม (integration)");
  await customer.getByRole("button", { name: "ส่งคำขอใบเสนอราคา" }).click();

  await expect(customer.getByText(/ส่งคำขอ RFQ-\d{4}-\d+ แล้ว/)).toBeVisible({ timeout: 30_000 });
  const code = (await customer.locator("p.font-mono").first().textContent())!.trim();
  const rfqUrl = customer.url().split("?")[0]!;
  const rfqId = rfqUrl.split("/").at(-1)!;

  // The same request on CS's desk: start the review, compose and send a quote.
  const staff = await (await browser.newContext()).newPage();
  await signInStaff(staff, "cs");
  await staff.goto(`${HOSTS.admin}/rfq/${rfqId}?tab=quotes`);
  await staff.locator("html[data-hydrated]").waitFor();
  await expect(staff.getByRole("heading", { level: 1 })).toHaveText(code);
  await staff.getByRole("button", { name: "การดำเนินการอื่น" }).click();
  await staff.getByRole("menuitem", { name: "เริ่มพิจารณา" }).click();
  await expect(staff.getByText("กำลังพิจารณาคำขอ").first()).toBeVisible();
  await staff.getByRole("tabpanel").getByRole("button", { name: "จัดทำใบเสนอราคา" }).click();
  for (const input of await staff.getByLabel(/^ราคาขายต่อชิ้น/).all()) await input.fill("42.50");
  for (const input of await staff.getByLabel(/^ระยะเวลาผลิต/).all()) await input.fill("15");
  await staff.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
  await staff.getByRole("tabpanel").getByRole("button", { name: "ส่งฉบับที่ 1 ให้ลูกค้า" }).click();
  const send = staff.getByRole("alertdialog", { name: "ส่งใบเสนอราคาฉบับที่ 1" });
  await send.getByLabel(new RegExp(`พิมพ์ ${code}`)).fill(code);
  await send.getByRole("button", { name: "ส่งให้ลูกค้า" }).click();
  await expect(staff.getByRole("alertdialog")).toHaveCount(0);

  // Back on the storefront: accept 1,000 pieces, confirmed with the code and the amount.
  await customer.goto(rfqUrl);
  await expect(customer.getByRole("heading", { name: "ใบเสนอราคาฉบับที่ 1" })).toBeVisible();
  await customer.getByRole("button", { name: "ยอมรับราคานี้ (1,000 ชิ้น)" }).click();
  const confirm = customer.getByRole("alertdialog", { name: "ยืนยันการยอมรับใบเสนอราคา" });
  await expect(confirm).toContainText(code);
  await confirm.getByRole("button", { name: "ยืนยัน" }).click();
  await customer.goto(`${HOSTS.customer}/cart`);
  await expect(customer.getByText(/1,000/).first()).toBeVisible();
});
