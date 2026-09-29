import type { Page } from "@playwright/test";

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
    () => expect(page.getByText(INVOICED.code).first()).toBeVisible(),
  );
  // A signed link is asked for, then opened by a second click (api-conventions §3).
  await j.decide("ask for the tax invoice's link", () =>
    page.getByRole("button", { name: /^ขอลิงก์ดาวน์โหลด TR-/ }).click(),
  );
  const open = page.getByRole("link", { name: /^เปิดเอกสาร TR-/ });
  let invoice: Page | null = null;
  await j.screen(
    "tax invoice",
    async () => {
      [invoice] = await Promise.all([page.waitForEvent("popup"), open.click()]);
    },
    () => expect.poll(() => invoice?.url() ?? "").toMatch(/^(data|https?):/),
  );

  await j.done(() => expect(page.getByText("ใบกำกับภาษี/ใบเสร็จรับเงิน").first()).toBeVisible());
});
