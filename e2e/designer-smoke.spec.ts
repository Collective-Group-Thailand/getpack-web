import { expect, test, type Page } from "@playwright/test";

/**
 * Smoke test for the one flow this app can do today:
 * home -> new design -> set the box up -> add text -> save -> My designs -> reopen -> export the dieline SVG.
 *
 * It is deliberately written against what the user sees (roles and Thai labels), so it keeps
 * working while F0.1 moves the code into @packio/dieline, src/features/designer and the
 * locale-scoped routes.
 */

const HOME = "/";
const MY_DESIGNS = "/account/designs";

async function startNewDesign(page: Page) {
  await page.goto(HOME);
  await page.getByRole("link", { name: "เริ่มออกแบบ" }).first().click();
  await expect(page).toHaveURL(/\/design\/new$/);

  // The setup dialog opens by itself for a new design.
  const dialog = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(dialog).toBeHidden();

  // Konva mounts client-side only.
  await expect(page.locator("canvas").first()).toBeVisible();
}

// Each test gets a fresh browser context, so localStorage starts empty; do not clear it
// on every navigation or the design saved mid-test disappears before "My designs" loads.
test("designs a box, saves it, finds it again and exports the dieline", async ({ page }) => {
  await startNewDesign(page);

  await page.getByRole("textbox", { name: "ชื่อแบบ" }).fill("กล่องทดสอบ E2E");
  await page.getByRole("button", { name: "ข้อความ" }).click();

  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
  // Saving a brand-new design swaps /design/new for its real id.
  await expect(page).not.toHaveURL(/\/design\/new$/);

  await page.goto(MY_DESIGNS);
  const card = page.getByRole("link", { name: "กล่องทดสอบ E2E" }).last();
  await expect(card).toBeVisible();
  await card.click();

  await expect(page.locator("canvas").first()).toBeVisible();

  // Export is a real ARIA menu since F0.2, not a div of buttons: the items are menuitems.
  await page.getByRole("button", { name: "ส่งออก" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /SVG ไดคัท/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.svg$/);
});

test("keeps the dieline in step with the box dimensions chosen in setup", async ({ page }) => {
  await startNewDesign(page);

  // Default style is RSC with its first preset, 150 x 100 x 80 mm inside, on E-flute (t = 1.6).
  await expect(page.getByText("ภายใน 150×100×80 มม.")).toBeVisible();
  // Engine v2 scores from the inside size: glue 35 + (L+t) + (W+t) + (L+t) + W = 539.8 wide;
  // flaps (W+t)/2 + t/2 twice + H + 2t = 186.4 tall.
  await expect(page.getByText("แผ่นคลี่ 540 × 186 มม.")).toBeVisible();
});

test("keeps the old BoxStudio path working", async ({ page }) => {
  await page.goto("/my/designs");
  await expect(page).toHaveURL(/\/account\/designs$/);
  await expect(page.getByRole("heading", { name: "แบบของฉัน" })).toBeVisible();
});

test("serves the English locale under /en and Thai without a prefix", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
});
