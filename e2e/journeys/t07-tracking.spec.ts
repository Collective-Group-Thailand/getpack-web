import { MOCK_BUYER_PHONE, signInAsCustomer } from "../helpers/customer";
import { expect, test } from "./fixture";
import { IN_PRODUCTION } from "./seeds";

test.use({ viewport: { width: 390, height: 844 } });

/** The buyer of `mocks/store/customers.ts`. */
const BUYER_ID = "00000000-0000-4000-8000-000000000003";
/** The mock's stateless deep-link token (`mocks/store/launchpad.ts` `mockDeepLink`, D-299). */
const deepLink = (path: string) =>
  `sMOCK${Buffer.from(JSON.stringify({ path, customerId: BUYER_ID })).toString("base64url")}`;

/**
 * T7 "ตอนนี้งานของคุณอยู่ขั้นไหน และจะได้ของวันไหน" — from the LINE notification to the stage and
 * the date. Since U5.1 the notification carries `<web>/l/<token>` (D-299): tapping it is the walk.
 */
test("T7 find the job's stage and arrival date from LINE", async ({ page, journey }) => {
  const j = journey("T7");
  await signInAsCustomer(page, "/liff", MOCK_BUYER_PHONE);
  await j.startHere();

  await j.screen(
    "order, from the notification's link",
    () => page.goto(`/l/${deepLink(`/account/orders/${IN_PRODUCTION.id}`)}`),
    () => expect(page.getByRole("heading", { level: 2, name: "ความคืบหน้า" })).toBeVisible(),
  );

  await j.done(async () => {
    await expect(page.getByText(IN_PRODUCTION.code).first()).toBeVisible();
    await expect(
      page.getByRole("list", { name: "ความคืบหน้าของคำสั่งซื้อ" }).locator(":scope > [aria-current=step]"),
    ).toBeVisible();
    // The order promises a ship date and, from its quotation, an arrival.
    // "กำหนดส่ง" since the factory wording sweep (Stage A, A1): customers are not shown the factory.
    await expect(page.getByText(/^กำหนดส่ง/).first()).toBeVisible();
    await expect(page.getByText("คาดว่าจะได้รับ").first()).toBeVisible();
  });
});
