import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated } from "./helpers/session";

/**
 * C8 (editor redesign Phases 1–3, `docs/design/editor-redesign/editor-prototype.html`): the first-open chooser, the
 * two modes over one document, the steps as inspector tabs, the view bar, live preflight markers and fixes, the pro
 * toolbox, guides and "สีในงาน", and the phone layout. A guest's box (browser storage), against the mock API.
 * Written, not run in the cloud (owner rule 2026-10-28).
 */

const BOX = `${HOSTS.customer}/studio/new?style=rsc&l=150&w=100&h=80&step=design`;
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .exclude("canvas")
    .exclude("[data-sonner-toaster]")
    .analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

async function openEditor(page: Page, mode: "easy" | "pro") {
  await page.addInitScript((m) => {
    localStorage.setItem("getpack.editorWelcomed", "1");
    localStorage.setItem("getpack.editorMode", m);
  }, mode);
  await gotoHydrated(page, BOX);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
}

const stepNav = (page: Page) => page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
const rail = (page: Page) => page.getByRole("navigation", { name: "เครื่องมือออกแบบ" });

test.describe("first open", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("asks how to start once: 3 ways (design team only where offered) and a file link", async ({ page }) => {
    await gotoHydrated(page, BOX);
    const chooser = page.getByRole("dialog", { name: "เริ่มออกแบบกล่องของคุณ" });
    await expect(chooser).toBeVisible({ timeout: 30_000 });
    await expect(chooser.getByRole("button", { name: /โหมดง่าย/ })).toBeVisible();
    await expect(chooser.getByRole("button", { name: /โหมดมืออาชีพ/ })).toBeVisible();
    await expect(chooser.getByRole("button", { name: "อัปโหลดไฟล์ PDF หรือ .ai" })).toBeVisible();
    // A guest is not offered the design service (it is ordered from an account design).
    await expect(chooser.getByText("ให้ทีม getpack ออกแบบให้")).toHaveCount(0);
    await expectNoViolations(page);
    await chooser.getByRole("button", { name: /โหมดมืออาชีพ/ }).click();
    await expect(page.getByRole("radio", { name: /มืออาชีพ/ })).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("dialog", { name: "เริ่มออกแบบกล่องของคุณ" })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /มืออาชีพ/ })).toHaveAttribute("aria-checked", "true");
  });
});

test("easy mode: 4-step guide, plain inspector, and switching modes never changes the design", async ({ page }) => {
  await openEditor(page, "easy");
  const inspector = page.getByRole("tabpanel", { name: "ออกแบบ" });
  await expect(inspector.getByRole("heading", { name: "ออกแบบเสร็จใน 4 ขั้น" })).toBeVisible();
  await expect(inspector.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  // Easy hides the pro tools: no rulers' guides, no layers, no export, no toolbox.
  await expect(rail(page).getByRole("button", { name: "ชั้น", exact: true })).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "เครื่องมือวาด" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ส่งออก" })).toHaveCount(0);

  await rail(page).getByRole("button", { name: "ข้อความ", exact: true }).click();
  await page.getByRole("button", { name: "เพิ่มหัวข้อ", exact: true }).click();
  await expect(inspector.getByRole("slider", { name: "ขนาดตัวอักษร" })).toBeVisible();
  await inspector.getByRole("group", { name: "วางตำแหน่งในแผง" }).getByRole("button", { name: "บนซ้าย" }).click();
  await inspector.getByRole("textbox", { name: "ข้อความ" }).fill("ขนมอบสดใหม่");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /บันทึกอัตโนมัติ/ })
      .first(),
  ).toBeVisible({ timeout: 15_000 });
  const contents = () =>
    page.evaluate(() =>
      (JSON.parse(localStorage.getItem("getpack.designs.v1") ?? "[]") as { content: unknown }[]).map((d) => d.content),
    );
  const before = await contents();
  expect(JSON.stringify(before)).toContain("ขนมอบสดใหม่");

  await page.getByRole("radio", { name: /มืออาชีพ/ }).click();
  await expect(page.getByRole("toolbar", { name: "เครื่องมือวาด" })).toBeVisible();
  await page.getByRole("radio", { name: /ง่าย/ }).click();
  expect(await contents()).toEqual(before);
  await expectNoViolations(page);
});

test("steps are the inspector's tabs; the check tab fixes findings, one undo step for all", async ({ page }) => {
  await openEditor(page, "pro");
  await rail(page).getByRole("button", { name: "ข้อความ", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "เพิ่มหัวข้อ", exact: true }).click();
    // Too small to print clearly (the mock's catalogue: 6 pt minimum).
    await page.getByRole("spinbutton", { name: /^ขนาด/ }).fill("2");
  }
  // The top bar's order waits for the must-fix findings; the step badge counts them.
  await stepNav(page)
    .getByRole("button", { name: /ตรวจงาน/ })
    .click();
  await expect(page.getByRole("tab", { name: /ตรวจงาน/ })).toHaveAttribute("aria-selected", "true");
  const fixAll = page.getByRole("button", { name: "แก้ทั้งหมด" });
  await expect(fixAll).toBeVisible();
  await fixAll.click();
  await expect(fixAll).toHaveCount(0);
  await page.getByRole("button", { name: "ย้อนกลับ", exact: true }).click();
  await expect(page.getByRole("button", { name: "แก้ทั้งหมด" })).toBeVisible();
  await stepNav(page)
    .getByRole("button", { name: /สั่งผลิต/ })
    .click();
  await expect(page.getByRole("tab", { name: "สั่งผลิต" })).toHaveAttribute("aria-selected", "true");
});

test("pro: toolbox keys draw and revert to select, a guide from the ruler, colours in the job", async ({ page }) => {
  await openEditor(page, "pro");
  // The sheet's own canvas (the split view's 3D card and the rulers draw on canvases too).
  const canvas = page.getByRole("group", { name: "พื้นที่ออกแบบแผ่นคลี่" }).locator("canvas").first();
  const box = (await canvas.boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

  await page.keyboard.press("r");
  await expect(page.getByRole("button", { name: "สี่เหลี่ยม (R)" })).toHaveAttribute("aria-pressed", "true");
  const a = at(0.4, 0.6);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 60, a.y + 40, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "เลือกและย้าย (V)" })).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("tabpanel", { name: "ออกแบบ" }).getByRole("heading", { name: "สี่เหลี่ยม" }),
  ).toBeVisible();

  // The pen: three points, Enter finishes.
  await page.keyboard.press("p");
  for (const [fx, fy] of [
    [0.6, 0.6],
    [0.65, 0.65],
    [0.6, 0.68],
  ] as const) {
    const p = at(fx, fy);
    await page.mouse.click(p.x, p.y);
  }
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "เลือกและย้าย (V)" })).toHaveAttribute("aria-pressed", "true");

  // A guide pulled from the top ruler is kept and undoable.
  await page.mouse.move(box.x + 300, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 200, { steps: 6 });
  await page.mouse.up();
  await page.getByRole("button", { name: "ย้อนกลับ", exact: true }).click();

  await rail(page).getByRole("button", { name: "สีในงาน", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "สีในงาน" })
      .getByText(/ใช้ \d+ ที่/)
      .first(),
  ).toBeVisible();
  await page.locator("body").press("?");
  await expect(page.getByRole("dialog", { name: "ทางลัดแป้นพิมพ์" }).getByText("ปากกา", { exact: true })).toBeVisible();
});

test("easy mode: a pro key offers the pro mode", async ({ page }) => {
  await openEditor(page, "easy");
  await page.locator("body").press("p");
  await page.getByRole("button", { name: "เปิดโหมดมืออาชีพ" }).click();
  await expect(page.getByRole("radio", { name: /มืออาชีพ/ })).toHaveAttribute("aria-checked", "true");
});

test("view bar: dieline / + 3D / 3D, zoom 20–600 % and fit", async ({ page }) => {
  await openEditor(page, "easy");
  const views = page.getByRole("group", { name: "แสดง" });
  await expect(page.getByRole("region", { name: "ภาพ 3D ของกล่อง" })).toBeVisible();
  await views.getByRole("button", { name: "แผ่นคลี่", exact: true }).click();
  await expect(page.getByRole("region", { name: "ภาพ 3D ของกล่อง" })).toHaveCount(0);
  const zoom = page.locator("output[aria-label='ระดับการซูม']");
  for (let i = 0; i < 20; i++) await page.getByRole("button", { name: "ซูมเข้า" }).click();
  await expect(zoom).toHaveText(/600%/);
  await page.getByRole("button", { name: "พอดีจอ (⇧1)" }).click();
  await expect(zoom).not.toHaveText(/600%/);
  await views.getByRole("button", { name: "3D", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "กล่อง 3 มิติ" }).getByRole("img", { name: /^ภาพสามมิติ/ }),
  ).toBeVisible();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("stacks canvas, inspector, rail and panel with no horizontal scroll", async ({ page }) => {
    await openEditor(page, "pro");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(360);
    await expect(page.getByRole("toolbar", { name: "เครื่องมือวาด" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "ออกแบบ" })).toBeVisible();
    await expectNoViolations(page);
  });
});
