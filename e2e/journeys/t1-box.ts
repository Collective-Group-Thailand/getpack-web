import { expect, type Page } from "@playwright/test";

/** The configurator's price dock. */
export const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });

/** The home page's Studio hero panel (homepage v10, D-310). */
export const heroPanel = (page: Page) => page.getByRole("region", { name: "สตูดิโอ · แบบร่างใหม่" });

/** The T1 box's own size: 20 × 15 × 8 cm inside, typed in millimetres. */
export async function typeT1Size(page: Page): Promise<void> {
  await page.getByRole("textbox", { name: "ยาว" }).fill("200");
  await page.getByRole("textbox", { name: "กว้าง" }).fill("150");
  await page.getByRole("textbox", { name: "สูง" }).fill("80");
}

/** The dock's settled price per piece. */
export const pricePerPiece = (page: Page) => dock(page).getByText(/^฿[\d,]+\.\d{2} \/ ชิ้น$/);

/** Uncounted: the T1 box at 500 pcs priced in the configurator, the T1 way (T6's start). */
export async function priceT1Box(page: Page): Promise<void> {
  const panel = heroPanel(page);
  await panel.getByRole("group", { name: "จำนวน" }).getByRole("button", { name: "500", exact: true }).click();
  await panel.getByRole("link", { name: "ดูรายละเอียดราคาและปรับสเปกเพิ่ม" }).click();
  await expect(dock(page)).toBeVisible({ timeout: 30_000 });
  await page.locator("html[data-hydrated]").waitFor();
  await page.getByRole("radio", { name: "กำหนดเอง" }).click();
  await page.getByRole("radio", { name: /ขนาดภายใน/ }).click();
  await typeT1Size(page);
  await expect(dock(page)).toContainText("500 ชิ้น");
  await expect(pricePerPiece(page)).toBeVisible({ timeout: 15_000 });
}
