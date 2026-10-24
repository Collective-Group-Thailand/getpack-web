import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";
import { choiceList } from "./helpers/select";

/**
 * F3 3.7 end to end: getpack for business, LINE LIFF and help.
 *
 * A founder signs a company up with its KYC documents; a company buyer's order over the
 * threshold waits for the approver, who places it (D-123); the admin invites a member and
 * reorders in bulk from CSV lines; LIFF shows orders and points in LINE's frame; the contact
 * form, the sample kit and the hand-off to CS each come back with a reference (guided help and
 * sample kits wait for U2.2 / U2.4, D-223: the kit page is reached by its address only). The B2B
 * personas (`companyadmin`, `companybuyer`, `founder`) are this spec's alone.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PHONES = { admin: "0867890123", buyer: "0878901234", founder: "0889012345" };
const PDF = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% mock\n") });

async function expectNoViolations(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

const dock = (page: Page) => page.getByRole("complementary", { name: "ราคาของคุณ" });

test.describe.configure({ mode: "serial" });

test.describe("getpack for business", () => {
  test("a visitor reads what a company account adds", async ({ page }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/business`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ในนามบริษัท");
    await expect(page.getByRole("link", { name: "เปิดบัญชีบริษัท" })).toHaveAttribute(
      "href",
      /sign-in\?returnTo=%2Fbusiness%2Fapply/,
    );
    await expectNoViolations(page);
  });

  test("a company signs up with its KYC documents and waits for review (D-120)", async ({ page }) => {
    await signInAsCustomer(page, "/business/apply", PHONES.founder);
    await expect(page.getByRole("heading", { level: 1, name: "เปิดบัญชีบริษัท" })).toBeVisible();
    await page.getByRole("button", { name: "ส่งใบสมัคร" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "กรุณาแก้" })).toContainText("กรุณาแนบหนังสือรับรองบริษัท");

    await page.getByLabel(/^ชื่อนิติบุคคล/).fill("บริษัท ทดสอบอีทูอี จำกัด");
    await page.getByLabel(/^เลขประจำตัวผู้เสียภาษี/).fill("0105556000017");
    // The head office starts from its postcode, which gives the area it is filed under.
    await page.getByLabel(/^รหัสไปรษณีย์/).fill("10110");
    await expect(choiceList(page, /^แขวง\/ตำบล/)).toContainText("คลองเตย");
    await page.getByLabel(/^เลขที่ อาคาร ถนน/).fill("1 ถนนทดสอบ");
    await page.getByLabel(/^ชื่อ-นามสกุล/).fill("สมใจ ทดสอบ");
    await page.getByLabel(/^ตำแหน่ง/).fill("กรรมการผู้จัดการ");
    await page.getByLabel(/^วันที่ออกหนังสือรับรอง/).fill(new Date().toISOString().slice(0, 10));
    const files = page.locator('input[type="file"]');
    await files.nth(0).setInputFiles(PDF("certificate.pdf"));
    await files.nth(1).setInputFiles(PDF("pp20.pdf"));
    await files.nth(2).setInputFiles(PDF("signatory-id.pdf"));
    await expect(page.getByText(/^อัปโหลด .+ แล้ว$/)).toHaveCount(3);
    await expectNoViolations(page);
    await page.getByRole("button", { name: "ส่งใบสมัคร" }).click();

    await expect(page).toHaveURL(/\/business\?applied=1$/);
    await expect(page.getByRole("heading", { level: 1, name: "บริษัท ทดสอบอีทูอี จำกัด" })).toBeVisible();
    await expect(page.getByText("กำลังตรวจเอกสาร", { exact: true })).toBeVisible();
    await expect(page.getByText("ส่งใบสมัครแล้ว")).toBeVisible();
  });

  test("a buyer's order over the threshold waits for the approver, who places it (D-123)", async ({
    page,
    browser,
  }) => {
    test.slow();
    await signInAsCustomer(page, "/configure/tuck-end-box", PHONES.buyer);
    // Two lines of 3,000 go over the company's THB 50,000 threshold.
    for (let line = 0; line < 2; line += 1) {
      await gotoHydrated(page, `${HOSTS.customer}/configure/tuck-end-box`);
      await dock(page)
        .getByRole("table", { name: "ราคาต่อจำนวน" })
        .getByRole("button", { name: /เลือก\S*\s*3,000 ชิ้น/ })
        .click();
      await expect(dock(page)).toContainText("3,000 ชิ้น");
      await dock(page).getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
      await expect(page.getByText("เพิ่มกล่องฝาเสียบลงตะกร้าแล้ว").first()).toBeVisible();
    }

    await gotoHydrated(page, `${HOSTS.customer}/checkout`);
    const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
    // Without the PO the company requires, the preview is refused (companies.po_required).
    await expect(summary).toContainText("กรุณาใส่เลขที่ใบสั่งซื้อ (PO) ของบริษัท");
    await page.getByLabel(/^เลขที่ใบสั่งซื้อ \(PO\)/).fill("PO-E2E-01");
    await expect(summary).toContainText(/คำสั่งซื้อจะรอผู้อนุมัติของบริษัท/);
    const send = summary.getByRole("button", { name: "ส่งให้ผู้อนุมัติ" });
    await expect(send).toBeEnabled();
    await send.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ส่งให้ผู้อนุมัติ" }).click();
    await expect(page).toHaveURL(/\/business\/approvals\?sent=AP-/);
    const requestNo = new URL(page.url()).searchParams.get("sent")!;
    await expect(page.getByRole("status").filter({ hasText: requestNo })).toBeVisible();
    await expect(page.getByRole("heading", { name: new RegExp(requestNo) })).toBeVisible();

    const other = await browser.newContext();
    const approver = await other.newPage();
    await signInAsCustomer(approver, "/business/approvals", PHONES.admin);
    const card = approver.getByRole("article").filter({ hasText: requestNo });
    await expect(card).toContainText("PO-E2E-01");
    await expectNoViolations(approver);
    await card.getByRole("button", { name: `อนุมัติ ${requestNo}`, exact: true }).click();
    const dialog = approver.getByRole("alertdialog", { name: `อนุมัติ ${requestNo}?` });
    await expect(dialog).toContainText("฿");
    await dialog.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    await expect(approver.getByText(`อนุมัติ ${requestNo} แล้ว`)).toBeVisible();
    await other.close();
  });

  test("a decided approval says who decided, when, and how many orders it placed", async ({ page }) => {
    await signInAsCustomer(page, "/business/approvals?view=decided", PHONES.admin);
    const decided = page.getByRole("region", { name: "ประวัติล่าสุด" }).getByRole("listitem").first();
    await expect(decided).toContainText("อนุมัติแล้ว");
    await expect(decided).toContainText(/ตัดสินเมื่อ/);
    await expect(decided).toContainText("2 คำสั่งซื้อ");
  });

  test("the admin sees credit and statements, invites a member, and reorders in bulk (D-121, D-153)", async ({
    page,
  }) => {
    await signInAsCustomer(page, "/business", PHONES.admin);
    await expect(
      page.getByRole("region", { name: "เครดิตคงเหลือ" }).or(page.locator("section[aria-labelledby=dash-credit]")),
    ).toContainText("฿");
    await expectNoViolations(page);

    await gotoHydrated(page, `${HOSTS.customer}/business/credit`);
    // The statements issued so far, and what is owed by age (D-122, D-125).
    await expect(page.getByText(/ยอดวางบิล/).first()).toBeVisible();
    await expect(page.getByText("ยังไม่ถึงกำหนด")).toBeVisible();
    await page
      .getByRole("button", { name: /^ดาวน์โหลด / })
      .first()
      .click();
    await expect(page.getByRole("link", { name: /^เปิดไฟล์/ }).first()).toBeVisible();

    await gotoHydrated(page, `${HOSTS.customer}/business/members`);
    // An invitation goes to an existing getpack account, by phone (store.companies.inviteMember).
    await page.getByLabel(/^เบอร์มือถือ/).fill(PHONES.founder);
    await page.getByRole("checkbox", { name: /^ฝ่ายบัญชี/ }).click();
    await page.getByRole("button", { name: "ส่งคำเชิญ" }).click();
    await expect(
      page.getByRole("table", { name: "สมาชิกของบริษัท" }).getByRole("row", { name: /^ผู้ก่อตั้งบริษัท .*รอตอบรับ/ }),
    ).toBeVisible();

    await gotoHydrated(page, `${HOSTS.customer}/business/reorder`);
    await page.getByLabel(/^หรือวางรายการ/).fill("order,quantity\nPK-2569-00113,2000\nPK-0000-99999,1000\nnot a line!");
    await page.getByRole("button", { name: "ตรวจรายการ" }).click();
    await expect(page.getByText("อ่านไม่ได้ 1 บรรทัด")).toBeVisible();
    const table = page.getByRole("table", { name: "ผลการตรวจรายการสั่งซ้ำ" });
    await expect(table).toContainText("พร้อม");
    await expect(table).toContainText("ไม่พบคำสั่งซื้อนี้ในบริษัท");
    await expectNoViolations(page);
    await page.getByRole("button", { name: "ใส่ตะกร้า 1 รายการ" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("list", { name: "รายการในตะกร้า" }).locator(":scope > li")).toHaveCount(1);
  });
});

test.describe("LINE LIFF (D-151)", () => {
  test("orders, an order's stages and points in LINE's frame", async ({ page }) => {
    await signInAsCustomer(page, "/liff");
    await expect(page.getByRole("heading", { level: 1, name: /^สวัสดี/ })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "เมนู getpack ใน LINE" });
    await expect(tabs.getByRole("link", { name: "หน้าแรก" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await expectNoViolations(page);

    await tabs.getByRole("link", { name: "คำสั่งซื้อ" }).click();
    await page.getByRole("link", { name: /PK-2569-00136/ }).click();
    await expect(page.getByRole("list", { name: "ความคืบหน้าของคำสั่งซื้อ" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^สั่งซ้ำ/ })).toHaveAttribute("href", /\/liff\/orders\/.+\/reorder$/);

    await tabs.getByRole("link", { name: "คะแนน" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "คะแนนสะสม" })).toBeVisible();
    await tabs.getByRole("link", { name: "แชท" }).click();
    await expect(page.getByRole("link", { name: "เปิดแชทกับ getpack" })).toHaveAttribute(
      "href",
      /line\.me\/R\/oaMessage/,
    );
  });
});

test.describe("help", () => {
  test("the contact form comes back with a ticket", async ({ page }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/contact`);
    await page.getByRole("button", { name: "ส่งข้อความ" }).click();
    await expect(page.getByText("ใส่เบอร์โทรหรืออีเมลอย่างน้อยหนึ่งช่องทาง").first()).toBeVisible();
    await page.getByLabel(/^ชื่อ/).fill("ผู้ติดต่อทดสอบ");
    await page.getByLabel(/^อีเมล/).fill("contact.e2e@example.invalid");
    await page.getByLabel(/^ข้อความ/).fill("อยากทราบระยะเวลาผลิตกล่อง 3,000 ใบครับ");
    await expectNoViolations(page);
    await page.getByRole("button", { name: "ส่งข้อความ" }).click();
    await expect(page.getByRole("status").filter({ hasText: /เลขเรื่อง CS-2569-/ })).toBeVisible();
  });

  test("a sample kit is requested to an address", async ({ page }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/samples`);
    await page.getByRole("radio", { name: /ชุดตัวอย่างกระดาษ/ }).click();
    await page.getByLabel(/^ชื่อผู้รับ/).fill("ผู้รับทดสอบ");
    await page.getByLabel(/^เบอร์มือถือ/).fill("0801234567");
    await page.getByLabel(/^ที่อยู่/).fill("9 ถนนทดสอบ");
    await page.getByLabel(/^จังหวัด/).fill("กรุงเทพมหานคร");
    await page.getByLabel(/^รหัสไปรษณีย์/).fill("10110");
    await expectNoViolations(page);
    await page.getByRole("button", { name: "ขอชุดตัวอย่าง" }).click();
    await expect(page.getByRole("status").filter({ hasText: /SK-2569-/ })).toBeVisible();
  });

  test("the guided help recommends styles and hands off to CS with the context", async () => {
    // Not a contract gap: guided help waits for the Structure Advisor (U2.2), and D-223 hides it.
    test.fixme(true, "D-223 — guided help is deferred to U2.2; the storefront offers the hand-off alone");
  });

  test("a guest asks CS to call back, and the ticket comes back with the reply target", async ({ page }) => {
    await acceptCookies(page);
    await gotoHydrated(page, `${HOSTS.customer}/help/chat`);
    await page.getByRole("button", { name: "ให้ทีมโทรกลับ" }).click();
    await expect(page.getByRole("region", { name: "คุยกับทีม" }).getByRole("alert")).toContainText("ใส่ชื่อ");
    await page.getByLabel(/^ชื่อ/).fill("ผู้ติดต่อทดสอบ");
    await page.getByLabel(/^เบอร์มือถือ/).fill("0801234567");
    await expectNoViolations(page);
    await page.getByRole("button", { name: "ให้ทีมโทรกลับ" }).click();
    const done = page.getByRole("status").filter({ hasText: /ส่งต่อให้ทีมแล้ว เลขเรื่อง CS-2569-/ });
    await expect(done).toBeVisible();
    await expect(done).toContainText("ทีมจะติดต่อกลับภายใน");
  });
});
