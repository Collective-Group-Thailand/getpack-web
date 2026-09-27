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

/**
 * A second complete account (the mock's `buyer` persona), for a flow that owns a cart or an order
 * end to end and must not share it with tests running in parallel as the returning customer.
 */
export const MOCK_BUYER_PHONE = "0823456789";

/** The mock's `artist` persona: owns an unpaid order waiting for artwork (F3 3.5). */
export const MOCK_ARTIST_PHONE = "0834567890";

/** The mock's `receiver` persona: owns an order delivered yesterday, 3 % short (F3 3.6). */
export const MOCK_RECEIVER_PHONE = "0845678901";
/** The tenth fake customer, whose orders use the online designer (F4 Part C). */
export const MOCK_DESIGNER_PHONE = "0856789012";

/** Signs a customer in (the returning one unless `phone` says otherwise) and lands on `path`. */
export async function signInAsCustomer(page: Page, path = "/", phone = MOCK_OTP.phone): Promise<void> {
  await acceptCookies(page);
  await gotoHydrated(page, `${HOSTS.customer}/sign-in?returnTo=${encodeURIComponent(path)}`);
  await completeSignIn(page, phone, "page");
  await expect(page).toHaveURL(new RegExp(`${HOSTS.customer}${path.replace(/[?]/g, "\\?")}$`));
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}
