import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";

/**
 * U3.5 on the real getpack-api (`v0.41.0`): the library reads `store.styles.list` and a style's page
 * `store.styles.get`. The dev seed publishes no style yet — publishing waits for approved recipes,
 * names and a partner able to make them (D-243) — so the library answers with its empty state and
 * an unknown code is a 404; the shapes are the published DTOs either way.
 */

test("the style library reads the real API", async ({ page }) => {
  await page.goto(`${HOSTS.customer}/styles`);
  await page.locator("html[data-hydrated]").waitFor();
  await expect(page.getByRole("heading", { level: 1, name: "คลังแบบกล่องและบรรจุภัณฑ์" })).toBeVisible();
  await expect(
    page.getByText("ไม่พบแบบกล่องที่ตรงกับเงื่อนไข").or(page.getByRole("list", { name: "แบบกล่อง" })),
  ).toBeVisible();

  const response = await page.goto(`${HOSTS.customer}/styles/pk-zz-99`);
  expect(response?.status()).toBe(404);
});
