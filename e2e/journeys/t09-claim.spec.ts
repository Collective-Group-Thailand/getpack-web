import { MOCK_RECEIVER_PHONE, signInAsCustomer } from "../helpers/customer";
import { png } from "./files";
import { expect, test } from "./fixture";
import { DELIVERED } from "./seeds";

/** T9 "สินค้าที่ได้รับสีเพี้ยน — แจ้งปัญหา" — from the order list to a submitted claim (D-082). */
test("T9 report off-colour goods", async ({ page, journey }) => {
  const j = journey("T9");
  await signInAsCustomer(page, "/account/orders", MOCK_RECEIVER_PHONE);
  await j.startHere();
  j.expectEvents("claim_started", "claim_submitted");

  // The orders list is a table row per order since the customer redesign; each row carries its own actions.
  const row = page.getByRole("row").filter({ hasText: DELIVERED.code });
  await j.screen(
    "claim form",
    () => row.getByRole("link", { name: /แจ้งปัญหา/ }).click(),
    () => expect(page.getByRole("heading", { level: 1, name: "แจ้งปัญหาสินค้า" })).toBeVisible(),
  );

  await j.decide("problem type", () => page.getByRole("radio", { name: "งานพิมพ์ผิดพลาด" }).click());
  await j.decide("description", () => page.getByLabel(/^รายละเอียด/).fill("สีฟ้าบนฝากล่องออกเขียว ต่างจากที่อนุมัติ"));
  await j.decide("resolution", () => page.getByRole("radio", { name: /^ผลิตใหม่/ }).click());
  const pickers = page.locator('input[type="file"]');
  await j.decide("product photo", async () => {
    await pickers.nth(0).setInputFiles(png("claim-1.png"));
    await expect(page.getByRole("img", { name: "อัปโหลดแล้ว" })).toHaveCount(1);
  });
  // D-082 asks for carton photos with every claim, including a print defect the carrier did not cause.
  j.gap("a carton photo is required for a print defect too (D-082 applies it to every claim type)");
  await j.decide("carton photo", async () => {
    await pickers.nth(1).setInputFiles(png("claim-2.png"));
    await expect(page.getByRole("img", { name: "อัปโหลดแล้ว" })).toHaveCount(2);
  });

  await j.screen(
    "claim submitted",
    () => page.getByRole("button", { name: "ส่งเรื่อง" }).click(),
    () => expect(page.getByRole("heading", { level: 1, name: /^เคลม CL-2569-/ })).toBeVisible(),
  );

  await j.done(() => expect(page).toHaveURL(/\/claims\/[0-9a-f-]+$/));
});
