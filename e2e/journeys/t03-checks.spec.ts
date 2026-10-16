import { HOSTS } from "../../playwright.config";
import { acceptCookies } from "../helpers/customer";
import { addHeading } from "../helpers/designer";
import { gotoHydrated } from "../helpers/session";
import { logo } from "./files";
import { expect, test } from "./fixture";
import { rail } from "./studio";

const BOX = "/studio/new?product=tuck-end-box&style=tuck-end&l=70&w=40&h=150&step=design";

/**
 * T3 "ทำให้ไฟล์พร้อมพิมพ์ (แก้ทุกปัญหาที่ระบบแจ้ง)" in getpack 3D Studio's ④ Check (U4.5). Judged by
 * unexplained warnings: an issue that offers neither a fix nor a way to learn why — a help link
 * (U5.2 §4) — `step-counting.md`.
 */
test("T3 make the file print-ready by fixing every flagged issue", async ({ page, journey }) => {
  const j = journey("T3");
  await acceptCookies(page);
  await gotoHydrated(page, `${HOSTS.customer}${BOX}`);
  const setup = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  if (await setup.isVisible()) await setup.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  // The box settles once the API has converted its size and priced it; elements added before that
  // were laid out on the earlier flat and could land off it, which is not the seeded state.
  await expect(page.getByText(/^฿[\d,]+\.\d{2}$/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("กำลังคำนวณราคาใหม่")).toHaveCount(0, { timeout: 15_000 });
  // The seeded issues (task-cards.md Part B): text too small to print, a low-resolution image.
  await addHeading(page);
  await page.getByRole("spinbutton", { name: /^ขนาด/ }).fill("1.5");
  await rail(page, "อัปโหลด").click();
  await page.locator('input[type="file"][accept*="image/png"]').setInputFiles(logo());
  await page.keyboard.press("Escape");
  await j.startHere();

  const small = page.getByRole("button", { name: /เล็กกว่า 6 pt อาจพิมพ์ไม่ชัด/ });
  await j.screen(
    "checks",
    () =>
      page
        .getByRole("navigation", { name: "ขั้นตอนการออกแบบ" })
        .getByRole("button", { name: /ตรวจงาน/ })
        .click(),
    () => expect(small).toBeVisible(),
  );

  const issues = page.getByRole("list").filter({ has: small }).getByRole("listitem");
  const count = await issues.count();
  let unexplained = 0;
  for (let i = 0; i < count; i += 1) {
    const item = issues.nth(i);
    // The finding itself is a button (it selects the element); anything more is a fix or a why.
    const helps = (await item.getByRole("link").count()) + (await item.getByRole("button").count()) - 1;
    if (helps <= 0) unexplained += 1;
  }
  j.measure(unexplained);
  expect(count, "the seeded issues are listed").toBeGreaterThan(0);
  if (unexplained > 0) j.gap(`${unexplained} of ${count} issues offer no fix and no help link (U4.5, U5.2)`);

  await j.decide("enlarge the small text", () => page.getByRole("button", { name: "ขยายตัวอักษร" }).first().click());

  // The low-resolution logo can only be fixed with a better file, which the task does not provide:
  // the participant is expected to be able to say why it is flagged — its "why" link (task-cards.md Part B).
  await j.done(() => expect(small).toHaveCount(0));
});
