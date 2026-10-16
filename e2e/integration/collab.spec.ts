import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { DEV_INSTANT_PRODUCT, runId, signInCustomer } from "./support";

/**
 * U4.7 on the real getpack-api (`v0.41.0`): a comment pinned on the studio's flat sheet and resolved
 * (D-285), a comment link opened by another signed-in customer who comments through it, a named
 * version (its label in `listVersions`), and what getpack-api answers to an edit link for a customer
 * with no company.
 */

const BFF = { "x-getpack-csrf": "1", origin: HOSTS.customer, "content-type": "application/json" };

async function studioDesign(page: Page): Promise<string> {
  const query = new URLSearchParams({ product: DEV_INSTANT_PRODUCT, style: "rsc", l: "400", w: "300", h: "250" });
  await page.goto(`${HOSTS.customer}/studio/new?${query.toString()}`);
  await page.locator("html[data-hydrated]").waitFor();
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?/, { timeout: 30_000 });
  const rail = page.getByRole("navigation", { name: "เครื่องมือออกแบบ" });
  await rail.getByRole("button", { name: "ข้อความ", exact: true }).click();
  await page.getByRole("button", { name: "เพิ่มหัวข้อ", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 30_000 });
  return /\/studio\/([0-9a-f-]{36})/.exec(page.url())![1]!;
}

test("comments, a comment link, a named version — on the real API", async ({ context, page, browser }) => {
  test.slow();
  await signInCustomer(context, runId("collab"));
  const id = await studioDesign(page);

  // A comment pinned on the flat sheet, then resolved.
  await page
    .getByRole("navigation", { name: "เครื่องมือออกแบบ" })
    .getByRole("button", { name: "ความเห็น", exact: true })
    .click();
  await page.getByRole("button", { name: "ปักหมุดความคิดเห็น" }).click();
  await page.locator(".konvajs-content").first().click();
  await page.getByRole("textbox", { name: "ความคิดเห็น" }).fill("ตรวจตำแหน่งโลโก้");
  await page.getByRole("button", { name: "ส่ง", exact: true }).click();
  const thread = page.getByRole("listitem").filter({ hasText: "ตรวจตำแหน่งโลโก้" });
  await expect(thread).toBeVisible({ timeout: 30_000 });
  await thread.getByRole("button", { name: "ปิดความคิดเห็นที่ 1" }).click();
  await expect(page.getByText("ยังไม่มีความคิดเห็น")).toBeVisible({ timeout: 30_000 });
  const comments = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/studio/${id}/comments`)).json();
  expect(comments[0]).toMatchObject({ body: "ตรวจตำแหน่งโลโก้", resolvedAt: expect.any(String) });
  expect(comments[0].anchor).toMatchObject({ xMm: expect.any(Number), yMm: expect.any(Number) });

  // A named version.
  await page.getByRole("button", { name: "ประวัติการบันทึก" }).click();
  const history = page.getByRole("dialog", { name: "ประวัติการบันทึก" });
  await history.getByRole("textbox", { name: "ตั้งชื่อเวอร์ชันนี้" }).fill("ส่งลูกค้าดู");
  await history.getByRole("button", { name: "บันทึกเป็นเวอร์ชัน" }).click();
  await expect(history.getByText("ส่งลูกค้าดู")).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");

  // A comment link, used by another customer.
  await page.getByRole("button", { name: "แชร์", exact: true }).click();
  const share = page.getByRole("dialog", { name: "แชร์แบบนี้" });
  await expect(share.getByRole("radio", { name: "แก้ไข" })).toHaveCount(0); // no company: no edit links offered
  await share.getByRole("radio", { name: "แสดงความคิดเห็น" }).click();
  await share.getByRole("button", { name: "สร้างลิงก์" }).click();
  const link = await share.getByRole("textbox", { name: "ลิงก์" }).inputValue();
  await page.keyboard.press("Escape");

  const other = await browser.newContext();
  await signInCustomer(other, runId("collab-guest"));
  const guest = await other.newPage();
  await guest.goto(link);
  await expect(guest.getByText("แบบที่แชร์ · แสดงความคิดเห็นได้")).toBeVisible({ timeout: 30_000 });
  await guest.getByRole("button", { name: "ปักหมุดความคิดเห็น" }).click();
  await guest.locator("main svg[aria-hidden='true']").first().click();
  await guest.getByRole("textbox", { name: "ความคิดเห็น" }).fill("เพิ่มเลขล็อต");
  await guest.getByRole("button", { name: "ส่ง", exact: true }).click();
  await expect(guest.getByRole("listitem").filter({ hasText: "เพิ่มเลขล็อต" })).toBeVisible({ timeout: 30_000 });
  await other.close();

  const after = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/studio/${id}/comments`)).json();
  expect(after.map((c: { body: string }) => c.body)).toContain("เพิ่มเลขล็อต");

  // An edit link for a design with no company: getpack-api makes it, and refuses its use — editing
  // is for the design's company's members (D-285); the studio offers edit links to them only.
  const edit = await page.request.post(`${HOSTS.customer}/bff/v1/store/studio/${id}/share-links`, {
    headers: BFF,
    data: { scope: "edit" },
  });
  expect(edit.status()).toBe(201);
  const { token } = await edit.json();
  const opened = await page.request.get(`${HOSTS.customer}/bff/v1/store/shared-designs/${token}`);
  expect((await opened.json()).scope).toBe("edit");
  const patched = await page.request.patch(`${HOSTS.customer}/bff/v1/store/studio/shared/${token}/document`, {
    headers: { ...BFF, "if-match": opened.headers()["etag"] ?? "" },
    data: { kind: "autosave", operations: [{ op: "replace", path: "/content/pattern/color", value: "#123456" }] },
  });
  expect(patched.status()).toBe(403);
  expect((await patched.json()).code).toBe("designs.share_scope");
});
