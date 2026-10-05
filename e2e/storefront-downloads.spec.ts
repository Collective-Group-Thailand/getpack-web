import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_RECEIVER_PHONE, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * U2.F2 against the mock API: the free dieline of a style variant at the customer's sizes (no plan
 * gate, the layers explained, the nudge to order after it), sizes outside the style's range refused
 * with the reason, and the packaging spec sheet of an order whose artwork is approved.
 */

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

test("a free dieline at my sizes, from a style's page", async ({ page }) => {
  // Signed out: asked to sign in, never a paywall.
  await gotoHydrated(page, `${HOSTS.customer}/styles/pk-te-01`);
  await page.getByRole("button", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" }).click();
  const panel = page.getByRole("region", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" });
  await expect(panel.getByRole("link", { name: "เข้าสู่ระบบเพื่อดาวน์โหลดฟรี" })).toBeVisible();

  await signInAsCustomer(page, "/styles");
  await gotoHydrated(page, `${HOSTS.customer}/styles/pk-te-01`);
  await page.getByRole("button", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" }).click();
  await panel.getByRole("textbox", { name: "ยาว (มม.)" }).fill("70");
  await panel.getByRole("textbox", { name: "กว้าง (มม.)" }).fill("40");
  await panel.getByRole("textbox", { name: "สูง (มม.)" }).fill("9000");
  await panel.getByRole("button", { name: "ดาวน์โหลด", exact: true }).click();
  await expect(panel.getByText("ขนาดนี้อยู่นอกช่วงที่แบบนี้ทำได้")).toBeVisible();

  await panel.getByRole("textbox", { name: "สูง (มม.)" }).fill("150");
  await panel.getByRole("radio", { name: "SVG" }).click();
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "ดาวน์โหลด", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^PK-TE-01-.*-70x40x150\.svg$/);
  await expect(panel.getByText(/วันนี้ดาวน์โหลดได้อีก \d+ ครั้ง/)).toBeVisible();
  await expect(panel.getByRole("link", { name: "ดูราคาและสั่งผลิต" })).toBeVisible();
  await panel.getByText("เลเยอร์ในไฟล์คืออะไร").click();
  await expect(panel.getByText(/CutContour/)).toBeVisible();
  await expectNoViolations(page);
});

test("the packaging spec sheet of an order with approved artwork", async ({ page }) => {
  const order = "00000000-0000-4000-8000-6f7264000020";
  await signInAsCustomer(page, `/account/orders/${order}`, MOCK_RECEIVER_PHONE);
  const sheet = page.getByRole("region", { name: "เอกสารสเปกบรรจุภัณฑ์" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("radio", { name: "English" }).click();
  const download = page.waitForEvent("download");
  await sheet.getByRole("button", { name: "ดาวน์โหลด PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/-spec-en\.pdf$/);
  await expectNoViolations(page);
});
