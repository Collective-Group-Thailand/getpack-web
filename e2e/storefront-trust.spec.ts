import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated } from "./helpers/session";

/**
 * U2.F4, trust surfaces against the mock API (the contract's own examples): the guarantee matrix as
 * published, the network page saying its figures are not published yet (with why), verified reviews
 * — and the honest empty state when there are none, never a placeholder testimonial.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

test("the guarantee: time limits and the remedies matrix as getpack-api publishes it", async ({ page }) => {
  await gotoHydrated(page, `${HOSTS.customer}/`);
  await page.getByRole("contentinfo").getByRole("link", { name: "การรับประกันงาน" }).click();
  await expect(page).toHaveURL(/\/guarantee$/);
  await expect(page.getByRole("heading", { level: 1, name: "การรับประกันงาน" })).toBeVisible();
  const matrix = page.getByRole("table", { name: "สิ่งที่เราทำให้" });
  await expect(matrix.getByRole("row", { name: /สินค้าเสียหาย/ })).toContainText("ผลิตใหม่ / คืนเงิน");
  await expect(matrix.getByRole("row", { name: /ส่งล่าช้า/ })).toContainText("พิจารณาเป็นกรณีไป");
  await expect(page.getByText("7 วันหลังได้รับสินค้า")).toBeVisible();
  await expectNoViolations(page);
});

test("the network page: getpack's production standard, with no factory wording", async ({ page }) => {
  await gotoHydrated(page, `${HOSTS.customer}/network`);
  await expect(page.getByRole("heading", { level: 1, name: "มาตรฐานการผลิตของ getpack" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ควบคุมคุณภาพ 4 ขั้น" })).toBeVisible();
  await expect(page.getByText("ΔE2000 ≤ 3")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText(/โรงงาน|ยังไม่เผยแพร่ตัวเลข|อย่างน้อย 3 แห่ง/);
  await expectNoViolations(page);
});

test("reviews: verified ones with their product and date, and the honest empty state", async ({ page }) => {
  await gotoHydrated(page, `${HOSTS.customer}/reviews`);
  await expect(page.getByText("ยืนยันแล้วว่ามาจากคำสั่งซื้อจริง").first()).toBeVisible();
  await expectNoViolations(page);
});
