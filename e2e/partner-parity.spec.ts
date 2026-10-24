import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsPartner } from "./helpers/session";

/**
 * U2.F7 — partner parity on a phone, against the mock API: the Today counters with samples and
 * claims, working hours and closures set by the owner (read-only to others), the payout calendar
 * in both views, and the knowledge base reached from the QC step's guide.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectAxeClean(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10_000 });
  // A colour still mid-transition (a tab just made current) is not what the page shows.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

test.use({ viewport: { width: 390, height: 844 } });

test("Today counts the sample jobs and the claims", async ({ page }) => {
  await signInAsPartner(page, "owner");
  const counters = page.getByRole("region", { name: "ภาพรวมวันนี้" });
  await expect(counters.getByRole("link", { name: /ตัวอย่าง/ }).first()).toBeVisible();
  // A counter with nothing in it is named in the "nothing waiting" line instead of a tile.
  await expect(counters.getByText(/เคลม/).first()).toBeVisible();
  await expectAxeClean(page);
});

test("the owner sets new working hours from tomorrow and a closure; another role only reads them", async ({ page }) => {
  test.setTimeout(90_000);
  await signInAsPartner(page, "owner");
  await page.goto(`${HOSTS.partner}/settings`);
  await page.getByRole("link", { name: "ตั้งเวลาทำการ" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "เวลาทำการ" })).toBeVisible();
  await expect(page.getByText(/^ใช้ตั้งแต่ /)).toBeVisible();
  await expectAxeClean(page);

  await page.getByRole("checkbox", { name: "เสาร์" }).click();
  await page.getByRole("button", { name: "บันทึกเวลาทำการ" }).click();
  await expect(page.getByText(/^บันทึกแล้ว เริ่มใช้ /)).toBeVisible();
  await expect(page.getByText(/^เวลาทำการที่ตั้งไว้จะเริ่มใช้ /)).toBeVisible();

  const day = new Date(Date.now() + 20 * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 10);
  await page.getByLabel("วันที่ปิด").fill(day);
  await page.getByLabel(/^ชื่อ/).fill("ปิดซ่อมบำรุงเครื่อง");
  await page.getByRole("button", { name: "เพิ่มวันปิด" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "ปิดซ่อมบำรุงเครื่อง" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "ลบ" }).click();
  await expect(row).toHaveCount(0);

  await signInAsPartner(page, "planner");
  await page.goto(`${HOSTS.partner}/settings/hours`);
  await expect(page.getByText("เจ้าของโรงงานเท่านั้นที่แก้เวลาทำการได้")).toBeVisible();
  await expect(page.getByRole("button", { name: "บันทึกเวลาทำการ" })).toHaveCount(0);
});

test("the payout calendar, by purchase order and by run", async ({ page }) => {
  await signInAsPartner(page, "accountant");
  await page.goto(`${HOSTS.partner}/payouts`);
  await page.getByRole("link", { name: "ปฏิทินการจ่ายเงิน" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ปฏิทินการจ่ายเงิน" })).toBeVisible();
  await expect(page.getByText(/^รอบจ่ายทุกวัน/)).toBeVisible();
  await expect(page.getByRole("link", { name: "ตามใบสั่งซื้อ" })).toHaveAttribute("aria-current", "page");
  await expectAxeClean(page);

  await page.getByRole("link", { name: "ตามรอบจ่าย" }).click();
  await expect(page).toHaveURL(/view=runs/);
  await expect(page.getByRole("link", { name: "ตามรอบจ่าย" })).toHaveAttribute("aria-current", "page");
  await expectAxeClean(page);
});

test("the knowledge base: searched, by category, and an article", async ({ page }) => {
  await signInAsPartner(page, "qc");
  await gotoHydrated(page, `${HOSTS.partner}/knowledge?category=qc-photo-standard`);
  await expect(page.getByRole("heading", { level: 1, name: "คู่มือโรงงาน" })).toBeVisible();
  await expect(page.getByRole("link", { name: "มาตรฐานรูป QC" })).toHaveAttribute("aria-current", "page");
  await expectAxeClean(page);

  await page.getByRole("link", { name: "ทั้งหมด" }).click();
  await expect(page.getByRole("link", { name: "ทั้งหมด" })).toHaveAttribute("aria-current", "page");
  await page.getByPlaceholder("ค้นหาคู่มือ").fill("ป้าย");
  await page.getByRole("button", { name: "ค้นหา" }).click();
  await expect(page).toHaveURL(/q=/);
  await page.getByRole("link", { name: /ติดป้ายพาเลทและกล่อง/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ติดป้ายพาเลทและกล่อง" })).toBeVisible();
  await expect(page.getByText(/ติดป้ายทุกกล่องด้านที่หันออก/)).toBeVisible();
  await expectAxeClean(page);

  await page.getByRole("link", { name: "กลับไปที่คู่มือทั้งหมด" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "คู่มือโรงงาน" })).toBeVisible();
});
