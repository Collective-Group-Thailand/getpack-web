import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_ARTIST_PHONE, signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F3 3.5 end to end: a customer uploads artwork, preflight answers, prepress
 * (in the admin zone) accepts it and sends a proof, and the customer comments on the proof and
 * approves it — the dialog restating the order. Then hired design: the free
 * rounds counted, and a charged round only after the fee is accepted (D-071).
 *
 * The artwork flow owns the `artist` persona's unpaid order; the design flow reads the returning
 * customer's hired-design order.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PDF = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% mock\n") });

async function expectNoViolations(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

/** `mocks/admin/commerce.ts` orders: the artist's (fourth customer) and the returning customer's. */
const ARTIST_ORDER = "00000000-0000-4000-8000-6f7264000004";
const ARTIST_CODE = "PK-2569-00103";
const DESIGN_ORDER = "00000000-0000-4000-8000-6f7264000001";

test.describe.configure({ mode: "serial" });

test.describe("artwork and proofs", () => {
  test("a file is uploaded against the rules and preflight answers", async ({ page }) => {
    await signInAsCustomer(page, `/account/orders/${ARTIST_ORDER}`, MOCK_ARTIST_PHONE);
    await page
      .getByRole("link", { name: /ส่งไฟล์งาน/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/account/orders/${ARTIST_ORDER}/artwork$`));
    await expect(page.getByRole("heading", { level: 1, name: "ไฟล์งานพิมพ์" })).toBeVisible();
    // The order's rules: what preflight checks, and the box it is laid out on.
    await expect(page.getByText(/ผ่านการตรวจอัตโนมัติ/)).toBeVisible();
    await expect(page.getByText("ระยะตัดตกด้านละ 3 มม.")).toBeVisible();
    await page.getByRole("button", { name: "ดาวน์โหลดแบบไดคัท" }).click();
    await expect(page.getByRole("link", { name: "เปิดแบบไดคัท" })).toHaveAttribute("href", /^data:image\/svg/);
    await expectNoViolations(page);

    await page.locator('input[type="file"]').setInputFiles(PDF("box-front.pdf"));
    await expect(page.getByText("อัปโหลดแล้ว")).toBeVisible();
    await page.getByLabel(/หมายเหตุถึงทีมพรีเพรส/).fill("ด้านโลโก้คือด้านหน้า");
    await page.getByRole("button", { name: "ส่งไฟล์ให้ตรวจ" }).click();
    await expect(page.getByText("ไฟล์ผ่านการตรวจเบื้องต้น ทีมพรีเพรสจะจัดทำแบบตัวอย่างให้")).toBeVisible();
    await expect(page.getByRole("region", { name: "ไฟล์ที่ส่งแล้ว" })).toContainText("ฉบับที่ 1");
  });

  test("prepress accepts it and sends a proof from the admin zone", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInAsStaff(page, "prepress");
    await gotoHydrated(page, `${HOSTS.admin}/prepress/${ARTIST_ORDER}`);
    await page.getByRole("button", { name: "รับไปทำ Proof" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "รับไปทำ Proof" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await page.getByRole("button", { name: "อัปโหลดและส่ง Proof" }).click();
    const dialog = page.getByRole("alertdialog", { name: "ส่ง Proof ฉบับที่ 1" });
    await dialog.locator('input[type="file"]').first().setInputFiles(PDF("proof.pdf"));
    await dialog.getByRole("button", { name: "อัปโหลดและส่ง" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await context.close();
  });

  test("the customer comments on the proof and approves it", async ({ page }) => {
    await signInAsCustomer(page, `/account/orders/${ARTIST_ORDER}/artwork`, MOCK_ARTIST_PHONE);
    await page.getByRole("link", { name: "ตรวจแบบตัวอย่าง" }).first().click();
    await expect(page).toHaveURL(/\/proof\?version=1$/);
    await expect(page.getByRole("img", { name: "ภาพแบบตัวอย่าง v1" })).toBeVisible();

    // Zoom and the dieline toggle.
    await page.getByRole("button", { name: "ซูมเข้า" }).click();
    await expect(page.getByRole("group", { name: "ซูม" })).toContainText("150%");
    // File, dieline or both (UX audit, proof review): the file alone hides the dieline.
    await page.getByRole("radio", { name: "ไฟล์" }).click();
    await expect(page.getByRole("radio", { name: "ไฟล์" })).toBeChecked();

    // A comment without pointing (WCAG 2.5.7), then a pin by pointer.
    await page.getByRole("button", { name: "แสดงความเห็นทั้งหน้า" }).click();
    await page.getByLabel("ความเห็น", { exact: true }).fill("ขอสีพื้นหลังเข้มขึ้นเล็กน้อย");
    await page.getByRole("button", { name: "บันทึกความเห็น" }).click();
    await expect(page.getByRole("button", { name: /^ความเห็นที่ 1: ขอสีพื้นหลัง/ })).toBeVisible();

    await page.getByRole("radio", { name: "ปักหมุด" }).click();
    await page.getByRole("img", { name: "ภาพแบบตัวอย่าง v1" }).click({ position: { x: 120, y: 90 }, force: true });
    await page.getByLabel("ความเห็น", { exact: true }).fill("โลโก้ชิดขอบเกินไป");
    await page.getByRole("button", { name: "บันทึกความเห็น" }).click();
    await expect(page.getByRole("heading", { name: "ความเห็น (2)" })).toBeVisible();
    await expectNoViolations(page);

    // Approval waits for every checklist item (`artwork.approval_checklist`), then restates what is
    // being approved and asks for the order code (irreversible, D-073).
    const approve = page.getByRole("button", { name: "อนุมัติเพื่อผลิต" });
    await expect(approve).toBeDisabled();
    const checklist = page.getByRole("group", { name: "ตรวจทุกข้อก่อนอนุมัติ" });
    for (const box of await checklist.getByRole("checkbox").all()) await box.click();
    await approve.click();
    const dialog = page.getByRole("alertdialog", { name: "อนุมัติแบบตัวอย่าง v1?" });
    await expect(dialog).toContainText(ARTIST_CODE);
    await dialog.getByRole("textbox").fill(ARTIST_CODE);
    await dialog.getByRole("button", { name: "อนุมัติเพื่อผลิต" }).click();
    await expect(page.getByText("อนุมัติแล้ว", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("complementary", { name: "ความเห็นและการอนุมัติ" })).toContainText(
      /เมื่อ .+ลายนิ้วมือไฟล์/,
    );
    await expect(page.getByRole("button", { name: "อนุมัติเพื่อผลิต" })).toHaveCount(0);
  });

  test("the approval record names who approved and what they confirmed", async ({ page }) => {
    await signInAsCustomer(page, `/account/orders/${ARTIST_ORDER}/proof`, MOCK_ARTIST_PHONE);
    const record = page.getByRole("complementary", { name: "ความเห็นและการอนุมัติ" });
    await expect(record).toContainText(/ตัดสินใจเมื่อ/);
    await expect(record).toContainText("ตรวจตัวสะกดและข้อความครบแล้ว");
  });

  test("the proof opens as the box in 3D", async ({ page }) => {
    await signInAsCustomer(page, `/account/orders/${ARTIST_ORDER}/proof`, MOCK_ARTIST_PHONE);
    await page.getByRole("radio", { name: "กล่อง 3D" }).click();
    await expect(page.getByRole("img", { name: /ตัวอย่างกล่อง 3 มิติ ขนาด 80 × 50 × 120 มม\./ })).toBeVisible();
  });
});

test.describe("hired design (D-071)", () => {
  test("the free rounds are counted and a charged round waits for the fee to be accepted", async ({ page }) => {
    await signInAsCustomer(page, `/account/orders/${DESIGN_ORDER}/artwork`);
    await expect(page.getByRole("heading", { name: "บริการออกแบบ" })).toBeVisible();
    await expect(page.getByText("ใช้ไป 3 จาก 3 รอบ เหลือ 0 รอบ").first()).toBeVisible();
    await expectNoViolations(page);

    await page.getByLabel(/ต้องการแก้อะไร/).fill("เปลี่ยนสีพื้นหลังเป็นสีครีม");
    const request = page.getByRole("button", { name: "ขอแก้ไข" });
    await expect(request).toBeDisabled();
    // The API quotes the fee with VAT (`nextRevision.feeGross`), and the customer confirms that figure.
    await page.getByRole("checkbox", { name: /ฉันยอมรับค่าแก้ไข ฿535\.00/ }).click();
    await request.click();
    await expect(page.getByText("รอชำระค่าแก้ไข", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "ชำระค่าแก้ไข" })).toBeVisible();
  });
});
