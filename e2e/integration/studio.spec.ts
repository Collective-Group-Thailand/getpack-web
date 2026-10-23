import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { DEV_INSTANT_PRODUCT, runId, signInCustomer } from "./support";

/**
 * U4.1 on the real getpack-api (`v0.41.0`): a studio design on the dev seed's instant corrugated
 * carton is created with its box and calculator spec (D-275), the dock prices that version through
 * `store.studio.quote` (D-277), and another quantity is re-priced with the API's reason. Every
 * figure is the API's; the assertions check that they arrive and follow the change.
 */

test("studio → saved box and spec → studio price → quantity → new price, on the real API", async ({
  context,
  page,
}) => {
  test.slow();
  await signInCustomer(context, runId("studio"));
  const query = new URLSearchParams({ product: DEV_INSTANT_PRODUCT, style: "rsc", l: "400", w: "300", h: "250" });
  await page.goto(`${HOSTS.customer}/studio/new?${query.toString()}`);
  await page.locator("html[data-hydrated]").waitFor();

  const setup = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await expect(setup).toBeVisible();
  await setup.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?/, { timeout: 30_000 });

  const dock = page.getByRole("region", { name: "ราคาและการสั่งผลิต" });
  const perPiece = dock.locator("span.font-semibold").filter({ hasText: "฿" });
  // The dev seed's product suggests no quantity: the dock asks for one.
  const quantity = dock.getByRole("spinbutton", { name: "จำนวน" });
  await expect(dock.getByText("ระบุจำนวนเพื่อดูราคา")).toBeVisible({ timeout: 30_000 });
  await quantity.fill("1000");
  await expect(perPiece.or(dock.getByText("ขอใบเสนอราคา").first())).toBeVisible({ timeout: 30_000 });
  test.skip(!(await perPiece.isVisible()), "the dev seed quotes this product on request");
  const first = await perPiece.textContent();

  await quantity.fill("3000");
  await expect(perPiece).not.toHaveText(first!, { timeout: 30_000 });
  await expect(dock.getByText(/เปลี่ยนจำนวน/)).toBeVisible();

  // ② the print method is saved with the design's box (D-275) and configures the editor (U4.2). The
  // dev seed's carton publishes no inks, so here it cannot move the price; the mock suite proves that.
  const designId = /\/studio\/([0-9a-f-]{36})/.exec(page.url())![1];
  await page
    .getByRole("navigation", { name: "ขั้นตอนการออกแบบ" })
    .getByRole("button", { name: /ขนาดและวัสดุ/ })
    .click();
  await page
    .getByRole("radiogroup", { name: "วิธีพิมพ์" })
    .getByRole("radio", { name: /เฟล็กโซ/ })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`${HOSTS.customer}/bff/v1/store/designs/${designId}`)).json()).printMethod,
      {
        timeout: 30_000,
      },
    )
    .toBe("flexo");
  await page.getByRole("button", { name: "ใช้กล่องนี้ แล้วเริ่มออกแบบ" }).click();
  const rail = page.getByRole("navigation", { name: "เครื่องมือออกแบบ" });
  await expect(rail.getByRole("button", { name: "ข้อความ", exact: true })).toBeVisible();
  await expect(rail.getByRole("button", { name: "อัปโหลด", exact: true })).toHaveCount(0);

  // ③ content on the real API (U4.4): the template list answers (the dev seed publishes none yet),
  // and a barcode is checked by getpack-api's validation service — its check digit and GS1 minimum.
  await rail.getByRole("button", { name: "แม่แบบ", exact: true }).click();
  const templates = page.getByRole("region", { name: "แม่แบบของ getpack" });
  await expect(
    templates.getByText("ยังไม่มีแม่แบบสำหรับประเภทนี้").or(templates.getByRole("listitem").first()),
  ).toBeVisible({
    timeout: 30_000,
  });
  await rail.getByRole("button", { name: "องค์ประกอบ", exact: true }).click();
  await page.getByRole("combobox", { name: "ชนิดโค้ด" }).click();
  await page.getByRole("option", { name: "EAN-8" }).click();
  await page.getByRole("textbox", { name: "ตัวเลขหรือข้อความของบาร์โค้ด" }).fill("96385075");
  await expect(page.getByText("หลักตรวจสอบไม่ถูกต้อง")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "ตัวเลขหรือข้อความของบาร์โค้ด" }).fill("9638507");
  await expect(page.getByText(/กว้างอย่างน้อย 21\.38 มม\./)).toBeVisible({ timeout: 30_000 });
});
