import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { acceptCookies, MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading } from "./helpers/designer";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F4 Part C end to end: designs in the account instead of the browser.
 *
 * A signed-in design is created on its first autosave and keeps a version history; two tabs
 * saving the same design meet the conflict choice instead of overwriting each other; a guest's
 * browser designs are imported after sign-in; a design started from an order is sent to print as
 * that order's artwork for prepress; prepress opens a customer's design read-only and
 * works on its own copy. All of it as the mock's `designer` persona (its own customer and orders),
 * so nothing here shares state with the other suites.
 */

/** The designer persona's order (`mocks/admin/commerce` order index 9, set up for the online designer). */
const DESIGN_ORDER = "00000000-0000-4000-8000-6f726400000a";
/** The design document on the prepress plan's order whose customer used the designer (`mocks/admin/prepress` plan 15). */
const CUSTOMER_DOCUMENT = "00000000-0000-4000-8000-646463000010";

const UUID = /\/design\/[0-9a-f-]{36}(\?|$)/;

async function startFromSetup(page: Page) {
  const dialog = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("canvas").first()).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("a blank design is saved in the account", async ({ page }) => {
  test.fixme(
    true,
    "CONTRACT-GAP store.catalog-product-ref — a design needs its product by id; a blank design stays in the browser",
  );
  await signInAsCustomer(page, "/design/new", MOCK_DESIGNER_PHONE);
});

test("a signed-in design is saved in the account, autosaved, and keeps its versions", async ({ page }) => {
  // Started from a product: the published design needs one (store.catalog-product-ref).
  await signInAsCustomer(page, "/design/new?product=tuck-end-box", MOCK_DESIGNER_PHONE);
  await startFromSetup(page);

  // The first autosave creates the design and swaps /design/new for its id.
  await expect(page).toHaveURL(UUID, { timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("textbox", { name: "ชื่อแบบ" }).fill("กล่องในบัญชี E2E");
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByRole("textbox", { name: "ชื่อแบบ" })).toHaveValue("กล่องในบัญชี E2E");

  await page.getByRole("button", { name: "ประวัติการบันทึก" }).click();
  const history = page.getByRole("dialog", { name: "ประวัติการบันทึก" });
  await expect(history.getByText("เวอร์ชัน 2")).toBeVisible();
  await history.getByRole("button", { name: "คืนค่า" }).first().click();
  await expect(page.getByText(/คืนค่าเวอร์ชัน \d+ แล้ว/)).toBeVisible();

  // A view-only link opens the design for anyone, without the editor.
  await page.getByRole("button", { name: "แชร์ลิงก์ดูแบบ" }).click();
  const share = page.getByRole("dialog", { name: "แชร์ลิงก์ดูแบบ" });
  const link = share.getByRole("textbox", { name: "ลิงก์" });
  await expect(link).toHaveValue(/\/design\/shared\/[A-Za-z0-9_-]{43}$/);
  const url = await link.inputValue();
  await page.keyboard.press("Escape");
  const viewer = await page.context().browser()!.newPage();
  await viewer.goto(url);
  await expect(viewer.getByRole("heading", { name: "กล่องในบัญชี E2E" })).toBeVisible();
  await expect(viewer.getByText("ดูได้อย่างเดียว")).toBeVisible();
  await expect(viewer.getByRole("img", { name: "กล่องในบัญชี E2E" })).toBeVisible();
  await viewer.close();
});

test("two tabs saving the same design meet the conflict choice instead of overwriting", async ({ page, context }) => {
  await signInAsCustomer(page, "/account/designs", MOCK_DESIGNER_PHONE);
  await page.getByRole("link", { name: "กล่องในบัญชี E2E" }).first().click();
  await expect(page).toHaveURL(UUID);
  const other = await context.newPage();
  await gotoHydrated(other, page.url());

  await other.getByRole("textbox", { name: "ชื่อแบบ" }).fill("จากแท็บที่สอง");
  await other.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(other.getByText("บันทึกแล้ว").first()).toBeVisible();

  await page.getByRole("textbox", { name: "ชื่อแบบ" }).fill("จากแท็บแรก");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  const conflict = page.getByRole("dialog", { name: "แบบนี้ถูกบันทึกจากที่อื่น" });
  await expect(conflict).toBeVisible();
  await conflict.getByRole("button", { name: "ใช้ฉบับของฉัน" }).click();
  await expect(conflict).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });
});

test("a guest's browser design is imported into the account after sign-in", async ({ page }) => {
  await acceptCookies(page);
  // With its product (the import needs one, store.catalog-product-ref): the designer catalogue names its id.
  await gotoHydrated(page, `${HOSTS.customer}/design/new?product=tuck-end-box`);
  await startFromSetup(page);
  await page.getByRole("textbox", { name: "ชื่อแบบ" }).fill("กล่องจากเบราว์เซอร์");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("บันทึกแล้ว").first()).toBeVisible();

  await signInAsCustomer(page, "/account/designs", MOCK_DESIGNER_PHONE);
  const offer = page.getByText("มี 1 แบบ ที่บันทึกไว้ในเบราว์เซอร์นี้");
  await expect(offer).toBeVisible();
  await page.getByRole("button", { name: "นำเข้าบัญชี" }).click();
  await expect(page.getByText("นำเข้าแล้ว 1 แบบ")).toBeVisible();
  await expect(page.getByRole("link", { name: "กล่องจากเบราว์เซอร์" }).first()).toBeVisible();
  await expect(offer).toBeHidden();
});

test("the order's artwork page opens the designer on its box", async ({ page }) => {
  await signInAsCustomer(page, `/account/orders/${DESIGN_ORDER}/artwork`, MOCK_DESIGNER_PHONE);
  // The order's dieline and size (`store.artwork.getRules`) and its product (`OrderDto.summary`).
  await page.getByRole("link", { name: "ออกแบบออนไลน์บนกล่องนี้" }).click();
  await expect(page).toHaveURL(/\/design\/new\?style=[a-z-]+&l=\d+&w=\d+&h=\d+/);
  await expect(page).toHaveURL(new RegExp(`order=${DESIGN_ORDER}`));
});

test("a design for an order is sent to print and prepress takes it", async ({ page }) => {
  // The link the artwork page builds (see the test above), with the product the order names.
  const linked = new URLSearchParams({
    // A published design needs its product (store.catalog-product-ref).
    product: "tuck-end-box",
    style: "tuck-end",
    l: "80",
    w: "50",
    h: "120",
    order: DESIGN_ORDER,
    item: DESIGN_ORDER,
    orderCode: "PK-2569-00109",
  });
  await signInAsCustomer(page, `/design/new?${linked.toString()}`, MOCK_DESIGNER_PHONE);
  await startFromSetup(page);
  await expect(page).toHaveURL(UUID, { timeout: 15_000 });

  await page.getByRole("button", { name: "ส่งเข้าผลิต" }).click();
  const confirm = page.getByRole("alertdialog", { name: /^ส่งแบบนี้เป็นไฟล์งานของคำสั่งซื้อ/ });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "ส่งเข้าผลิต" }).click();

  // `store.designs.submitForOrder`: prepress exports the design, so preflight answers later.
  const result = page.getByRole("dialog", { name: /^ส่งไฟล์ของคำสั่งซื้อ .* แล้ว$/ });
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText("ทีมพรีเพรสกำลังจัดทำไฟล์");
  await result.getByRole("link", { name: "ไปหน้าไฟล์งานและพรูฟ" }).click();
  await expect(page).toHaveURL(new RegExp(`/account/orders/${DESIGN_ORDER}/artwork$`));
});

test("from a product page: design online with its live price, which follows quantity and artwork", async ({ page }) => {
  await signInAsCustomer(page, "/products/shipping-box", MOCK_DESIGNER_PHONE);
  await page.getByRole("link", { name: "ออกแบบออนไลน์" }).click();
  await expect(page).toHaveURL(/\/design\/new\?product=shipping-box$/);
  await startFromSetup(page);

  // The top bar prices this box at the product's default quantity, from the API.
  const header = page.locator("header").first();
  const price = header.locator("b").filter({ hasText: "฿" });
  await expect(price).toBeVisible({ timeout: 15_000 });
  const blank = await price.textContent();

  await header.getByRole("combobox", { name: "จำนวน" }).click();
  const options = page.getByRole("option");
  await options.last().click();
  await expect(price).not.toHaveText(blank!, { timeout: 15_000 });
  const larger = await price.textContent();

  // Printing something changes what is priced: the blank box becomes a printed one.
  await addHeading(page);
  await expect(price).not.toHaveText(larger!, { timeout: 15_000 });
});

test("prepress opens a customer's design read-only and copies it", async ({ page }) => {
  // CONTRACT-GAP admin.prepress — the workspace no longer links the order's design (the order does
  // not reference it), so the design is opened by its address.
  await signInAsStaff(page, "prepress");
  await gotoHydrated(page, `${HOSTS.admin}/designs/${CUSTOMER_DOCUMENT}`);
  await expect(page.getByText("เปิดดูอย่างเดียว").first()).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "เครื่องมือออกแบบ" }).getByRole("button", { name: "ข้อความ", exact: true }),
  ).toHaveCount(0);

  // The owner is published (`owner`): the customer's design says whose it is.
  await expect(page.getByText(/^แบบของลูกค้า /)).toBeVisible();

  await page.getByRole("button", { name: "ทำสำเนาเพื่อแก้ไข" }).click();
  await expect(page).toHaveURL(/\/designs\/[0-9a-f-]{36}\?from=/);
  // `admin.designs.copy` makes a copy prepress owns.
  await expect(page.getByText(/^แบบของพนักงาน /)).toBeVisible();
});

test("prepress works on its own copy and saves it", async ({ page }) => {
  test.fixme(
    true,
    "CONTRACT-GAP admin.design-documents — admin.designs.save needs catalog.manage, which prepress lacks, so even its own copy (editable) opens read-only",
  );
  await signInAsStaff(page, "prepress");
  await addHeading(page);
});
