import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading } from "./helpers/designer";
import { gotoHydrated } from "./helpers/session";

/**
 * U4.1, Packio 3D Studio against the mock API: from a style card into the studio, the price dock
 * pricing the saved version (`store.studio.quote`), a quantity change re-priced with its reason,
 * the five steps reversible with the canvas kept, and axe on everything that is not the canvas.
 * As the mock's `designer` persona, so nothing here shares state with the other suites.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const STUDIO = /\/studio\/[0-9a-f-]{36}\?/;

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

test.describe.configure({ mode: "serial" });

test("style card → studio → price → quantity → new price, every step reversible", async ({ page }) => {
  // The style page redirects to its named address, so it is opened after signing in.
  await signInAsCustomer(page, "/account", MOCK_DESIGNER_PHONE);
  await gotoHydrated(page, `${HOSTS.customer}/styles/pk-te-01`);
  await page.getByRole("link", { name: "ออกแบบใน 3D Studio" }).click();
  await expect(page).toHaveURL(/\/studio\/new\?product=[^&]+&style=.*step=box/);

  const setup = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await expect(setup).toBeVisible();
  await setup.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(setup).toBeHidden();
  await expect(page.locator("canvas").first()).toBeVisible();

  // The first autosave creates the design (with its box and spec) and the address becomes its own.
  // A style card opens ②: the style is chosen, its size and material are next.
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await expect(steps.getByRole("button", { name: /ขนาดและวัสดุ/ })).toHaveAttribute("aria-current", "step");
  await page.getByRole("button", { name: "ใช้กล่องนี้ แล้วเริ่มออกแบบ" }).click();
  await expect(steps.getByRole("button", { name: /ออกแบบ/ })).toHaveAttribute("aria-current", "step");

  // The dock prices the saved version.
  const dock = page.getByRole("region", { name: "ราคาและการสั่งผลิต" });
  const perPiece = dock.locator("span.font-semibold").filter({ hasText: "฿" });
  await expect(perPiece).toBeVisible({ timeout: 15_000 });
  await expect(dock.getByText("กำลังคำนวณราคาใหม่")).toHaveCount(0, { timeout: 15_000 });
  await expect(dock.getByText(/^รวม ฿/)).toBeVisible();
  await expect(dock.getByText("ราคารวม VAT ยังไม่รวมค่าจัดส่ง")).toBeVisible();
  const first = await perPiece.textContent();

  // Another quantity: a new price, and the dock says why.
  await dock.getByRole("combobox", { name: "จำนวน" }).click();
  await page.getByRole("option").last().click();
  await expect(perPiece).not.toHaveText(first!, { timeout: 15_000 });
  await expect(dock.getByText(/เพราะเปลี่ยนจำนวน/)).toBeVisible();

  // ④ and ⑤ wait for content; ② and back keeps the canvas.
  await expect(steps.getByRole("button", { name: /ตรวจงาน/ })).toBeDisabled();
  await steps.getByRole("button", { name: /ขนาดและวัสดุ/ }).click();
  await expect(page).toHaveURL(/step=box/);
  await expect(page.getByRole("button", { name: "ใช้กล่องนี้ แล้วเริ่มออกแบบ" })).toBeVisible();
  await page.getByRole("button", { name: "ใช้กล่องนี้ แล้วเริ่มออกแบบ" }).click();
  await addHeading(page);
  await expect(steps.getByRole("button", { name: /ตรวจงาน/ })).toBeEnabled();
  // Printing the artwork changes what is priced.
  const second = await perPiece.textContent();
  await expect(perPiece).not.toHaveText(second!, { timeout: 15_000 });
  await expect(dock.getByText(/เปลี่ยนการพิมพ์/)).toBeVisible();

  await steps.getByRole("button", { name: /ตรวจงาน/ }).click();
  await expect(page.getByRole("heading", { name: "ตรวจงานก่อนสั่งผลิต" })).toBeVisible();
  await expectNoViolations(page);
  await dock.getByRole("button", { name: "สั่งผลิต" }).click();
  await expect(page.getByRole("heading", { name: "สั่งผลิตแบบนี้" })).toBeVisible();
  await expect(page).toHaveURL(/step=order/);

  // Back to ③: the heading is still on the sheet, and a reload opens the step from the address.
  await steps.getByRole("button", { name: /ออกแบบ/ }).click();
  await expect(page.getByRole("navigation", { name: "เครื่องมือออกแบบ" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(steps.getByRole("button", { name: /ออกแบบ/ })).toHaveAttribute("aria-current", "step");
  await expect(perPiece).toBeVisible({ timeout: 15_000 });
  await expectNoViolations(page);
});

test("② the print method configures the editor and the price; a size that cannot be made says why", async ({
  page,
}) => {
  // The style page redirects to its named address, so it is opened after signing in.
  await signInAsCustomer(page, "/account", MOCK_DESIGNER_PHONE);
  await gotoHydrated(page, `${HOSTS.customer}/styles/pk-te-01`);
  await page.getByRole("link", { name: "ออกแบบใน 3D Studio" }).click();
  const setup = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await setup.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });

  const dock = page.getByRole("region", { name: "ราคาและการสั่งผลิต" });
  const perPiece = dock.locator("span.font-semibold").filter({ hasText: "฿" });
  await expect(perPiece).toBeVisible({ timeout: 15_000 });
  await expect(dock.getByText("กำลังคำนวณราคาใหม่")).toHaveCount(0, { timeout: 15_000 });
  const auto = await perPiece.textContent();

  // Digital: a printed box — a new price, and the dock says the printing changed it.
  const method = page.getByRole("radiogroup", { name: "วิธีพิมพ์" });
  await method.getByRole("radio", { name: /ดิจิทัล/ }).click();
  await expect(perPiece).not.toHaveText(auto!, { timeout: 15_000 });
  await expect(dock.getByText(/เปลี่ยนการพิมพ์/)).toBeVisible({ timeout: 15_000 });

  // Flexo: spot colours up to the limit Prepress set (the mock's 3), no photo uploads in the editor.
  await method.getByRole("radio", { name: /เฟล็กโซ/ }).click();
  await expect(method.getByText("พิมพ์สีพิเศษได้ไม่เกิน 3 สี คิดราคาตามจำนวนสี")).toBeVisible();
  await page.getByRole("button", { name: "ใช้กล่องนี้ แล้วเริ่มออกแบบ" }).click();
  const rail = page.getByRole("navigation", { name: "เครื่องมือออกแบบ" });
  await expect(rail.getByRole("button", { name: "ข้อความ", exact: true })).toBeVisible();
  await expect(rail.getByRole("button", { name: "อัปโหลด", exact: true })).toHaveCount(0);
  await expect(page.getByText(/^เฟล็กโซ: ใช้ \d+ จาก 3 สี$/)).toBeVisible();

  // No print: structure only — the artwork tools leave the rail.
  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await steps.getByRole("button", { name: /ขนาดและวัสดุ/ }).click();
  await method.getByRole("radio", { name: /ไม่พิมพ์/ }).click();
  await page.getByRole("button", { name: "ใช้กล่องนี้ แล้วเริ่มออกแบบ" }).click();
  await expect(rail.getByRole("button", { name: "ข้อความ", exact: true })).toHaveCount(0);
  await expect(page.getByText("ไม่พิมพ์: ออกแบบได้เฉพาะโครงสร้าง")).toBeVisible();

  // A size the engine cannot make is refused with its reason.
  await steps.getByRole("button", { name: /ขนาดและวัสดุ/ }).click();
  await page.getByRole("textbox", { name: "สูง" }).fill("2");
  await expect(page.getByText("ขนาดนี้ผลิตไม่ได้")).toBeVisible();
  await expect(page.getByRole("button", { name: "ใช้ขนาดนี้" })).toBeDisabled();
  await expectNoViolations(page);
});

test("① describe your product → three boxes with reasons → ②", async ({ page }) => {
  await signInAsCustomer(page, "/products/shipping-box", MOCK_DESIGNER_PHONE);
  await page.getByRole("link", { name: "ออกแบบออนไลน์" }).click();
  await expect(page).toHaveURL(/\/studio\/new\?product=shipping-box&step=start$/);
  await expect(page.getByRole("dialog", { name: "ตั้งค่ากล่อง" })).toHaveCount(0);

  const describe = page.getByRole("region", { name: "บอกขนาดสินค้าของคุณ" });
  await describe.getByRole("textbox", { name: "ยาว" }).fill("300");
  await describe.getByRole("textbox", { name: "กว้าง" }).fill("200");
  await describe.getByRole("textbox", { name: "สูง" }).fill("150");
  await describe.getByRole("radio", { name: "ส่งพัสดุ" }).click();
  await describe.getByRole("button", { name: "แนะนำกล่อง" }).click();
  const results = describe.getByRole("list", { name: "กล่องที่แนะนำ" });
  await expect(results.getByRole("listitem").first()).toBeVisible();
  expect(await results.locator(":scope > li").count()).toBeLessThanOrEqual(3);
  await expect(results.getByText(/^ใส่สินค้าได้ ขนาดภายใน/).first()).toBeVisible();
  await expectNoViolations(page);

  await results.getByRole("button", { name: "ใช้กล่องนี้" }).first().click();
  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await expect(steps.getByRole("button", { name: /ขนาดและวัสดุ/ })).toHaveAttribute("aria-current", "step");
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
});
