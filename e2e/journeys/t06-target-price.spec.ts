import { HOSTS } from "../../playwright.config";
import { acceptCookies } from "../helpers/customer";
import { test } from "./fixture";

/** T6 "งบของคุณคือ 8 บาท/ใบ — ทำให้ได้ราคาใกล้เคียงที่สุด" — judged by whether a lever is found unaided. */
test("T6 get as close as possible to 8 ฿ a piece", async ({ page, journey }) => {
  const j = journey("T6");
  await acceptCookies(page);
  await j.start(`${HOSTS.customer}/configure/mailer-box`);
  j.pending("no target price and no levers toward it in the configurator", "U2.3 / U2.F1");
});
