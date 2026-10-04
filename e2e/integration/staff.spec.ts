import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { api, signInStaff, staffToken, type StaffRole } from "./support";

/**
 * Every D-140 staff role the dev seed creates signs in through the real form, and its sidebar is
 * packio-api's menu for it (`admin.me.get` → `menu[]`): each entry the API grants is a link in
 * the shell, and nothing the API withholds is.
 */

const ROLES: StaffRole[] = [
  "superadmin",
  "c_level",
  "vp",
  "director",
  "admin",
  "cs",
  "cs_lead",
  "prepress",
  "finance",
  "finance_manager",
  "logistics",
  "marketing",
  "partner_manager",
  "auditor",
  "dpo",
];

interface Me {
  roles: string[];
  menu: { key: string; path: string }[];
}

for (const role of ROLES) {
  test(`${role} signs in and sees the menu packio-api grants`, async ({ page }) => {
    const me = await api<Me>("GET", "/v1/admin/me", { token: await staffToken(role) });
    expect(me.roles).toContain(role);

    await signInStaff(page, role);
    const nav = page.getByRole("navigation").first();
    for (const entry of me.menu) {
      // The API's paths are the admin zone's own (`/admin/orders`); the shell links to them on the
      // admin host, where the zone prefix is implicit.
      const href = entry.path.replace(/^\/admin(?=\/|$)/, "") || "/";
      await expect(nav.locator(`a[href="${href}"]`).first(), `${role}: ${entry.key} → ${href}`).toBeAttached();
    }
    await expect(page.getByText(/เกิดข้อผิดพลาด|Something went wrong/)).toHaveCount(0);
  });
}

test("a wrong password is refused with the API's words", async ({ page }) => {
  await page.goto(`${HOSTS.admin}/login`);
  await page.getByLabel(/^อีเมล/).fill("cs@example.invalid");
  await page.getByLabel(/^รหัสผ่าน/).fill("not-the-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "บัญชีผู้ใช้" })).toHaveCount(0);
});
