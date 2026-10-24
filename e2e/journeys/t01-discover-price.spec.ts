import { HOSTS } from "../../playwright.config";
import { acceptCookies } from "../helpers/customer";
import { expect, test } from "./fixture";
import { dock, heroPanel, pricePerPiece, typeT1Size } from "./t1-box";

/** T1 "หากล่องไปรษณีย์ … 20×15×8 ซม. หนัก 500 กรัม แล้วดูว่า 500 ใบราคาเท่าไร" — home to a real price. */
test("T1 find a mailer box and its price for 500 pcs", async ({ page, journey }) => {
  const j = journey("T1");
  await acceptCookies(page);
  await j.start(HOSTS.customer);
  j.expectEvents("configurator_opened", "quote_shown");

  // Homepage v10: the hero's Studio panel opens on the mailer and prices its standard sizes; a size
  // of the customer's own is set in the configurator it links to.
  const panel = heroPanel(page);
  await expect(
    panel.getByRole("group", { name: "ทรงกล่อง" }).getByRole("button", { name: "ไปรษณีย์" }),
  ).toHaveAttribute("aria-pressed", "true");
  await j.decide("quantity", () =>
    panel.getByRole("group", { name: "จำนวน" }).getByRole("button", { name: "500", exact: true }).click(),
  );
  await j.screen(
    "configurator",
    () => panel.getByRole("link", { name: "ดูรายละเอียดราคาและปรับสเปกเพิ่ม" }).click(),
    () => expect(dock(page)).toBeVisible({ timeout: 30_000 }),
  );
  await page.locator("html[data-hydrated]").waitFor();
  await j.decide("own size", () => page.getByRole("radio", { name: "กำหนดเอง" }).click());
  // D-182: the customer chooses the basis (no silent default).
  await j.decide("measurement basis", () => page.getByRole("radio", { name: /ขนาดภายใน/ }).click());
  await j.decide("size", () => typeT1Size(page));
  j.gap("no product-weight input: the 500 g in the task has nowhere to go (Structure Advisor, U2.2 / U2.F1)");

  await j.done(async () => {
    await expect(dock(page)).toContainText("500 ชิ้น");
    await expect(pricePerPiece(page)).toBeVisible({ timeout: 15_000 });
  });
});
