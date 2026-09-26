import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff } from "./helpers/session";

/**
 * F2 2.4 — prepress and design services, against the mock API.
 *
 * Prepress state hangs off the commerce mock's orders (`…-6f7264` + the order's number in hex),
 * and each test that changes state uses an order no other test reads.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const order = (n: number) => `00000000-0000-4000-8000-6f7264${n.toString(16).padStart(6, "0")}`;
const PDF = { name: "proof.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% mock\n") };

async function expectAxeClean(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

async function attach(scope: Locator, index = 0) {
  await scope.locator('input[type="file"]').nth(index).setInputFiles(PDF);
}

const header = (page: Page) => page.getByRole("heading", { level: 1 }).locator("..");

test.describe("the prepress desk", () => {
  test("opens on a stage with its SLA and the preflight result", async ({ page }) => {
    await signInAsStaff(page, "prepress");
    await gotoHydrated(page, `${HOSTS.admin}/prepress?queue=preflight`);
    await expect(page.getByRole("link", { name: /^ตรวจไฟล์ \(preflight\)/ })).toHaveAttribute("aria-current", "page");
    const table = page.getByRole("table", { name: "งานก่อนพิมพ์" });
    await expect(table).toContainText("ไม่ผ่าน ต้องแก้ไฟล์");
    await expect(table).toContainText("ผ่านแต่มีคำเตือน");
    await expectAxeClean(page);
  });
});

test.describe("preflight (D-070)", () => {
  test("a blocking finding cannot be accepted; the file goes back with a reason", async ({ page }) => {
    await signInAsStaff(page, "prepress");
    await gotoHydrated(page, `${HOSTS.admin}/prepress/${order(13)}`);
    await expect(page.getByText("ขนาดไม่ตรงแบบกล่อง")).toBeVisible();
    await expect(page.getByRole("button", { name: "รับไปทำปรู๊ฟ" })).toBeDisabled();
    await expect(page.getByText(/D-070/).first()).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("button", { name: "ส่งคืนให้แก้ไข" }).click();
    const dialog = page.getByRole("alertdialog", { name: "ส่งไฟล์ฉบับที่ 1 คืนให้แก้ไข" });
    await dialog.getByLabel(/^สิ่งที่ต้องแก้/).fill("กรุณาจัดไฟล์ตามแบบกล่องและเพิ่มระยะตัดตก 3 มม.");
    await dialog.getByRole("button", { name: "ส่งคืน" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("main")).toContainText("ส่งคืนให้แก้ไข");
    await expect(header(page)).toContainText("รอไฟล์งาน");
  });

  test("accepting a file with warnings asks why it is acceptable", async ({ page }) => {
    await signInAsStaff(page, "prepress");
    await gotoHydrated(page, `${HOSTS.admin}/prepress/${order(14)}`);
    await page.getByRole("button", { name: "รับไปทำปรู๊ฟ" }).click();
    const dialog = page.getByRole("alertdialog", { name: "รับไฟล์ฉบับที่ 1 ไปทำปรู๊ฟ" });
    await expect(dialog).toContainText("ข้อควรระวัง 2 ข้อ");
    await dialog.getByRole("button", { name: "รับไปทำปรู๊ฟ" }).click();
    await expect(dialog).toContainText("กรุณาระบุเหตุผล");
    await dialog.getByLabel(/^เหตุผลที่รับได้/).fill("ภาพพื้นหลังเป็นลายจาง ความละเอียดพอสำหรับงานนี้");
    await dialog.getByRole("button", { name: "รับไปทำปรู๊ฟ" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "อัปโหลดและส่งปรู๊ฟ" })).toBeVisible();
  });
});

test.describe("proofs", () => {
  test("a proof is uploaded, restating the order, and sent as a new version", async ({ page }) => {
    await signInAsStaff(page, "prepress");
    await gotoHydrated(page, `${HOSTS.admin}/prepress/${order(16)}`);
    // The customer's online design, read-only, beside the files it produced.
    await expect(page.getByRole("img", { name: /^ตัวอย่างแบบ/ })).toBeVisible();
    const code = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

    await page.getByRole("button", { name: "อัปโหลดและส่งปรู๊ฟ" }).click();
    const dialog = page.getByRole("alertdialog", { name: "ส่งปรู๊ฟฉบับที่ 1" });
    await expect(dialog).toContainText(code);
    await attach(dialog);
    await dialog.getByRole("button", { name: "อัปโหลดและส่ง" }).click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(header(page)).toContainText("ส่งปรู๊ฟให้ลูกค้าแล้ว");
    await page.getByRole("tab", { name: /^ปรู๊ฟ/ }).click();
    await expect(page.getByRole("tabpanel")).toContainText("รอลูกค้าตรวจปรู๊ฟ");
  });

  test("the customer's annotations are answered and resolved", async ({ page }) => {
    await signInAsStaff(page, "prepress");
    await gotoHydrated(page, `${HOSTS.admin}/prepress/${order(17)}?tab=proofs`);
    await expect(page.getByRole("img", { name: /ตำแหน่งความเห็น 2 จุด/ })).toBeVisible();
    await expectAxeClean(page);

    await page.getByLabel("ตอบความเห็นที่ 1").fill("ปรับขนาดโลโก้ในฉบับถัดไปครับ");
    await page.getByRole("button", { name: "ตอบ", exact: true }).first().click();
    await expect(page.getByText("ปรับขนาดโลโก้ในฉบับถัดไปครับ")).toBeVisible();

    await page.getByRole("button", { name: "ทำเครื่องหมายแก้แล้ว (2)" }).click();
    await expect(page.getByText("แก้ไขแล้ว", { exact: true })).toBeVisible();
  });
});

test.describe("design services (D-071)", () => {
  test("counts the free rounds and says what the next one costs", async ({ page }) => {
    await signInAsStaff(page, "prepress");
    await gotoHydrated(page, `${HOSTS.admin}/prepress/${order(15)}?tab=design`);
    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText("3 จาก 3 รอบ");
    await expect(panel).toContainText("รอบถัดไป (รอบที่ 4) มีค่าใช้จ่าย ฿500.00");
    await expect(panel).toContainText("D-071");
    await expectAxeClean(page);
  });

  test("a round is delivered with its files", async ({ page }) => {
    await signInAsStaff(page, "prepress");
    await gotoHydrated(page, `${HOSTS.admin}/prepress/${order(8)}?tab=design`);
    await page.getByRole("button", { name: "ส่งงานออกแบบรอบนี้" }).click();
    const dialog = page.getByRole("alertdialog", { name: "ส่งงานออกแบบรอบที่ 1" });
    await attach(dialog);
    await dialog.getByRole("button", { name: "ส่งให้ลูกค้า" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("tabpanel")).toContainText("ส่งงานรอบนี้แล้ว");
  });
});

test.describe("template & dieline", () => {
  test("drawing says the engine is not ready; the template is sent from a file", async ({ page }) => {
    await signInAsStaff(page, "prepress");
    await gotoHydrated(page, `${HOSTS.admin}/prepress/${order(12)}?tab=template`);
    await expectAxeClean(page);

    await page.getByRole("tabpanel").getByRole("button", { name: "วาดแบบกล่อง" }).click();
    await expect(page.getByText("ระบบวาดแบบกล่องยังไม่พร้อมใช้งาน").first()).toBeVisible();

    await page.getByRole("tabpanel").getByRole("button", { name: "ส่งแบบกล่อง" }).click();
    const dialog = page.getByRole("alertdialog", { name: "ส่งแบบกล่องให้ลูกค้า" });
    await attach(dialog);
    await dialog.getByRole("button", { name: "ส่งแบบกล่อง" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("tabpanel")).toContainText("ส่งโดยพนักงาน");
  });
});

test.describe("every 2.4 screen is axe-clean", () => {
  for (const path of [`/prepress`, `/prepress/${order(20)}?tab=mockup`, `/prepress/${order(19)}`]) {
    test(path, async ({ page }) => {
      await signInAsStaff(page, "prepress");
      await gotoHydrated(page, `${HOSTS.admin}${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectAxeClean(page);
    });
  }
});
