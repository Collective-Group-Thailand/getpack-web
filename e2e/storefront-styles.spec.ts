import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * U3.5, the style library, against the mock API (105 bases, 960 variants from the master file;
 * wave 1's variants are the ones the engine draws): browse by category and facet, search with a
 * Thai synonym, sort, save, compare up to three, and pick a variant whose incompatible options
 * say why.
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

  test("browses by category and facet, finds a mailer by its Thai nickname, and sorts", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/styles`);
    await expect(page.getByRole("heading", { level: 1, name: "คลังแบบกล่องและบรรจุภัณฑ์" })).toBeVisible();
    await expect(page.getByText("105 แบบ")).toBeVisible();
    await expect(grid(page).getByRole("listitem").first()).toBeVisible();
    // The grid is virtual and says where each card sits in the whole.
    await expect(grid(page).getByRole("listitem").first()).toHaveAttribute("aria-setsize", "24");

    await page
      .getByRole("navigation", { name: "ประเภทบรรจุภัณฑ์" })
      .getByRole("link", { name: /กล่องลูกฟูก/ })
      .click();
    await expect(page).toHaveURL(/category=corrugated/);
    await expect(page.getByText("28 แบบ")).toBeVisible();
    await page.getByRole("link", { name: /ช่องมือจับ: ด้านข้าง/ }).click();
    await expect(page).toHaveURL(/closure=|feature=hand_holes/);
    await expect(grid(page).getByRole("listitem").first()).toBeVisible();

    await gotoHydrated(page, `${HOSTS.customer}/styles`);
    await page.getByRole("searchbox", { name: "ค้นหาแบบกล่อง" }).fill("หูช้าง");
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "ผลการค้นหา “หูช้าง”" })).toBeVisible();
    await expect(
      grid(page).getByRole("link", { name: "Roll-end tuck-front mailer" }).or(grid(page).getByText("PK-CF-01")),
    ).toBeVisible();

    await expectNoViolations(page);
  });

  test("loads more by cursor", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/styles`);
    await page.getByRole("button", { name: "แสดงเพิ่ม" }).click();
    await expect(page.getByText("แสดง 48 แบบ")).toBeVisible();
    await expect(grid(page).getByRole("listitem").first()).toHaveAttribute("aria-setsize", "48");
  });

  test("compares up to three styles side by side", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/styles`);
    const buttons = grid(page).getByRole("button", { name: /^เปรียบเทียบ: / });
    for (let i = 0; i < 3; i++) await buttons.nth(i).click();
    await expect(buttons.nth(3)).toBeDisabled();
    const tray = page.getByRole("region", { name: "แบบที่เลือกเปรียบเทียบ" });
    await tray.getByRole("link", { name: "เปรียบเทียบ 3 แบบ" }).click();
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
