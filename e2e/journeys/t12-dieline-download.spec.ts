import { readFile } from "node:fs/promises";

import type { Download } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { acceptCookies } from "../helpers/customer";
import { expect, test } from "./fixture";

/** T12 "ดาวน์โหลดไฟล์ไดไลน์ขนาดนี้ไปทำใน Illustrator" — a designer, from the home page to the file. */
test("T12 download the dieline for a size, for Illustrator", async ({ page, journey }) => {
  const j = journey("T12");
  await acceptCookies(page);
  await j.start(HOSTS.customer);
  j.gap("no dieline download without opening the designer: /templates is not built (U3.B5 / U5.4)");

  const dialog = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await j.screen(
    "studio ① start",
    () => page.getByRole("link", { name: "เริ่มออกแบบ" }).first().click(),
    () => expect(page.getByRole("button", { name: "เลือกแบบและขนาดกล่อง" })).toBeVisible(),
  );
  await j.screen(
    "box setup",
    () => page.getByRole("button", { name: "เลือกแบบและขนาดกล่อง" }).click(),
    () => expect(dialog).toBeVisible(),
  );
  await j.decide("size", async () => {
    await dialog.getByRole("radio", { name: "กำหนดเองจากขนาดสินค้า" }).click();
    await dialog.getByRole("spinbutton", { name: "ยาว (L)" }).fill("200");
    await dialog.getByRole("spinbutton", { name: "กว้าง (W)" }).fill("150");
    await dialog.getByRole("spinbutton", { name: "สูง (H)" }).fill("80");
  });
  await j.screen(
    "designer",
    () => dialog.getByRole("button", { name: "เริ่มออกแบบ" }).click(),
    () => expect(page.locator("canvas").first()).toBeVisible(),
  );
  await j.screen(
    "export menu",
    () => page.getByRole("button", { name: "ส่งออก" }).click(),
    () => expect(page.getByRole("menuitem", { name: /PDF ไดคัท/ })).toBeVisible(),
  );
  let file: Download | null = null;
  await j.decide("dieline PDF", async () => {
    [file] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: /PDF ไดคัท/ }).click(),
    ]);
  });

  await j.done(async () => {
    expect(file!.suggestedFilename()).toMatch(/-dieline\.pdf$/);
    const pdf = await readFile((await file!.path())!, "latin1");
    expect(pdf).toContain("/CutContour");
    // Illustrator shows layers from optional-content groups; spot colours alone are swatches.
    for (const name of ["OCG", "Bleed", "Safe"]) {
      if (!pdf.includes(name))
        j.gap(`the dieline PDF has no ${name === "OCG" ? "PDF layers (OCGs)" : `${name} layer`} (U5.4)`);
    }
  });
});
