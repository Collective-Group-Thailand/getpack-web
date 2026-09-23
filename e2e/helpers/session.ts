import { expect, type Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";

/**
 * Credentials the mock API accepts (`mocks/handlers.ts`). Obviously fake, and the mock only
 * runs when the server is started with `API_MOCKS=1`.
 */
export const MOCK_STAFF = { email: "somchai.staff@packio.invalid", password: "mock-password" };
export const MOCK_PARTNER = { username: "seed.planner", password: "mock-password" };
export const MOCK_OTP = { phone: "0812345678", code: "000000", ref: "MOCK-4821" };

/** Signs in as staff and waits until the admin zone is actually rendering for them. */
export async function signInAsStaff(page: Page): Promise<void> {
  await page.goto(`${HOSTS.admin}/login`);
  await page.getByLabel(/^อีเมล/).fill(MOCK_STAFF.email);
  await page.getByLabel(/^รหัสผ่าน/).fill(MOCK_STAFF.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByTestId("actor-name")).toBeVisible();
}

/** Signs in as a partner-factory user. */
export async function signInAsPartner(page: Page): Promise<void> {
  await page.goto(`${HOSTS.partner}/login`);
  await page.getByLabel(/^ชื่อผู้ใช้/).fill(MOCK_PARTNER.username);
  await page.getByLabel(/^รหัสผ่าน/).fill(MOCK_PARTNER.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByTestId("actor-name")).toBeVisible();
}
