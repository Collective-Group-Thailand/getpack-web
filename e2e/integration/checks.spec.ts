import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { DEV_INSTANT_PRODUCT, runId, signInCustomer } from "./support";

/**
 * U4.5 parity on the real getpack-api (`v0.41.0`): a studio design whose document breaks the rules
 * getpack-api evaluates on the document — an EAN-13 whose check digit is wrong, beside a good one — is checked by `store.studio.runChecks`, and the studio shows the same rule ids for the
 * same elements. (The dev seed leaves the text and spot-colour rules off, D-278.)
 */
test("the studio and getpack-api find the same document rules for the same version", async ({ context, page }) => {
  test.slow();
  await signInCustomer(context, runId("checks"));
  const query = new URLSearchParams({ product: DEV_INSTANT_PRODUCT, style: "rsc", l: "400", w: "300", h: "250" });
  await page.goto(`${HOSTS.customer}/studio/new?${query.toString()}`);
  await page.locator("html[data-hydrated]").waitFor();
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?/, { timeout: 30_000 });
  const id = /\/studio\/([0-9a-f-]{36})/.exec(page.url())![1]!;

  // Two EAN-13s through the elements panel; the second's value then mistyped in its properties.
  const rail = page.getByRole("navigation", { name: "เครื่องมือออกแบบ" });
  for (const value of ["590123412345", "590123412345"]) {
    const tool = rail.getByRole("button", { name: "องค์ประกอบ", exact: true });
    if ((await tool.getAttribute("aria-pressed")) !== "true") await tool.click();
    await page.getByRole("combobox", { name: "ชนิดโค้ด" }).click();
    await page.getByRole("option", { name: "EAN-13" }).click();
    await page.getByRole("textbox", { name: "ตัวเลขหรือข้อความของบาร์โค้ด" }).fill(value);
    await expect(page.getByText(/กว้างอย่างน้อย/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "เพิ่มโค้ด" }).click();
  }
  await page.getByRole("textbox", { name: "ตัวเลข 13 หลัก" }).fill("5901234123458");
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 30_000 });

  // Entering ④ runs getpack-api's checks on the saved version; the run the studio got is the server's answer.
  const response = page.waitForResponse((r) => r.url().endsWith(`/studio/${id}/checks`) && r.request().method() === "POST");
  await page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" }).getByRole("button", { name: /ตรวจงาน/ }).click();
  await expect(page.getByRole("button", { name: /บาร์โค้ดใช้ไม่ได้/ })).toHaveCount(1, { timeout: 30_000 });
  const run = await (await response).json();
  expect(run.findings, JSON.stringify(run)).toBeDefined();
  const server = (run.findings as { ruleId: string; elementId: string | null }[])
    .filter((f) => f.ruleId === "barcode_invalid")
    .map((f) => f.ruleId);
  expect(server).toEqual(["barcode_invalid"]);
});
