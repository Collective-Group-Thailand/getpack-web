import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, MOCK_NEW_CUSTOMER_PHONE, MOCK_OTP } from "./helpers/session";

/**
 * F3 3.1 end to end: browse the catalogue, read a product, an article and the FAQ, search, and
 * sign in — as a returning customer and as a new one who is asked for consent and a profile.
 * Against the mock API, whose catalogue is the back office's own rows (`mocks/store`).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  // A card mid-fade under the pointer (ProductCard's hover CTA) is not what the page settles on.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

async function jsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((text) => JSON.parse(text) as Record<string, unknown>);
}

const SIGN_IN = {
  th: { title: "เข้าสู่ระบบ", phone: "เบอร์มือถือ", send: "ขอรหัส OTP", otp: "รหัส OTP" },
  en: { title: "Sign in", phone: "Mobile number", send: "Send OTP", otp: "OTP code" },
};

async function signIn(page: Page, phone: string, locale: keyof typeof SIGN_IN = "th") {
  const labels = SIGN_IN[locale];
  // Over a page it is a dialog (a sheet on a phone); /sign-in itself is a page of its own.
  const sheet = new URL(page.url()).pathname.endsWith("/sign-in")
    ? page.getByRole("main")
    : page.getByRole("dialog", { name: labels.title });
  await sheet.getByLabel(labels.phone).fill(phone);
  await sheet.getByRole("button", { name: labels.send }).click();
  await sheet.getByLabel(labels.otp).fill(MOCK_OTP.code);
  return sheet;
}

test.describe("the catalogue", () => {
  test("browses from the catalogue to a category to a product", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/products`);
    await expect(page.getByRole("heading", { level: 1, name: "สินค้าและราคา" })).toBeVisible();
    // A draft in the back office is not in the shop.
    await expect(page.getByRole("link", { name: "กล่องถาด" })).toHaveCount(0);

    // C1: the catalogue's category chips filter in place; the chosen category links to its own page.
    await page
      .getByRole("navigation", { name: "หมวดสินค้า" })
      .getByRole("link", { name: /^กล่องกระดาษลูกฟูก/ })
      .click();
    await expect(page).toHaveURL(/cat=corrugated/);
    await page.getByRole("link", { name: /ดูหน้าหมวดกล่องกระดาษลูกฟูก/ }).click();
    await expect(page).toHaveURL(`${HOSTS.customer}/products/corrugated`);
    await expect(page.getByRole("heading", { level: 1, name: "กล่องกระดาษลูกฟูก" })).toBeVisible();

    await page.getByRole("link", { name: "กล่องไปรษณีย์" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "กล่องไปรษณีย์" })).toBeVisible();
  });

  test("a product page shows its price with its basis, its sizes and FAQs, and one next step", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/products/tuck-end-box`);

    await expect(
      page
        .locator("main")
        .getByText(/^฿\d+\.\d{2}$/)
        .first(),
    ).toBeVisible();
    await expect(page.locator("main")).toContainText(/เริ่มต้น\s*฿\d+\.\d{2}\s*\/ ชิ้น/);
    await expect(page.getByText(/ที่ 1,000 ชิ้น · รวม VAT/)).toBeVisible();
    await expect(page.getByText("ผลิต 7–10 วันทำการ")).toBeVisible();
    await expect(page.getByRole("table", { name: /ขนาดมาตรฐาน/ }).getByRole("row")).toHaveCount(4);
    await expect(page.getByRole("link", { name: "ปรับแต่งและดูราคา" })).toHaveAttribute(
      "href",
      "/configure/tuck-end-box",
    );

    const data = await jsonLd(page);
    const product = data.find((block) => block["@type"] === "Product");
    expect(product).toMatchObject({
      name: "กล่องฝาเสียบ",
      offers: { "@type": "AggregateOffer", priceCurrency: "THB" },
    });
    expect(JSON.stringify(product)).not.toMatch(/rating|review/i);
    expect(data.map((block) => block["@type"])).toEqual(expect.arrayContaining(["BreadcrumbList", "FAQPage"]));
  });

  test("an RFQ product asks for a quote instead of showing a price", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/products/magnetic-gift-box`);
    await expect(page.getByText("ราคาตามสเปก", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "ขอใบเสนอราคา" })).toBeVisible();
    const product = (await jsonLd(page)).find((block) => block["@type"] === "Product");
    expect(product).not.toHaveProperty("offers");
  });

  test("serves stock products, 404s what does not exist, and keeps the English page canonical", async ({
    page,
    request,
  }) => {
    await page.goto(`${HOSTS.customer}/products/PKO-BTL-0250`);
    await expect(page.getByRole("heading", { level: 1, name: "ขวด PET 250 มล." })).toBeVisible();
    await expect(page.getByText("สั่งขั้นต่ำ 100 ชิ้น")).toBeVisible();

    expect((await request.get(`${HOSTS.customer}/products/no-such-thing`)).status()).toBe(404);

    await page.goto(`${HOSTS.customer}/en/products/tuck-end-box`);
    await expect(page.getByRole("heading", { level: 1, name: "Tuck-end box" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${HOSTS.customer}/en/products/tuck-end-box`,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="th"]')).toHaveAttribute(
      "href",
      `${HOSTS.customer}/products/tuck-end-box`,
    );
  });

  test("the header's สินค้าและราคา leads to the catalogue's categories", async ({ page }) => {
    await gotoHydrated(page, HOSTS.customer);
    await page.getByRole("banner").getByRole("link", { name: "สินค้าและราคา" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(
      page
        .getByRole("main")
        .getByRole("link", { name: /สติ๊กเกอร์และฉลาก/ })
        .first(),
    ).toBeVisible();
  });

  test("the sitemap walks the catalogue and articles", async ({ request }) => {
    const body = await (await request.get(`${HOSTS.customer}/sitemap.xml`)).text();
    for (const path of ["/products/tuck-end-box", "/products/corrugated", "/articles/choosing-box-paper", "/faq"]) {
      expect(body).toContain(`<loc>${HOSTS.customer}${path}</loc>`);
    }
    expect(body).not.toContain("/help/faq");
  });

  test("robots.txt keeps the English private pages out as well as the Thai", async ({ request }) => {
    const body = await (await request.get(`${HOSTS.customer}/robots.txt`)).text();
    expect(body).toContain("Disallow: /account/");
    expect(body).toContain("Disallow: /en/account/");
    expect(body).toContain("Disallow: /configure/");
  });
});

test.describe("content", () => {
  test("an article renders its stored body", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/articles`);
    await page.getByRole("link", { name: "เลือกกระดาษทำกล่องอย่างไรให้เหมาะกับสินค้า" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "อาร์ตการ์ด" })).toBeVisible();
    await expect(page.getByText("บทความนี้เป็นข้อมูลจำลอง")).toBeVisible();
    await expect(page.getByText(/เผยแพร่ 20 ก\.ย\. 2569/)).toBeVisible();
  });

  test("the FAQ opens in place, is marked up, and /help/faq moved to it", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/help/faq`);
    await expect(page).toHaveURL(`${HOSTS.customer}/faq`);
    await page.getByText("สั่งขั้นต่ำกี่ชิ้น").click();
    await expect(page.getByText("ขึ้นอยู่กับประเภทสินค้า")).toBeVisible();
    expect((await jsonLd(page)).some((block) => block["@type"] === "FAQPage")).toBe(true);
  });
});

test.describe("search", () => {
  test("the search page finds products, articles and FAQs without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${HOSTS.customer}/search?q=${encodeURIComponent("กล่อง")}`);
    await expect(page.getByRole("heading", { level: 2, name: "สินค้า" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "บทความ" })).toBeVisible();
    await page.goto(`${HOSTS.customer}/search?q=${encodeURIComponent("ขั้นต่ำ")}`);
    await expect(page.getByRole("heading", { level: 2, name: "คำถามที่พบบ่อย" })).toBeVisible();
    await context.close();
  });

  test("the header's instant search goes to a result by keyboard", async ({ page }) => {
    await gotoHydrated(page, HOSTS.customer);
    await page.getByRole("banner").getByRole("link", { name: "ค้นหา" }).click();
    const dialog = page.getByRole("dialog", { name: "ค้นหา" });
    await expect(dialog.getByRole("combobox")).toBeFocused();
    await page.keyboard.type("ไปรษณีย์");
    await expect(dialog.getByRole("option", { name: "กล่องไปรษณีย์", exact: true })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`${HOSTS.customer}/products/mailer-box`);
  });

  test("a signed-in customer finds their own order by its code, and a guest does not", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/search?q=PK-2569-00100`);
    await expect(page.getByRole("heading", { level: 2, name: "คำสั่งซื้อของคุณ" })).toHaveCount(0);

    await gotoHydrated(page, `${HOSTS.customer}/sign-in?returnTo=${encodeURIComponent("/search?q=PK-2569-00100")}`);
    await signIn(page, MOCK_OTP.phone);
    await expect(page.getByRole("heading", { level: 2, name: "คำสั่งซื้อของคุณ" })).toBeVisible();
    await expect(page.getByRole("link", { name: /PK-2569-00100/ })).toBeVisible();
  });
});

test.describe("signing in", () => {
  test("a guest is sent to sign in and brought back", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/en/account/orders`);
    await expect(page).toHaveURL(`${HOSTS.customer}/en/sign-in?returnTo=%2Faccount%2Forders`);
    await signIn(page, MOCK_OTP.phone, "en");
    await expect(page).toHaveURL(`${HOSTS.customer}/en/account/orders`);
  });

  test("the header's sign-in link opens sign-in over the page; a returning customer goes straight on", async ({
    page,
  }) => {
    await gotoHydrated(page, `${HOSTS.customer}/products`);
    await page.getByRole("banner").getByRole("link", { name: "เข้าสู่ระบบ" }).click();
    const sheet = await signIn(page, MOCK_OTP.phone);
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(`${HOSTS.customer}/products`);
    // Signed in, the header shows the customer's avatar and name in place of "เข้าสู่ระบบ".
    await expect(page.getByRole("banner").getByRole("button", { name: "บัญชีของฉัน" })).toBeVisible();
  });

  test("a new customer accepts the required terms, may skip marketing, and completes a profile", async ({ page }) => {
    // The e-mail comes from a verified sign-in (D-224): the profile asks a name and a type only.
    await gotoHydrated(page, `${HOSTS.customer}/products`);
    await page.getByRole("banner").getByRole("link", { name: "เข้าสู่ระบบ" }).click();
    const sheet = await signIn(page, MOCK_NEW_CUSTOMER_PHONE);

    const accept = sheet.getByRole("button", { name: "ยอมรับและดำเนินการต่อ" });
    await expect(accept).toBeDisabled();
    // Opt-in: nothing optional is ticked for them.
    await expect(sheet.getByRole("checkbox", { name: /^รับข่าวสาร โปรโมชัน/ })).not.toBeChecked();
    await expectNoViolations(page);

    // The required documents are accepted in one tick (terms and privacy notice, each linked).
    await sheet
      .getByRole("checkbox", { name: /^ฉันได้อ่านและยอมรับ ข้อกำหนดการใช้บริการ และ นโยบายความเป็นส่วนตัว/ })
      .click();
    await accept.click();

    await expect(sheet.getByRole("heading", { name: "บอกเราเพิ่มอีกนิด" })).toBeVisible();
    await expect(sheet.getByLabel("อีเมล")).toHaveCount(0);
    await sheet.getByRole("radio", { name: "นิติบุคคล / บริษัท" }).click();
    await sheet.getByRole("button", { name: "บันทึก" }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(`${HOSTS.customer}/products`);
  });

  test("Google, Apple and LINE are offered but off when this deployment has no credentials", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/sign-in`);
    for (const name of ["ดำเนินการต่อด้วย Google", "ดำเนินการต่อด้วย Apple", "ดำเนินการต่อด้วย LINE"]) {
      await expect(page.getByRole("button", { name })).toBeDisabled();
    }
    await expect(page.getByRole("link", { name: "นโยบายความเป็นส่วนตัว" })).toBeVisible();
  });
});

test.describe("axe on the new pages", () => {
  for (const path of [
    "/products",
    "/products/corrugated",
    "/products/tuck-end-box",
    "/products/PKO-BTL-0250",
    "/articles",
    "/articles/choosing-box-paper",
    "/faq",
    "/search?q=%E0%B8%81%E0%B8%A5%E0%B9%88%E0%B8%AD%E0%B8%87",
  ]) {
    test(`${path} is clean`, async ({ page }) => {
      await page.goto(`${HOSTS.customer}${path}`);
      await expectNoViolations(page);
    });
  }

  test("a product page is clean on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${HOSTS.customer}/products/tuck-end-box`);
    await expectNoViolations(page);
  });
});
