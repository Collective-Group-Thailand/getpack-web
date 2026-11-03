import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInToAgentZone } from "./helpers/agent";
import { gotoHydrated, signInAsStaff, type Persona } from "./helpers/session";

/**
 * Agent portal P4 (D-469, D-470): the company sales desk in the admin zone — the inbound pool (round robin, manual
 * assignment with a reason), a rep's own inbox and pipeline, a quote and a discount request from the desk, the
 * discount approval desk in three permission tiers (field-level RBAC checked on the wire, not only on screen), an
 * approval with a co-fund option that the freelance agent then takes in the agent zone, the view log, playbook
 * maker-checker, and the layouts at 768–1920.
 *
 * Runs against the MSW mock server (mocks/admin/sales-desk.ts with the P3 agent mock), whose state lives as long as
 * the server: the suite expects a freshly started server and runs in order.
 */
test.describe.configure({ mode: "serial" });

const shots = process.env["E2E_SHOTS"];
/** Keys a rep's or a manager's payload must not carry (cost, money and margin amounts of the full tier). */
const FULL_ONLY = [
  "factoryCost",
  "listRevenue",
  "netRevenue",
  'grossMargin"',
  "commissionAmount",
  "creditCost",
  "contributionAfterCommission",
  "priceLocks",
  "buyPrice",
];
const MARGIN_KEYS = ["grossMarginPct", "contributionPct", "floorPct", "floorCheck"];

async function shoot(page: Page, name: string, widths: readonly number[] = [1440, 1024]) {
  if (!shots) return;
  // A full-page shot: no toast, no focus ring on the skip link, from the top (the sticky header stays put).
  await page
    .locator("[data-sonner-toast]")
    .first()
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(() => undefined);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  for (const width of widths) {
    await page.setViewportSize({ width, height: width >= 1280 ? 900 : 1366 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${shots}/p4-${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function noHorizontalScroll(page: Page, label: string, widths: readonly number[] = [1024, 1280, 1440, 1920]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(80);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${label}: horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function asStaff(page: Page, persona: Persona, path: string) {
  await page.context().clearCookies();
  await signInAsStaff(page, persona);
  await gotoHydrated(page, `${HOSTS.admin}${path}`);
}

/** Opens an approval and returns the raw JSON the BFF answered with (what reached the browser). */
async function openApproval(page: Page, name: RegExp): Promise<string> {
  const response = page.waitForResponse(
    (candidate) =>
      /\/bff\/v1\/admin\/sales\/discount-approvals\/[0-9a-f-]{36}$/.test(new URL(candidate.url()).pathname) &&
      candidate.request().method() === "GET",
  );
  await page.locator("main").getByRole("link", { name }).first().click();
  return (await response).text();
}

test.describe("P4 sales desk", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("inbox: round robin for two, a named rep for one, and a move that asks why", async ({ page }) => {
    await asStaff(page, "sales_manager", "/sales");
    await expect(page.getByRole("heading", { level: 1, name: "งานเข้าฝ่ายขาย" })).toBeVisible();
    // The menu entry "ฝ่ายขาย" is the API's (`sales`), shown to a pipeline holder.
    await expect(page.getByRole("navigation").getByRole("link", { name: "ฝ่ายขาย" }).first()).toBeVisible();
    const table = page.getByRole("table", { name: "งานเข้าฝ่ายขาย" });
    await expect(table).toContainText("คุณเมธี ทดสอบ");
    await shoot(page, "inbox");

    // Round robin: select two new enquiries, assign them together.
    await table
      .getByRole("row", { name: /คุณเมธี ทดสอบ/ })
      .getByRole("checkbox")
      .check();
    await table
      .getByRole("row", { name: /คุณนิด ตัวอย่าง/ })
      .getByRole("checkbox")
      .check();
    await page.getByRole("button", { name: "มอบหมาย 2 รายการ" }).click();
    const bulk = page.getByRole("dialog", { name: "มอบหมาย 2 รายการ" });
    await expect(bulk.getByRole("radio", { name: /ให้ระบบเลือก/ })).toBeChecked();
    await bulk.getByRole("button", { name: "มอบหมาย" }).click();
    await expect(page.getByText(/มอบหมายแล้ว 2 รายการ/)).toBeVisible();
    // Round robin spreads them: the two reps with no open enquiries, least recently assigned first (soonest due first).
    await expect(table.getByRole("row", { name: /คุณนิด ตัวอย่าง/ })).toContainText("วิภา ขายดี");
    await expect(table.getByRole("row", { name: /คุณเมธี ทดสอบ/ })).toContainText("ธนา มุ่งมั่น");

    // A named rep for a new enquiry.
    await table
      .getByRole("row", { name: /คุณแพร ทดสอบ/ })
      .getByRole("button", { name: "การทำงานของ คุณแพร ทดสอบ" })
      .click();
    await page.getByRole("menuitem", { name: "มอบหมาย" }).click();
    let dialog = page.getByRole("dialog", { name: "มอบหมาย คุณแพร ทดสอบ" });
    await dialog.getByRole("radio", { name: /พนักงานขาย ตัวอย่าง/ }).click();
    await dialog.getByRole("button", { name: "มอบหมาย" }).click();
    await expect(table.getByRole("row", { name: /คุณแพร ทดสอบ/ })).toContainText("พนักงานขาย ตัวอย่าง");

    // Moving an enquiry away from another rep needs a reason.
    await table
      .getByRole("row", { name: /คุณต้น ตัวอย่าง/ })
      .getByRole("button", { name: "การทำงานของ คุณต้น ตัวอย่าง" })
      .click();
    await page.getByRole("menuitem", { name: "ย้ายผู้รับผิดชอบ" }).click();
    dialog = page.getByRole("dialog", { name: "มอบหมาย คุณต้น ตัวอย่าง" });
    await dialog.getByRole("radio", { name: /วิภา ขายดี/ }).click();
    await dialog.getByRole("button", { name: "มอบหมาย" }).click();
    // Not sent without a reason: the dialog stays and the reason field is the one missing.
    const reason = dialog.getByRole("textbox", { name: /เหตุผลที่ย้ายงาน/ });
    await expect(dialog).toBeVisible();
    expect(await reason.evaluate((field) => (field as HTMLTextAreaElement).validity.valueMissing)).toBe(true);
    await reason.fill("พนักงานขายคนเดิมลาพักร้อน");
    await dialog.getByRole("button", { name: "มอบหมาย" }).click();
    await expect(table.getByRole("row", { name: /คุณต้น ตัวอย่าง/ })).toContainText("วิภา ขายดี");
  });

  test("a rep: own inbox only, contact, convert, quote and ask for a discount", async ({ page }) => {
    await asStaff(page, "sales_rep", "/sales");
    const table = page.getByRole("table", { name: "งานเข้าฝ่ายขาย" });
    await expect(table).toContainText("คุณแพร ทดสอบ");
    // Only what is assigned to them: the pool's other enquiries are not in a rep's payload.
    await expect(table).not.toContainText("คุณเมธี ทดสอบ");
    await expect(table).not.toContainText("คุณต้น ตัวอย่าง");
    await expect(page.getByRole("button", { name: /มอบหมาย \d+ รายการ/ })).toHaveCount(0);

    await table
      .getByRole("row", { name: /คุณแพร ทดสอบ/ })
      .getByRole("button", { name: "การทำงานของ คุณแพร ทดสอบ" })
      .click();
    await page.getByRole("menuitem", { name: "บันทึกว่าติดต่อแล้ว" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "บันทึก" }).click();
    await expect(table.getByRole("row", { name: /คุณแพร ทดสอบ/ })).toContainText("ติดต่อแล้ว");
    await table
      .getByRole("row", { name: /คุณแพร ทดสอบ/ })
      .getByRole("button", { name: "การทำงานของ คุณแพร ทดสอบ" })
      .click();
    await page.getByRole("menuitem", { name: "เปลี่ยนเป็นลูกค้ามุ่งหวัง" }).click();
    await expect(page.getByText("คุณแพร ทดสอบ เป็นลูกค้ามุ่งหวังแล้ว")).toBeVisible();

    // The pipeline is the rep's own (no "worked by" column, no other reps' leads).
    await gotoHydrated(page, `${HOSTS.admin}/sales/pipeline`);
    await expect(page.locator("main")).toContainText("คุณแพร ทดสอบ");
    await expect(page.locator("main")).not.toContainText("คุณพร ตัวอย่าง");
    await page.locator("main").getByRole("link", { name: "คุณแพร ทดสอบ" }).first().click();
    await expect(page).toHaveURL(/\/sales\/leads\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "คุณแพร ทดสอบ" })).toBeVisible({ timeout: 30_000 });
    await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });

    // A quote from a spec the desk already priced, then a discount request with what the customer gives back.
    await page.getByRole("button", { name: "สร้างใบเสนอราคา" }).click();
    const quote = page.getByRole("dialog", { name: /ใบเสนอราคาสำหรับ คุณแพร ทดสอบ/ });
    await quote.getByLabel(/จำนวน \(ชิ้น\)/).fill("5000");
    await quote.getByRole("button", { name: "สร้างและส่ง" }).click();
    await expect(page.getByText("สร้างใบเสนอราคาแล้ว")).toBeVisible();
    await page.getByRole("button", { name: "ขอส่วนลด" }).click();
    const ask = page.getByRole("dialog", { name: /ขอส่วนลด/ });
    await ask.getByLabel("มัดจำ (%)").fill("50");
    await ask.getByLabel(/ส่วนลดที่ขอ/).fill("5");
    await ask.getByRole("button", { name: "ส่งคำขอ" }).click();
    await expect(page.getByText("ส่งคำขอส่วนลดแล้ว")).toBeVisible();
    await expect(page.locator("main")).toContainText("ขอส่วนลด 5% (รอบ 1)");
    await shoot(page, "lead-detail");
  });

  test("field-level RBAC: a rep sees the authority colour only — on screen and on the wire", async ({ page }) => {
    await asStaff(page, "sales_rep", "/sales/approvals");
    await shoot(page, "approvals-queue-rep", [1440]);
    const body = await openApproval(page, /คุณแพร ทดสอบ|ร้านดอกไม้ตัวอย่าง/);
    for (const key of [...FULL_ONLY, ...MARGIN_KEYS]) expect(body, `rep payload carries ${key}`).not.toContain(key);
    expect(body).toContain('"visibility":"authority"');
    await expect(page.locator('[data-tier="authority"]').first()).toBeVisible();
    await expect(page.locator('[data-tier="full"], [data-tier="margin_pct"]')).toHaveCount(0);
    await expect(page.getByText("คำขอนี้เป็นของคุณ ต้องให้ผู้มีอำนาจอีกคนตัดสิน")).toBeVisible();
    await expect(page.getByRole("button", { name: "ดาวน์โหลด CSV" })).toHaveCount(0);
    await shoot(page, "approval-rep-tier");
  });

  test("a sales manager sees margin percentages, approves the agent's request with a co-fund option", async ({
    page,
  }) => {
    await asStaff(page, "sales_manager", "/sales/approvals");
    await shoot(page, "approvals-queue");
    const body = await openApproval(page, /ขนมไทยดีดี/);
    for (const key of FULL_ONLY) expect(body, `manager payload carries ${key}`).not.toContain(key);
    expect(body).toContain('"visibility":"margin_pct"');
    await expect(page.locator('[data-tier="margin_pct"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: "ดาวน์โหลด CSV" })).toHaveCount(0);

    // The simulator answers from the API in the same tier (debounced).
    const simulated = page.waitForResponse((r) => r.url().includes("/actions/simulate"));
    await page.getByLabel("เครดิต (วัน)").fill("60");
    const simulation = await (await simulated).text();
    for (const key of FULL_ONLY) expect(simulation, `simulation carries ${key}`).not.toContain(key);
    await shoot(page, "simulator", [1440]);

    // Options: the full-rate standard option is fixed first; add a co-fund option.
    await expect(page.getByText("ค่าคอมปกติ ต้องมีเสมอ")).toBeVisible();
    await page.getByRole("button", { name: "เพิ่มทางเลือก (สูงสุด 3)" }).click();
    const coFund = page.locator('[data-option="co_fund"]');
    await coFund.getByLabel("ส่วนลด (%)").fill("6");
    await coFund.getByLabel("ค่าคอมของทางเลือกนี้ (%)").fill("3.5");
    await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "อนุมัติและเสนอทางเลือก" });
    await confirm.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    await expect(page.getByText("อนุมัติแล้ว ผู้ขายเห็นทางเลือกแล้ว")).toBeVisible();
    await expect(page.locator("main")).toContainText("ผลการตัดสิน");
  });

  test("the freelance agent sees the options in the agent zone and takes the co-fund one with its confirm", async ({
    page,
  }) => {
    await signInToAgentZone(page, "/quotes");
    await page.locator("main").getByRole("link", { name: "คุณวีระ ทองดี" }).first().click();
    const options = page.getByRole("list", { name: "ทางเลือกส่วนลดจาก getpack" });
    await expect(options.getByRole("listitem").first()).toHaveAttribute("data-testid", "option-standard");
    await expect(page.locator("main")).not.toContainText(/กำไร|margin|ต้นทุน|cost/i);
    await page.getByTestId("option-co_fund").getByRole("button", { name: "เลือกทางนี้" }).click();
    const confirm = page.getByRole("dialog", { name: "ยืนยันร่วมลดจากค่าคอมของคุณ" });
    await expect(confirm.getByRole("button", { name: "ยืนยัน" })).toBeDisabled();
    await confirm.getByRole("checkbox", { name: /ฉันยอมรับค่าคอม ฿/ }).click();
    await confirm.getByRole("button", { name: "ยืนยัน" }).click();
    await expect(page.getByTestId("option-co_fund")).toContainText("เลือกแล้ว");
    // "Won" is set by the system on the first payment (D-468) — the mocks stop at the accepted option.
  });

  test("C-Level sees the full bridge with the watermark; Finance can export; the auditor reads the view log", async ({
    page,
  }) => {
    await asStaff(page, "c_level", "/sales/approvals");
    const body = await openApproval(page, /โรงคั่วกาแฟทดสอบ/);
    expect(body).toContain('"visibility":"full"');
    expect(body).toContain("contributionAfterCommission");
    await expect(page.locator('[data-tier="full"]').first()).toBeVisible();
    await expect(page.getByRole("figure", { name: "จากราคาหน้าเว็บถึงกำไรหลังหักค่าคอม" })).toBeVisible();
    await expect(page.getByText("กำไรหลังหักค่าคอม").first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText("กำไรสุทธิ");
    await expect(page.getByText("ผู้บริหาร ตัวอย่าง (ข้อมูลจำลอง)").first()).toBeAttached();
    await expect(page.getByRole("button", { name: "ดาวน์โหลด CSV" })).toHaveCount(0);
    await shoot(page, "approval-full-tier", [1920, 1440, 1280, 1024]);
    await noHorizontalScroll(page, "approval detail (full)");

    await asStaff(page, "finance_manager", "/sales/approvals");
    await openApproval(page, /โรงคั่วกาแฟทดสอบ/);
    await expect(page.locator('[data-tier="full"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: "ดาวน์โหลด CSV" })).toBeVisible();

    await asStaff(page, "auditor", "/sales/approvals/views");
    const log = page.getByRole("table", { name: "บันทึกการเปิดดูตัวเลข" });
    await expect(log).toContainText("ผู้บริหาร ตัวอย่าง (ข้อมูลจำลอง)");
    await expect(log).toContainText("ตัวเลขเต็ม");
    await expect(log).toContainText("พนักงานขาย ตัวอย่าง (ข้อมูลจำลอง)");
    await expect(log).toContainText("ระดับอำนาจอนุมัติ");
    await expect(log).toContainText("ลองปรับเงื่อนไข");
  });

  test("playbook: the maker cannot publish; another person can", async ({ page }) => {
    await asStaff(page, "marketing", "/sales/playbook");
    await shoot(page, "playbook-list");
    await page
      .locator("main")
      .getByRole("link", { name: /คุยครั้งแรก|first-contact/ })
      .first()
      .click();
    await page.getByRole("button", { name: "สร้างฉบับร่างใหม่" }).click();
    await expect(page.getByRole("heading", { name: "แก้ไขฉบับร่าง" })).toBeVisible();
    await page.getByLabel("เปลี่ยนอะไรในฉบับนี้").fill("ปรับประโยคเปิด");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
    await page.getByRole("button", { name: "ส่งตรวจ" }).click();
    await expect(page.getByText(/ส่งตรวจแล้ว/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "เผยแพร่" })).toBeDisabled();
    await expect(page.getByText(/ผู้เขียนหรือผู้ส่งตรวจเผยแพร่เองไม่ได้/)).toBeVisible();
    await shoot(page, "playbook-editor");
    const draftUrl = page.url().replace(HOSTS.admin, "");

    await asStaff(page, "sales_manager", draftUrl);
    await expect(page.getByRole("button", { name: "เผยแพร่" })).toBeEnabled();
    await page.getByRole("button", { name: "เผยแพร่" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "เผยแพร่" }).click();
    await expect(page.getByText(/เผยแพร่แล้ว/).first()).toBeVisible();
  });

  test("layouts: dashboard, pipeline, reports — screenshots and no horizontal scroll", async ({ page }) => {
    await asStaff(page, "sales_manager", "/sales/dashboard");
    await expect(page.getByRole("figure", { name: "ลูกค้ามุ่งหวังแต่ละขั้น" })).toBeVisible();
    await shoot(page, "dashboard");
    await noHorizontalScroll(page, "dashboard");

    await gotoHydrated(page, `${HOSTS.admin}/sales/pipeline`);
    await expect(page.getByRole("table")).toBeVisible();
    await shoot(page, "pipeline-table");
    await noHorizontalScroll(page, "pipeline", [768, 1024, 1280, 1440, 1920]);
    await gotoHydrated(page, `${HOSTS.admin}/sales/pipeline?layout=board`);
    await shoot(page, "pipeline-board");
    await noHorizontalScroll(page, "pipeline board");

    await gotoHydrated(page, `${HOSTS.admin}/sales`);
    await noHorizontalScroll(page, "inbox", [768, 1024, 1280, 1440, 1920]);

    for (const [path, name] of [
      ["/sales/reports/negotiations?leadId=00000000-0000-4000-8000-0000000b8004", "negotiation-history"],
      ["/sales/reports/lost-to-price", "lost-to-price"],
      ["/sales/reports/post-deal", "post-deal-review"],
      ["/sales/quotes", "quotes"],
      ["/sales/playbook", "playbook"],
    ] as const) {
      await gotoHydrated(page, `${HOSTS.admin}${path}`);
      await expect(page.locator("main h1")).toBeVisible();
      await page.waitForLoadState("networkidle");
      if (name !== "quotes" && name !== "playbook") await shoot(page, name);
      await noHorizontalScroll(page, path);
    }
  });
});
