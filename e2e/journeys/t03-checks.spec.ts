import { acceptCookies } from "../helpers/customer";
import { addHeading } from "../helpers/designer";
import { logo } from "./files";
import { expect, test } from "./fixture";
import { openNewDesign, rail } from "./studio";

/**
 * T3 "ทำให้ไฟล์พร้อมพิมพ์ (แก้ทุกปัญหาที่ระบบแจ้ง)". Judged by unexplained warnings: an issue in
 * the checks that offers neither a fix nor a way to learn how (a help link) — `step-counting.md`.
 */
test("T3 make the file print-ready by fixing every flagged issue", async ({ page, journey }) => {
  const j = journey("T3");
  await acceptCookies(page);
  await openNewDesign(page);
  // The seeded issues (task-cards.md Part B): text too small to print, a low-resolution image.
  await addHeading(page);
  await page.getByRole("spinbutton", { name: /^ขนาด/ }).fill("1.5");
  await rail(page, "อัปโหลด").click();
  await page.locator('input[type="file"][accept*="image/png"]').setInputFiles(logo());
  await page.keyboard.press("Escape");
  await j.startHere();

  const trigger = page.getByRole("button", { name: /ควรตรวจ \d+ รายการ/ });
  await j.screen(
    "checks",
    () => trigger.click(),
    () => expect(page.getByRole("button", { name: /ตัวอักษรสูง 1\.5 มม\./ })).toBeVisible(),
  );

  const smallText = page.getByRole("button", { name: /ตัวอักษรสูง 1\.5 มม\./ });
  const issues = page.getByRole("list").filter({ has: smallText }).getByRole("listitem");
  const count = await issues.count();
  let unexplained = 0;
  for (let i = 0; i < count; i += 1) {
    const item = issues.nth(i);
    const helps = (await item.getByRole("link").count()) + (await item.getByRole("button").count()) - 1;
    if (helps <= 0) unexplained += 1;
  }
  j.measure(unexplained);
  expect(count, "the seeded issues are listed").toBeGreaterThan(0);
  if (unexplained > 0) j.gap(`${unexplained} of ${count} issues offer no fix and no help link (U4.5, U5.2)`);

  await j.decide("select the small text", () => smallText.click());
  await j.decide("make the text larger", () => page.getByRole("spinbutton", { name: /^ขนาด/ }).fill("8"));

  // The low-resolution logo can only be fixed with a better file, which the task does not provide:
  // the participant is expected to be able to say why it is flagged (task-cards.md Part B).
  await j.done(() => expect(page.getByText("ตัวอักษรเล็กกว่า 6pt อาจพิมพ์ไม่ชัด")).toHaveCount(0));
});
