import { expect, type Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { gotoHydrated, MOCK_OTP } from "./session";

/**
 * Storefront helpers for the F3 flows. The mock's returning customer (`MOCK_OTP.phone`) owns the
 * first fake commerce customer's orders and RFQs; state lives in the one mock process for the
 * whole run, so tests assert on what they created rather than on counts.
 */

/** Answers the cookie banner up front, so it never covers what a test clicks. */
export async function acceptCookies(page: Page): Promise<void> {
  const url = new URL(HOSTS.customer);
  await page.context().addCookies([{ name: "pk_consent", value: "a1m1", domain: url.hostname, path: "/" }]);
}

/**
 * Fills the sign-in form (phone → OTP): the sheet a storefront action opens over the page — which
 * loads on demand, so it is waited for — or the `/sign-in` page itself.
 */
export async function completeSignIn(page: Page, phone = MOCK_OTP.phone, where: "sheet" | "page" = "sheet") {
  const scope = where === "sheet" ? page.getByRole("dialog", { name: "เข้าสู่ระบบ" }) : page.locator("body");
  await expect(scope.getByLabel("เบอร์มือถือ")).toBeVisible({ timeout: 15_000 });
  await scope.getByLabel("เบอร์มือถือ").fill(phone);
  await scope.getByRole("button", { name: "ขอรหัส OTP" }).click();
  await scope.getByLabel("รหัส OTP").fill(MOCK_OTP.code);
}

/** Signs the returning customer in and lands on `path`. */
export async function signInAsCustomer(page: Page, path = "/"): Promise<void> {
  await acceptCookies(page);
  await gotoHydrated(page, `${HOSTS.customer}/sign-in?returnTo=${encodeURIComponent(path)}`);
  await completeSignIn(page, MOCK_OTP.phone, "page");
  await expect(page).toHaveURL(new RegExp(`${HOSTS.customer}${path.replace(/[?]/g, "\\?")}$`));
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}
