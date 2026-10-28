import { expect, type Page } from "@playwright/test";

/** Adds a heading through the left rail's Text tool (F4 Part D), and waits for it to be selected. */
export async function addHeading(page: Page): Promise<void> {
  const rail = page
    .getByRole("navigation", { name: "เครื่องมือออกแบบ" })
    .getByRole("button", { name: "ข้อความ", exact: true });
  if ((await rail.getAttribute("aria-pressed")) !== "true") await rail.click();
  // C8: the selection shows in the inspector's "ออกแบบ" tab (the pro inspector in e2e's default mode).
  const design = page.getByRole("tab", { name: "ออกแบบ", exact: true });
  if ((await design.getAttribute("aria-selected")) !== "true") await design.click();
  await page.getByRole("button", { name: "เพิ่มหัวข้อ", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "ออกแบบ" }).getByRole("heading", { name: "ข้อความ", exact: true }),
  ).toBeVisible();
}

/** Opens a tool on the left rail. */
export async function openRail(page: Page, name: string): Promise<void> {
  const button = page.getByRole("navigation", { name: "เครื่องมือออกแบบ" }).getByRole("button", { name, exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
}
