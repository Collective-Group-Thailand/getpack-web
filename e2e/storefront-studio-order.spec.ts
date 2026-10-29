import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading } from "./helpers/designer";
import { gotoHydrated } from "./helpers/session";

/**
 * U4.6, ⑤ order from getpack 3D Studio against the mock API: the order sheet's tiers priced for the
 * saved version, "เพิ่มลงตะกร้า" saving the quotation, uploading the version's renders and ordering
 * it (a print job polled to success), then the cart with the version pinned at the studio's price —
 * and, once the order is placed, the design locked by it (editing makes a new version).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const STUDIO = /\/studio\/([0-9a-f-]{36})\?/;

/**
 * Only a style-library box prints from the studio (OrderSheet's `catalogueOnly`): opened from its
 * style page, with its variant code. The style page redirects to its named address, so it is opened
 * after signing in.
 */
async function openLibraryBox(page: Page, phone: string) {
  await signInAsCustomer(page, "/account", phone);
  await gotoHydrated(page, `${HOSTS.customer}/styles/pk-te-01`);
  await page.getByRole("button", { name: "ออกแบบใน 3D Studio" }).click();
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  // A style opens on ② (size and material); its defaults are the box to design on.
  await page.getByRole("button", { name: "ใช้กล่องนี้ แล้วเริ่มออกแบบ" }).click();
  await expect(
    page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" }).getByRole("button", { name: /ออกแบบ/ }),
  ).toHaveAttribute("aria-current", "step");
}
const BFF = { "x-getpack-csrf": "1", origin: HOSTS.customer };

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .exclude("canvas")
    .exclude("[data-sonner-toaster]")
    .analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

test.describe.configure({ mode: "serial" });

type CartItem = {
  designDocumentId: string | null;
  designVersionNo: number | null;
  quantity: number;
  productGrossAmount: string;
};

test("studio → order sheet → cart: the version pinned at the studio's price", async ({ page }) => {
  test.setTimeout(120_000);
  await openLibraryBox(page, MOCK_DESIGNER_PHONE);
  const id = STUDIO.exec(page.url())![1]!;

  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกอัตโนมัติ" })).toBeVisible({ timeout: 15_000 });

  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await steps.getByRole("button", { name: /สั่งผลิต/ }).click();
  await expect(page.getByRole("heading", { name: "สั่งผลิตแบบนี้" })).toBeVisible();
  // The final pass: a warning still open sends the customer back to ④ to accept it.
  const warning = page.getByText(/คำเตือน \d+ รายการที่ต้องรับทราบ/);
  if (await warning.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole("button", { name: "ไปที่ตรวจงาน" }).click();
    const accept = page.getByRole("button", { name: "รับทราบ ใช้แบบนี้" });
    await expect(accept.first()).toBeVisible({ timeout: 15_000 });
    while ((await accept.count()) > 0) {
      const before = await accept.count();
      await accept.first().click();
      await expect(accept).toHaveCount(before - 1, { timeout: 15_000 });
    }
    await steps.getByRole("button", { name: /สั่งผลิต/ }).click();
    await expect(warning).toBeHidden();
  }
  const tiers = page.getByRole("table", { name: "ราคาตามจำนวน" });
  const chosen = tiers.getByRole("row").filter({ has: page.getByRole("button", { pressed: true }) });
  await expect(chosen).toHaveCount(1, { timeout: 15_000 });
  const quantity = Number((await chosen.getByRole("button").innerText()).replace(/[^\d]/g, ""));
  const studioTotal = (await chosen.getByRole("cell").last().innerText()).trim();
  await expectNoViolations(page);

  await expect(page.getByRole("button", { name: "เพิ่มลงตะกร้า" })).toBeEnabled();
  await page.getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await expect(page).toHaveURL(/\/cart$/, { timeout: 30_000 });

  const cart = (await (await page.request.get(`${HOSTS.customer}/bff/v1/store/cart`, { headers: BFF })).json()) as {
    items: CartItem[];
  };
  const line = cart.items.find((item) => item.designDocumentId === id);
  expect(line, "the cart line carries the studio design").toBeTruthy();
  expect(line!.designVersionNo).toBeGreaterThan(0);
  expect(line!.quantity).toBe(quantity);
  // The same price the studio showed for the same options (D-277: one engine, one spec).
  expect(studioTotal.replace(/[^\d.]/g, "")).toBe(line!.productGrossAmount);

  // Placing the order locks the version (D-276): the studio says editing makes a new version.
  await page.goto(`${HOSTS.customer}/checkout?step=payment`);
  await page.getByRole("radio", { name: /โอนเงินและแนบสลิป/ }).click();
  const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
  await summary.getByRole("button", { name: "ต่อไป: ทบทวนและยืนยัน" }).click({ timeout: 15_000 });
  await page.getByRole("checkbox", { name: /ยอมรับข้อกำหนดการใช้งาน/ }).check();
  await summary.getByRole("button", { name: "ยืนยันคำสั่งซื้อและชำระเงิน" }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\//, { timeout: 15_000 });

  const design = (await (
    await page.request.get(`${HOSTS.customer}/bff/v1/store/designs/${id}`, { headers: BFF })
  ).json()) as {
    lock: { versionNo: number; orderId: string; orderCode: string } | null;
  };
  expect(design.lock?.versionNo).toBe(line!.designVersionNo);
  await page.goto(`${HOSTS.customer}/studio/${id}?step=design`);
  await expect(
    page.getByText(`เวอร์ชัน ${design.lock!.versionNo} สั่งผลิตแล้ว (${design.lock!.orderCode})`),
  ).toBeVisible({
    timeout: 15_000,
  });
  // The order links to the version it locked.
  await page.goto(`${HOSTS.customer}/account/orders/${design.lock!.orderId}`);
  await expect(
    // The order page's "สเปกและแบบ" since C6: "เปิดแบบ “<title>” (ฉบับที่ <n>)".
    page.getByRole("link", { name: new RegExp(`^เปิดแบบ .*\\(ฉบับที่ ${design.lock!.versionNo}\\)$`) }),
  ).toBeVisible();
});

async function newDesign(page: Page): Promise<string> {
  await openLibraryBox(page, MOCK_DESIGNER_PHONE);
  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกอัตโนมัติ" })).toBeVisible({ timeout: 15_000 });
  return STUDIO.exec(page.url())![1]!;
}

async function toOrderStep(page: Page) {
  const steps = page.getByRole("navigation", { name: "ขั้นตอนการออกแบบ" });
  await steps.getByRole("button", { name: /สั่งผลิต/ }).click();
  await expect(page.getByRole("heading", { name: "สั่งผลิตแบบนี้" })).toBeVisible();
  const warning = page.getByText(/คำเตือน \d+ รายการที่ต้องรับทราบ/);
  if (await warning.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole("button", { name: "ไปที่ตรวจงาน" }).click();
    const accept = page.getByRole("button", { name: "รับทราบ ใช้แบบนี้" });
    await expect(accept.first()).toBeVisible({ timeout: 15_000 });
    while ((await accept.count()) > 0) {
      const before = await accept.count();
      await accept.first().click();
      await expect(accept).toHaveCount(before - 1, { timeout: 15_000 });
    }
    await steps.getByRole("button", { name: /สั่งผลิต/ }).click();
  }
}

// U4.8: the ordered design as a product (serial with the order above: checkout takes the whole cart).
test("an ordered design is a product: reorder, another quantity, a new size fitted to the box", async ({ page }) => {
  test.setTimeout(150_000);
  const id = await newDesign(page);
  await toOrderStep(page);
  await page.getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await expect(page).toHaveURL(/\/cart$/, { timeout: 30_000 });
  await page.goto(`${HOSTS.customer}/checkout?step=payment`);
  await page.getByRole("radio", { name: /โอนเงินและแนบสลิป/ }).click();
  const summary = page.getByRole("complementary", { name: "สรุปคำสั่งซื้อ" });
  await summary.getByRole("button", { name: "ต่อไป: ทบทวนและยืนยัน" }).click();
  await page.getByRole("checkbox", { name: /ยอมรับข้อกำหนดการใช้งาน/ }).check();
  await summary.getByRole("button", { name: "ยืนยันคำสั่งซื้อและชำระเงิน" }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\//, { timeout: 15_000 });

  await page.goto(`${HOSTS.customer}/account/designs`);
  const products = page.getByRole("region", { name: "สินค้าของฉัน" });
  const card = products
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: /^PK-/ }) })
    .first();
  await expect(card).toBeVisible();
  await expect(card.getByText(/^เวอร์ชัน \d+$/)).toBeVisible();
  await expect(card.getByRole("link", { name: /^สั่ง .* ซ้ำ$/ })).toHaveAttribute(
    "href",
    /\/account\/orders\/[0-9a-f-]+\/reorder$/,
  );
  await expect(card.getByRole("link", { name: /ในจำนวนอื่น$/ })).toHaveAttribute(
    "href",
    new RegExp(`/studio/[0-9a-f-]+\\?step=order`),
  );

  // A new size: a copy opened on ②; the artwork follows the box.
  await card.getByRole("button", { name: /ขนาดใหม่$/ }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?step=box/, { timeout: 15_000 });
  const copyId = /\/studio\/([0-9a-f-]{36})/.exec(page.url())![1]!;
  expect(copyId).not.toBe(id);
  await page.getByRole("textbox", { name: "สูง" }).fill("200");
  await page.getByRole("button", { name: "ใช้ขนาดนี้" }).click();
  const confirm = page.getByRole("alertdialog");
  if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) await confirm.getByRole("button").last().click();
  await expect(page.getByText("จัดลายบนกล่องให้พอดีขนาดใหม่แล้ว (ย้อนกลับได้)")).toBeVisible({ timeout: 10_000 });
});

test("a company buyer sends the design for approval with a view link", async ({ page }) => {
  test.setTimeout(120_000);
  // The mock's Company Admin: a member of a company (D-281).
  await openLibraryBox(page, "0867890123");
  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกอัตโนมัติ" })).toBeVisible({ timeout: 15_000 });
  await toOrderStep(page);
  await expect(page.getByRole("button", { name: "ส่งขออนุมัติ" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "ส่งขออนุมัติ" }).click();
  const dialog = page.getByRole("dialog", { name: "ส่งให้ผู้อนุมัติดู" });
  await expect(dialog.getByRole("textbox", { name: "ลิงก์สำหรับผู้อนุมัติ" })).toHaveValue(
    /\/design\/shared\/[A-Za-z0-9_-]{43}$/,
    {
      timeout: 30_000,
    },
  );
  await expectNoViolations(page);
});
