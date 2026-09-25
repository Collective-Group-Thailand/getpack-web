import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { openAccountMenu, signInAsPartner, signInAsStaff } from "./helpers/session";

/**
 * The three zone shells (F1 1.3).
 *
 * The assertion that matters most is the admin sidebar: it must show exactly what
 * `/v1/admin/me` returned and nothing else. A sidebar that quietly falls back to a hard-coded
 * list would pass every unit test and hand a CS agent a link to Finance.
 */

test.describe("admin shell", () => {
  test("builds the sidebar from the menu entitlements, and only those", async ({ page }) => {
    await signInAsStaff(page);

    const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
    // The mock builds a CS agent's menu from their permissions, as packio-api's menu catalogue
    // does: these eleven entries and nothing else.
    const expected = [
      "ภาพรวม",
      "รายการรออนุมัติ",
      "คำสั่งซื้อ",
      "คำนวณราคา (CS)",
      "ใบเสนอราคา",
      "คำขอใบเสนอราคา",
      "บันทึกขอส่วนลด",
      "รอบจัดส่ง",
      "งานเคลม",
      "ลูกค้า",
      "บริษัทคู่ค้า",
    ];
    await expect(nav.getByRole("link")).toHaveCount(expected.length);
    for (const name of expected) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();

    // Nothing this staff user was not entitled to.
    await expect(nav.getByRole("link", { name: "ผู้ใช้และสิทธิ์" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "ตั้งค่าระบบ" })).toHaveCount(0);
  });

  test("marks the current page for a screen reader, not just with a colour", async ({ page }) => {
    await signInAsStaff(page);

    const dashboard = page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("link", { name: "ภาพรวม" });
    await expect(dashboard).toHaveAttribute("aria-current", "page");
  });

  test("collapses the sidebar and remembers it across a reload", async ({ page }) => {
    await signInAsStaff(page);

    // Retried for the same reason as the account menu: the button is in the server HTML
    // before the JavaScript that makes it do anything has hydrated.
    await expect(async () => {
      await page.getByRole("button", { name: "ย่อเมนู" }).click();
      await expect(page.getByRole("button", { name: "ขยายเมนู" })).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    // Collapsed, the labels are hidden visually but still in the accessibility tree — a
    // sighted colleague collapsing the nav must not make it unusable to a screen reader.
    const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
    await expect(nav.getByRole("link", { name: "คำสั่งซื้อ" })).toBeAttached();
    await expect(page.getByRole("button", { name: "ขยายเมนู" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "ขยายเมนู" })).toBeVisible();
  });

  test("opens the command palette with the keyboard and closes it with Escape", async ({ page }) => {
    await signInAsStaff(page);

    const palette = page.getByRole("dialog", { name: "ค้นหาและสั่งงาน" });

    // Retried: the shortcut is registered by an effect, so a keypress before the shell has
    // hydrated is simply dropped. There is no DOM signal for "hydrated" — the button is
    // present and enabled in the server HTML either way — so pressing again is the honest
    // way to wait for it, and it still fails if the shortcut is genuinely not wired.
    await expect(async () => {
      await page.keyboard.press("ControlOrMeta+k");
      await expect(palette).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    // Focus lands in the input, which is what makes the shortcut worth having.
    await expect(palette.getByRole("combobox")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });

  test("opens the shortcuts overlay with ?, but not while typing", async ({ page }) => {
    await signInAsStaff(page);

    // Opened by the button rather than ⌘K: the shortcut has its own test above, and going
    // through a real control removes the race with the effect that registers it.
    // Retried: the button is in the server HTML before the JavaScript that opens anything has
    // hydrated, and a click in that window is dropped (the same reason as `openAccountMenu`).
    const palette = page.getByRole("dialog", { name: "ค้นหาและสั่งงาน" });
    await expect(async () => {
      await page
        .getByRole("button", { name: /ค้นหาคำสั่งซื้อ/ })
        .first()
        .click();
      await expect(palette).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await palette.getByRole("combobox").fill("?");
    // `?` is a printable character: inside a text field it must type, not open a dialog.
    await expect(page.getByRole("dialog", { name: "ปุ่มลัด" })).toHaveCount(0);
    await expect(palette.getByRole("combobox")).toHaveValue("?");

    await page.keyboard.press("Escape");
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "ปุ่มลัด" })).toBeVisible();
  });

  test("shows who is signed in, behind the account menu", async ({ page }) => {
    await signInAsStaff(page);
    await openAccountMenu(page);

    await expect(page.getByTestId("actor-name")).toHaveText("สมชาย ตัวอย่าง (ข้อมูลจำลอง)");
    await expect(page.getByTestId("actor-roles")).toContainText("cs");
  });
});

test.describe("partner shell", () => {
  test("gives the shop floor a bottom nav with big targets", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsPartner(page);

    const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
    await expect(nav.getByRole("link")).toHaveCount(4);

    // design-system.md §5: 48 px is the floor for the partner app; these are 64.
    const box = await nav.getByRole("link", { name: "งานผลิต" }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  });
});

test.describe("customer shell", () => {
  test("has a header, a footer and a phone bottom nav", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(HOSTS.customer);

    await expect(page.getByRole("navigation", { name: "เมนูด้านล่าง" }).getByRole("link")).toHaveCount(5);
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("switches language to the same page, not the home page", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/help/faq`);

    await page.getByRole("button", { name: "ภาษา" }).click();
    await page.getByRole("menuitemradio", { name: "English" }).click();

    // The other half of hreflang: /en/help/faq, not /en.
    await expect(page).toHaveURL(`${HOSTS.customer}/en/help/faq`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("every destination the shell links to actually answers", async ({ page, request }) => {
    // A 404 on an RSC prefetch has no content-length, so the browser holds the socket open
    // until keep-alive expires — a link to a page that does not exist is not just a dead end,
    // it slows down the page it sits on. This asserts the shell never ships one.
    await page.goto(HOSTS.customer);

    const hrefs = await page
      .locator("header a, footer a, nav a")
      .evaluateAll((links) => [
        ...new Set(links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean)),
      ]);
    expect(hrefs.length).toBeGreaterThan(10);

    for (const href of hrefs) {
      const response = await request.get(`${HOSTS.customer}${href}`);
      expect(response.status(), `${href} answered ${response.status()}`).toBeLessThan(400);
    }
  });
});
