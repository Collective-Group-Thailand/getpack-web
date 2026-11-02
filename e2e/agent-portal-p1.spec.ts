import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { AGENT_PHONE, signInToAgentZone } from "./helpers/agent";
import { acceptCookies, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

const shots = process.env["E2E_SHOTS"];
const WIDTHS = [360, 375, 393, 768, 1024, 1280, 1440, 1920] as const;

async function noHorizontalScroll(page: Page) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function shoot(page: Page, name: string) {
  if (!shots) return;
  for (const [label, width] of [
    ["phone", 390],
    ["desktop", 1440],
  ] as const) {
    await page.setViewportSize({ width, height: label === "phone" ? 844 : 900 });
    await page.screenshot({ path: `${shots}/${name}-${label}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test.describe("agent portal P1 — entry and two-step apply (D-466)", () => {
  test("the public landing shows the API's rates, an uncapped promise and JSON-LD, with no factory or profit wording", async ({
    page,
  }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/agent`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/โรงงาน|factory|กำไร|margin|profit|฿0(?![0-9.,])|เร็ว ๆ นี้|coming soon/i);
    await expect(page.getByRole("link", { name: /สมัคร/ }).first()).toHaveAttribute("href", /\/agent\/apply$/);
    // The calculator asks the API (the mock computes like the API); the web only formats.
    const amount = page.getByLabel(/ยอดสินค้าก่อน VAT/);
    await amount.fill("40000");
    await expect(page.getByText("฿2,000.00").first()).toBeVisible();
    await noHorizontalScroll(page);
    await shoot(page, "landing");
  });

  test("the English landing renders", async ({ page }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/en/agent`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/factory|profit|margin/i);
  });

  test("step 1: a customer verifies a new phone with a code, accepts the agreement and applies", async ({ page }) => {
    await signInAsCustomer(page, "/agent/apply");
    await expect(page.getByRole("list", { name: "ขั้นตอนการสมัคร" })).toBeVisible();
    await shoot(page, "apply");
    // Submitting empty explains every problem at once.
    await page.getByRole("button", { name: "ส่งใบสมัคร" }).click();
    await expect(page.getByRole("alert").first()).toContainText("เลือกอย่างน้อยหนึ่งช่องทาง");
    // A different number than the account's needs a code.
    const phone = page.getByLabel("เบอร์มือถือ");
    await phone.fill("0899990000");
    await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
    await page.getByLabel("รหัสยืนยัน").fill("000000");
    await expect(page.getByText("✓ ยืนยันแล้ว")).toBeVisible();
    await page.getByLabel("อีเมล").fill("agent.applicant@example.invalid");
    await page.getByLabel("กลุ่ม LINE").check();
    await page.getByRole("button", { name: "อ่านข้อตกลง" }).click();
    await page.getByRole("button", { name: "อ่านแล้ว ยอมรับข้อตกลง" }).click();
    await expect(page.getByLabel("ฉันอ่านและยอมรับข้อตกลงตัวแทนขายฉบับนี้")).toBeChecked();
    await noHorizontalScroll(page);
    await page.getByRole("button", { name: "ส่งใบสมัคร" }).click();
    await expect(page).toHaveURL(/\/account\/agent/, { timeout: 15_000 });
  });

  test("step 2: an approved agent fills in payout details and sends them to Finance", async ({ page }) => {
    await signInToAgentZone(page, "/payout", AGENT_PHONE);
    await expect(page.getByRole("heading", { level: 1, name: "ข้อมูลรับเงิน" })).toBeVisible();
    await expect(page.getByText("ยังไม่ได้กรอก")).toBeVisible();
    await noHorizontalScroll(page);
    await shoot(page, "payout-empty");
    await page.getByRole("button", { name: "ส่งให้ฝ่ายการเงินตรวจ" }).click();
    await expect(page.getByRole("alert").first()).toContainText("เลขประจำตัว 13 หลักไม่ถูกต้อง");
  });

  test("an agent without verified payout details is asked for them on the agent home", async ({ page }) => {
    await signInToAgentZone(page, "/", AGENT_PHONE);
    await expect(page.getByRole("link", { name: "กรอกข้อมูลรับเงิน" })).toHaveAttribute("href", /^\/payout$/);
  });

  test("the header, footer and partner page lead to the programme", async ({ page }) => {
    await acceptCookies(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoHydrated(page, `${HOSTS.customer}/partner-with-us`);
    await expect(page.locator('footer a[href$="/agent"]').first()).toBeAttached();
    await expect(page.locator('main a[href$="/agent"]').first()).toBeVisible();
    await expect(page.locator('header nav a[href$="/agent"]')).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(page.locator('header nav a[href$="/agent"]')).toBeHidden();
  });

  test("Finance opens the payout profile queue and a profile", async ({ page }) => {
    await signInAsStaff(page, "finance_manager");
    await page.goto(`${HOSTS.admin}/agents/payout-profiles`);
    await expect(page.getByRole("heading", { level: 1, name: "ข้อมูลรับเงินตัวแทน" })).toBeVisible();
    await shoot(page, "admin-payout-profiles");
    await page.getByRole("link", { name: "สมชาย ขายเก่ง" }).first().click();
    await expect(page.getByRole("button", { name: "ยืนยันข้อมูล" })).toBeVisible();
    await expect(page.getByText("•••• 7890")).toBeVisible();
    await shoot(page, "admin-payout-profile");
  });
});
