import { expect, type Page } from "@playwright/test";

/** The hero's shape chips (`home.panel.shapes`). */
export const HERO_SHAPES = { mailer: "ไปรษณีย์", lid: "ฝาครอบ", tuck: "ฝาเสียบ" } as const;

/**
 * Price parity between the home hero and `/configure` (D-310): pick `shape` on the hero's Studio
 * panel, read its settled price per piece, follow "ดูรายละเอียดราคาและปรับสเปกเพิ่ม" and expect the
 * configurator's dock to show the same price at the same quantity — a two-part box (the lid shape,
 * a telescope body and lid) priced part by part on both sides. The page must be on the home page.
 *
 * Returns `false`, having checked nothing, when the presets do not offer the shape (a catalogue
 * that prices it on request only).
 */
export async function expectHeroParity(page: Page, shape: keyof typeof HERO_SHAPES): Promise<boolean> {
  const panel = page.getByRole("region", { name: "สตูดิโอ · แบบร่างใหม่" });
  const chip = panel
    .getByRole("group", { name: "ทรงกล่อง" })
    .getByRole("button", { name: HERO_SHAPES[shape], exact: true });
  if ((await chip.count()) === 0) return false;
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  // The price has settled for these choices (the panel marks an update in flight as busy).
  await expect(panel.locator("[aria-busy]")).toHaveCount(0, { timeout: 30_000 });
  const price = panel.getByText(/^฿[\d,]+\.\d{2}/).first();
  await expect(price).toBeVisible({ timeout: 30_000 });
  const unit = (await price.innerText()).match(/฿[\d,]+\.\d{2}/)![0];
  const qty = await panel.getByRole("group", { name: "จำนวน" }).locator("[aria-pressed=true]").innerText();
  await expect(panel.getByText(`ราคาต่อชิ้น · ${qty} ชิ้น · รวม VAT`)).toBeVisible();

  await panel.getByRole("link", { name: "ดูรายละเอียดราคาและปรับสเปกเพิ่ม" }).click();
  await expect(page).toHaveURL(/\/configure\/[^?]+\?.*from=home/);
  const dock = page.getByRole("complementary", { name: "ราคาของคุณ" });
  await expect(dock).toContainText(`${qty} ชิ้น`, { timeout: 30_000 });
  await expect(dock, `${shape}: the hero said ${unit} per piece at ${qty}`).toContainText(`${unit} / ชิ้น`, {
    timeout: 30_000,
  });
  return true;
}
