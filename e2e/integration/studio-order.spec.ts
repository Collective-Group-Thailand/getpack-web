import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { DEV_INSTANT_PRODUCT, runId, signInCustomer } from "./support";

/**
 * U4.6 on the real getpack-api (`v0.41.0`): from ⑤ the studio saves the version's quotation, uploads
 * its renders and orders it. Either the print job succeeds and the cart carries the version at the
 * studio's price, or getpack-api cannot assemble the file here (`studio.print_unavailable`) and the
 * studio offers the upload route instead — never a half-made order.
 */
test("ordering a studio version: the cart at the studio's price, or the honest fallback", async ({ context, page }) => {
  test.slow();
  await signInCustomer(context, runId("order"));
  const query = new URLSearchParams({ product: DEV_INSTANT_PRODUCT, style: "rsc", l: "400", w: "300", h: "250" });
  await page.goto(`${HOSTS.customer}/studio/new?${query.toString()}`);
  await page.locator("html[data-hydrated]").waitFor();
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?/, { timeout: 30_000 });
  const id = /\/studio\/([0-9a-f-]{36})/.exec(page.url())![1]!;

  const rail = page.getByRole("navigation", { name: "เครื่องมือออกแบบ" });
  await rail.getByRole("button", { name: "ข้อความ", exact: true }).click();
  await page.getByRole("button", { name: "เพิ่มหัวข้อ", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 30_000 });

  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await steps.getByRole("button", { name: /สั่งผลิต/ }).click();
  await expect(page.getByRole("heading", { name: "สั่งผลิตแบบนี้" })).toBeVisible();
  const warning = page.getByText(/คำเตือน \d+ รายการที่ต้องรับทราบ/);
  if (await warning.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await page.getByRole("button", { name: "ไปที่ตรวจงาน" }).click();
    const accept = page.getByRole("button", { name: "รับทราบ ใช้แบบนี้" });
    await expect(accept.first()).toBeVisible({ timeout: 30_000 });
    while ((await accept.count()) > 0) {
      const before = await accept.count();
      await accept.first().click();
      await expect(accept).toHaveCount(before - 1, { timeout: 30_000 });
    }
    await steps.getByRole("button", { name: /สั่งผลิต/ }).click();
  }
  // The dev product has no quantity presets: the quantity is typed in the price bar.
  if (await page.getByText("ระบุจำนวนที่แถบราคาเพื่อดูราคาของแบบนี้").isVisible()) {
    await page.getByRole("spinbutton", { name: "จำนวน" }).fill("1000");
    await page.getByRole("spinbutton", { name: "จำนวน" }).blur();
  }
  const chosen = page
    .getByRole("table", { name: "ราคาตามจำนวน" })
    .getByRole("row")
    .filter({ has: page.getByRole("button", { pressed: true }) });
  await expect(chosen).toHaveCount(1, { timeout: 30_000 });
  const studioTotal = (await chosen.getByRole("cell").last().innerText()).replace(/[^\d.]/g, "");

  // The dev stack's storage is a placeholder (`https://fake-s3.invalid`): the browser cannot PUT the
  // renders there, so the studio stops at the upload and says so — no order, no cart line.
  let upload: string | null = null;
  // (The browser refuses that origin by CSP before any request leaves, so it shows in the console.)
  page.on("console", (message) => {
    const host = /https:\/\/fake-s3\.invalid/.exec(message.text());
    if (host) upload = host[0];
  });
  const ordered = page
    .waitForResponse((r) => r.url().endsWith(`/studio/${id}/order`) && r.request().method() === "POST", {
      timeout: 150_000,
    })
    .then((r) => ({ kind: "order" as const, r }));
  await expect(page.getByRole("button", { name: "เพิ่มลงตะกร้า" })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  const stopped = page
    .getByText("ส่งไฟล์งานพิมพ์ไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง")
    .waitFor({ timeout: 150_000 })
    .then(() => ({ kind: "stopped" as const }));
  const outcome = await Promise.race([ordered, stopped]);

  if (outcome.kind === "stopped") {
    expect(upload, "the upload went to the stack's placeholder storage").toBe("https://fake-s3.invalid");
    const cart = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/cart`)).json();
    expect((cart.items as { designDocumentId: string | null }[]).some((item) => item.designDocumentId === id)).toBe(
      false,
    );
    // getpack-api refuses to order a version it has no renders for.
    const design = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/designs/${id}`)).json();
    const headers = { "x-getpack-csrf": "1", origin: HOSTS.customer, "content-type": "application/json" };
    const quote = await (
      await page.request.post(`${HOSTS.customer}/bff/v1/store/studio/${id}/quote/actions/save`, {
        headers: { ...headers, "idempotency-key": crypto.randomUUID() },
        data: { quantities: [1000], versionNo: design.versionNo },
      })
    ).json();
    expect(quote.options?.length, JSON.stringify(quote)).toBeGreaterThan(0);
    const refused = await page.request.post(`${HOSTS.customer}/bff/v1/store/studio/${id}/order`, {
      headers: { ...headers, "idempotency-key": crypto.randomUUID() },
      data: { quoteId: quote.id, quoteOptionId: quote.options[0].id, versionNo: design.versionNo },
    });
    const problem = await refused.json();
    expect(["studio.renders_missing", "studio.print_unavailable"], JSON.stringify(problem)).toContain(problem.code);
    return;
  }

  const answer = outcome.r;
  const body = await answer.json();
  if (answer.status() === 202) {
    await expect(page).toHaveURL(/\/cart$/, { timeout: 180_000 });
    const cart = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/cart`)).json();
    const line = (cart.items as { designDocumentId: string | null; productGrossAmount: string }[]).find(
      (item) => item.designDocumentId === id,
    );
    expect(line?.productGrossAmount).toBe(studioTotal);
  } else {
    expect(body.code, JSON.stringify(body)).toBe("studio.print_unavailable");
    await expect(page.getByText("ยังสั่งผลิตจาก Studio ไม่ได้สำหรับแบบนี้")).toBeVisible();
  }
});
