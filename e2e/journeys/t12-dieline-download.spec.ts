import { readFile } from "node:fs/promises";

import type { Download } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { acceptCookies } from "../helpers/customer";
import { expect, test } from "./fixture";

/**
 * T12 "ดาวน์โหลดไฟล์ไดไลน์ขนาดนี้ไปทำใน Illustrator" — a designer, from the home page (signed out) to
 * the file. Since U2.F2 the free dieline is on every style's page (D-203 / D-271), with the layers
 * D-302 names, so that is the path walked (the designer's export has no Safe layer and no PDF layers,
 * so it does not finish the task). Since D-471 the first download needs no sign-in (the browser's
 * device cookie counts it); from the second a sign-in sheet opens, which this first-time walk never meets.
 */
test("T12 download the dieline for a size, for Illustrator", async ({ page, journey }) => {
  const j = journey("T12");
  await acceptCookies(page);
  await j.start(HOSTS.customer);

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
  await expect(panel).toBeVisible({ timeout: 10_000 });

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
