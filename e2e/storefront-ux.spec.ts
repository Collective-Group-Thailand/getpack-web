import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_ARTIST_PHONE, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * U5.1–U5.4, U5.6, U5.7 against the mock API: the launchpad, notification deep links, a
 * conversation from the storefront to the CS inbox and back, the multi-item RFQ basket, the
 * glossary, materials and learning paths, first-run guidance, and no dead ends.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** The returning customer of `mocks/store/customers.ts`. */
const RETURNING_ID = "00000000-0000-4000-8000-000000000001";
const COMPANY_BUYER = "0878901234";

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).exclude("[data-sonner-toaster]").analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

/** A mock deep-link token (`mocks/store/launchpad.ts` `mockDeepLink`). */
const deepLink = (link: { path: string; customerId: string; expired?: boolean }) =>
  `sMOCK${Buffer.from(JSON.stringify(link)).toString("base64url")}`;

test.describe("U5.1 — the signed-in home and deep links", () => {
  test("the launchpad leads with one recommended step", async ({ page }) => {
    await signInAsCustomer(page, "/account");
    const next = page.locator("section[aria-labelledby=launchpad-next]");
    await expect(next.getByText("ขั้นต่อไปที่แนะนำ")).toBeVisible();
    await expect(next.getByRole("link")).toHaveAttribute("href", /\/(account|studio|products)/);
    // What already stood on the home is still there.
    await expect(page.getByRole("heading", { name: "ตอนนี้งานของคุณอยู่ไหน" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("a notification link opens its page after sign-in; an expired one says so and offers a way on", async ({
    page,
  }) => {
    const token = deepLink({ path: "/account/orders", customerId: RETURNING_ID });
    await signInAsCustomer(page, "/account");
    await gotoHydrated(page, `${HOSTS.customer}/l/${token}`);
    await expect(page).toHaveURL(`${HOSTS.customer}/account/orders`);

    await gotoHydrated(
      page,
      `${HOSTS.customer}/l/${deepLink({ path: "/account", customerId: RETURNING_ID, expired: true })}`,
    );
    await expect(page.getByText("ลิงก์นี้หมดอายุแล้ว").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "ไปที่บัญชีของฉัน" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("a guest following a customer link is asked to sign in and comes back to it", async ({ page }) => {
    const token = deepLink({ path: "/account/orders", customerId: RETURNING_ID });
    await gotoHydrated(page, `${HOSTS.customer}/l/${token}`);
    await expect(page).toHaveURL(new RegExp(`/sign-in\\?returnTo=${encodeURIComponent(`/l/${token}`)}`));
  });

  test("a staff link on the storefront host goes to the admin host", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/l/aABCDEFGHIJKLmnop`);
    await expect(page).toHaveURL(new RegExp(`^${HOSTS.admin}/`));
  });

  test("a page that does not exist offers home, search and help", async ({ page }) => {
    await page.goto(`${HOSTS.customer}/no-such-page-u5`);
    for (const name of ["กลับหน้าแรก", "ค้นหา", "ศูนย์ช่วยเหลือ"])
      await expect(page.getByRole("link", { name })).toBeVisible();
  });
});

test.describe("U5.3 — messaging", () => {
  test("a customer writes, CS answers from the inbox with a note the customer never sees", async ({ browser }) => {
    test.slow();
    const customer = await (await browser.newContext()).newPage();
    await signInAsCustomer(customer, "/account/messages", MOCK_ARTIST_PHONE);
    await expectNoViolations(customer);
    // A rerun against the same mock finds the support thread already open: continue it there.
    const existing = customer.getByRole("link", { name: "เปิดบทสนทนา" });
    if (await existing.isVisible()) await existing.click();
    await customer.getByRole("textbox", { name: "พิมพ์ข้อความ" }).fill("ขอถามเรื่องกล่องลูกฟูกพิมพ์สองสี (ทดสอบ)");
    await customer.getByRole("button", { name: "ส่ง", exact: true }).click();
    await expect(customer).toHaveURL(/\/account\/messages\/[0-9a-f-]+$/);
    await expect(customer.getByText("ขอถามเรื่องกล่องลูกฟูกพิมพ์สองสี (ทดสอบ)")).toBeVisible();
    await expect(customer.getByText("ส่งแล้ว").first()).toBeVisible();
    await expectNoViolations(customer);
    const threadUrl = customer.url();
    const threadId = threadUrl.split("/").at(-1)!;

    const staff = await (await browser.newContext()).newPage();
    await signInAsStaff(staff, "cs");
    await gotoHydrated(staff, `${HOSTS.admin}/inbox`);
    await expect(staff.getByRole("heading", { level: 1, name: "กล่องข้อความลูกค้า" })).toBeVisible();
    await gotoHydrated(staff, `${HOSTS.admin}/inbox/${threadId}`);
    await expect(staff.getByText("ขอถามเรื่องกล่องลูกฟูกพิมพ์สองสี (ทดสอบ)")).toBeVisible();
    await expectNoViolations(staff);

    await staff.getByRole("switch", { name: "บันทึกภายใน" }).click();
    await staff.getByRole("textbox", { name: "บันทึกภายใน (ลูกค้าไม่เห็น)" }).fill("ลูกค้าประจำ (ทดสอบ)");
    await staff.getByRole("button", { name: "เพิ่มบันทึก" }).click();
    await expect(staff.getByText("ลูกค้าประจำ (ทดสอบ)")).toBeVisible();
    await staff.getByRole("switch", { name: "บันทึกภายใน" }).click();
    await staff.getByRole("textbox", { name: "ตอบลูกค้า" }).fill("พิมพ์สองสีได้ค่ะ (ทดสอบ)");
    await expect(staff.getByRole("button", { name: "ส่งคำตอบ" })).toBeEnabled({ timeout: 15_000 });
    await staff.getByRole("button", { name: "ส่งคำตอบ" }).click();
    await expect(staff.getByText("พิมพ์สองสีได้ค่ะ (ทดสอบ)")).toBeVisible();

    await gotoHydrated(customer, threadUrl);
    await expect(customer.getByText("พิมพ์สองสีได้ค่ะ (ทดสอบ)")).toBeVisible();
    await expect(customer.getByText("ลูกค้าประจำ (ทดสอบ)")).toHaveCount(0);
    await expect(customer.getByText(/ทีมอ่านล่าสุด/)).toBeVisible();
  });
});

test.describe("U5.4 — the RFQ basket", () => {
  test("two items go into the basket and leave as one submission", async ({ page }) => {
    test.slow();
    await signInAsCustomer(page, "/rfq/rigid-box", COMPANY_BUYER);
    await page.getByRole("combobox", { name: /รูปแบบการปิด/ }).click();
    await page.getByRole("option", { name: "ฝาแม่เหล็ก" }).click();
    await page.getByLabel(/^ยาว/).fill("200");
    await page.getByLabel(/^กว้าง/).fill("150");
    await page.getByLabel(/^สูง/).fill("60");
    await page.getByRole("button", { name: "เพิ่มลงตะกร้าคำขอ" }).click();
    await expect(page).toHaveURL(/\/rfq\/basket\?added=1$/);
    await expect(page.getByText("รายการในตะกร้า (1)")).toBeVisible();

    await gotoHydrated(page, `${HOSTS.customer}/rfq/rigid-box`);
    await page.getByRole("combobox", { name: /รูปแบบการปิด/ }).click();
    await page.getByRole("option", { name: "ลิ้นชัก" }).click();
    await page.getByLabel(/^ยาว/).fill("120");
    await page.getByLabel(/^กว้าง/).fill("80");
    await page.getByLabel(/^สูง/).fill("40");
    await page.getByRole("button", { name: "เพิ่มลงตะกร้าคำขอ" }).click();
    await expect(page.getByText("รายการในตะกร้า (2)")).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole("button", { name: "ส่งคำขอ 2 รายการ" }).click();
    await expect(page.getByText("ใส่รหัสไปรษณีย์ 5 หลัก")).toBeVisible();
    await page.getByLabel(/รหัสไปรษณีย์ปลายทาง/).fill("10110");
    await page.getByRole("button", { name: "ส่งคำขอ 2 รายการ" }).click();
    await expect(page).toHaveURL(/\/account\/rfq-baskets\/[0-9a-f-]+\?submitted=1$/);
    await expect(page.getByRole("heading", { level: 1, name: /ตะกร้า RFB-/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^RFQ-/ })).toHaveCount(2);
    await expect(page.getByText("รอทีมเสนอราคา")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "คุยกับทีมเรื่องตะกร้านี้" })).toBeVisible();
    await expectNoViolations(page);
  });
});

test.describe("U5.2 / U5.6 — content that teaches", () => {
  test("the glossary, its chips, the materials library and a learning path", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/help/glossary`);
    await expectNoViolations(page);
    await gotoHydrated(page, `${HOSTS.customer}/help/glossary#bleed`);
    await expect(page.locator("#bleed")).toContainText("ระยะตัดตก");
    await page.getByRole("searchbox", { name: "ค้นหาคำศัพท์" }).fill("ลอนอี");
    await expect(page.locator("#e-flute")).toBeVisible();
    await expect(page.locator("#bleed")).toHaveCount(0);

    await gotoHydrated(page, `${HOSTS.customer}/materials`);
    const cards = page.getByRole("listitem").filter({ has: page.getByRole("checkbox") });
    await cards.nth(0).getByRole("checkbox").check();
    await cards.nth(1).getByRole("checkbox").check();
    await expect(page.getByRole("heading", { name: "เปรียบเทียบ 2 วัสดุ" })).toBeVisible();
    await expectNoViolations(page);
    await page.getByRole("link", { name: "ใช้วัสดุนี้" }).first().click();
    await expect(page).toHaveURL(/\/configure\/[a-z0-9-]+\?material=/);

    await gotoHydrated(page, `${HOSTS.customer}/learn`);
    await page.getByRole("link", { name: /เลือกวัสดุให้ประหยัด/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "เลือกวัสดุให้ประหยัด" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ลองกับวัสดุที่แนะนำ" })).toHaveAttribute(
      "href",
      /\/configure\/.+\?material=/,
    );
    // After a client navigation the page's metadata streams in; axe reads the title.
    await expect(page).toHaveTitle(/เลือกวัสดุให้ประหยัด/);
    await expectNoViolations(page);
  });

  test("the dieline download says how to open each format", async ({ page }) => {
    await signInAsCustomer(page, "/styles");
    await gotoHydrated(page, `${HOSTS.customer}/styles/pk-te-01`);
    await page.getByRole("button", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" }).click();
    const panel = page.getByRole("region", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" });
    await expect(panel.getByRole("list", { name: "วิธีเปิดไฟล์ PDF" }).getByRole("listitem")).toHaveCount(3);
    await panel.getByRole("radio", { name: "DXF" }).click();
    await expect(panel.getByRole("list", { name: "วิธีเปิดไฟล์ DXF" })).toBeVisible();
  });
});

test.describe("U5.2 — first visit", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the configurator asks what brings you here, and remembers the answer", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
    const picker = page.locator("section[aria-labelledby=intent-title]");
    await expect(picker.getByRole("heading", { name: "วันนี้อยากเริ่มจากอะไร" })).toBeVisible();
    await expectNoViolations(page);
    await picker.getByRole("button", { name: /ยังไม่มีแบบ ช่วยออกแบบ/ }).click();
    await expect(page).toHaveURL(/\/studio\/new\?product=tuck-end-box/);
    await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
    await expect(page.getByRole("button", { name: "ไม่แน่ใจว่าจะเริ่มยังไง? ให้เราช่วยแนะนำ" })).toBeVisible();
  });

  test("the studio shows three tips once, dismissible and back from the question mark", async ({ page }) => {
    await gotoHydrated(
      page,
      `${HOSTS.customer}/studio/new?product=tuck-end-box&style=tuck-end&l=70&w=40&h=150&step=design`,
    );
    const setup = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
    if (await setup.isVisible()) await setup.getByRole("button", { name: "เริ่มออกแบบ" }).click();
    const tip = page.getByRole("dialog", { name: /คำแนะนำ 1 จาก 3/ });
    await expect(tip).toBeVisible();
    await tip.getByRole("button", { name: "ถัดไป" }).click();
    await page
      .getByRole("dialog", { name: /คำแนะนำ 2 จาก 3/ })
      .getByRole("button", { name: "ข้าม" })
      .click();
    await expect(page.getByRole("dialog", { name: /คำแนะนำ/ })).toHaveCount(0);
    await page.reload();
    await page.locator("html[data-hydrated]").waitFor();
    // A guest's unsaved box starts again at the setup; the tips do not come back.
    if (await setup.isVisible()) await setup.getByRole("button", { name: "เริ่มออกแบบ" }).click();
    await expect(page.getByRole("dialog", { name: /คำแนะนำ/ })).toHaveCount(0);
    await page.getByRole("button", { name: "เปิดคำแนะนำสตูดิโอ" }).click();
    await expect(page.getByRole("dialog", { name: /คำแนะนำ 1 จาก 3/ })).toBeVisible();
  });
});
