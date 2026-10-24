import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInAsPartner, signInAsStaff } from "./helpers/session";

/**
 * The a11y gate that needs a real browser (design-system.md §6).
 *
 * The per-component suites in Vitest run axe in jsdom, which has no layout and no colour, so
 * three checks can only happen here: **contrast** against real pixels, **landmarks** on a whole
 * page, and **focus** behaviour the browser owns — roving selection and returning focus to a
 * trigger when a dialog closes.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
}

function report(violations: Awaited<ReturnType<typeof scan>>["violations"]) {
  return violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`)
    .join("\n\n");
}

test.describe("axe, in a real browser", () => {
  test("the home page is clean", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const { violations } = await scan(page);
    expect(violations, report(violations)).toEqual([]);
  });

  test("My designs is clean, empty and populated", async ({ page }) => {
    await page.goto("/account/designs");
    await expect(page.getByRole("heading", { name: "แบบของฉัน" })).toBeVisible();

    const { violations } = await scan(page);
    expect(violations, report(violations)).toEqual([]);
  });

  test("the designer shell is clean, including the box setup dialog", async ({ page }) => {
    await page.goto("/studio/new");
    await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /เลือกแบบกล่องแล้วออกแบบ/ }).click();

    // ① offers the setup dialog; this scan covers the studio frame and the dialog at once.
    const dialog = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
    await expect(dialog).toBeVisible();

    const withDialog = await scan(page);
    expect(withDialog.violations, report(withDialog.violations)).toEqual([]);

    await dialog.getByRole("button", { name: "เริ่มออกแบบ" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();

    const shell = await scan(page);
    expect(shell.violations, report(shell.violations)).toEqual([]);
  });

  test("every designer panel is clean: each rail tool, a selection, the checks and the 3D view", async ({ page }) => {
    await page.goto("/studio/new");
    await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /เลือกแบบกล่องแล้วออกแบบ/ }).click();
    const dialog = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
    await dialog.getByRole("button", { name: "เริ่มออกแบบ" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();

    const rail = page.getByRole("navigation", { name: "เครื่องมือออกแบบ" });
    for (const tool of ["กล่อง", "แม่แบบ", "องค์ประกอบ", "ข้อความ", "อัปโหลด", "แบรนด์", "พื้นหลัง", "ชั้น"]) {
      const button = rail.getByRole("button", { name: tool, exact: true });
      if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
      await expect(page.getByRole("region", { name: tool, exact: true })).toBeVisible();
      const { violations } = await scan(page);
      expect(violations, `${tool}\n${report(violations)}`).toEqual([]);
    }

    await rail.getByRole("button", { name: "ข้อความ", exact: true }).click();
    await page.getByRole("button", { name: "เพิ่มหัวข้อ", exact: true }).click();
    await expect(
      page.getByRole("tabpanel", { name: "คุณสมบัติ" }).getByRole("heading", { name: "ข้อความ", exact: true }),
    ).toBeVisible();
    const selected = await scan(page);
    expect(selected.violations, report(selected.violations)).toEqual([]);

    await page.getByRole("tab", { name: /^ตรวจงาน/ }).click();
    const checks = await scan(page);
    expect(checks.violations, report(checks.violations)).toEqual([]);

    // The studio shows the model beside the sheet (U4.3).
    await expect(page.getByRole("img", { name: /^ภาพสามมิติ/ })).toBeVisible();
    const preview = await scan(page);
    expect(preview.violations, report(preview.violations)).toEqual([]);
  });

  test("the admin and partner zones are clean, including a zone 404", async ({ page }) => {
    for (const url of [HOSTS.admin, HOSTS.partner, `${HOSTS.admin}/nope`]) {
      await page.goto(url);
      await expect(page.locator("main#main")).toBeVisible();

      const { violations } = await scan(page);
      expect(violations, `${url}\n${report(violations)}`).toEqual([]);
    }
  });

  test("the admin shell is clean, open and collapsed, and with its overlays up", async ({ page }) => {
    await signInAsStaff(page);
    await expect(page.getByRole("navigation", { name: "เมนูหลัก" })).toBeVisible();

    const open = await scan(page);
    expect(open.violations, report(open.violations)).toEqual([]);

    // Collapsed is a different tree, not a different stylesheet: the labels move into the
    // accessibility tree only and each link gains a tooltip.
    await page.getByRole("button", { name: "ย่อเมนู" }).click();
    await expect(page.getByRole("button", { name: "ขยายเมนู" })).toBeVisible();
    const collapsed = await scan(page);
    expect(collapsed.violations, report(collapsed.violations)).toEqual([]);

    // The command palette is a combobox in a modal — the most intricate ARIA in the shell.
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog", { name: "ค้นหาและสั่งงาน" })).toBeVisible();
    const palette = await scan(page);
    expect(palette.violations, report(palette.violations)).toEqual([]);

    await page.keyboard.press("Escape");
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "ปุ่มลัด" })).toBeVisible();
    const shortcuts = await scan(page);
    expect(shortcuts.violations, report(shortcuts.violations)).toEqual([]);
  });

  test("the partner shop-floor shell is clean on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsPartner(page);
    await expect(page.getByRole("navigation", { name: "เมนูหลัก" })).toBeVisible();

    const { violations } = await scan(page);
    expect(violations, report(violations)).toEqual([]);
  });

  test("the storefront shell is clean on a phone, bottom nav and all", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "เมนูด้านล่าง" })).toBeVisible();

    const { violations } = await scan(page);
    expect(violations, report(violations)).toEqual([]);
  });

  test("the dark theme keeps its contrast", async ({ page, context }) => {
    // The theme is a cookie the server reads, so setting it exercises the real path.
    await context.addCookies([{ name: "pk_theme", value: "dark", url: "http://localhost:3100" }]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    const { violations } = await scan(page);
    expect(violations, report(violations)).toEqual([]);
  });

  test("the high-contrast theme keeps its contrast", async ({ page, context }) => {
    await context.addCookies([{ name: "pk_theme", value: "hc", url: "http://localhost:3100" }]);
    await page.goto("/account/designs");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "hc");

    const { violations } = await scan(page);
    expect(violations, report(violations)).toEqual([]);
  });
});

test.describe("keyboard paths", () => {
  test("a skip link moves focus to the main landmark", async ({ page }) => {
    await page.goto("/account/designs");
    await expect(page.locator("main#main")).toBeVisible();
  });

  test("closing the box setup dialog returns focus to the button that opened it", async ({ page }) => {
    await page.goto("/studio/new");
    await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /เลือกแบบกล่องแล้วออกแบบ/ }).click();

    const dialog = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
    await dialog.getByRole("button", { name: "เริ่มออกแบบ" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();

    // Reopen it from the Box tool, so there is a trigger for focus to return to.
    await page
      .getByRole("navigation", { name: "เครื่องมือออกแบบ" })
      .getByRole("button", { name: "กล่อง", exact: true })
      .click();
    const trigger = page.getByRole("button", { name: "ตั้งค่ากล่อง" }).first();
    await trigger.click();
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // This is the assertion jsdom could not make in src/ui/components/overlays.test.tsx.
    await expect(trigger).toBeFocused();
  });

  test("the designer toolbar is reachable and operable by keyboard", async ({ page }) => {
    await page.goto("/studio/new");
    await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /เลือกแบบกล่องแล้วออกแบบ/ }).click();
    const dialog = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
    await dialog.getByRole("button", { name: "เริ่มออกแบบ" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();

    const textTool = page
      .getByRole("navigation", { name: "เครื่องมือออกแบบ" })
      .getByRole("button", { name: "ข้อความ", exact: true });
    await textTool.focus();
    await page.keyboard.press("Enter");
    const addHeading = page.getByRole("button", { name: "เพิ่มหัวข้อ", exact: true });
    await addHeading.focus();
    await page.keyboard.press("Enter");

    // The new element selects itself, so its properties panel appears.
    await expect(
      page.getByRole("tabpanel", { name: "คุณสมบัติ" }).getByRole("heading", { name: "ข้อความ", exact: true }),
    ).toBeVisible();
  });

  test("the storefront starts light even on a dark OS", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("the theme toggle switches theme and persists it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ธีม" }).click();
    await page.getByRole("menuitemradio", { name: "มืด" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Stamped server-side on the next request: no flash, and it works without JavaScript.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
