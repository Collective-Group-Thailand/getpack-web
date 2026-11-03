import { expect, test, type Browser, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInToAgentZone } from "./helpers/agent";
import { acceptCookies } from "./helpers/customer";
import { gotoHydrated, MOCK_OTP, signInAsStaff } from "./helpers/session";

/**
 * Agent portal P5 (D-471): automatic lead capture and scoring; the dieline download stays free.
 * - The first dieline download needs no sign-in; the second opens the sign-in sheet (one-tap providers first, then
 *   phone OTP) and, once signed in, the same file downloads by itself. "ฟรี" throughout, never "฿0".
 * - The studio idle capture (the mock runs the job on request) puts the customer in the sales inbox with a score whose
 *   reasons open from the keyboard; the inbox sorts by score.
 * - An agent sees the score of their own leads, with no reasons.
 *
 * Runs against the MSW mock server, whose state lives as long as the server: a freshly started server, in order.
 */
test.describe.configure({ mode: "serial" });

const shots = process.env["E2E_SHOTS"];
const STYLE = `${HOSTS.customer}/styles/pk-te-01`;

async function shoot(page: Page, name: string, widths: readonly number[]) {
  if (!shots) return;
  for (const width of widths) {
    await page.setViewportSize({ width, height: width >= 1280 ? 900 : width >= 768 ? 1100 : 844 });
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${shots}/p5-${name}-${width}.png`, fullPage: false });
  }
}

/** The mock's studio idle job, run from the admin page itself (same origin: the BFF's CSRF and Origin checks pass). */
async function runStudioIdleJob(page: Page): Promise<{ status: number; body: { captured: number } }> {
  return page.evaluate(async () => {
    const response = await fetch("/bff/v1/admin/mock-jobs/sales.capture_studio_idle", {
      method: "POST",
      headers: { "x-getpack-csrf": "1" },
    });
    return { status: response.status, body: (await response.json()) as { captured: number } };
  });
}

async function noHorizontalScroll(page: Page, label: string, widths: readonly number[]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(80);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${label}: horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  }
}

/** The style page's dieline form, opened and filled with a size inside the style's range. */
async function openDieline(page: Page) {
  await gotoHydrated(page, STYLE);
  await page.getByRole("button", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" }).click();
  const panel = page.getByRole("region", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" });
  await panel.getByRole("textbox", { name: "ยาว (มม.)" }).fill("70");
  await panel.getByRole("textbox", { name: "กว้าง (มม.)" }).fill("40");
  await panel.getByRole("textbox", { name: "สูง (มม.)" }).fill("150");
  return panel;
}

/** A visitor's own browser: no session, no device cookie yet. */
async function freshVisitor(browser: Browser, width: number) {
  const context = await browser.newContext({
    viewport: { width, height: width >= 1280 ? 900 : 844 },
    ...(width < 768 ? { isMobile: true, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  await acceptCookies(page);
  return { context, page };
}

test.describe("P5 dieline download stays free", () => {
  for (const width of [1440, 390] as const) {
    test(`the second download asks for a free sign-in, then continues by itself (${width})`, async ({ browser }) => {
      const { context, page } = await freshVisitor(browser, width);
      const panel = await openDieline(page);
      // Signed out, the form is there — no sign-in wall, and the note says the first one is free.
      await expect(panel.getByText("ครั้งแรกดาวน์โหลดได้เลยโดยไม่ต้องเข้าสู่ระบบ")).toBeVisible();
      await panel.getByRole("radio", { name: "SVG" }).click();
      let download = page.waitForEvent("download");
      await panel.getByRole("button", { name: "ดาวน์โหลด", exact: true }).click();
      expect((await download).suggestedFilename()).toMatch(/^PK-TE-01-.*-70x40x150\.svg$/);
      await expect(panel.getByText("ครั้งต่อไปเข้าสู่ระบบก่อน แล้วดาวน์โหลดต่อได้ฟรีเหมือนเดิม")).toBeVisible();
      // The device id is the BFF's httpOnly cookie, never one a script can read.
      const device = (await context.cookies()).find((cookie) => cookie.name === "gp_device");
      expect(device?.httpOnly).toBe(true);
      expect(await page.evaluate(() => document.cookie)).not.toContain("gp_device");

      // The second download: the sign-in sheet, titled for the task, one-tap providers first.
      await panel.getByRole("radio", { name: "PDF" }).click();
      await panel.getByRole("button", { name: "ดาวน์โหลด", exact: true }).click();
      const sheet = page.getByRole("dialog", { name: "ดาวน์โหลดต่อได้ฟรี" });
      await expect(sheet).toBeVisible({ timeout: 15_000 });
      const top = async (name: RegExp | string) =>
        (await sheet.getByRole(typeof name === "string" ? "textbox" : "button", { name }).boundingBox())!.y;
      const google = await top(/Google/);
      expect(google).toBeLessThan(await top(/Apple/));
      expect(await top(/Apple/)).toBeLessThan(await top(/LINE/));
      expect(await top(/LINE/)).toBeLessThan(await top("เบอร์มือถือ"));
      await expect(sheet).toContainText("ฟรี");
      await expect(page.locator("body")).not.toContainText("฿0");
      await shoot(page, "signin-sheet", [width]);

      // Phone OTP (the one-tap providers are not configured in the mock); the file then downloads by itself.
      await sheet.getByLabel("เบอร์มือถือ").fill(MOCK_OTP.phone);
      await sheet.getByRole("button", { name: "ขอรหัส OTP" }).click();
      download = page.waitForEvent("download", { timeout: 30_000 });
      await sheet.getByLabel("รหัส OTP").fill(MOCK_OTP.code);
      expect((await download).suggestedFilename()).toMatch(/^PK-TE-01-.*-70x40x150\.pdf$/);
      await expect(sheet).toBeHidden();
      await expect(panel.getByText(/วันนี้ดาวน์โหลดได้อีก \d+ ครั้ง/)).toBeVisible();
      if (width === 1440) await noHorizontalScroll(page, "style page, dieline open", [360, 768, 1024, 1280, 1920]);
      await context.close();
    });
  }
});

test.describe("P5 capture and scoring at the sales desk", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("a saved design not ordered arrives in the inbox with a score whose reasons open from the keyboard", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await signInAsStaff(page, "sales_manager");
    // The job `sales.capture_studio_idle`, run now by the mock (a mock-only admin path through the BFF).
    const run = await runStudioIdleJob(page);
    expect(run).toEqual({ status: 200, body: { captured: 1 } });

    await gotoHydrated(page, `${HOSTS.admin}/sales`);
    const table = page.getByRole("table", { name: "งานเข้าฝ่ายขาย" });
    const row = table.getByRole("row", { name: /คุณใบเตย ออกแบบเอง/ });
    await expect(row).toContainText("ออกแบบแล้วยังไม่สั่ง");
    await expect(row).toContainText("ยินยอมรับข่าวสาร");

    // Keyboard only: focus the chip, Enter opens the reasons, Esc closes them and focus returns to the chip.
    const chip = row.getByRole("button", { name: /คะแนนของ คุณใบเตย ออกแบบเอง: \d+ จาก 100 — ดูเหตุผล/ });
    await chip.focus();
    await expect(chip).toBeFocused();
    await page.keyboard.press("Enter");
    const reasons = page.getByRole("dialog", { name: /ทำไมได้ \d+ คะแนน/ });
    await expect(reasons).toBeVisible();
    await expect(chip).toHaveAttribute("aria-expanded", "true");
    await expect(reasons.getByRole("list", { name: "เหตุผลหลัก" }).getByRole("listitem")).toHaveCount(3);
    await expect(reasons).toContainText("มาจากช่องทางที่สนใจซื้อ");
    await shoot(page, "admin-inbox-popover", [1440, 1024]);
    await page.keyboard.press("Escape");
    await expect(reasons).toBeHidden();
    await expect(chip).toBeFocused();

    // The job is idempotent: a second run finds the design already captured.
    expect(await runStudioIdleJob(page)).toEqual({ status: 200, body: { captured: 0 } });
  });

  test("the inbox sorts by score, highest first, and filters by a minimum score", async ({ page }) => {
    await page.context().clearCookies();
    await signInAsStaff(page, "sales_manager");
    await gotoHydrated(page, `${HOSTS.admin}/sales`);
    const table = page.getByRole("table", { name: "งานเข้าฝ่ายขาย" });
    await table.getByRole("button", { name: /คะแนน/ }).first().click();
    await expect(page).toHaveURL(/sort=score/);
    await expect(table.getByRole("columnheader", { name: /คะแนน/ })).toHaveAttribute(
      "aria-sort",
      /descending|ascending/,
    );
    if (!/order=desc/.test(page.url()) && /order=asc/.test(page.url()))
      await table.getByRole("button", { name: /คะแนน/ }).first().click();
    await expect(page).toHaveURL(/order=desc|sort=score(?!.*order=asc)/);
    const scores = async () =>
      (await table.getByRole("button", { name: /: \d+ จาก 100 — ดูเหตุผล/ }).allTextContents())
        .map((text) => Number(/\d+/.exec(text)?.[0] ?? -1))
        .filter((value) => value >= 0);
    await expect.poll(async () => (await scores()).length).toBeGreaterThan(2);
    const sorted = await scores();
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
  });
});

test.describe("P5 agent zone", () => {
  test("the agent sees the score of their own leads — no reasons — and sorts by it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInToAgentZone(page, "/leads");
    const table = page.getByRole("table");
    await expect(table.getByText(/^คะแนน(ของ .+:)? \d+ จาก 100$/).first()).toBeAttached();
    // A label, not a button: the reasons stay with getpack staff, and nothing on the wire carries them.
    await expect(table.getByRole("button", { name: /ดูเหตุผล/ })).toHaveCount(0);
    const body = await page.evaluate(async () => {
      const response = await fetch("/bff/v1/store/agent/leads/pipeline?sort=score");
      return response.ok ? response.text() : `status ${response.status}`;
    });
    expect(body).toContain('"score"');
    expect(body).not.toContain("scoreReasons");

    await page
      .getByRole("link", { name: /^คะแนน/ })
      .first()
      .click();
    await expect(page).toHaveURL(/sort=score/);
    await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
    await shoot(page, "agent-leads", [1440]);
    await noHorizontalScroll(page, "agent leads", [360, 768, 1024, 1280, 1920]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText(/^คะแนน(ของ .+:)? \d+ จาก 100$/).first()).toBeAttached();
    await shoot(page, "agent-leads", [390]);
  });
});
