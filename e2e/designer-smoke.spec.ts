import { expect, test, type Page } from "@playwright/test";

import { addHeading } from "./helpers/designer";

/**
 * Smoke test for the one flow this app can do today:
 * home -> new design -> set the box up -> add text -> save -> My designs -> reopen -> export the dieline SVG.
 *
 * It is deliberately written against what the user sees (roles and Thai labels), so it keeps
 * working while F0.1 moves the code into @getpack/dieline, src/features/designer and the
 * locale-scoped routes.
 */

const HOME = "/";
const MY_DESIGNS = "/account/designs";

async function startNewDesign(page: Page, product?: string) {
  // An old /design link lands in the studio (U4.2).
  if (product) await page.goto(`/design/new?product=${product}`);
  else {
    // The header's "เริ่มออกแบบฟรี" opens the studio's front door (Phase 4); a blank design starts at /studio/new.
    await page.goto(HOME);
    await page.getByRole("link", { name: "เริ่มออกแบบ" }).first().click();
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/studio/new?step=box");
  }
  await expect(page).toHaveURL(/\/studio\/new(\?|$)/);
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });

  // ① offers the box setup.
  await page.getByRole("button", { name: /เลือกแบบกล่องแล้วออกแบบ/ }).click();
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
  await addHeading(page);

  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
  // Saving a brand-new design swaps /studio/new for its real id.
  await expect(page).not.toHaveURL(/\/studio\/new(\?|$)/);

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
  // The catalogue is a product's (`store.designer.getCatalog` takes `product`): a blank design has
  // none and draws on the engine's own board (CONTRACT-GAP store.catalog-product-ref).
  await startNewDesign(page, "shipping-box");

  // Default style is RSC with its first preset, 150 x 100 x 80 mm inside, on the catalogue's
  // thinnest board for it: E-flute (t = 1.6, make-up allowances col_a 1.14, col_c 1.18).
  await expect(page.getByText("ภายใน 150×100×80 มม.").first()).toBeVisible();
  // Engine v2 scores from the inside size: glue 35 + (L+a) + (W+a) + (L+a) + (W+a−t) = 538 wide;
  // flaps (W+a)/2 + c twice + H + 2t = 187 tall.
  await expect(page.getByText("แผ่นคลี่ 538 × 187 มม.").first()).toBeVisible();
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
