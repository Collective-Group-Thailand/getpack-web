import { expect, type Page } from "@playwright/test";

/** Adds a heading through the left rail's Text tool (F4 Part D), and waits for it to be selected. */
export async function addHeading(page: Page): Promise<void> {
  const rail = page
    .getByRole("navigation", { name: "เครื่องมือออกแบบ" })
    .getByRole("button", { name: "ข้อความ", exact: true });
  if ((await rail.getAttribute("aria-pressed")) !== "true") await rail.click();
  // C8: the selection shows in the inspector's "ออกแบบ" tab (the pro inspector in e2e's default mode). An edit
  // link's editor keeps the earlier layout: the "รายละเอียด" side panel and its "คุณสมบัติ" tab.
  const inspector = page.getByRole("complementary", { name: /^(คุณสมบัติ|รายละเอียด)$/ });
  await expect(inspector).toBeVisible();
  const tab = inspector.getByRole("tab", { name: /^(ออกแบบ|คุณสมบัติ)$/ });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await page.getByRole("button", { name: "เพิ่มหัวข้อ", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "ข้อความ", exact: true })).toBeVisible();
}

/** Opens a tool on the left rail. */
export async function openRail(page: Page, name: string): Promise<void> {
  const button = page.getByRole("navigation", { name: "เครื่องมือออกแบบ" }).getByRole("button", { name, exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
}

/**
 * Saves now. The C8 editor saves on its own and has no save button; ⌘/Ctrl+S saves at once — from the page, since
 * the shortcut leaves a field that is being typed in alone. Waits for the top bar's "บันทึกอัตโนมัติ <time>".
 */
export async function saveDesign(page: Page): Promise<void> {
  await page.locator("body").press("ControlOrMeta+s");
  await expect(page.getByRole("status").filter({ hasText: /^บันทึกอัตโนมัติ/ })).toBeVisible({ timeout: 15_000 });
}

/** The view bar (C8): "แผ่นคลี่", "แผ่นคลี่ + 3D" or "3D". */
export const viewButton = (page: Page, name: "แผ่นคลี่" | "แผ่นคลี่ + 3D" | "3D") =>
  page.getByRole("toolbar", { name: "มุมมอง" }).getByRole("button", { name, exact: true });

/**
 * Focuses a face (C8): faces are picked on the 3D view — the split view's 3D is a small card without the picker — and
 * the sheet then shows "กำลังแก้: <face>". Comes back to the split view unless `stay` keeps the 3D view.
 */
export async function pickFace(page: Page, name: string | RegExp, { stay = false } = {}): Promise<void> {
  await viewButton(page, "3D").click();
  const faces = page.getByRole("group", { name: "เลือกด้านที่จะออกแบบ" });
  await faces
    .getByRole("button", { name, exact: typeof name === "string" })
    .first()
    .click();
  if (!stay) await viewButton(page, "แผ่นคลี่ + 3D").click();
}
