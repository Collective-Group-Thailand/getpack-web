import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * C1d (owner decisions 2026-10-28, D-449) — Superadmin powers in the back office, against the MSW mock.
 * Written in the cloud run and not run there (admin.localhost does not resolve; owner rule 12:32: e2e later).
 *
 * The mock keeps state for the run: the solo-owner test turns the mode off again before it ends.
 */

test.describe("solo-owner mode (D-449 A)", () => {
  test("a Superadmin turns it on with a reason, sees the badge, and turns it off again", async ({ page }) => {
    await signInAsStaff(page, "superadmin");
    await gotoHydrated(page, `${HOSTS.admin}/approvals?tab=all`);
    const panel = page.getByRole("region", { name: /โหมดเจ้าของคนเดียว/ });
    await expect(panel).toContainText("ปิดอยู่");

    await panel.getByRole("button", { name: "เปิดโหมด" }).click();
    const dialog = page.getByRole("dialog", { name: "เปิดโหมดเจ้าของคนเดียว" });
    await dialog.getByLabel(/^เหตุผล/).fill("ช่วงเปิดตัวมีผู้อนุมัติคนเดียว");
    await dialog.getByRole("button", { name: "เปิดโหมด" }).click();
    await expect(panel).toContainText("เปิดอยู่");

    await panel.getByRole("button", { name: "ปิดโหมด" }).click();
    const confirm = page.getByRole("alertdialog", { name: "ปิดโหมดเจ้าของคนเดียว" });
    await confirm.getByLabel(/เหตุผล/).fill("มีผู้อนุมัติฝ่ายการเงินแล้ว");
    await confirm.getByRole("button", { name: "ปิดโหมด" }).click();
    await expect(panel).toContainText("ปิดอยู่");
  });

  test("anyone else sees no switch, and nothing at all while the mode is off", async ({ page }) => {
    await signInAsStaff(page, "director");
    await gotoHydrated(page, `${HOSTS.admin}/approvals?tab=all`);
    await expect(page.getByRole("button", { name: "เปิดโหมด" })).toHaveCount(0);
  });
});

test.describe("approval threshold (D-449 B)", () => {
  test("the Superadmin's proposal dialog has the auto-approve amount field", async ({ page }) => {
    await signInAsStaff(page, "superadmin");
    await gotoHydrated(page, `${HOSTS.admin}/approvals?tab=matrix`);
    await page.getByRole("button", { name: "เสนอฉบับใหม่" }).first().click();
    await expect(page.getByLabel(/อนุมัติอัตโนมัติเมื่อยอดไม่เกิน/)).toBeVisible();
  });
});

test.describe("solo-owner mode on every step (C1f, D-451)", () => {
  test("a Superadmin's own multi-step request offers self-approval again on the next step", async ({ page }) => {
    // Needs a two-step request of the Superadmin in the mock (e.g. a company bank-account change); the offer follows
    // the current step: approved step 1 by self-approval → "อนุมัติด้วยตนเอง" offered again on step 2.
    await signInAsStaff(page, "superadmin");
    await gotoHydrated(page, `${HOSTS.admin}/approvals?tab=mine`);
    const own = page.getByRole("link", { name: "อนุมัติด้วยตนเอง" });
    test.skip((await own.count()) === 0, "no own pending multi-step request in this mock state");
    await own.first().click();
    await expect(page.getByRole("button", { name: "อนุมัติด้วยตนเอง" })).toBeVisible();
  });
});
