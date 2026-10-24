import { readFile } from "node:fs/promises";

import type { Download } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { acceptCookies } from "../helpers/customer";
import { MOCK_OTP } from "../helpers/session";
import { expect, test } from "./fixture";

/**
 * T12 "ดาวน์โหลดไฟล์ไดไลน์ขนาดนี้ไปทำใน Illustrator" — a designer, from the home page (signed out) to
 * the file. Since U2.F2 the free dieline is on every style's page (D-203 / D-271), with the layers
 * D-302 names, so that is the path walked (the designer's export has no Safe layer and no PDF layers,
 * so it does not finish the task). D-271 needs a signed-in customer: the sign-in is counted as a
 * screen and the OTP as a decision (`step-counting.md` rule 8).
 */
test("T12 download the dieline for a size, for Illustrator", async ({ page, journey }) => {
  const j = journey("T12");
  await acceptCookies(page);
  await j.start(HOSTS.customer);
  j.gap("a free dieline needs a signed-in customer (D-203 / D-271), so a first-time designer signs in on the way");

  const header = page.getByRole("banner");
  await j.screen(
    "style library",
    // The header's own link (no menu to open first).
    () => header.getByRole("link", { name: "แบบกล่อง", exact: true }).click(),
    () => expect(page.getByRole("heading", { level: 1, name: "คลังแบบกล่องและบรรจุภัณฑ์" })).toBeVisible(),
  );
  await j.screen(
    "the tuck-end style",
    () => page.getByRole("main").getByRole("link", { name: "กล่องฝาเสียบ (ปรับฝาบน-ล่างได้)" }).first().click(),
    () => expect(page.getByRole("button", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" })).toBeVisible(),
  );
  await page.locator("html[data-hydrated]").waitFor();
  const panel = page.getByRole("region", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" });
  await j.decide("free dieline", () => page.getByRole("button", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" }).click());

  await j.screen(
    "sign in",
    () => panel.getByRole("link", { name: "เข้าสู่ระบบเพื่อดาวน์โหลดฟรี" }).click(),
    () => expect(page.getByLabel("เบอร์มือถือ")).toBeVisible({ timeout: 15_000 }),
  );
  // Rule 8: the sign-in is the screen above and the OTP one decision, wherever it lands.
  await page.getByLabel("เบอร์มือถือ").fill(MOCK_OTP.phone);
  await page.getByRole("button", { name: "ขอรหัส OTP" }).click();
  await j.screen(
    "OTP, back on the style",
    () => page.getByLabel("รหัส OTP").fill(MOCK_OTP.code),
    () =>
      expect(page.getByRole("heading", { level: 1, name: "กล่องฝาเสียบ (ปรับฝาบน-ล่างได้)" })).toBeVisible({
        timeout: 30_000,
      }),
  );
  await page.locator("html[data-hydrated]").waitFor();
  // Back at `#dieline`, the form is open again (U5.8); the form loads on demand, so give it a moment.
  await expect(panel)
    .toBeVisible({ timeout: 10_000 })
    .catch(() => undefined);
  if (!(await panel.isVisible())) {
    j.gap("the download form is closed again after signing in");
    await j.decide("free dieline, again", () => page.getByRole("button", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" }).click());
  }

  await j.decide("size", async () => {
    await panel.getByRole("textbox", { name: "ยาว (มม.)" }).fill("70");
    await panel.getByRole("textbox", { name: "กว้าง (มม.)" }).fill("40");
    await panel.getByRole("textbox", { name: "สูง (มม.)" }).fill("150");
  });
  let file: Download | null = null;
  // PDF is the format offered first; accepting it costs nothing (rule 4).
  await j.decide("download", async () => {
    [file] = await Promise.all([
      page.waitForEvent("download"),
      panel.getByRole("button", { name: "ดาวน์โหลด", exact: true }).click(),
    ]);
  });

  // The file's D-302 layers are getpack-api's output, checked on the real API
  // (`e2e/integration/downloads.spec.ts`); the mock serves a placeholder PDF.
  await j.done(async () => {
    expect(file!.suggestedFilename()).toMatch(/^PK-TE-01-.*-70x40x150\.pdf$/);
    expect(await readFile((await file!.path())!, "latin1")).toMatch(/^%PDF-/);
  });
});
