import { expect, test, type Page } from "@playwright/test";

import { addHeading, openRail } from "./helpers/designer";

/**
 * F4 Part D end to end: the editor's tools as a customer uses them — the left rail's elements and
 * codes, layers and locking, undo, face focus with its way back, the live print checks, the 3D
 * preview and the shortcuts overlay. A guest's design (browser storage), so it shares no state.
 */

async function newDesign(page: Page) {
  await page.goto("/studio/new?step=box");
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /เลือกแบบกล่องแล้วออกแบบ/ }).click();
  const dialog = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await dialog.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("canvas").first()).toBeVisible();
}

test("adds a QR code, finds it in layers, locks it, and undoes", async ({ page }) => {
  await newDesign(page);

  await openRail(page, "องค์ประกอบ");
  await page.getByRole("textbox", { name: "ลิงก์หรือข้อความ" }).fill("https://getpack.example/p/123");
  await page.getByRole("button", { name: "เพิ่มโค้ด" }).click();
  await expect(
    page.getByRole("tabpanel", { name: "คุณสมบัติ" }).getByRole("heading", { name: "คิวอาร์โค้ด" }),
  ).toBeVisible();

  await openRail(page, "ชั้น");
  // The layers are an accessible tree (U4.3): the outside, then its element.
  const layers = page.getByRole("tree", { name: "ชั้นขององค์ประกอบ บนสุดก่อน" });
  await expect(layers.getByRole("treeitem")).toHaveCount(2);
  await layers.getByRole("treeitem", { level: 2 }).click();
  await page.getByRole("button", { name: /^ล็อก / }).click();
  await expect(page.getByText("ล็อกอยู่ — ปลดล็อกเพื่อย้ายหรือแก้ไข")).toBeVisible();

  // Undo the lock, then the code itself.
  await page.getByRole("button", { name: "ย้อนกลับ", exact: true }).click();
  await page.getByRole("button", { name: "ย้อนกลับ", exact: true }).click();
  await expect(page.getByText("ยังไม่มีองค์ประกอบ")).toBeVisible();
});

test("focuses a face upright and leaves it with Escape", async ({ page }) => {
  await newDesign(page);

  await openRail(page, "กล่อง");
  await page
    .getByRole("region", { name: "กล่อง", exact: true })
    .getByRole("button", { name: "ด้านหน้า", exact: true })
    .click();
  await expect(page.getByRole("status").filter({ hasText: "กำลังแก้: ด้านหน้า" })).toBeVisible();

  // A heading added now lands on the focused face.
  await addHeading(page);
  await page.keyboard.press("Escape"); // clears the selection first…
  await expect(page.getByRole("status").filter({ hasText: "กำลังแก้: ด้านหน้า" })).toBeVisible();
  await page.keyboard.press("Escape"); // …then leaves the face.
  await expect(page.getByRole("status").filter({ hasText: "กำลังแก้" })).toHaveCount(0);
});

test("flags small text in the checks and selects it from there", async ({ page }) => {
  await newDesign(page);
  await addHeading(page);

  await page.getByRole("spinbutton", { name: /^ขนาด/ }).fill("1.5");
  await expect(page.getByText("ตัวอักษรเล็กกว่า 6pt อาจพิมพ์ไม่ชัด")).toBeVisible();

  await page.getByRole("button", { name: /ควรตรวจ \d+ รายการ/ }).click();
  const issue = page.getByRole("button", { name: /ตัวอักษร [\d.]+ pt เล็กกว่า 6 pt/ });
  await expect(issue).toBeVisible();
  await page.keyboard.press("Escape");
  await issue.click();
  await expect(page.getByRole("tab", { name: "คุณสมบัติ" })).toHaveAttribute("aria-selected", "true");
});

test("shows the box in 3D with the fold slider, and lists the shortcuts", async ({ page }) => {
  await newDesign(page);

  // The studio's stage: 3D on its own, then beside the sheet (U4.3).
  await page.getByRole("radio", { name: "3 มิติ" }).click();
  await expect(page.getByRole("img", { name: /^ภาพสามมิติ/ })).toBeVisible();
  await expect(page.getByRole("slider", { name: "การพับกล่อง" })).toBeVisible();
  await page.getByRole("button", { name: "หมุนไปทางซ้าย" }).click();

  await page.locator("body").press("?");
  await expect(page.getByRole("dialog", { name: "ทางลัดแป้นพิมพ์" })).toBeVisible();
});
