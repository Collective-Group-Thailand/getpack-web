import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading } from "./helpers/designer";

/**
 * U4.5, ④ Check in Packio 3D Studio against the mock API: the live checks on the shared rule
 * catalogue, a finding fixed in one click, a warning accepted — packio-api stores the acceptance with
 * the version (its run of the saved version says so) — and the soft proof with its label.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const STUDIO = /\/studio\/([0-9a-f-]{36})\?/;
const BOX = "/studio/new?product=tuck-end-box&style=tuck-end&l=70&w=40&h=150&step=design";

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

test("a finding fixed in one click, a warning accepted with the version, and the soft proof", async ({ page }) => {
  await signInAsCustomer(page, BOX, MOCK_DESIGNER_PHONE);
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  const id = STUDIO.exec(page.url())![1]!;

  // Two headings too small to print clearly (the mock's catalogue: 6 pt minimum).
  for (let i = 0; i < 2; i++) {
    await addHeading(page);
    await page.getByRole("spinbutton", { name: /^ขนาด/ }).fill("1.5");
  }
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" }).getByRole("button", { name: /ตรวจงาน/ }).click();
  await expect(page.getByRole("heading", { name: "ตรวจงานก่อนสั่งผลิต" })).toBeVisible();
  const panel = page;
  const small = panel.getByRole("button", { name: /เล็กกว่า 6 pt อาจพิมพ์ไม่ชัด/ });
  await expect(small).toHaveCount(2);
  await expectNoViolations(page);

  // One fixed in a click.
  await panel.getByRole("button", { name: "ขยายตัวอักษร" }).first().click();
  await expect(small).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });

  // The other accepted: packio-api evaluates this rule on the document and keeps the acceptance.
  await expect(panel.getByRole("button", { name: "รับทราบ ใช้แบบนี้" })).toBeVisible({ timeout: 15_000 });
  await panel.getByRole("button", { name: "รับทราบ ใช้แบบนี้" }).first().click();
  await expect(panel.getByText("รับทราบแล้ว")).toBeVisible({ timeout: 15_000 });
  const run = await (
    await page.request.post(`${HOSTS.customer}/bff/v1/store/studio/${id}/checks`, {
      headers: { "x-packio-csrf": "1", origin: HOSTS.customer, "content-type": "application/json" },
      data: {},
    })
  ).json();
  expect(run.findings.filter((f: { ruleId: string; acknowledged: boolean }) => f.ruleId === "min_text_size" && f.acknowledged)).toHaveLength(1);

  // The soft proof: the substrate's preview transform, labelled as a preview.
  await page.getByRole("switch", { name: "ดูแบบพิมพ์จริง" }).click();
  await expect(page.getByText(/ภาพจำลองเพื่อดูตัวอย่าง ไม่ใช่ปรู๊ฟสัญญา/)).toBeVisible();
  await expectNoViolations(page);
});
