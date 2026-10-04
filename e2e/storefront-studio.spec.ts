import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading } from "./helpers/designer";

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
  await signInAsCustomer(page, "/styles/pk-te-01", MOCK_DESIGNER_PHONE);
  await page.getByRole("link", { name: "ออกแบบใน 3D Studio" }).click();
  await expect(page).toHaveURL(/\/studio\/new\?product=[^&]+&style=/);

  const setup = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await expect(setup).toBeVisible();
  await setup.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(setup).toBeHidden();
  await expect(page.locator("canvas").first()).toBeVisible();

  // The first autosave creates the design (with its box and spec) and the address becomes its own.
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await expect(steps.getByRole("button", { name: /ออกแบบ/ })).toHaveAttribute("aria-current", "step");

  // The dock prices the saved version.
  const dock = page.getByRole("region", { name: "ราคาและการสั่งผลิต" });
  const perPiece = dock.locator("span.font-semibold").filter({ hasText: "฿" });
  await expect(perPiece).toBeVisible({ timeout: 15_000 });
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
