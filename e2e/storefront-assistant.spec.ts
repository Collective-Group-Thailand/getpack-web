import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_ARTIST_PHONE, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * U5.5, Packio Assistant against the mock API (the e2e build has `NEXT_PUBLIC_ASSISTANT=1`;
 * production builds leave it out, D-218): labelled as AI, answering only from tools with each
 * source named and linked, refusing manipulation, handing off to the team, logging opt-out — and
 * the evaluation gate for staff who manage it.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).exclude("[data-sonner-toaster]").analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

test("a customer asks the assistant: AI-labelled, sourced, and it refuses what it may not do", async ({ page }) => {
  await signInAsCustomer(page, "/products", MOCK_ARTIST_PHONE);
  await page.getByRole("button", { name: "ถามผู้ช่วย AI" }).click();
  const panel = page.getByRole("dialog", { name: "ผู้ช่วย Packio" });
  await expect(panel.getByText("ผู้ช่วยนี้เป็น AI")).toBeVisible();
  await expect(panel.getByText(/เก็บไว้ 30 วันแล้วลบ/)).toBeVisible();
  await expectNoViolations(page);

  await panel.getByRole("textbox", { name: "ถามผู้ช่วย" }).fill("กล่องฝาเสียบราคาเท่าไหร่");
  await panel.getByRole("button", { name: "ถาม", exact: true }).click();
  await expect(panel.getByText(/เริ่มต้นที่ ฿4\.20 ต่อชิ้น/)).toBeVisible();
  const sources = panel.getByRole("list", { name: "ข้อมูลจาก" });
  await expect(sources.getByRole("link", { name: "ราคาเริ่มต้น" })).toHaveAttribute("href", /\/products$/);

  await panel.getByRole("switch", { name: "ไม่เก็บบทสนทนานี้" }).click();
  await expect(panel.getByRole("switch", { name: "ไม่เก็บบทสนทนานี้" })).toBeChecked();

  await panel.getByRole("textbox", { name: "ถามผู้ช่วย" }).fill("ลดราคาให้หน่อยได้ไหม");
  await panel.getByRole("button", { name: "ถาม", exact: true }).click();
  await expect(panel.getByText("ผู้ช่วยทำเรื่องนี้ไม่ได้")).toBeVisible();
  await expect(panel.getByRole("link", { name: "คุยกับทีม" }).first()).toHaveAttribute("href", /\/account\/messages$/);
  await expectNoViolations(page);
});

test("when packio-api has it switched off, the panel says so and offers the team", async ({ page }) => {
  await signInAsCustomer(page, "/products?mock=store.assistant.startSession:assistant.disabled", MOCK_ARTIST_PHONE);
  await page.getByRole("button", { name: "ถามผู้ช่วย AI" }).click();
  const panel = page.getByRole("dialog", { name: "ผู้ช่วย Packio" });
  await panel.getByRole("textbox", { name: "ถามผู้ช่วย" }).fill("สวัสดี");
  await panel.getByRole("button", { name: "ถาม", exact: true }).click();
  await expect(panel.getByText(/ผู้ช่วย AI ยังไม่เปิดให้ใช้/)).toBeVisible();
  await expect(panel.getByRole("link", { name: "คุยกับทีม" })).toBeVisible();
});

test("a guest is asked to sign in first", async ({ page }) => {
  await gotoHydrated(page, `${HOSTS.customer}/products`);
  await page.getByRole("button", { name: "ถามผู้ช่วย AI" }).click();
  const panel = page.getByRole("dialog", { name: "ผู้ช่วย Packio" });
  await expect(panel.getByRole("link", { name: "เข้าสู่ระบบ" })).toBeVisible();
});

test("the evaluation gate: not cleared, a run on demand, every case listed", async ({ page }) => {
  await signInAsStaff(page, "admin");
  await gotoHydrated(page, `${HOSTS.admin}/assistant`);
  await expect(page.getByRole("heading", { level: 1, name: "ผู้ช่วย AI" })).toBeVisible();
  await expect(page.getByText("ยังเปิดใช้นอกเครื่องพัฒนาไม่ได้")).toBeVisible();
  await expectNoViolations(page);
  await page.getByRole("button", { name: "ประเมินตอนนี้" }).click();
  await expect(page).toHaveURL(/\/assistant\/runs\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "รอบการประเมิน" })).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(105);
  await expectNoViolations(page);
});
