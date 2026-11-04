import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { PILOT_PHONE } from "./helpers/agent";
import { acceptCookies, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * Agent portal P7 — the pilot switch (API-CHANGES-P7 §1–2): while sign-up is closed to the public, everyone sees the
 * waiting list on getpack.co/agent ("ลงทะเบียนรอเปิดรับ": name, phone or e-mail, how they sell, the published consent
 * text with its tick) and gets the same neutral thanks whether they were listed already; with no consent text
 * published the page says calmly that sign-up is not open; a customer on the pilot list sees apply and can apply;
 * /agent/apply offers the waiting list to everyone else. Admin: the waiting list and its CSV export for the roles that
 * may read it, a 403 page for the others.
 *
 * Runs against the MSW mock server (mocks/store/agent.ts): the mock-only job
 * `POST /v1/store/mock-jobs/agents.programme_state` moves the switch; the suite runs in order and puts it back.
 */
test.describe.configure({ mode: "serial" });

const shots = process.env["E2E_SHOTS"];
const WORDING = /โรงงาน|factory|กำไร|margin|profit|฿0(?![0-9.,])|เร็ว ๆ นี้|เร็วๆ นี้|กำลังพัฒนา|coming soon/i;

async function shoot(page: Page, name: string, widths: readonly number[], at?: string) {
  if (!shots) return;
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
    await page.waitForTimeout(300);
    if (at) await page.locator(at).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${shots}/p7-${name}-${width}.png`, fullPage: !at });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/** Moves the mock's pilot switch through the storefront BFF (the browser's own origin). */
async function programmeState(page: Page, state: "waitlist" | "closed" | "open", resetPilot = false) {
  if (!page.url().startsWith(HOSTS.customer)) await page.goto(`${HOSTS.customer}/robots.txt`);
  const status = await page.evaluate(
    async ({ state, resetPilot }) =>
      (
        await fetch("/bff/v1/store/mock-jobs/agents.programme_state", {
          method: "POST",
          headers: { "content-type": "application/json", "x-getpack-csrf": "1" },
          body: JSON.stringify({ state, resetPilot }),
        })
      ).status,
    { state, resetPilot },
  );
  expect(status).toBe(200);
}

async function joinWaitlist(page: Page, contact: { name: string; phone?: string; email?: string }) {
  const form = page.getByRole("form", { name: "ลงทะเบียนรอเปิดรับสมัครตัวแทน" });
  await form.getByLabel(/^ชื่อ/).fill(contact.name);
  if (contact.phone) await form.getByLabel("เบอร์มือถือ").fill(contact.phone);
  if (contact.email) await form.getByLabel("อีเมล").fill(contact.email);
  await form.getByLabel("ช่องทางที่คุณขาย (ไม่บังคับ)").selectOption("line_groups");
  await form.getByRole("checkbox", { name: "ฉันอ่านและยินยอมตามข้อความนี้" }).check();
  await form.getByRole("button", { name: "ลงทะเบียน" }).click();
}

test.describe("agent portal P7 — pilot switch and waiting list", () => {
  test("anonymous visitors see the waiting list, with the consent text and a neutral thank-you", async ({ page }) => {
    await acceptCookies(page);
    await programmeState(page, "waitlist", true);
    await gotoHydrated(page, `${HOSTS.customer}/agent`);
    const hero = page.getByRole("link", { name: "ลงทะเบียนรอเปิดรับ" }).first();
    await expect(hero).toHaveAttribute("href", /#waitlist$/);
    await expect(page.locator('main a[href$="/agent/apply"]')).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(WORDING);
    const form = page.getByRole("form", { name: "ลงทะเบียนรอเปิดรับสมัครตัวแทน" });
    await expect(form).toContainText("ความยินยอม (ฉบับที่ 1)");
    await expect(form).toContainText("ข้อความจำลองสำหรับทดสอบ");
    await shoot(page, "waitlist-form", [390, 1440], "#waitlist");

    // Sending empty explains everything at once: a name, a phone or an e-mail, the consent.
    await form.getByRole("button", { name: "ลงทะเบียน" }).click();
    const errors = page.getByRole("alert").first();
    await expect(errors).toContainText("กรอกชื่อ");
    await expect(errors).toContainText("กรอกเบอร์มือถือหรืออีเมลอย่างน้อยหนึ่งช่อง");
    await expect(errors).toContainText("ติ๊กยินยอมก่อนส่ง");

    await joinWaitlist(page, { name: "คุณรอเปิด ทดสอบ", phone: "0810005678" });
    await expect(page.getByRole("status")).toContainText("ได้รับข้อมูลแล้ว ขอบคุณที่สนใจ");
    await shoot(page, "waitlist-done", [390], "#waitlist");

    // The same contact again gets exactly the same answer (the API's neutral 200; nothing says "already listed").
    await gotoHydrated(page, `${HOSTS.customer}/agent`);
    await joinWaitlist(page, { name: "คุณรอเปิด ทดสอบ", phone: "0810005678" });
    await expect(page.getByRole("status")).toContainText("ได้รับข้อมูลแล้ว ขอบคุณที่สนใจ");
    await expect(page.locator("main")).not.toContainText(/แล้วก่อนหน้า|already/i);

    // An e-mail alone is enough.
    await gotoHydrated(page, `${HOSTS.customer}/agent`);
    await joinWaitlist(page, { name: "คุณอีเมล ทดสอบ", email: "waitlist.e2e@example.invalid" });
    await expect(page.getByRole("status")).toContainText("ได้รับข้อมูลแล้ว");
  });

  test("the English landing offers the waiting list too", async ({ page }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/en/agent`);
    await expect(page.getByRole("link", { name: "Join the waiting list" }).first()).toBeVisible();
    await expect(page.getByRole("form", { name: "Join the agent waiting list" })).toContainText("Consent (version 1)");
  });

  test("with no consent text published, sign-up is calmly closed — no form, no 'coming soon'", async ({ page }) => {
    await acceptCookies(page);
    await programmeState(page, "closed");
    await gotoHydrated(page, `${HOSTS.customer}/agent`);
    await expect(page.getByRole("heading", { name: "ตอนนี้ไม่ได้เปิดรับสมัครตัวแทน" })).toBeVisible();
    await expect(page.getByRole("form", { name: "ลงทะเบียนรอเปิดรับสมัครตัวแทน" })).toHaveCount(0);
    await expect(page.locator('main a[href$="/agent/apply"]')).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(WORDING);
    await expect(page.getByRole("link", { name: "ติดต่อทีมงาน" })).toHaveAttribute("href", /\/contact$/);
    await shoot(page, "closed", [390, 1440]);
    await programmeState(page, "waitlist");
  });

  test("a customer not on the pilot list gets the waiting list on /agent/apply, prefilled", async ({ page }) => {
    await signInAsCustomer(page, "/agent/apply");
    await expect(page.getByRole("heading", { level: 1, name: "ลงทะเบียนรอเปิดรับ" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ส่งใบสมัคร" })).toHaveCount(0);
    const form = page.getByRole("form", { name: "ลงทะเบียนรอเปิดรับสมัครตัวแทน" });
    await expect(form.getByLabel(/^ชื่อ/)).not.toHaveValue("");
    await form.getByRole("checkbox", { name: "ฉันอ่านและยินยอมตามข้อความนี้" }).check();
    await form.getByRole("button", { name: "ลงทะเบียน" }).click();
    await expect(page.getByRole("status")).toContainText("ได้รับข้อมูลแล้ว");
    // The landing as this customer: the waiting list as well.
    await gotoHydrated(page, `${HOSTS.customer}/agent`);
    await expect(page.getByRole("link", { name: "ลงทะเบียนรอเปิดรับ" }).first()).toBeVisible();
  });

  test("a pilot customer sees apply on the landing and can apply", async ({ page }) => {
    await acceptCookies(page);
    await programmeState(page, "waitlist", true);
    await signInAsCustomer(page, "/agent", PILOT_PHONE);
    const apply = page.getByRole("link", { name: "สมัครเป็นตัวแทน" }).first();
    await expect(apply).toHaveAttribute("href", /\/agent\/apply$/);
    await expect(page.getByRole("form", { name: "ลงทะเบียนรอเปิดรับสมัครตัวแทน" })).toHaveCount(0);
    await shoot(page, "pilot-landing", [390]);
    await apply.click();
    await expect(page).toHaveURL(/\/agent\/apply$/);
    await expect(page.getByRole("list", { name: "ขั้นตอนการสมัคร" })).toBeVisible();
    await page.getByLabel("อีเมล").fill("pilot.applicant@example.invalid");
    await page.getByLabel("กลุ่ม LINE").check();
    await page.getByRole("button", { name: "อ่านข้อตกลง" }).click();
    await page.getByRole("button", { name: "อ่านแล้ว ยอมรับข้อตกลง" }).click();
    await shoot(page, "pilot-apply", [390, 1440]);
    await page.getByRole("button", { name: "ส่งใบสมัคร" }).click();
    await expect(page).toHaveURL(/\/account\/agent/, { timeout: 15_000 });
  });

  test("a non-pilot customer's application is refused by the API (the switch is the API's, not the page's)", async ({
    page,
  }) => {
    await signInAsCustomer(page, "/account");
    const status = await page.evaluate(
      async () =>
        (
          await fetch("/bff/v1/store/agent/application", {
            method: "POST",
            headers: { "content-type": "application/json", "x-getpack-csrf": "1" },
            body: JSON.stringify({}),
          })
        ).status,
    );
    expect(status).toBe(409);
  });

  test("Sales Manager reads the waiting list and exports it; Finance gets the 403 page", async ({ page }) => {
    await signInAsStaff(page, "sales_manager");
    await gotoHydrated(page, `${HOSTS.admin}/agents`);
    await page.getByRole("link", { name: "รายชื่อรอเปิดรับ" }).click();
    await expect(page).toHaveURL(/\/agents\/waitlist$/);
    const table = page.getByRole("table", { name: "รายชื่อรอเปิดรับสมัครตัวแทน" });
    await expect(table).toContainText("คุณรอเปิด ทดสอบ");
    await expect(table).toContainText("081-000-5678");
    await expect(table).toContainText("waitlist.e2e@example.invalid");
    await shoot(page, "admin-waitlist", [1440]);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "ส่งออก CSV" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$|download/);
    await expect(page.getByText(/ส่งออก \d+ รายการ/)).toBeVisible();

    await page.context().clearCookies();
    await signInAsStaff(page, "finance_manager");
    await gotoHydrated(page, `${HOSTS.admin}/agents/waitlist`);
    await expect(page.getByText("คุณไม่มีสิทธิ์เปิดหน้านี้")).toBeVisible();
    await expect(page.getByRole("table", { name: "รายชื่อรอเปิดรับสมัครตัวแทน" })).toHaveCount(0);
    await expect(page.getByText("รายชื่อรอเปิดรับ", { exact: true })).toHaveCount(0);
  });
});
