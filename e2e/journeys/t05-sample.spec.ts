import type { Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { acceptCookies } from "../helpers/customer";
import { expect, test } from "./fixture";

const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });

/**
 * T5 "ขอตัวอย่างก่อนสั่งผลิตจริง". A sample of the customer's own design before the run is U2.4;
 * today the nearest is the physical mockup add-on in the configurator (D-072), so that is what is
 * walked, stopping before anything is submitted (task-cards.md Part B).
 */
test("T5 ask for a sample before the production run", async ({ page, journey }) => {
  const j = journey("T5");
  await acceptCookies(page);
  await j.start(`${HOSTS.customer}/products/mailer-box`);
  j.gap("no sample request of the customer's own design; the D-072 mockup is an add-on to a full order (U2.4 / U2.F3)");

  await j.screen(
    "configurator",
    () => page.getByRole("link", { name: "ปรับแต่งและดูราคา" }).click(),
    () => expect(dock(page)).toBeVisible(),
  );
  await j.decide("open design and sample", () => page.getByRole("button", { name: /งานออกแบบและตัวอย่าง/ }).click());
  await j.decide("a printed sample", () => page.getByRole("radio", { name: /^พิมพ์ลายจริง/ }).click());

  await j.done(() => expect(page.getByRole("radio", { name: /^พิมพ์ลายจริง/ })).toBeChecked());
});
