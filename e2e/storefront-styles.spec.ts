import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * U3.5, the style library (redesigned, docs/design/styles-redesign), against the mock API: browse by
 * category and facet, live search with a Thai synonym, the filter sheet on a phone, the quick view,
 * compare up to three, and pick a variant whose incompatible options say why.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).exclude("[data-sonner-toaster]").analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

const grid = (page: Page) => page.getByRole("list", { name: "แบบกล่อง" });

test.describe("the style library", () => {
  test.beforeEach(async ({ page }) => acceptCookies(page));

  test("browses by category and facet, finds a mailer by its Thai nickname as it is typed", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/styles`);
    await expect(page.getByRole("heading", { level: 1, name: "คลังแบบกล่องและบรรจุภัณฑ์" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /^\d+ แบบ$/ })).toBeVisible();
    await expect(grid(page).getByRole("listitem").first()).toBeVisible();
    // The grid is virtual and says where each card sits in the whole.
    await expect(grid(page).getByRole("listitem").first()).toHaveAttribute("aria-setsize", "24");

    // The category rail adds history; filters replace it.
    await page
      .getByRole("navigation", { name: "หมวดบรรจุภัณฑ์" })
      .getByRole("link", { name: /กล่องลูกฟูก/ })
      .click();
    await expect(page).toHaveURL(/cat=corrugated/);
    // One filter system: an option facet's values sit under their axis, the prefix said once.
    await page.getByRole("group", { name: "ช่องมือจับ" }).getByRole("checkbox", { name: "ด้านข้าง" }).click();
    await expect(page).toHaveURL(/feat=hand_holes:/);
    await expect(page.getByRole("link", { name: /^เอาตัวกรอง “ช่องมือจับ: ด้านข้าง” ออก$/ })).toBeVisible();
    await expect(grid(page).getByRole("listitem").first()).toBeVisible();

    // "/" focuses the search; results follow the words without a button.
    await gotoHydrated(page, `${HOSTS.customer}/styles`);
    await page.keyboard.press("/");
    await expect(page.getByRole("searchbox", { name: "ค้นหาแบบกล่อง" })).toBeFocused();
    await page.keyboard.type("หูช้าง");
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole("heading", { level: 2, name: /สำหรับ “หูช้าง”/ })).toBeVisible();
    await expect(
      grid(page).getByRole("link", { name: "Roll-end tuck-front mailer" }).or(grid(page).getByText("PK-CF-01")),
    ).toBeVisible();

    await expectNoViolations(page);
  });

  test("filters in a bottom sheet on a narrow screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHydrated(page, `${HOSTS.customer}/styles`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const open = page.getByRole("button", { name: "ตัวกรอง" });
    await open.click();
    const sheet = page.getByRole("dialog", { name: "ตัวกรอง" });
    await sheet.getByRole("switch", { name: /ราคาทันทีเท่านั้น/ }).click();
    await expect(page).toHaveURL(/price=instant/);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(open).toBeFocused();
    await expectNoViolations(page);
  });

  test("loads more by cursor", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/styles`);
    await page.getByRole("button", { name: "โหลดเพิ่ม" }).click();
    await expect(page.getByText(/^แสดง 48 จาก \d+ แบบ$/)).toBeVisible();
    await expect(grid(page).getByRole("listitem").first()).toHaveAttribute("aria-setsize", "48");
  });

  test("opens a card in the quick view, shareable by its URL", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/styles`);
    const first = grid(page).locator("a[data-style-code]").first();
    await first.click();
    await expect(page).toHaveURL(/style=PK-/);
    const panel = page.getByRole("dialog");
    await expect(panel.getByRole("heading", { name: "ตัวเลือกโครงสร้าง" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "เริ่มออกแบบแบบนี้" })).toBeVisible();
    await expectNoViolations(page);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page).not.toHaveURL(/style=/);
    await expect(first).toBeFocused();
  });

  test("compares up to three styles side by side", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/styles`);
    const boxes = grid(page).getByRole("checkbox", { name: /^เปรียบเทียบ: / });
    for (let i = 0; i < 3; i++) await boxes.nth(i).click();
    // The limit (D-246, staff's setting) refuses a fourth and says so.
    await boxes.nth(3).click();
    await expect(boxes.nth(3)).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("เปรียบเทียบได้สูงสุด 3 แบบ")).toBeVisible();
    const tray = page.getByRole("region", { name: "แบบที่เลือกเปรียบเทียบ" });
    await expect(tray.getByText("เลือกแล้ว 3/3")).toBeVisible();
    await tray.getByRole("link", { name: "เปรียบเทียบ" }).click();
    await expect(page).toHaveURL(/\/styles\/compare\?codes=/);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("columnheader")).toHaveCount(4);
    await expectNoViolations(page);
  });

  test("a style's page: variants with reasons, its 3D model, save it", async ({ page }) => {
    await signInAsCustomer(page, "/styles");
    await gotoHydrated(page, `${HOSTS.customer}/styles/pk-te-01`);
    // The code decides the page; the URL is corrected to carry the name in Thai.
    await expect(page).toHaveURL(/\/styles\/pk-te-01-/);
    await expect(page.getByRole("heading", { level: 1, name: "กล่องฝาเสียบ (ปรับฝาบน-ล่างได้)" })).toBeVisible();

    const hang = page.getByRole("group", { name: "รูแขวน" });
    // The default top is a straight tuck: a hang tab cannot stand on its back panel.
    await expect(hang.getByRole("radio", { name: "รูยูโร" })).toHaveAttribute("aria-disabled", "true");
    await expect(hang.getByText(/ไม่มีแบบนี้คู่กับ ฝาบน/).first()).toBeVisible();
    await page.getByRole("group", { name: "ฝาบน" }).getByRole("radio", { name: "ฝาเสียบสลับ" }).click();
    await hang.getByRole("radio", { name: "รูยูโร" }).click();
    await expect(hang.getByRole("radio", { name: "รูยูโร" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/รหัสแบบย่อย PK-TE-01-/)).toBeVisible();

    await page.getByRole("button", { name: "บันทึกแบบนี้ไว้" }).click();
    await expect(page.getByRole("button", { name: "เลิกบันทึก" })).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole("button", { name: "หมุนดูแบบ 3 มิติ" }).click();
    await expect(
      page.getByRole("img", { name: "แบบกล่อง 3 มิติ ลากเพื่อหมุน" }).or(page.locator("canvas")).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("an unknown style is a 404", async ({ page }) => {
    const response = await page.goto(`${HOSTS.customer}/styles/pk-zz-99`);
    expect(response?.status()).toBe(404);
  });
});
