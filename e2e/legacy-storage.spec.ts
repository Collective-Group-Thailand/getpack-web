import { expect, test } from "@playwright/test";

/**
 * A design saved before the getpack rebrand must still open (F0.1 acceptance, kept green
 * through the F0.2 migration onto src/ui). The legacy key is read once and copied across.
 */
test("opens a design saved under the pre-rebrand BoxStudio key", async ({ page }) => {
  const legacy = [
    {
      id: "legacy1",
      name: "กล่องเก่าจาก BoxStudio",
      spec: { style: "rsc", dims: { length: 150, width: 100, height: 80 }, paperId: "b-kraft" },
      content: { elements: [], pattern: { kind: "none", color: "#1f6f78", background: "#ffffff", size: 12 } },
      createdAt: 1_750_000_000_000,
      updatedAt: 1_750_000_000_000,
    },
  ];

  // Seed the old key before any app script runs.
  await page.addInitScript((value) => {
    window.localStorage.setItem("boxstudio.designs.v1", value);
  }, JSON.stringify(legacy));

  await page.goto("/account/designs");

  const card = page.getByRole("link", { name: "กล่องเก่าจาก BoxStudio" });
  await expect(card).toBeVisible();
  await card.click();

  // It opens in the editor with its saved box, not the setup dialog for a new design.
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "ชื่อแบบ" })).toHaveValue("กล่องเก่าจาก BoxStudio");
  await expect(page.getByRole("dialog", { name: "ตั้งค่ากล่อง" })).toBeHidden();

  // And it was adopted under the new key rather than only read from the old one.
  const adopted = await page.evaluate(() => window.localStorage.getItem("getpack.designs.v1"));
  expect(adopted).toContain("กล่องเก่าจาก BoxStudio");
});
