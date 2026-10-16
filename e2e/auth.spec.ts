import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { accountButton, MOCK_OTP, MOCK_PARTNER, MOCK_STAFF, openAccountMenu, signInAsStaff } from "./helpers/session";

/**
 * These run against MSW (`API_MOCKS=1` in the web server's env), so they exercise the whole
 * chain this app owns — proxy, guard, Server Action, cookies, BFF, `/me` — without needing
 * getpack-api. The credentials below are the mock's, defined in `mocks/handlers.ts`.
 */
const STAFF = MOCK_STAFF;
const PARTNER = MOCK_PARTNER;
const OTP = MOCK_OTP;

test.describe("staff sign-in", () => {
  test("an unauthenticated visitor is sent to the login page, and back after signing in", async ({ page }) => {
    await page.goto(`${HOSTS.admin}/`);

    await expect(page).toHaveURL(`${HOSTS.admin}/login`);

    await page.getByLabel("อีเมล").fill(STAFF.email);
    await page.getByLabel(/^รหัสผ่าน/).fill(STAFF.password);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

    await expect(page).toHaveURL(`${HOSTS.admin}/`);
    await openAccountMenu(page);
    await expect(page.getByTestId("actor-name")).toHaveText("สมชาย ตัวอย่าง (ข้อมูลจำลอง)");
    await expect(page.getByTestId("actor-roles")).toContainText("cs");
  });

  test("keeps where the visitor was going and returns them to it", async ({ page }) => {
    await page.goto(`${HOSTS.admin}/orders`);

    await expect(page).toHaveURL(`${HOSTS.admin}/login?returnTo=%2Forders`);
  });

  test("never returns to the login page or an internal route spelling after signing in", async ({ page }) => {
    // UX audit Flow 1, bug #2: a `returnTo` the admin host would rewrite twice ended on a 404.
    for (const returnTo of ["/login", "/admin/orders"]) {
      await page.context().clearCookies();
      await page.goto(`${HOSTS.admin}/login?returnTo=${encodeURIComponent(returnTo)}`);
      await page.getByLabel("อีเมล").fill(STAFF.email);
      await page.getByLabel(/^รหัสผ่าน/).fill(STAFF.password);
      await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
      await expect(page).toHaveURL(`${HOSTS.admin}/`);
      await expect(accountButton(page)).toBeVisible();
    }
  });

  test("refuses the wrong password without saying which half was wrong", async ({ page }) => {
    await page.goto(`${HOSTS.admin}/login`);
    await page.getByLabel("อีเมล").fill(STAFF.email);
    await page.getByLabel(/^รหัสผ่าน/).fill("not-the-password");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

    await expect(page.getByRole("status")).toContainText("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    await expect(page).toHaveURL(/\/login/);
  });

  test("stores the session in cookies JavaScript cannot read", async ({ page, context }) => {
    await signInAsStaff(page);

    const cookies = await context.cookies();
    const access = cookies.find((cookie) => cookie.name.endsWith("pk_at"));

    expect(access).toBeDefined();
    expect(access?.httpOnly).toBe(true);
    expect(access?.sameSite).toBe("Lax");
    // Host-only: no leading-dot domain, so the cookie cannot travel to another zone's host.
    expect(access?.domain).not.toMatch(/^\./);

    // The whole point of the BFF: the token exists, and the page cannot see it.
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain("pk_at");
    expect(visible).not.toContain("pk_rt");
  });

  test("signing out ends the session and asks for it again", async ({ page }) => {
    await signInAsStaff(page);

    await openAccountMenu(page);
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    // Longer than the default: this is a Server Action that calls the API, clears three
    // cookies and then redirects, and with the suite running four workers against one dev
    // server that round trip can outlast 5 s. The assertion is about the outcome, not speed.
    await expect(page).toHaveURL(`${HOSTS.admin}/login`, { timeout: 15_000 });

    await page.goto(`${HOSTS.admin}/`);
    await expect(page).toHaveURL(`${HOSTS.admin}/login`);
  });
});

test.describe("zone isolation", () => {
  test("a customer session never authenticates on the admin host", async ({ page, context }) => {
    // Sign in as a customer on the storefront host.
    await page.goto(`${HOSTS.customer}/sign-in`);
    await page.getByLabel("เบอร์มือถือ").fill(OTP.phone);
    await page.getByRole("button", { name: "ขอรหัส OTP" }).click();
    await page.getByLabel("รหัส OTP").fill(OTP.code);
    await expect(page).toHaveURL(`${HOSTS.customer}/`);

    const customerCookies = await context.cookies();
    expect(customerCookies.some((cookie) => cookie.name.endsWith("pk_at"))).toBe(true);

    // The admin host is a different origin, so the cookie is not even sent — and if one were
    // copied across by hand, the API rejects a token whose audience is not `staff`.
    await page.goto(`${HOSTS.admin}/`);
    await expect(page).toHaveURL(`${HOSTS.admin}/login`);
    await expect(accountButton(page)).toHaveCount(0);
  });

  test("a staff session does not sign the customer in", async ({ page }) => {
    await signInAsStaff(page);

    await page.goto(`${HOSTS.customer}/sign-in`);
    await expect(page.getByLabel("เบอร์มือถือ")).toBeVisible();
  });
});

test.describe("customer OTP sign-in", () => {
  test("sends a code, accepts it, and signs in", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/sign-in`);

    await page.getByLabel("เบอร์มือถือ").fill(OTP.phone);
    await page.getByRole("button", { name: "ขอรหัส OTP" }).click();

    // The hint names the number the code went to, which is what someone needs in order to
    // notice they typed the wrong one.
    await expect(page.getByText("081 234 5678", { exact: false })).toBeVisible();

    await page.getByLabel("รหัส OTP").fill(OTP.code);

    await expect(page).toHaveURL(`${HOSTS.customer}/`);
  });

  test("accepts a code pasted with the text around it (WCAG 2.2 §3.3.8)", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/sign-in`);
    await page.getByLabel("เบอร์มือถือ").fill(OTP.phone);
    await page.getByRole("button", { name: "ขอรหัส OTP" }).click();

    const field = page.getByLabel("รหัส OTP");
    await field.fill("รหัส OTP ของคุณคือ 000000");

    await expect(field).toHaveValue(OTP.code);
  });

  test("refuses a wrong code and keeps the form usable", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/sign-in`);
    await page.getByLabel("เบอร์มือถือ").fill(OTP.phone);
    await page.getByRole("button", { name: "ขอรหัส OTP" }).click();

    await page.getByLabel("รหัส OTP").fill("999999");

    await expect(page.getByRole("status")).toContainText("รหัส OTP ไม่ถูกต้อง");
    // A wrong code is a 422 `auth.otp_invalid`; it was once reported as a bad phone (UX audit bug #1).
    await expect(page.getByRole("status")).not.toContainText("เบอร์มือถือ");
    // design-system.md §4: never clear a form on error.
    await expect(page.getByLabel("รหัส OTP")).toHaveValue("999999");
  });
});

test.describe("the storefront header's sign-in link", () => {
  test("goes straight to /sign-in and brings the customer back to the page they were on", async ({ page }) => {
    // UX audit Flow 1, bug #4: no detour through /account's redirect.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${HOSTS.customer}/products`);
    await expect(page.getByRole("banner").getByRole("link", { name: "เข้าสู่ระบบ" })).toHaveAttribute(
      "href",
      "/sign-in?returnTo=%2Fproducts",
    );
  });
});

test.describe("partner sign-in", () => {
  test("guards the zone and signs a factory user in", async ({ page }) => {
    await page.goto(`${HOSTS.partner}/`);
    await expect(page).toHaveURL(`${HOSTS.partner}/login`);

    await page.getByLabel(/^อีเมล/).fill(PARTNER.email);
    // Anchored rather than exact: `Field` appends the required marker and its screen-reader
    // word to the label, and "รหัส PIN ของเครื่อง" is the other field a loose match would hit.
    await page.getByLabel(/^รหัสผ่าน/).fill(PARTNER.password);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

    await expect(page).toHaveURL(`${HOSTS.partner}/`);
    // The roles held at the factory, by name (`FactoryAccessDto` gives the keys).
    await openAccountMenu(page);
    await expect(page.getByTestId("actor-factories")).toContainText("ผู้วางแผนการผลิต");
  });

  test("signs in with a device PIN instead of a password, on a shared device", async ({ page }) => {
    // `PartnerLoginDto` requires only the email: a shop-floor device enrolled with a PIN is
    // signed in without anyone typing a password on a shared screen.
    await page.goto(`${HOSTS.partner}/login`);

    await page.getByLabel(/^อีเมล/).fill(PARTNER.email);
    await page.getByLabel("รหัส PIN ของเครื่อง").fill(PARTNER.pin);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

    await expect(page).toHaveURL(`${HOSTS.partner}/`);
    await openAccountMenu(page);
    await expect(page.getByTestId("actor-name")).toBeVisible();
  });
});
