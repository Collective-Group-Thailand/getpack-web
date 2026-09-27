import { expect, type Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";

/**
 * Credentials the mock API accepts (`mocks/handlers.ts`). Obviously fake, and the mock only
 * runs when the server is started with `API_MOCKS=1`.
 */
export const MOCK_STAFF = { email: "somchai.staff@packio.invalid", password: "mock-password" };
export const MOCK_PARTNER = { email: "planner@factory.invalid", password: "mock-password", pin: "1234" };
export const MOCK_OTP = { phone: "0812345678", code: "000000" };
/** A first-time customer: the mock resets them on every sign-in, so consent and profile are asked. */
export const MOCK_NEW_CUSTOMER_PHONE = "0898765432";

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

/**
 * The D-140 personas the mock API knows (`mocks/personas.ts`). The default, `cs`, is the
 * somchai account the F1 tests were written against.
 */
export type Persona =
  | "superadmin"
  | "c_level"
  | "vp"
  | "director"
  | "admin"
  | "cs"
  | "cs_lead"
  | "prepress"
  | "finance"
  | "finance_manager"
  | "logistics"
  | "marketing"
  | "partner_manager"
  | "auditor";

export function personaEmail(persona: Persona): string {
  return persona === "cs" ? MOCK_STAFF.email : `${persona.replace(/_/g, ".")}.staff@packio.invalid`;
}

/** Signs in as staff and waits until the admin shell is actually rendering for them. */
export async function signInAsStaff(page: Page, persona: Persona = "cs"): Promise<void> {
  await page.goto(`${HOSTS.admin}/login`);
  await page.getByLabel(/^อีเมล/).fill(personaEmail(persona));
  await page.getByLabel(/^รหัสผ่าน/).fill(MOCK_STAFF.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(accountButton(page)).toBeVisible();
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}

/**
 * The factory personas the mock API knows (`mocks/partner/personas.ts`): one per D-140 factory
 * role at F001, the applicant owner of F005 and the assisted owner of F006. The default,
 * `planner`, is the account the F1 tests were written against.
 */
export type PartnerPersona =
  "planner" | "owner" | "operator" | "qc" | "shipping" | "accountant" | "applicant" | "assisted";

const PARTNER_EMAILS: Record<PartnerPersona, string> = {
  planner: MOCK_PARTNER.email,
  owner: "owner@factory.invalid",
  operator: "operator@factory.invalid",
  qc: "qc@factory.invalid",
  shipping: "shipping@factory.invalid",
  accountant: "accountant@factory.invalid",
  applicant: "owner@corrugated.invalid",
  assisted: "owner@labels.invalid",
};

/** Signs in as a partner-factory user and waits until the shop-floor shell is interactive. */
export async function signInAsPartner(page: Page, persona: PartnerPersona = "planner"): Promise<void> {
  await page.goto(`${HOSTS.partner}/login`);
  await page.getByLabel(/^อีเมล/).fill(PARTNER_EMAILS[persona]);
  await page.getByLabel(/^รหัสผ่าน/).fill(MOCK_PARTNER.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(accountButton(page)).toBeVisible();
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}

/**
 * Navigates and waits until the page is interactive — `<html data-hydrated>`, stamped by
 * `HydrationMark` once React has hydrated — so the next click is not dropped.
 */
export async function gotoHydrated(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}
