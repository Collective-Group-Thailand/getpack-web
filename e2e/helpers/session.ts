import { expect, type Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";

/**
 * Credentials the mock API accepts (`mocks/handlers.ts`). Obviously fake, and the mock only
 * runs when the server is started with `API_MOCKS=1`.
 */
export const MOCK_STAFF = { email: "somchai.staff@packio.invalid", password: "mock-password" };
export const MOCK_PARTNER = { email: "planner@factory.invalid", password: "mock-password", pin: "1234" };
export const MOCK_OTP = { phone: "0812345678", code: "000000" };

/**
 * Who is signed in now lives behind the account menu in each zone's topbar (F1 1.3), not on
 * the page — so "signed in" is proved by the shell rendering its account control, and the
 * name is asserted after opening it.
 */
export function accountButton(page: Page) {
  return page.getByRole("button", { name: "บัญชีผู้ใช้" });
}

/**
 * Opens the topbar account menu and returns once the name inside it is visible.
 *
 * Retried, because the button is in the server-rendered HTML before the JavaScript that makes
 * it open anything has hydrated — a click in that window is simply lost, which showed up as
 * three tests failing only when the suite ran in parallel. Retrying is the honest fix: a real
 * person who clicks too early also just clicks again.
 */
export async function openAccountMenu(page: Page): Promise<void> {
  await expect(async () => {
    await accountButton(page).click();
    await expect(page.getByTestId("actor-name")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/** Signs in as staff and waits until the admin shell is actually rendering for them. */
export async function signInAsStaff(page: Page): Promise<void> {
  await page.goto(`${HOSTS.admin}/login`);
  await page.getByLabel(/^อีเมล/).fill(MOCK_STAFF.email);
  await page.getByLabel(/^รหัสผ่าน/).fill(MOCK_STAFF.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(accountButton(page)).toBeVisible();
}

/** Signs in as a partner-factory user. */
export async function signInAsPartner(page: Page): Promise<void> {
  await page.goto(`${HOSTS.partner}/login`);
  await page.getByLabel(/^อีเมล/).fill(MOCK_PARTNER.email);
  await page.getByLabel(/^รหัสผ่าน/).fill(MOCK_PARTNER.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(accountButton(page)).toBeVisible();
}
