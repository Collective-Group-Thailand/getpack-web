import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { runId, signInCustomer } from "./support";

/**
 * U5.5 on the real packio-api (`v0.41.0`): the assistant is off at launch (D-218), so the panel —
 * built into this test build — learns it from a refused session and offers the team instead.
 */
test("the assistant, switched off by packio-api, sends the customer to the team", async ({ context, page }) => {
  test.slow();
  await signInCustomer(context, runId("assistant"));
  await page.goto(`${HOSTS.customer}/products`);
  await page.locator("html[data-hydrated]").waitFor();
  await page.getByRole("button", { name: "ถามผู้ช่วย AI" }).click();
  const panel = page.getByRole("dialog", { name: "ผู้ช่วย Packio" });
  await expect(panel.getByText("ผู้ช่วยนี้เป็น AI")).toBeVisible();
  await panel.getByRole("textbox", { name: "ถามผู้ช่วย" }).fill("กล่องไปรษณีย์ราคาเท่าไหร่");
  await panel.getByRole("button", { name: "ถาม", exact: true }).click();
  await expect(panel.getByText(/ผู้ช่วย AI ยังไม่เปิดให้ใช้/)).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByRole("link", { name: "คุยกับทีม" })).toBeVisible();
});
