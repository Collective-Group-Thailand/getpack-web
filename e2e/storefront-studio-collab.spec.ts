import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_BUYER_PHONE, MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading, openRail } from "./helpers/designer";

/**
 * U4.7, collaboration in getpack 3D Studio against the mock API: a comment pinned on the flat sheet,
 * resolved; a comment link opened by someone else (signed in) who pins a comment of their own; an
 * edit link that saves a new version of the owner's design through its token.
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

async function newDesign(page: Page, phone: string): Promise<string> {
  await signInAsCustomer(page, BOX, phone);
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกอัตโนมัติ" })).toBeVisible({ timeout: 15_000 });
  return STUDIO.exec(page.url())![1]!;
}

async function shareLink(page: Page, scope: "แสดงความคิดเห็น" | "แก้ไข"): Promise<string> {
  await page.getByRole("button", { name: "แชร์", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "แชร์แบบนี้" });
  await dialog.getByRole("radio", { name: scope }).click();
  await dialog.getByRole("button", { name: "สร้างลิงก์" }).click();
  const url = await dialog.getByRole("textbox", { name: "ลิงก์" }).inputValue();
  await expect(dialog.getByRole("listitem").filter({ hasText: scope })).toHaveCount(1);
  await expectNoViolations(page);
  await page.keyboard.press("Escape");
  return url;
}

test("a comment pinned on the flat sheet, resolved; a comment link used by someone else", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const id = await newDesign(page, MOCK_DESIGNER_PHONE);

  await openRail(page, "ความเห็น");
  await page.getByRole("button", { name: "ปักหมุดความคิดเห็น" }).click();
  await expect(page.getByText(/คลิกบนกล่อง 3D หรือบนแผ่นคลี่/)).toBeVisible();
  await page.locator(".konvajs-content").first().click();
  await page.getByRole("textbox", { name: "ความคิดเห็น" }).fill("ขยายโลโก้อีกนิด");
  await page.getByRole("button", { name: "ส่ง", exact: true }).click();
  const thread = page.getByRole("listitem").filter({ hasText: "ขยายโลโก้อีกนิด" });
  await expect(thread).toBeVisible();
  await expect(thread.getByText(/บน|บนแผ่นคลี่/).first()).toBeVisible();
  await expectNoViolations(page);
  await thread.getByRole("button", { name: "ปิดความคิดเห็นที่ 1" }).click();
  await expect(page.getByText("ยังไม่มีความคิดเห็น")).toBeVisible();

  const link = await shareLink(page, "แสดงความคิดเห็น");

  // Someone else, signed in, comments through the link.
  const other = await browser.newContext();
  const guest = await other.newPage();
  await signInAsCustomer(guest, new URL(link).pathname, MOCK_BUYER_PHONE);
  await guest.goto(link);
  await expect(guest.getByText("แบบที่แชร์ · แสดงความคิดเห็นได้")).toBeVisible();
  await guest.getByRole("button", { name: "ปักหมุดความคิดเห็น" }).click();
  await guest.locator("main svg[aria-hidden='true']").first().click();
  await guest.getByRole("textbox", { name: "ความคิดเห็น" }).fill("สีฟ้าเข้มไปไหม");
  await guest.getByRole("button", { name: "ส่ง", exact: true }).click();
  await expect(guest.getByRole("listitem").filter({ hasText: "สีฟ้าเข้มไปไหม" })).toBeVisible();
  await expectNoViolations(guest);
  await other.close();

  const comments = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/studio/${id}/comments`)).json();
  expect(comments.map((c: { body: string }) => c.body)).toEqual(["ขยายโลโก้อีกนิด", "สีฟ้าเข้มไปไหม"]);
  expect(comments[1].anchor).toMatchObject({ xMm: expect.any(Number), yMm: expect.any(Number) });
});

test("an edit link saves a new version of the owner's design", async ({ page }) => {
  test.setTimeout(120_000);
  // The mock's Company Admin: a company member may make edit links.
  const id = await newDesign(page, "0867890123");
  const before = (await (await page.request.get(`${HOSTS.customer}/bff/v1/store/designs/${id}`)).json()).versionNo;
  const link = await shareLink(page, "แก้ไข");

  await page.goto(link);
  await page.getByRole("link", { name: "แก้ไขแบบนี้" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  // The artwork only: no box tool, no uploads.
  const rail = page.getByRole("navigation", { name: "เครื่องมือออกแบบ" });
  await expect(rail.getByRole("button", { name: "ข้อความ", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(rail.getByRole("button", { name: "อัปโหลด", exact: true })).toHaveCount(0);
  await addHeading(page);
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "บันทึกอัตโนมัติ" })).toBeVisible({ timeout: 15_000 });

  const after = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/designs/${id}`)).json();
  expect(after.versionNo).toBeGreaterThan(before);
  expect(after.document.content.elements.length).toBe(2);
});

test("a comment pinned on the 3D box is anchored to the face it hit", async ({ page }) => {
  test.setTimeout(120_000);
  const id = await newDesign(page, MOCK_DESIGNER_PHONE);
  await openRail(page, "ความเห็น");
  await page.getByRole("button", { name: "ปักหมุดความคิดเห็น" }).click();
  // The 3D view of the split stage: its centre is on the box.
  const box = page.locator("div[role='img'] canvas").first();
  await expect(box).toBeVisible({ timeout: 15_000 });
  await box.click();
  await expect(page.getByText(/^ปักไว้บน/)).toBeVisible();
  await page.getByRole("textbox", { name: "ความคิดเห็น" }).fill("มุมนี้สีเพี้ยน");
  await page.getByRole("button", { name: "ส่ง", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "มุมนี้สีเพี้ยน" })).toBeVisible();
  const comments = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/studio/${id}/comments`)).json();
  expect(comments.at(-1).anchor).toMatchObject({
    faceId: expect.any(String),
    u: expect.any(Number),
    v: expect.any(Number),
  });
});
