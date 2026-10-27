import { expect, type Locator, type Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";

/**
 * Credentials the mock API accepts (`mocks/handlers.ts`). Obviously fake, and the mock only
 * runs when the server is started with `API_MOCKS=1`.
 */
export const MOCK_STAFF = { email: "somchai.staff@getpack.invalid", password: "mock-password" };
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
  | "auditor"
  | "dpo";

export function personaEmail(persona: Persona): string {
  return persona === "cs" ? MOCK_STAFF.email : `${persona.replace(/_/g, ".")}.staff@getpack.invalid`;
}

/** Signs in as staff and waits until the admin shell is actually rendering for them. */
export async function signInAsStaff(page: Page, persona: Persona = "cs"): Promise<void> {
  await page.goto(`${HOSTS.admin}/login`);
  await page.getByLabel(/^อีเมล/).fill(personaEmail(persona));
  await page.getByLabel(/^รหัสผ่าน/).fill(MOCK_STAFF.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  // Sign-in and the redirect outlast 5 s when the whole suite runs in parallel.
  await expect(accountButton(page)).toBeVisible({ timeout: 15_000 });
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}

/**
 * An entry of the admin sidebar by its name. Past a dozen entries the sidebar folds its groups
 * and offers a menu search (AdminSidebar); this searches the way a person would, so the entry is
 * shown whichever group it is in. An entry the menu does not hold is still a (count 0) locator.
 */
export async function adminMenuLink(page: Page, name: string): Promise<Locator> {
  const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
  await expect(nav.getByRole("link").first()).toBeVisible();
  const search = nav.getByRole("searchbox", { name: "ค้นหาเมนู" });
  if (await search.count()) await search.fill(name);
  return nav.getByRole("link", { name, exact: true });
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
  // A signed-in user opening /login is sent home; switching factory user starts from no session.
  await page.context().clearCookies();
  await page.goto(`${HOSTS.partner}/login`);
  await page.getByLabel(/^อีเมล/).fill(PARTNER_EMAILS[persona]);
  await page.getByLabel(/^รหัสผ่าน/).fill(MOCK_PARTNER.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  // Sign-in and the redirect outlast 5 s when the whole suite runs in parallel.
  await expect(accountButton(page)).toBeVisible({ timeout: 15_000 });
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}

/**
 * Navigates and waits until the page is interactive — `<html data-hydrated>`, stamped by
 * `HydrationMark` once React has hydrated — so the next click is not dropped.
 */
export async function gotoHydrated(page: Page, url: string): Promise<void> {
  // A navigation the app starts itself (a redirect after signing in) can abort this one; once more.
  await page.goto(url).catch(async (error: Error) => {
    if (!/ERR_ABORTED|interrupted by another navigation/.test(error.message)) throw error;
    await page.waitForLoadState("load");
    await page.goto(url);
  });
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}
