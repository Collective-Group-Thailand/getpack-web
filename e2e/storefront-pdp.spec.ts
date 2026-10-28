import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * The product page (Stage C · C3, pdp redesign Phase 1) on the mock backend: the buy box prices the
 * configurator's default spec, every picker re-prices it and is carried to `/configure/[slug]` (the
 * configurator opens on the same choices), the sizes table picks a size into the buy box, the sticky
 * section bar, and the phone's buy bar that covers neither the content nor the LINE button.
 */
const PRODUCT = `${HOSTS.customer}/products/mailer-box`;
const price = /^฿[\d,]+\.\d{2}$/;

test.describe("the product page", () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test("buy box: live price, pickers, and the configurator opens on the same choices", async ({ page }) => {
    await gotoHydrated(page, PRODUCT);
    await expect(page.getByRole("heading", { level: 1, name: "กล่องไปรษณีย์" })).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "เส้นทางนำทาง" });
    await expect(crumbs.getByRole("link", { name: "สินค้าและราคา" })).toBeVisible();

    const buy = page.locator("#buy");
    await expect(buy.getByText(price).first()).toBeVisible({ timeout: 15_000 });
    await expect(buy.getByText(/ชิ้น · เบอร์ A · รวม VAT แล้ว · ไม่รวมค่าจัดส่ง/)).toBeVisible();
    const configure = buy.getByRole("link", { name: "ปรับแต่งต่อและสั่งซื้อ" });
    await expect(configure).toHaveAttribute("href", "/configure/mailer-box");

    await buy
      .getByRole("group", { name: "ขนาด" })
      .getByRole("button", { name: /^เบอร์ B / })
      .click();
    await buy.getByRole("group", { name: "วัสดุ" }).getByRole("button", { name: /ลอน E/ }).click();
    await buy.getByRole("group", { name: "สีพิมพ์ด้านนอก" }).getByRole("button", { name: "ดำ" }).click();
    await buy
      .getByRole("group", { name: "จำนวน" })
      .getByRole("button", { name: /^2,000/ })
      .click();
    await expect(buy.getByText(/2,000 ชิ้น · เบอร์ B/)).toBeVisible({ timeout: 15_000 });
    await expect(configure).toHaveAttribute("href", /size=B/);
    await expect(configure).toHaveAttribute("href", /qty=2000/);

    // The configurator reads the link: size B, board E, black outside, 2,000 pieces.
    const pagePrice = await buy.getByText(price).first().textContent();
    await configure.click();
    await expect(page).toHaveURL(/\/configure\/mailer-box\?/);
    await page.locator("html[data-hydrated]").waitFor();
    await expect(page.getByRole("radio", { name: /เบอร์ B/ }).first()).toBeChecked();
    await expect(page.getByRole("radio", { name: /ลอน E/ }).first()).toBeChecked();
    const dock = page.getByRole("region", { name: "ราคาและการสั่งผลิต" });
    await expect(dock.getByText(pagePrice!).first()).toBeVisible({ timeout: 15_000 });
  });

  test("the sizes table, the tiers and the section bar", async ({ page }) => {
    await gotoHydrated(page, PRODUCT);
    const table = page.getByRole("table", { name: /ขนาดมาตรฐานทุกเบอร์/ });
    await expect(table.getByRole("row")).toHaveCount(4);
    await expect(table.getByRole("button", { name: "เลือกเบอร์ A อยู่" })).toHaveAttribute("aria-pressed", "true");
    await table.getByRole("button", { name: "เลือกเบอร์ C" }).click();
    await expect(page.locator("#buy").getByText(/เบอร์ C · รวม VAT แล้ว/)).toBeVisible({ timeout: 15_000 });

    const tiers = page.getByRole("table", { name: "ราคาต่อชิ้นและราคารวมตามจำนวน" });
    await expect(tiers.getByRole("row")).toHaveCount(5);

    const bar = page.getByRole("navigation", { name: "ส่วนของหน้า" });
    await bar.getByRole("link", { name: "คำถามที่พบบ่อย" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "คำถามที่พบบ่อย" })).toBeInViewport();
    await expect(bar.getByRole("link", { name: "คำถามที่พบบ่อย" })).toHaveAttribute("aria-current", "true");

    const data = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = data.flatMap((text) => [JSON.parse(text)].flat().map((block: { "@type": string }) => block["@type"]));
    expect(types).toEqual(expect.arrayContaining(["Product", "BreadcrumbList", "FAQPage"]));
    expect(data.join(" ")).not.toMatch(/AggregateRating|"Review"/);
  });

  test("phone: the buy bar sits above the tab bar, covers no content and not the LINE button", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.context().addCookies([{ name: "pk_theme", value: "dark", url: HOSTS.customer }]);
    await gotoHydrated(page, PRODUCT);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    const bar = page.locator("[data-pdp-bar]");
    await expect(bar).toBeVisible();
    await expect(bar.getByText(price)).toBeVisible({ timeout: 15_000 });
    await expect(bar.getByRole("link", { name: "ปรับแต่งต่อ" })).toHaveAttribute("href", "/configure/mailer-box");

    const line = page.getByRole("button", { name: /คุยทาง LINE/ });
    if (await line.count()) {
      const [barBox, lineBox] = [await bar.boundingBox(), await line.boundingBox()];
      expect(lineBox!.y + lineBox!.height).toBeLessThanOrEqual(barBox!.y);
    }
    // The page ends above the bar: the last section is reachable in full.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const padding = await page.evaluate(() => getComputedStyle(document.body).paddingBottom);
    expect(parseFloat(padding)).toBeGreaterThan(0);
  });

  test("an RFQ product keeps the quotation path, without a live buy box", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/products/magnetic-gift-box`);
    await expect(page.getByText("ราคาตามสเปก", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "ขอใบเสนอราคา" })).toBeVisible();
    await expect(page.locator("[data-pdp-bar]")).toHaveCount(0);
  });
});
