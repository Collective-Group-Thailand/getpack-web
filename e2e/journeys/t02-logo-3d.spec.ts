import { acceptCookies } from "../helpers/customer";
import { logo } from "./files";
import { expect, test } from "./fixture";
import { openNewDesign, tool } from "./studio";

/** T2 "ใส่โลโก้ของคุณบนกล่องนี้ที่ด้านบนและด้านหน้า แล้วดูภาพ 3D" — in the studio. */
test("T2 put the logo on the top and the front, then see it in 3D", async ({ page, journey }) => {
  const j = journey("T2");
  await acceptCookies(page);
  await openNewDesign(page);
  await j.startHere();
  j.expectEvents("design_started");

  const focused = (face: string) => page.getByRole("status").filter({ hasText: `กำลังแก้: ${face}` });
  await tool(j, page, "กล่อง");
  await j.decide("focus the top", async () => {
    await page.getByRole("button", { name: /^ฝาบน/ }).first().click();
    await expect(focused("ฝาบน")).toBeVisible();
  });
  await tool(j, page, "อัปโหลด");
  await j.decide("upload the logo (lands on the focused face)", async () => {
    await page.locator('input[type="file"][accept*="image/png"]').setInputFiles(logo());
    await expect(page.getByRole("button", { name: "วางรูปนี้อีกครั้ง" })).toBeVisible();
  });

  j.gap("no way to place one image on several faces at once (U4.4)");
  await tool(j, page, "กล่อง");
  await j.decide("focus the front", async () => {
    await page.getByRole("button", { name: "ด้านหน้า", exact: true }).click();
    await expect(focused("ด้านหน้า")).toBeVisible();
  });
  await tool(j, page, "อัปโหลด");
  await j.decide("place the logo again", () => page.getByRole("button", { name: "วางรูปนี้อีกครั้ง" }).click());

  await j.screen(
    "3D",
    () => page.getByRole("tab", { name: "3 มิติ" }).click(),
    () => expect(page.getByRole("img", { name: /^ภาพสามมิติ/ })).toBeVisible(),
  );

  await j.done(() => expect(page.getByRole("tab", { name: "3 มิติ" })).toHaveAttribute("aria-selected", "true"));
});
