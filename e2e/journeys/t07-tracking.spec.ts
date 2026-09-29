import { MOCK_BUYER_PHONE, signInAsCustomer } from "../helpers/customer";
import { expect, test } from "./fixture";
import { IN_PRODUCTION } from "./seeds";

test.use({ viewport: { width: 390, height: 844 } });

/** T7 "ตอนนี้งานของคุณอยู่ขั้นไหน และจะได้ของวันไหน" — from LINE to the stage and the date. */
test("T7 find the job's stage and arrival date from LINE", async ({ page, journey }) => {
  const j = journey("T7");
  // The task starts at a LINE notification about the order. Notifications carry no link yet
  // (contract `notifications.unread-and-link`), so the closest LINE can land is Packio's LIFF home.
  await signInAsCustomer(page, "/liff", MOCK_BUYER_PHONE);
  await j.startHere();
  j.gap("the LINE notification cannot open the order itself — it has no link (notifications.unread-and-link)");

  const tabs = page.getByRole("navigation", { name: "เมนู Packio ใน LINE" });
  await j.screen(
    "orders",
    () => tabs.getByRole("link", { name: "คำสั่งซื้อ" }).click(),
    () => expect(page.getByRole("link", { name: new RegExp(IN_PRODUCTION.code) })).toBeVisible(),
  );
  await j.screen(
    "order",
    () => page.getByRole("link", { name: new RegExp(IN_PRODUCTION.code) }).click(),
    () => expect(page.getByRole("heading", { level: 2, name: "ความคืบหน้า" })).toBeVisible(),
  );

  await j.done(async () => {
    await expect(
      page.getByRole("list", { name: "ความคืบหน้าของคำสั่งซื้อ" }).locator("[aria-current=step]"),
    ).toBeVisible();
    await expect(page.getByText("คาดว่าจะได้รับ")).toBeVisible();
  });
});
