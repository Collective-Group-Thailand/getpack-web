import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { FACTORY_ROLES, readState, signInFactory } from "./support";

/**
 * F9001's users — one per D-140 factory role, provisioned by the setup project — sign in to the
 * partner zone, and each screen they reach renders from packio-api rather than an error.
 */

for (const role of FACTORY_ROLES) {
  test(`${role} signs in to the partner zone`, async ({ page }) => {
    await signInFactory(page, role);
    await expect(page.getByText(/เกิดข้อผิดพลาด|Something went wrong/)).toHaveCount(0);
  });
}

test("the planner's floor reads today, the jobs and the capacity calendar", async ({ page }) => {
  await signInFactory(page, "factory_planner");
  for (const path of ["/", "/jobs", "/capacity"]) {
    await page.goto(`${HOSTS.partner}${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/เกิดข้อผิดพลาด|Something went wrong|โหลดข้อมูลไม่สำเร็จ/)).toHaveCount(0);
  }
});

test("the owner sees the factory's users the setup created", async ({ page }) => {
  await signInFactory(page, "factory_owner");
  await page.goto(`${HOSTS.partner}/settings`);
  const { factory } = readState();
  for (const role of ["factory_planner", "factory_qc", "factory_accountant"] as const) {
    await expect(page.getByText(factory[role].email).first()).toBeVisible();
  }
});

test("the accountant reads billing and payouts; the operator is kept out", async ({ browser }) => {
  const accountant = await (await browser.newContext()).newPage();
  await signInFactory(accountant, "factory_accountant");
  for (const path of ["/billing", "/payouts"]) {
    await accountant.goto(`${HOSTS.partner}${path}`);
    await expect(accountant.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(accountant.getByText(/เกิดข้อผิดพลาด|Something went wrong|โหลดข้อมูลไม่สำเร็จ/)).toHaveCount(0);
  }

  const operator = await (await browser.newContext()).newPage();
  await signInFactory(operator, "factory_operator");
  await operator.goto(`${HOSTS.partner}/billing`);
  await expect(operator.getByText(/ไม่มีสิทธิ์|ไม่พบหน้า/).first()).toBeVisible();
});
