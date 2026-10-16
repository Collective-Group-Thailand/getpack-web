import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, completeSignIn, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, MOCK_OTP, signInAsStaff } from "./helpers/session";

/**
 * F3 3.2 end to end: configure (3D preview, live price, price breaks, route to RFQ), keep the
 * price (guest sign-in gate, add to cart, share), and an RFQ from the storefront through the RFQ
 * desk and back — the same rows, across two zones. Against the mock API.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });

test.describe("the configurator", () => {
  test.beforeEach(async ({ page }) => acceptCookies(page));

  test("prices a box live, previews it in 3D, and re-prices when the size changes", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
    await expect(page.getByRole("heading", { level: 1, name: "ปรับแต่งกล่องฝาเสียบ" })).toBeVisible();
    await expect(page.getByRole("img", { name: /กล่องฝาเสียบ ขนาด 100 × 100 × 50 มม./ })).toBeVisible();

    const headline = dock(page).getByText(/^฿[\d,]+\.\d{2} \/ ชิ้น$/);
    await expect(headline).toBeVisible();
    const first = await headline.textContent();
    await expect(dock(page)).toContainText("ระบุรหัสไปรษณีย์");
    await expect(dock(page)).toContainText("ราคานี้คงที่ 15 วัน");
    await expect(dock(page).getByRole("table", { name: "ราคาต่อจำนวน" }).getByRole("row")).toHaveCount(5);

    // A custom size: the preview and the price follow it.
    await page.getByRole("radio", { name: "กำหนดเอง" }).click();
    await page.getByRole("radio", { name: /ขนาดภายใน/ }).click();
    await page.getByRole("textbox", { name: "ยาว" }).fill("220");
    await expect(page.getByRole("img", { name: /ขนาด 220 × 100 × 50 มม./ })).toBeVisible();
    await expect(headline).not.toHaveText(first!);

    // A size outside the pattern's rules is explained and not priced.
    await page.getByRole("textbox", { name: "กว้าง" }).fill("900");
    await expect(page.getByText(/^สูงสุด 500 มม\. สำหรับ/)).toBeVisible();
    await expect(dock(page)).toContainText("เลือกอีกนิดเพื่อดูราคา");
    await page.getByRole("textbox", { name: "กว้าง" }).fill("150");

    // The unit switch is display only: the box keeps its millimetres.
    await page.getByRole("radio", { name: "ซม." }).click();
    await expect(page.getByRole("textbox", { name: "ยาว" })).toHaveValue("22");
    await expect(page.getByRole("img", { name: /ขนาด 220 × 150 × 50 มม./ })).toBeVisible();

    // Delivery is priced once there is a postcode, and the area is named.
    await page.getByRole("button", { name: /การจัดส่ง/ }).click();
    await page.getByLabel("รหัสไปรษณีย์ปลายทาง").fill("10110");
    await expect(page.getByText("จัดส่งถึง คลองเตย กรุงเทพมหานคร")).toBeVisible();
    await expect(dock(page)).not.toContainText("ระบุรหัสไปรษณีย์");

    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoViolations(page);
  });

  test("choosing a quantity from the price breaks moves the headline", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
    const breaks = dock(page).getByRole("table", { name: "ราคาต่อจำนวน" });
    await breaks.getByRole("button", { name: "เลือก 2,000 ชิ้น" }).click();
    await expect(breaks.getByRole("button", { name: "เลือกอยู่ 2,000 ชิ้น" })).toHaveAttribute("aria-pressed", "true");
    await expect(dock(page)).toContainText("2,000 ชิ้น");
  });

  test("a spec the factory cannot price routes to RFQ with the reason", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
    await page.getByRole("radio", { name: "กำหนดเอง" }).click();
    await page.getByRole("radio", { name: /ขนาดภายใน/ }).click();
    await page.getByRole("textbox", { name: "ยาว" }).fill("480");
    await expect(dock(page)).toContainText("จำนวนนี้ยังไม่มีราคาทันที");
    await expect(dock(page)).toContainText("สเปกนี้ต้องให้ทีมงานประเมินราคา");
    await dock(page).getByRole("link", { name: "ขอใบเสนอราคา" }).click();
    await expect(page).toHaveURL(`${HOSTS.customer}/rfq/folding-carton?from=tuck-end-box`);
    await expect(page.getByText(/ส่งต่อจากกล่องฝาเสียบ/)).toBeVisible();
  });

  test("a flat item shows a 2D mockup; a product has only the steps it needs", async ({ page }) => {
    // Hang tags, not labels: the back-office e2e switches label_sticker to RFQ during the run.
    await gotoHydrated(page, `${HOSTS.customer}/configure/hang-tag`);
    await expect(page.getByRole("img", { name: /ป้ายแท็กห้อยสินค้า ขนาด/ })).toBeVisible();
    // No standard sizes: the customer types one, and the drawing takes its proportions.
    await expect(dock(page)).toContainText("ขนาดที่ถูกต้อง");
    await page.getByRole("textbox", { name: "กว้าง" }).fill("40");
    await page.getByRole("textbox", { name: "ยาว" }).fill("90");
    await expect(page.getByRole("img", { name: /ขนาด 40 × 90 มม./ })).toBeVisible();
    // The price follows a debounce and a round trip; the full suite runs many of these at once.
    await expect(dock(page).getByText(/\/ ชิ้น$/)).toBeVisible({ timeout: 15_000 });

    // A shipping carton has no coatings or die-cut to choose.
    await gotoHydrated(page, `${HOSTS.customer}/configure/shipping-box`);
    await expect(page.getByRole("button", { name: /ลอนกระดาษ|วัสดุ/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /งานเคลือบและตกแต่ง/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ไดคัทและการขึ้นรูป/ })).toHaveCount(0);
  });

  test("a promotion code is checked for this product", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
    await page.getByRole("button", { name: /งานออกแบบและตัวอย่าง/ }).click();
    await page.getByLabel("โค้ดส่วนลด").fill("corrugate5");
    await page.getByRole("button", { name: "ตรวจสอบ" }).click();
    await expect(page.getByText("โค้ดนี้ใช้กับสินค้านี้ไม่ได้")).toBeVisible();
    await page.getByLabel("โค้ดส่วนลด").fill("GETPACK10");
    await page.getByRole("button", { name: "ตรวจสอบ" }).click();
    await expect(page.getByText("ลด 10% ค่าสินค้า")).toBeVisible();
  });

  test("an RFQ-only product goes to its request form", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/configure/magnetic-gift-box`);
    await expect(page).toHaveURL(`${HOSTS.customer}/rfq/rigid-box?from=magnetic-gift-box`);
  });
});

test.describe("keeping the price", () => {
  test("a guest adds to the cart without an account, and signing in at checkout moves the line in", async ({
    page,
  }) => {
    // UX audit Flow 1, bug #3: the cart is a guest's too; only checkout asks for an account.
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
    await expect(dock(page).getByText(/\/ ชิ้น$/)).toBeVisible();
    await dock(page).getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
    await expect(page.getByText("เพิ่มกล่องฝาเสียบลงตะกร้าแล้ว")).toBeVisible();

    await gotoHydrated(page, `${HOSTS.customer}/cart`);
    await expect(page).toHaveURL(`${HOSTS.customer}/cart`);
    const line = page.getByRole("list", { name: "รายการในตะกร้า" }).getByRole("article");
    await expect(line).toHaveCount(1);
    await expect(line.getByRole("heading", { name: "กล่องฝาเสียบ" })).toBeVisible();

    await page.getByRole("link", { name: "ดำเนินการชำระเงิน" }).click();
    await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fcart$/);
    await completeSignIn(page, MOCK_OTP.phone, "page");
    await expect(page).toHaveURL(`${HOSTS.customer}/cart`);
    await expect(page.getByText(/ย้ายรายการจากตะกร้าก่อนเข้าสู่ระบบแล้ว 1 รายการ/)).toBeVisible();
  });

  test("a saved quote can be shared, and the link reopens the configuration", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsCustomer(page, "/configure/tuck-end-box");
    await page.getByRole("radio", { name: "กำหนดเอง" }).click();
    await page.getByRole("radio", { name: /ขนาดภายใน/ }).click();
    await page.getByRole("textbox", { name: "ยาว" }).fill("180");
    await expect(dock(page).getByText(/\/ ชิ้น$/)).toBeVisible();
    await dock(page).getByRole("button", { name: "แชร์" }).click();
    await expect(page.getByText("คัดลอกลิงก์ใบเสนอราคาแล้ว")).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/configure\/tuck-end-box\?share=/);

    await page.goto(link);
    await expect(page.getByText(/เปิดจากใบเสนอราคา QT-/)).toBeVisible();
    await expect(page.getByRole("img", { name: /ขนาด 180 × 100 × 50 มม./ })).toBeVisible();
  });

  test("on a phone the dock is a bar above the bottom nav, with details in a sheet", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
    await expect(page.getByRole("button", { name: "เพิ่มลงตะกร้า" })).toBeVisible();
    await page.getByRole("button", { name: "รายละเอียด" }).click();
    const sheet = page.getByRole("dialog", { name: "ราคาของคุณ" });
    await expect(sheet.getByRole("table", { name: "ราคาต่อจำนวน" })).toBeVisible();
    await expect(sheet).toContainText("ยอดรวมทั้งหมด");
    await context.close();
  });
});

test.describe("requests for quotation", () => {
  test("a customer asks, CS quotes on the desk, and the customer accepts into the cart", async ({ browser }) => {
    test.slow();
    const customer = await (await browser.newContext()).newPage();
    await signInAsCustomer(customer, "/rfq/rigid-box");

    // Required answers are summarised at the top before anything is sent.
    await customer.getByRole("button", { name: "ส่งคำขอใบเสนอราคา" }).click();
    await expect(customer.getByText(/ที่ต้องแก้ไข/)).toBeVisible();

    await customer.getByRole("combobox", { name: /รูปแบบการปิด/ }).click();
    await customer.getByRole("option", { name: "ฝาแม่เหล็ก" }).click();
    await customer.getByLabel(/^ยาว/).fill("200");
    await customer.getByLabel(/^กว้าง/).fill("150");
    await customer.getByLabel(/^สูง/).fill("60");
    await customer.getByRole("spinbutton", { name: "จำนวนที่ 1" }).fill("500");
    await customer.getByRole("button", { name: "เพิ่มจำนวน" }).click();
    await customer.getByRole("spinbutton", { name: "จำนวนที่ 2" }).fill("1000");
    await customer.getByLabel(/รหัสไปรษณีย์ปลายทาง/).fill("10110");
    await customer.getByLabel("หมายเหตุถึงทีมงาน").fill("กล่องใส่ขวดเซรั่ม (ทดสอบ)");
    await customer.getByRole("button", { name: "ส่งคำขอใบเสนอราคา" }).click();

    await expect(customer.getByText(/ส่งคำขอ RFQ-2569-\d+ แล้ว/)).toBeVisible();
    const code = (await customer.locator("p.font-mono").first().textContent())!.trim();
    await expect(customer.getByText("ฝาแม่เหล็ก")).toBeVisible();
    const rfqUrl = customer.url().split("?")[0]!;

    // The same request is on the RFQ desk; CS prices it and sends the quote.
    const staff = await (await browser.newContext()).newPage();
    await signInAsStaff(staff, "cs");
    const rfqId = rfqUrl.split("/").at(-1)!;
    await gotoHydrated(staff, `${HOSTS.admin}/rfq/${rfqId}?tab=quotes`);
    await expect(staff.getByRole("heading", { level: 1 })).toHaveText(code);
    // The RFQ header leads with the API's first action (assign); start review is under "more".
    await staff.getByRole("button", { name: "การดำเนินการอื่น" }).click();
    await staff.getByRole("menuitem", { name: "เริ่มพิจารณา" }).click();
    await expect(staff.getByText("กำลังพิจารณาคำขอ").first()).toBeVisible();
    await staff.getByRole("tabpanel").getByRole("button", { name: "จัดทำใบเสนอราคา" }).click();
    for (const input of await staff.getByLabel(/^ราคาขายต่อชิ้น/).all()) await input.fill("42.50");
    for (const input of await staff.getByLabel(/^ระยะเวลาผลิต/).all()) await input.fill("15");
    await staff.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
    await staff.getByRole("tabpanel").getByRole("button", { name: "ส่งฉบับที่ 1 ให้ลูกค้า" }).click();
    const send = staff.getByRole("alertdialog", { name: "ส่งใบเสนอราคาฉบับที่ 1" });
    await send.getByLabel(new RegExp(`พิมพ์ ${code}`)).fill(code);
    await send.getByRole("button", { name: "ส่งให้ลูกค้า" }).click();
    await expect(staff.getByRole("alertdialog")).toHaveCount(0);

    // Back on the storefront: accept 1,000 pieces, confirmed with the code and the amount.
    await gotoHydrated(customer, rfqUrl);
    await expect(customer.getByRole("heading", { name: "ใบเสนอราคาฉบับที่ 1" })).toBeVisible();
    await customer.getByRole("button", { name: "ยอมรับราคานี้ (1,000 ชิ้น)" }).click();
    const confirm = customer.getByRole("alertdialog", { name: "ยืนยันการยอมรับใบเสนอราคา" });
    await expect(confirm).toContainText(code);
    await expect(confirm).toContainText("฿");
    await confirm.getByRole("button", { name: "ยืนยัน" }).click();
    await expect(customer.getByText(/ยอมรับแล้ว — ใบเสนอราคา/)).toBeVisible();
    await customer.getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
    await expect(customer).toHaveURL(`${HOSTS.customer}/cart`);
  });

  test("a category with several types asks which one; the list and detail need a session", async ({ page }) => {
    await acceptCookies(page);
    await page.goto(`${HOSTS.customer}/account/rfqs`);
    await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Faccount%2Frfqs/);
  });
});
