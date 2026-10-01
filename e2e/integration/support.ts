import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { expect, type BrowserContext, type Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";

/**
 * The real-backend run's accounts and calls (U-F0.5, `docs/integration.md`).
 *
 * packio-api's dev seed (`prisma/seed/dev-seed.ts`) has one staff user per D-140 role —
 * `<role-with-dashes>@example.invalid` with `DEV_SEED_PASSWORD` — one customer and the fake
 * factory F9001 with its price lists. What it lacks the setup project creates through the API:
 * F9001's users (the owner by a Partner Manager, the other roles by the owner) and customers,
 * who sign in with the fake Firebase verifier's readable tokens (`INTEGRATIONS_MODE=fake`).
 * Everything is obviously fake.
 */

export const API = process.env.INTEGRATION_API_URL ?? "http://localhost:3400";
export const SEED_PASSWORD = process.env.IT_SEED_PASSWORD ?? "packio-it-password";
/** The dev seed's factory (`prisma/seed/dev-folding.ts`). */
export const DEV_FACTORY_CODE = "F9001";

export type StaffRole =
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

export type FactoryRole =
  "factory_owner" | "factory_planner" | "factory_operator" | "factory_qc" | "factory_shipping" | "factory_accountant";

export const FACTORY_ROLES: readonly FactoryRole[] = [
  "factory_owner",
  "factory_planner",
  "factory_operator",
  "factory_qc",
  "factory_shipping",
  "factory_accountant",
];

export const staffEmail = (role: StaffRole) => `${role.replace(/_/g, "-")}@example.invalid`;

/* -------------------------------------------------------------------------------- API calls */

export class ApiCallError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    what: string,
  ) {
    super(`${what} → ${status}: ${body.slice(0, 400)}`);
  }
}

/** One call to packio-api, for setup only — the specs themselves go through the app. */
export async function api<T>(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; idempotent?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json", "accept-language": "th" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.idempotent) headers["idempotency-key"] = crypto.randomUUID();
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  if (!response.ok) throw new ApiCallError(response.status, text, `${method} ${path}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

/** `TokenPairDto`: every sign-in answers this. */
interface Tokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export async function staffToken(role: StaffRole): Promise<string> {
  const tokens = await api<Tokens>("POST", "/v1/auth/staff/login", {
    body: { email: staffEmail(role), password: SEED_PASSWORD },
  });
  return tokens.accessToken;
}

export async function partnerToken(account: Account): Promise<string> {
  const tokens = await api<Tokens>("POST", "/v1/auth/partner/login", {
    body: { email: account.email, password: account.password },
  });
  return tokens.accessToken;
}

/* -------------------------------------------------------------------------------- state */

export interface Account {
  email: string;
  password: string;
  displayName: string;
}

export interface IntegrationState {
  factoryId: string;
  factory: Record<FactoryRole, Account>;
}

const STATE = join(process.cwd(), "e2e", "integration", ".state", "accounts.json");

export function writeState(state: IntegrationState): void {
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify(state, null, 2));
}

export function readState(): IntegrationState {
  return JSON.parse(readFileSync(STATE, "utf8")) as IntegrationState;
}

/* -------------------------------------------------------------------------------- sign-in */

/** Signs in as a seeded staff role through the real login form. */
export async function signInStaff(page: Page, role: StaffRole): Promise<void> {
  await page.goto(`${HOSTS.admin}/login`);
  await page.getByLabel(/^อีเมล/).fill(staffEmail(role));
  await page.getByLabel(/^รหัสผ่าน/).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("button", { name: "บัญชีผู้ใช้" })).toBeVisible({ timeout: 30_000 });
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}

/** Signs in as one of F9001's users (created by the setup project) through the real login form. */
export async function signInFactory(page: Page, role: FactoryRole): Promise<void> {
  const account = readState().factory[role];
  await page.goto(`${HOSTS.partner}/login`);
  await page.getByLabel(/^อีเมล/).fill(account.email);
  await page.getByLabel(/^รหัสผ่าน/).fill(account.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("button", { name: "บัญชีผู้ใช้" })).toBeVisible({ timeout: 30_000 });
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}

/**
 * Signs a customer in: the fake Firebase verifier takes `fake-firebase.google.<uid>.<email>`, and
 * the tokens it answers are planted as the customer zone's own session cookies. The storefront's
 * sign-in button opens Google's SDK, which a test cannot drive; everything after the token — the
 * cookies, the BFF, the API — is the real path. A new `uid` is a new customer.
 */
export async function signInCustomer(context: BrowserContext, uid: string): Promise<{ email: string }> {
  const email = `${uid}@customers.example.invalid`;
  const tokens = await api<Tokens>("POST", "/v1/auth/customer/firebase", {
    body: { idToken: `fake-firebase.google.${uid}.${encodeURIComponent(email)}` },
  });
  const url = new URL(HOSTS.customer);
  const seconds = (at: string) => Math.floor(Date.parse(at) / 1000);
  const expires = seconds(tokens.accessTokenExpiresAt);
  const cookie = (name: string, value: string, until: number) => ({
    name,
    value,
    domain: url.hostname,
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
    expires: until,
  });
  // Plain http, so the cookies drop their `__Host-` prefix (`src/lib/auth/cookies.ts`).
  await context.addCookies([
    cookie("pk_at", tokens.accessToken, expires),
    cookie("pk_ate", String(expires), expires),
    cookie("pk_rt", tokens.refreshToken, seconds(tokens.refreshTokenExpiresAt)),
  ]);
  return { email };
}

/** A name unique to this run, so the specs can be repeated on the same database. */
export function runId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
