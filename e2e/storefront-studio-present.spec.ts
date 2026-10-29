import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading } from "./helpers/designer";

/**
 * U4.7, versions and presentation in getpack 3D Studio against the mock API: two named versions
 * compared side by side and overlaid; presentation on our own scenes with the lid opened, a PNG and
 * a recorded turn; and the box at its real size in the AR view (on a desktop: the model, its size and
 * the files to open on a phone).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const STUDIO = /\/studio\/([0-9a-f-]{36})\?/;
const BOX = "/studio/new?product=tuck-end-box&style=tuck-end&l=70&w=40&h=150&step=design";

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .exclude("canvas")
    .exclude("model-viewer")
    .exclude("[data-sonner-toaster]")
    .analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

async function open(page: Page) {
  await signInAsCustomer(page, BOX, MOCK_DESIGNER_PHONE);
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกอัตโนมัติ" })).toBeVisible({ timeout: 15_000 });
}

test("two named versions, compared side by side and overlaid", async ({ page }) => {
  await open(page);
  const nameVersion = async (label: string) => {
    await page.getByRole("button", { name: "ประวัติการบันทึก" }).click();
    const history = page.getByRole("dialog", { name: "ประวัติการบันทึก" });
    await history.getByRole("textbox", { name: "ตั้งชื่อเวอร์ชันนี้" }).fill(label);
    await history.getByRole("button", { name: "บันทึกเป็นเวอร์ชัน" }).click();
    await expect(history.getByText(label)).toBeVisible({ timeout: 15_000 });
    return history;
  };
  let history = await nameVersion("รอบแรก");
  await page.keyboard.press("Escape");
  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกอัตโนมัติ" })).toBeVisible({ timeout: 15_000 });
  history = await nameVersion("รอบสอง");

  const first = history.getByRole("listitem").filter({ hasText: "รอบแรก" });
  const second = history.getByRole("listitem").filter({ hasText: "รอบสอง" });
  await first.getByRole("checkbox").click();
  await second.getByRole("checkbox").click();
  await expect(history.getByText(/^เทียบเวอร์ชัน \d+ กับ \d+$/)).toBeVisible();
  await expectNoViolations(page);
  await history.getByRole("button", { name: "เทียบ", exact: true }).click();

  const compare = page.getByRole("dialog", { name: /^เทียบเวอร์ชัน/ });
  await expect(compare.getByRole("img")).toHaveCount(2);
  await compare.getByRole("radio", { name: "ซ้อนทับ" }).click();
  await expect(compare.getByRole("slider")).toBeVisible();
  await expectNoViolations(page);
});

test("presentation on our scenes: lid, PNG, a recorded turn, and the box at real size in AR", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await page.getByRole("banner").getByRole("button", { name: "Mockup" }).click();
  const present = page.getByRole("dialog", { name: "นำเสนอแบบกล่อง" });
  await expect(present).toBeVisible();
  await present.getByRole("radio", { name: "โต๊ะคราฟต์" }).click();
  await present.getByRole("button", { name: "เปิดฝา" }).click();
  await expect(present.getByRole("button", { name: "ปิดฝา" })).toBeVisible({ timeout: 5_000 });
  await expectNoViolations(page);

  const png = page.waitForEvent("download");
  await present.getByRole("button", { name: "บันทึกภาพ (PNG)" }).click();
  expect((await png).suggestedFilename()).toMatch(/-kraft\.png$/);

  const video = page.waitForEvent("download", { timeout: 20_000 });
  await present.getByRole("button", { name: "บันทึกวิดีโอ 1 รอบ" }).click();
  expect((await video).suggestedFilename()).toMatch(/-kraft\.(mp4|webm)$/);

  await present.getByRole("button", { name: "ดูขนาดจริง (AR)" }).click();
  const ar = page.getByRole("dialog", { name: "ดูขนาดจริงด้วย AR" });
  await expect(ar.getByText(/ขนาดกล่องเมื่อปิด \d[\d,]* × \d[\d,]* × \d[\d,]* มม\./)).toBeVisible({ timeout: 20_000 });
  await expect(ar.getByText("อุปกรณ์นี้เปิด AR ไม่ได้")).toBeVisible({ timeout: 20_000 });
  await expect(ar.getByRole("link", { name: "ไฟล์ 3D (GLB)" })).toHaveAttribute("href", /^blob:/);
  await expectNoViolations(page);
});
