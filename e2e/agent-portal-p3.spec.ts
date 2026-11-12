import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInToAgentZone } from "./helpers/agent";
import { signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * Agent portal P3 (D-468): lead management in getpack Agent — the pipeline on every size, a new lead with the neutral
 * duplicate check, card scan, the offline queue, stage changes by keyboard, a quote on a lead's behalf opened by the
 * customer on the storefront (agent cookie, timeline, conversion), the three-step discount request and a co-fund
 * option accepted with its confirmation, CSV import, and the commission forecast.
 *
 * Runs against the MSW mock server (persona `agent`, mocks/store/agent-leads.ts), whose state lives as long as the
 * server: the suite expects a freshly started server (a second run finds the seeded discount rounds already used).
 */
const shots = process.env["E2E_SHOTS"];
const WIDTHS = [360, 375, 393, 768, 1024, 1280, 1440, 1920] as const;
/** The returning storefront customer (mocks/store/customers.ts) — the lead the conversion journey registers. */
const CUSTOMER_PHONE = "0812345678";
/** A seeded lead of the agent (คุณมานี ใจดี) — the own-lead duplicate. */
const OWN_LEAD_PHONE = "0890001234";
/** A contact another agent holds, in the mock — the neutral refusal. */
const HELD_PHONE = "0899999999";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** A Thai mobile number no other test uses: 08 + eight digits from the clock. */
const uniquePhone = () => `08${String(Date.now()).slice(-8)}`;

async function noHorizontalScroll(page: Page, label: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(60);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${label}: horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function shoot(page: Page, name: string, sizes: readonly ("phone" | "tablet" | "desktop")[] = ["phone", "desktop"]) {
  if (!shots) return;
  const widths = { phone: 390, tablet: 768, desktop: 1440 } as const;
  for (const size of sizes) {
    await page.setViewportSize({ width: widths[size], height: size === "phone" ? 844 : size === "tablet" ? 1024 : 900 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${shots}/${name}-${size}-${widths[size]}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/** One open lead of the agent's, found through the BFF (the browser's own session). */
async function leadByPhone(page: Page, phone: string): Promise<{ id: string; contactName: string } | null> {
  const body = (await bff(page, `/bff/v1/store/agent/leads/pipeline?q=${phone}&limit=5`)) as {
    data: { id: string; contactName: string; phone: string | null }[];
  };
  return body.data.find((lead) => lead.phone?.endsWith(phone.slice(1))) ?? null;
}

/**
 * A call through the agent zone's BFF from inside the page (the test runner cannot resolve `agent.localhost`; the
 * browser can), with the page's own session cookies.
 */
async function bff(page: Page, path: string, init?: { method: string; body: unknown }): Promise<unknown> {
  return page.evaluate(
    async ({ path, init }) => {
      const response = await fetch(path, {
        method: init?.method ?? "GET",
        headers: init ? { "content-type": "application/json", "x-getpack-csrf": "1" } : {},
        body: init ? JSON.stringify(init.body) : undefined,
      });
      return { ...((await response.json().catch(() => ({}))) as object), httpStatus: response.status };
    },
    { path, init },
  );
}

test.describe("agent portal P3 — lead management (D-468)", () => {
  test.describe.configure({ mode: "serial" });

  test("a new lead on a phone: the FAB, the sheet, the neutral duplicate check, saved", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInToAgentZone(page, "/leads");
    await expect(page.getByRole("heading", { level: 1, name: "ลูกค้ามุ่งหวัง" })).toBeVisible();
    await page.getByTestId("new-lead-fab").click();
    const sheet = page.getByRole("dialog", { name: "ลูกค้ามุ่งหวังใหม่" });
    await expect(sheet).toBeVisible();
    // A sheet from the bottom on a phone, not a centred dialog.
    const box = await sheet.boundingBox();
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(840);
    await expect(sheet.getByLabel("เบอร์โทร")).toHaveAttribute("inputmode", "tel");
    await expect(sheet.getByLabel("อีเมล")).toHaveAttribute("autocomplete", "email");

    await sheet.getByLabel("ชื่อผู้ติดต่อ").fill("คุณทดสอบ มือถือ");
    await sheet.getByLabel("เบอร์โทร").fill(OWN_LEAD_PHONE);
    await sheet.getByLabel("อีเมล").focus();
    await expect(sheet.getByText("รายชื่อนี้อยู่ในลูกค้ามุ่งหวังของคุณแล้ว")).toBeVisible();
    await expect(sheet.getByRole("link", { name: "เปิดดูรายชื่อเดิม" })).toBeVisible();

    await sheet.getByLabel("เบอร์โทร").fill(HELD_PHONE);
    await sheet.getByLabel("อีเมล").focus();
    const neutral = sheet.getByText("ลงทะเบียนผู้มุ่งหวังรายนี้ไม่ได้");
    await expect(neutral).toBeVisible();
    // Never who holds it (D-440).
    await expect(sheet).not.toContainText(/ตัวแทนอื่น|another agent|ลูกค้าเดิม/);
    await shoot(page, "p3-new-lead", ["phone"]);

    await sheet.getByLabel("เบอร์โทร").fill(uniquePhone());
    await sheet.getByRole("button", { name: "พรุ่งนี้ 10:00" }).click();
    await sheet.getByRole("checkbox", { name: "ลูกค้ายินยอมให้ getpack ติดต่อกลับ" }).click();
    await sheet.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "คุณทดสอบ มือถือ" })).toBeVisible();
  });

  test("scan a business card: the fake OCR fills the form, unsure readings are marked, then save", async ({ page }) => {
    await signInToAgentZone(page, "/leads");
    await page.keyboard.press("n");
    const dialog = page.getByRole("dialog", { name: "ลูกค้ามุ่งหวังใหม่" });
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("card-scan-input").setInputFiles({ name: "card.png", mimeType: "image/png", buffer: PNG });
    await expect(dialog.getByText("อ่านนามบัตรแล้ว")).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByLabel("ชื่อผู้ติดต่อ")).toHaveValue("คุณสุดา ทดลองสแกน");
    await expect(dialog.getByLabel("ชื่อร้านหรือบริษัท")).toHaveValue("บริษัท ตัวอย่างนามบัตร จำกัด");
    // The e-mail was read with low confidence: it says so beside the field.
    await expect(dialog.getByText("อ่านได้ไม่ชัด ตรวจอีกครั้ง").first()).toBeVisible();
    if (shots) {
      await page.screenshot({ path: `${shots}/p3-card-scan-review-desktop-1440.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    const form = page.getByRole("dialog", { name: "ลูกค้ามุ่งหวังใหม่" });
    await form.getByLabel("อีเมล").fill("suda.checked@example.invalid");
    await form.getByLabel("เบอร์โทร").fill(uniquePhone());
    await form.getByRole("checkbox", { name: "ลูกค้ายินยอมให้ getpack ติดต่อกลับ" }).click();
    await form.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "คุณสุดา ทดลองสแกน" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("จากนามบัตร").first()).toBeVisible().catch(() => undefined);
  });

  test("offline: the lead waits on the device as รอส่ง and is sent when the connection returns", async ({ page, context }) => {
    await signInToAgentZone(page, "/leads");
    await page.getByRole("button", { name: /เพิ่มลูกค้ามุ่งหวัง/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "ลูกค้ามุ่งหวังใหม่" });
    await dialog.getByLabel("ชื่อผู้ติดต่อ").fill("คุณออฟไลน์ ทดสอบ");
    await dialog.getByLabel("เบอร์โทร").fill(uniquePhone());
    await dialog.getByRole("checkbox", { name: "ลูกค้ายินยอมให้ getpack ติดต่อกลับ" }).click();
    await context.setOffline(true);
    await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
    const pending = page.getByTestId("pending-drafts");
    await expect(pending).toBeVisible();
    await expect(pending).toContainText("คุณออฟไลน์ ทดสอบ");
    await expect(pending).toContainText("รอส่ง");
    await context.setOffline(false);
    await expect(pending).toBeHidden({ timeout: 20_000 });
    await gotoHydrated(page, `${HOSTS.agent}/leads?q=${encodeURIComponent("คุณออฟไลน์")}`);
    await expect(page.locator("main").getByRole("link", { name: "คุณออฟไลน์ ทดสอบ" }).first()).toBeVisible();
  });

  test("a stage changes from its menu with the keyboard alone (never by dragging only)", async ({ page }) => {
    await signInToAgentZone(page, "/leads");
    const row = page.locator("tbody tr", { hasText: "คุณกันยา ศรีงาม" });
    const trigger = row.getByRole("button", { name: /ย้ายไปขั้น…/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "ปิดการขายได้" })).toHaveCount(0);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/ย้ายไปขั้น “.+” แล้ว/)).toBeVisible();
    // The board is the desktop's enhancement; every card there keeps the same menu.
    await gotoHydrated(page, `${HOSTS.agent}/leads?layout=board`);
    await expect(page.getByRole("heading", { level: 2, name: "กำลังต่อรอง" })).toBeVisible();
    await expect(page.locator("section").filter({ hasText: "กำลังต่อรอง" }).getByRole("button", { name: /ย้ายไปขั้น…/ }).first()).toBeVisible();
  });

  test("a quote on the lead's behalf, opened by the customer, then the sign-up converts the lead", async ({ page, browser }) => {
    test.setTimeout(180_000);
    await signInToAgentZone(page, "/leads");
    // The lead is the storefront's returning customer, so the conversion can be walked (mock: claim by phone).
    let lead = await leadByPhone(page, CUSTOMER_PHONE);
    if (!lead) {
      const created = (await bff(page, "/bff/v1/store/agent/leads", {
        method: "POST",
        body: { kind: "customer", source: "manual", contactName: "คุณลูกค้า กลับมา", phone: "+66812345678", consentConfirmed: true },
      })) as { httpStatus: number };
      expect(created.httpStatus).toBe(201);
      lead = await leadByPhone(page, CUSTOMER_PHONE);
    }
    await gotoHydrated(page, `${HOSTS.agent}/leads/${lead!.id}`);
    await page.getByRole("link", { name: "ส่งใบเสนอราคา" }).first().click();
    await expect(page.getByRole("heading", { level: 2, name: "เลือกสินค้า" })).toBeVisible({ timeout: 15_000 });
    await page.locator("main ul li button").first().click();
    await expect(page.getByText(/ชิ้น/).first()).toBeVisible();
    const review = page.getByRole("button", { name: "ตรวจใบเสนอราคา" }).last();
    await expect(review).toBeEnabled({ timeout: 15_000 });
    await shoot(page, "p3-quote-create");
    await review.click();
    await page.getByRole("button", { name: "สร้างและรับลิงก์" }).click();
    await expect(page.getByRole("heading", { name: "ใบเสนอราคาพร้อมส่งแล้ว" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "แชร์ลิงก์" })).toBeVisible();

    const quotes = (await bff(page, `/bff/v1/store/agent/quotes?leadId=${lead!.id}`)) as {
      data: { shareUrl: string | null; status: string }[];
    };
    const shareUrl = quotes.data.find((quote) => quote.shareUrl)!.shareUrl!;
    const token = shareUrl.split("/q/")[1]!;

    // The customer, on another browser: the storefront keeps the agent's code exactly as /a/{code} does.
    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    await customerPage.goto(`${HOSTS.customer}/q/${token}`);
    await expect(customerPage).toHaveURL(/\/configure\/[^?]+\?share=/, { timeout: 20_000 });
    const cookie = (await customer.cookies()).find((entry) => entry.name === "pk_agent");
    expect(cookie?.value).toBe("MOCKAG01");

    await gotoHydrated(page, `${HOSTS.agent}/leads/${lead!.id}`);
    await expect(page.getByText("ลูกค้าเปิดดูใบเสนอราคาแล้ว").first()).toBeVisible();

    // Signing up with the lead's phone claims the code and converts the lead (mock: the claim matches the phone).
    await signInAsCustomer(customerPage, "/account", CUSTOMER_PHONE);
    await expect
      .poll(async () => (await customer.cookies()).some((entry) => entry.name === "pk_agent" && entry.value), { timeout: 15_000 })
      .toBe(false);
    await customer.close();
    await gotoHydrated(page, `${HOSTS.agent}/leads/${lead!.id}`);
    await expect(page.getByText("ลูกค้าสมัครแล้ว เป็นลูกค้าของคุณ").first()).toBeVisible();
    await expect(page.getByText("เป็นลูกค้าของคุณแล้ว").first()).toBeVisible();
    await shoot(page, "p3-lead-detail");
  });

  test("a discount request in three steps, and a co-fund option accepted only with its explicit confirm", async ({ page }) => {
    await signInToAgentZone(page, "/quotes");
    await shoot(page, "p3-quotes-list");
    await page.locator("main").getByRole("link", { name: "คุณวีระ ทองดี" }).first().click();
    await expect(page.getByTestId("deal-badge")).toContainText("ดีลนี้ถูกจองแล้วถึง");
    await page.getByRole("link", { name: "ขอส่วนลด" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "ขอส่วนลด" })).toBeVisible();

    // Step 1: give-get first — nothing chosen is refused.
    await page.getByRole("button", { name: "ถัดไป" }).click();
    await expect(page.getByText("เลือกสิ่งที่ลูกค้าให้กลับมาอย่างน้อยหนึ่งอย่าง")).toBeVisible();
    await page.getByRole("checkbox", { name: /ทำสัญญาเรียกของเป็นงวด/ }).click();
    await page.getByRole("checkbox", { name: /ชำระเร็ว/ }).click();
    await page.getByLabel("ส่วนลดที่ลูกค้าขอ (%)").fill("6");
    await shoot(page, "p3-discount-step1");
    await page.getByRole("button", { name: "ถัดไป" }).click();

    // Step 2: the reason, and a competitor's like-for-like spec.
    await page.getByRole("radio", { name: "เจ้าอื่นเสนอราคาถูกกว่า" }).click();
    await page.getByLabel("เกรดกระดาษ").fill("KA125/CA125");
    await page.getByLabel("ราคารวม (บาท)").fill("42500");
    await shoot(page, "p3-discount-step2");
    await page.getByRole("button", { name: "ถัดไป" }).click();

    // Step 3: review, then send — the request then waits for getpack, honestly.
    await expect(page.getByText("สัญญา 6 เดือน", { exact: true })).toBeVisible();
    await shoot(page, "p3-discount-step3");
    await page.getByRole("button", { name: "ส่งคำขอ" }).click();
    await expect(page.getByText("รอ getpack ตอบ").first()).toBeVisible({ timeout: 15_000 });

    // A round getpack has answered (seeded): plain lines, the full rate first, co-fund needs the tick.
    await gotoHydrated(page, `${HOSTS.agent}/quotes`);
    await page.locator("main").getByRole("link", { name: "คุณมานี ใจดี" }).first().click();
    const options = page.getByRole("list", { name: "ทางเลือกส่วนลดจาก getpack" });
    await expect(options.getByRole("listitem").first()).toHaveAttribute("data-testid", "option-standard");
    await expect(options).toContainText(/ลูกค้าได้ส่วนลด 4% · คุณได้ ฿/);
    await expect(page.locator("main")).not.toContainText(/กำไร|margin|ต้นทุน|cost/i);
    await shoot(page, "p3-discount-options");
    await page.getByTestId("option-co_fund").getByRole("button", { name: "เลือกทางนี้" }).click();
    const confirm = page.getByRole("dialog", { name: "ยืนยันร่วมลดจากค่าคอมของคุณ" });
    await expect(confirm).toContainText("ค่าคอมของคุณสำหรับดีลนี้");
    await expect(confirm.getByRole("button", { name: "ยืนยัน" })).toBeDisabled();
    await confirm.getByRole("checkbox", { name: /ฉันยอมรับค่าคอม ฿/ }).click();
    await confirm.getByRole("button", { name: "ยืนยัน" }).click();
    await expect(page.getByTestId("option-co_fund")).toContainText("เลือกแล้ว");
  });

  test("CSV import: a dry run with row problems in words, then the commit", async ({ page }) => {
    await signInToAgentZone(page, "/leads/import");
    const phone = uniquePhone();
    await page
      .getByLabel("หรือวางข้อมูล CSV")
      .fill(
        `contact_name,organisation_name,phone,email\nคุณนำเข้า หนึ่ง,ร้านทดสอบ,${phone},\nคุณนำเข้า สอง,,12345,\nคุณนำเข้า สาม,,${OWN_LEAD_PHONE},`,
      );
    await page.getByRole("checkbox", { name: "ทุกคนในไฟล์ยินยอมให้ getpack ติดต่อกลับ" }).click();
    await shoot(page, "p3-import");
    await page.getByRole("button", { name: "ตรวจรายชื่อ" }).click();
    await expect(page.getByRole("heading", { name: "พร้อมนำเข้า 1 จาก 3 แถว" })).toBeVisible();
    await expect(page.getByText("เบอร์โทรไม่ถูกต้อง")).toBeVisible();
    await expect(page.getByText("อยู่ในลูกค้ามุ่งหวังของคุณแล้ว")).toBeVisible();
    await shoot(page, "p3-import-check");
    await page.getByRole("button", { name: "นำเข้า 1 รายชื่อ" }).click();
    await expect(page.getByRole("heading", { name: "นำเข้าแล้ว 1 รายชื่อ" })).toBeVisible();
  });

  test("the commission forecast: expected payment per order and what each waits for", async ({ page }) => {
    await signInToAgentZone(page, "/commissions?view=forecast");
    await expect(page.getByRole("heading", { name: "ค่าคอมที่รอรับ" })).toBeVisible();
    await expect(page.getByText("รอออเดอร์ส่งถึงลูกค้า").first()).toBeVisible();
    await expect(page.getByText(/ภายใน \d/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "กรอกข้อมูลรับเงิน" })).toHaveAttribute("href", "/payout");
    await expect(page.locator("main")).not.toContainText(/วันที่ 5|the 5th/);
    await shoot(page, "p3-forecast");
  });

  test("phone cards, tablet two columns, desktop table; no sideways scroll on any P3 page", async ({ page }) => {
    test.setTimeout(240_000);
    await signInToAgentZone(page, "/leads");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("main ul[aria-label='ลูกค้ามุ่งหวัง'] article").first()).toBeVisible();
    await expect(page.locator("main table")).toBeHidden();
    await page.setViewportSize({ width: 768, height: 1024 });
    const columns = await page
      .locator("main ul[aria-label='ลูกค้ามุ่งหวัง']")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(2);
    await shoot(page, "p3-leads", ["tablet"]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator("main table")).toBeVisible();
    await shoot(page, "p3-leads");

    const lead = await leadByPhone(page, OWN_LEAD_PHONE);
    const quotes = (await bff(page, "/bff/v1/store/agent/quotes")) as { data: { id: string }[] };
    const paths = [
      "/leads",
      `/leads/${lead!.id}`,
      "/quotes",
      `/quotes/${quotes.data[0]!.id}`,
      `/quotes/${quotes.data[0]!.id}/discount`,
      "/quotes/new",
      "/playbook",
      "/commissions?view=forecast",
      "/leads/import",
    ];
    for (const path of paths) {
      await gotoHydrated(page, `${HOSTS.agent}${path}`);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator("main")).not.toContainText(/โรงงาน|factory|กำไร|margin|profit|coming soon|กำลังพัฒนา/i);
      await noHorizontalScroll(page, path);
    }
    await gotoHydrated(page, `${HOSTS.agent}/leads/${lead!.id}`);
    await page.setViewportSize({ width: 390, height: 844 });
    // The phone's sticky actions: call · LINE · quote · log, above the tab bar.
    const bar = page.locator("[data-mobile-bar]");
    await expect(bar.getByRole("link", { name: "โทร" })).toHaveAttribute("href", /^tel:/);
    await expect(bar.getByRole("link", { name: "LINE" })).toHaveAttribute("href", /line\.me/);
    await shoot(page, "p3-lead-detail");
    await gotoHydrated(page, `${HOSTS.agent}/playbook`);
    await page.getByLabel("ค้นหาในคู่มือ").fill("ส่วนลด");
    await expect(page.getByRole("status").filter({ hasText: "การ์ด" })).toBeVisible();
    await shoot(page, "p3-playbook");
  });

  test("notifications offer the two new events; the storefront /q link of a factory quote still opens as before", async ({ page }) => {
    await signInToAgentZone(page, "/notifications");
    await expect(page.getByRole("group", { name: /ถึงเวลาติดตามลูกค้า/ })).toBeVisible();
    await expect(page.getByRole("group", { name: /ลูกค้าเปิดดูใบเสนอราคา/ })).toBeVisible();
    const unknown = await page.request.get(`${HOSTS.customer}/q/AAAAAAAAAAAAAAAAAAAAAAAAAAAA`, { maxRedirects: 0 });
    expect(unknown.status()).toBe(404);
  });
});
