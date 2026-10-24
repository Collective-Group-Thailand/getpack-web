import { expect, type Page } from "@playwright/test";

import type { Journey } from "./fixture";

/** Opens a new guest design with the setup's defaults — the task cards' "a design open in the studio". */
export async function openNewDesign(page: Page): Promise<void> {
  await page.goto("/studio/new");
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /เลือกแบบกล่องแล้วออกแบบ/ }).click();
  const dialog = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await dialog.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
  // The first save gives the design its own address; settle there before the walk starts, so no
  // decision of the walk is charged with that move.
  await expect(page).not.toHaveURL(/\/studio\/new/, { timeout: 15_000 });
  // A person at the page has moved the pointer: the split view's model loads with that (ADR-0010).
  await page.mouse.move(1, 1);
}

export const rail = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "เครื่องมือออกแบบ" }).getByRole("button", { name, exact: true });

/**
 * Opens a left-rail tool as a step — unless it is already open, which costs the person nothing
 * (step-counting rule 4). The Box tool is open when a new design starts.
 */
export async function tool(j: Journey, page: Page, name: string): Promise<void> {
  const button = rail(page, name);
  if ((await button.getAttribute("aria-pressed")) === "true") return;
  await j.decide(`open ${name}`, () => button.click());
}
