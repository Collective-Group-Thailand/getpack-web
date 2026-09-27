import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsPartner, signInAsStaff } from "./helpers/session";

/**
 * F5 5.2 — the partner zone's production floor on a phone, against the mock API: accept a job →
 * milestones with photos → QC → a split shipment with POD, and the logistics desk sees the PODs
 * waiting for review. The jobs are the commerce mock's own; the one this flow takes is the
 * released job due within hours (paid up, split across two addresses — `mocks/partner/jobs.ts`).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const F001 = "00000000-0000-4000-8000-0000000000f1";
/** A real 1 × 1 JPEG, so the browser's own decoder takes the camera path. */
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

async function expectAxeClean(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10_000 });
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

async function photo(page: Page, name = "shot.jpg") {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "image/jpeg", buffer: JPEG });
  await expect(page.getByRole("button", { name: /^ลบรูปที่ 1/ })).toBeVisible();
}

const dialog = (page: Page) => page.getByRole("alertdialog");
const toast = (page: Page, text: string | RegExp) => expect(page.getByText(text).first()).toBeVisible();

test.use({ viewport: { width: 390, height: 844 } });

test.describe("a job from acceptance to delivery (F001)", () => {
  test("accepts, reports every step with photos and QC, ships split with POD", async ({ page }) => {
    test.setTimeout(180_000);
    await signInAsPartner(page, "owner");
    await expect(page.getByRole("link", { name: /รอรับงาน/ })).toBeVisible();
    await expectAxeClean(page);

    // The released job due soonest: the one this flow can take to delivery.
    const list = await page.request.get(`${HOSTS.partner}/bff/v1/partner/factories/${F001}/jobs?view=to_accept`);
    const jobs = ((await list.json()) as { data: { id: string; jobNo: string; acceptDueAt: string }[] }).data;
    const job = [...jobs].sort((a, b) => a.acceptDueAt.localeCompare(b.acceptDueAt))[0]!;

    await gotoHydrated(page, `${HOSTS.partner}/jobs?view=to_accept`);
    await expect(page.getByRole("link", { name: new RegExp(job.jobNo) })).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("link", { name: new RegExp(job.jobNo) }).click();
    await expect(page.getByRole("heading", { level: 1, name: job.jobNo })).toBeVisible();
    await expect(page.getByText(/รับงานภายใน/)).toBeVisible();
    await expectAxeClean(page);
    await page.getByRole("button", { name: /^รับงาน/ }).click();
    await expect(dialog(page)).toContainText(job.jobNo);
    await dialog(page).getByRole("button", { name: "รับงาน", exact: true }).click();
    await toast(page, `รับงาน ${job.jobNo} แล้ว`);

    const steps: { name: string; photo?: boolean; qc?: boolean }[] = [
      { name: "เตรียมวัตถุดิบ" },
      { name: "พิมพ์", photo: true },
      { name: "ไดคัท", photo: true },
      { name: "ตรวจคุณภาพ", qc: true },
      { name: "แพ็ก", photo: true },
    ];
    for (const step of steps) {
      await page.getByRole("button", { name: new RegExp(`^เริ่ม${step.name}`) }).click();
      await toast(page, `เริ่ม${step.name}แล้ว`);
      if (step.qc) {
        // The QC form arrives with the refreshed job; wait for it before answering each item.
        await expect(page.getByRole("radiogroup", { name: /^ผลของ / })).toHaveCount(5);
        for (const group of await page.getByRole("radiogroup", { name: /^ผลของ / }).all()) {
          await group.getByRole("radio", { name: "ผ่าน", exact: true }).click();
        }
        await photo(page, "qc.jpg");
        await page.getByRole("button", { name: /^บันทึกผลตรวจคุณภาพ/ }).click();
        await toast(page, "บันทึกผลตรวจคุณภาพแล้ว");
      }
      if (step.photo) await photo(page);
      await page.getByRole("button", { name: new RegExp(`^จบ${step.name}`) }).click();
      await toast(page, `จบ${step.name}แล้ว`);
    }
    await expectAxeClean(page);

    // Two destinations (D-110): one shipment each, each with its labels, dispatch and POD.
    await page.getByRole("link", { name: /ผลิตเสร็จ — ไปจัดส่ง/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "จัดส่ง" })).toBeVisible();
    await expectAxeClean(page);
    const shipped: string[] = [];
    for (let round = 0; round < 2; round += 1) {
      if (round === 1) await gotoHydrated(page, `${HOSTS.partner}/ship`);
      await page
        .getByRole("button", { name: /^สร้างการจัดส่งถึง/ })
        .first()
        .click();
      await expect(page).toHaveURL(/\/ship\/[0-9a-f-]+$/);
      const shipmentNo = (await page.getByRole("heading", { level: 1 }).textContent())!;
      shipped.push(shipmentNo);
      if (round === 0) {
        await page.getByRole("link", { name: /พิมพ์ฉลากกล่อง/ }).click();
        await expect(page.getByRole("img", { name: "QR ติดตามกล่องที่ 1" })).toBeVisible();
        await expectAxeClean(page);
        await page.getByRole("link", { name: "กลับไปที่การจัดส่ง" }).click();
        await expect(page.getByRole("heading", { level: 1, name: shipmentNo })).toBeVisible();
      }
      await page.getByRole("button", { name: /^ออกรถส่งของ/ }).click();
      await toast(page, `${shipmentNo} ออกจากโรงงานแล้ว`);
      await photo(page, "pod.jpg");
      await page
        .getByLabel(/^ชื่อผู้รับ/)
        .first()
        .fill("คุณผู้รับ ทดสอบ");
      await page.getByRole("radio", { name: /พิมพ์ชื่อ/ }).click();
      await page.getByRole("textbox", { name: "ชื่อผู้รับ", exact: true }).last().fill("ผู้รับ ทดสอบ");
      if (round === 0) await expectAxeClean(page);
      await page.getByRole("button", { name: /^บันทึกการส่งมอบ/ }).click();
      await toast(page, "บันทึกการส่งมอบแล้ว รอ Packio ตรวจ");
      await expect(page.getByText("ส่งครบตามจำนวน")).toBeVisible();
    }

    // The logistics desk has the PODs to review (D-013).
    await signInAsStaff(page, "logistics");
    await gotoHydrated(page, `${HOSTS.admin}/shipments?queue=pod_review`);
    for (const shipmentNo of shipped) await expect(page.getByText(shipmentNo).first()).toBeVisible();
  });
});

test.describe("the floor's other screens and rules", () => {
  test("a typed code opens its job, and the capacity calendar reads", async ({ page }) => {
    await signInAsPartner(page, "planner");
    const list = await page.request.get(`${HOSTS.partner}/bff/v1/partner/factories/${F001}/jobs?view=all`);
    const [first] = ((await list.json()) as { data: { id: string; jobNo: string }[] }).data;
    await gotoHydrated(page, `${HOSTS.partner}/jobs`);
    await page.getByRole("button", { name: "สแกน QR" }).click();
    await expect(page.getByText("อุปกรณ์นี้สแกนไม่ได้ พิมพ์รหัสแทนได้เลย")).toBeVisible();
    await page.getByLabel(/^รหัสงานหรือรหัสกล่อง/).fill(first!.jobNo);
    await page.getByRole("button", { name: "เปิดงาน" }).click();
    await expect(page.getByRole("heading", { level: 1, name: first!.jobNo })).toBeVisible();

    await gotoHydrated(page, `${HOSTS.partner}/capacity`);
    await expect(page.getByRole("heading", { level: 1, name: "กำลังผลิตรายสัปดาห์" })).toBeVisible();
    await expect(page.getByRole("meter").first()).toBeVisible();
    await expectAxeClean(page);
  });

  test("an operator reports steps but cannot accept, and has no billing or prices", async ({ page }) => {
    await signInAsPartner(page, "operator");
    const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
    await expect(nav.getByRole("link", { name: "งานผลิต" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "วางบิล" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "จัดส่ง" })).toHaveCount(0);
    const list = await page.request.get(`${HOSTS.partner}/bff/v1/partner/factories/${F001}/jobs?view=to_accept`);
    const [waiting] = ((await list.json()) as { data: { id: string }[] }).data;
    if (waiting) {
      await gotoHydrated(page, `${HOSTS.partner}/jobs/${waiting.id}`);
      await expect(page.getByText("ผู้วางแผนหรือเจ้าของโรงงานเป็นผู้รับงาน")).toBeVisible();
      await expect(page.getByRole("button", { name: /^รับงาน/ })).toHaveCount(0);
    }
  });

  test("another factory's job is not found (D-044)", async ({ page }) => {
    await signInAsPartner(page, "owner");
    const list = await page.request.get(`${HOSTS.partner}/bff/v1/partner/factories/${F001}/jobs?view=all`);
    const [job] = ((await list.json()) as { data: { id: string }[] }).data;
    await signInAsPartner(page, "assisted");
    await gotoHydrated(page, `${HOSTS.partner}/jobs/${job!.id}`);
    await expect(page.getByText("ไม่พบรายการนี้")).toBeVisible();
  });
});
