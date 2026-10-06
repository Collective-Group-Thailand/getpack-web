import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { openRail } from "./helpers/designer";

/**
 * U4.4, ③ design content in Packio 3D Studio against the mock API: a Packio template re-flowed onto
 * the box and restyled with "ใช้แบรนด์ของฉัน", Packio's elements (a mark with legal meaning only
 * after the right is declared), a barcode checked by the validation service, a nutrition block,
 * a finish as its own layer and a gradient background — read back from the saved document.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const STUDIO = /\/studio\/([0-9a-f-]{36})\?/;
const BOX = "/studio/new?product=tuck-end-box&style=tuck-end&l=70&w=40&h=150&step=design";

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

type Saved = {
  document: {
    content: {
      elements: {
        type: string;
        name?: string;
        fill?: string;
        finish?: string;
        kind?: string;
        value?: string;
        studioElementId?: string;
        templateRole?: { role: string };
      }[];
      pattern: { kind: string };
    };
  };
};

async function saved(page: Page, id: string): Promise<Saved["document"]["content"]> {
  await expect(page.getByRole("status").filter({ hasText: "บันทึกอัตโนมัติ" })).toBeVisible({ timeout: 15_000 });
  const response = await page.request.get(`${HOSTS.customer}/bff/v1/store/designs/${id}`);
  return ((await response.json()) as Saved).document.content;
}

test.describe.configure({ mode: "serial" });

test("a Packio template re-flows onto the box, then takes my brand", async ({ page }) => {
  await signInAsCustomer(page, BOX, MOCK_DESIGNER_PHONE);
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  const id = STUDIO.exec(page.url())![1]!;

  await openRail(page, "แม่แบบ");
  const templates = page.getByRole("region", { name: "แม่แบบของ Packio" });
  await templates.getByRole("combobox", { name: "ใช้กับสินค้า" }).click();
  await page.getByRole("option", { name: "กาแฟ" }).click();
  await expect(templates.getByRole("list").getByRole("listitem")).toHaveCount(3);
  await templates.getByRole("button", { name: "กาแฟ · คลาสสิก" }).click();
  await expect(page.getByText(/ใช้แม่แบบ กาแฟ · คลาสสิก แล้ว/)).toBeVisible();
  await expectNoViolations(page);

  let content = await saved(page, id);
  const headline = content.elements.find((e) => e.name === "headline")!;
  expect(headline.fill).toBe("#5b3a29");

  // My brand (kept in this browser for a customer without a company): its colours by role.
  await openRail(page, "แบรนด์");
  const add = page.getByRole("button", { name: "เพิ่ม", exact: true });
  await page.getByRole("textbox", { name: "เพิ่มสี" }).first().fill("#123abc");
  await add.click();
  await page.getByRole("button", { name: "ใช้แบรนด์ของฉัน" }).click();
  await expect(page.getByText("ใช้สีและโลโก้ของคุณกับแม่แบบแล้ว")).toBeVisible();
  content = await saved(page, id);
  expect(content.elements.find((e) => e.name === "headline")!.fill).toBe("#123abc");
});

test("Packio elements, a validated barcode, a nutrition block, a finish layer and a gradient", async ({ page }) => {
  await signInAsCustomer(page, BOX, MOCK_DESIGNER_PHONE);
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  const id = STUDIO.exec(page.url())![1]!;

  await openRail(page, "องค์ประกอบ");
  // A handling mark is placed at once; a mark with legal meaning asks for the right first.
  await page.getByRole("button", { name: "ตั้งด้านนี้ขึ้น", exact: true }).click();
  await openRail(page, "องค์ประกอบ");
  // The persona's declaration outlives the test in the mock: declare only when it is still asked for.
  const mark = page.getByRole("button", { name: /^เครื่องหมายรับรอง \(ตัวอย่าง\)/ });
  const needsRight = /ต้องยืนยันสิทธิ์ก่อนใช้/.test((await mark.getAttribute("aria-label")) ?? "");
  await mark.click();
  if (needsRight) {
    const declare = page.getByRole("dialog", { name: /ยืนยันสิทธิ์ใช้/ });
    await expect(declare).toBeVisible();
    await expectNoViolations(page);
    await declare.getByRole("textbox", { name: "คำยืนยันสิทธิ์" }).fill("ใบรับรองเลขที่ TEST-001 ออกโดยหน่วยงานทดสอบ");
    await declare.getByRole("button", { name: "ยืนยันและวางเครื่องหมาย" }).click();
    await expect(declare).toBeHidden();
  }

  // EAN-8 with its check digit added by the validation service, at least its GS1 minimum width.
  await openRail(page, "องค์ประกอบ");
  await page.getByRole("combobox", { name: "ชนิดโค้ด" }).click();
  await page.getByRole("option", { name: "EAN-8" }).click();
  await page.getByRole("textbox", { name: "ตัวเลขหรือข้อความของบาร์โค้ด" }).fill("9638507");
  await expect(page.getByText(/กว้างอย่างน้อย 21\.38 มม\./)).toBeVisible();
  await page.getByRole("button", { name: "เพิ่มโค้ด" }).click();

  await openRail(page, "องค์ประกอบ");
  await page.getByRole("combobox", { name: "ชนิดข้อมูล" }).click();
  await page.getByRole("option", { name: "ข้อมูลโภชนาการ" }).click();
  await page.getByRole("textbox", { name: "พลังงาน" }).fill("120 กิโลแคลอรี");
  await page.getByRole("button", { name: "วางข้อมูลบนกล่อง" }).click();

  // The handling mark becomes a foil layer.
  await openRail(page, "ชั้น");
  await page
    .getByRole("tree")
    .getByRole("treeitem", { name: /ตั้งด้านนี้ขึ้น/ })
    .click();
  await page.getByRole("combobox", { name: "งานตกแต่ง (ชั้นพิเศษ)" }).click();
  await page.getByRole("option", { name: "ปั๊มฟอยล์" }).click();

  await openRail(page, "พื้นหลัง");
  await page.getByRole("button", { name: "ไล่สี" }).click();

  const content = await saved(page, id);
  expect(content.elements.some((e) => e.type === "code" && e.kind === "ean8" && e.value === "96385074")).toBe(true);
  expect(content.elements.filter((e) => e.studioElementId)).toHaveLength(2);
  expect(content.elements.find((e) => e.name === "ตั้งด้านนี้ขึ้น")!.finish).toBe("foil");
  expect(content.elements.some((e) => e.name === "ข้อมูลโภชนาการ")).toBe(true);
  expect(content.pattern.kind).toBe("gradient");
});

test("the company's brand kit: the Company Admin keeps it, one click restyles the template", async ({ page }) => {
  // The mock's `companyadmin` persona (storefront-business.spec's Company Admin).
  await signInAsCustomer(page, BOX, "0867890123");
  await page.getByRole("dialog", { name: "ตั้งค่ากล่อง" }).getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  const id = STUDIO.exec(page.url())![1]!;

  await openRail(page, "แม่แบบ");
  await page.getByRole("region", { name: "แม่แบบของ Packio" }).getByRole("button", { name: "ขนม · แถบสี" }).click();

  await openRail(page, "แบรนด์");
  const kits = page.getByRole("region", { name: /^ชุดแบรนด์ของ / });
  await kits.getByRole("button", { name: "สร้างชุดแบรนด์" }).click();
  const editor = page.getByRole("dialog", { name: "สร้างชุดแบรนด์" });
  // A name of this run's own: the mock keeps the company's kits between runs.
  const kitName = `แบรนด์ทดสอบ ${Date.now().toString(36)}`;
  await editor.getByRole("textbox", { name: "ชื่อชุดแบรนด์" }).fill(kitName);
  await editor.getByRole("textbox", { name: "สีหลัก" }).first().fill("#7a1fa2");
  await expectNoViolations(page);
  await editor.getByRole("button", { name: "บันทึกชุดแบรนด์" }).click();
  await expect(editor).toBeHidden();

  const kit = kits.getByRole("listitem").filter({ hasText: kitName });
  await kit.getByRole("button", { name: "ใช้แบรนด์ของฉัน" }).click();
  await expect(page.getByText(`ใช้ชุดแบรนด์ ${kitName} แล้ว`)).toBeVisible();
  const content = await saved(page, id);
  expect(content.elements.find((e) => e.name === "band")!.fill).toBe("#7a1fa2");
});
