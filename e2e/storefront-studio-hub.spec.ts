import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated } from "./helpers/session";

/**
 * C7 (studio redesign Phase 1): `/studio` is the one front door — the old `/studio/new` hub redirects here, the mini
 * editor carries the brand name, size and print into the editor, the finder is inline, the header CTA does not link
 * to the page itself. Against the mock API. Written, not run in the cloud (owner rule 2026-10-28).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("old links land on /studio with the right section", async ({ page }) => {
  await page.goto(`${HOSTS.customer}/studio/new`);
  await expect(page).toHaveURL(/\/studio$/);
  await page.goto(`${HOSTS.customer}/studio/new?start=product&step=start`);
  await expect(page).toHaveURL(/\/studio\?start=product$/);
  await expect(page.locator("#finder")).toBeInViewport();
  // An editor entry stays in the editor.
  await page.goto(`${HOSTS.customer}/studio/new?step=box`);
  await expect(page).toHaveURL(/\/studio\/new\?step=box/);
});

test("the header CTA on /studio is 'สินค้าและราคา'", async ({ page }) => {
  await gotoHydrated(page, `${HOSTS.customer}/studio`);
  const header = page.locator("header").first();
  await expect(header.getByRole("link", { name: "เริ่มออกแบบฟรี" })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "สินค้าและราคา" }).last()).toHaveAttribute("href", /\/products$/);
});

test("mini editor: keyboard, price, and the brand name carried into the editor", async ({ page }) => {
  await gotoHydrated(page, `${HOSTS.customer}/studio`);
  const editor = page.getByRole("group", { name: "สตูดิโอจำลอง ลองใช้ได้" });
  await editor.getByLabel("หรือพิมพ์ชื่อแบรนด์").fill("Somchai Coffee");
  await expect(editor.getByRole("img")).toHaveAccessibleName(/Somchai Coffee/);
  const sizes = editor.getByRole("group", { name: "ขนาด (ซม.)" }).getByRole("button");
  await sizes.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(sizes.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(editor.getByText(/฿[\d,.]+/)).toBeVisible();
  await editor.getByRole("link", { name: "เปิดในสตูดิโอ" }).click();
  await expect(page).toHaveURL(/\/studio\/(new|[0-9a-f-]{36})\?.*style=/);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
});

test("inline finder suggests boxes with reasons and opens the editor on the size", async ({ page }) => {
  await gotoHydrated(page, `${HOSTS.customer}/studio#finder`);
  const finder = page.locator("#finder");
  await finder.getByLabel("ยาว").fill("250");
  await finder.getByLabel("กว้าง").fill("180");
  await finder.getByLabel("สูง").fill("80");
  await expect(finder.getByRole("listitem")).toHaveCount(3);
  await finder.getByRole("button", { name: "ซม." }).click();
  await expect(finder.getByLabel("ยาว")).toHaveValue("25");
  await finder.getByRole("link", { name: "ออกแบบแบบนี้" }).first().click();
  await expect(page).toHaveURL(/\/studio\/new\?.*style=.*l=\d+.*step=design/);
});

test("the file path's drop zone starts the upload flow", async ({ page }) => {
  await gotoHydrated(page, `${HOSTS.customer}/studio`);
  await page.locator('#paths input[type="file"]').setInputFiles({
    name: "logo-final.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });
  await expect(page).toHaveURL(/\/studio\/upload\?file=logo-final\.pdf/);
  await expect(page.getByRole("status")).toContainText("logo-final.pdf");
});

test("/studio has no axe violations and no horizontal scroll at 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoHydrated(page, `${HOSTS.customer}/studio`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
