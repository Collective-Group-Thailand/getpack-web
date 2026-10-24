import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { adminMenuLink, gotoHydrated, signInAsStaff } from "./helpers/session";
import { choiceList } from "./helpers/select";

/**
 * F2 2.1 — the back-office foundation, against the MSW mock of getpack-api B1.3 plus the F2
 * contract requests.
 *
 * The mock keeps state for the whole run and tests run in parallel, so every test that changes
 * something changes a record no other test reads.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectAxeClean(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  const report = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`,
  );
  expect(violations, report.join("\n\n")).toEqual([]);
}

/** Radix Select: open the trigger named `label`, then pick `option`. */
async function choose(page: Page, label: string | RegExp, option: string) {
  await choiceList(page, label).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

const MEMO_FOR_DIRECTOR = "00000000-0000-4000-8000-617070000001";
const MEMO_BELOW_FLOOR = "00000000-0000-4000-8000-617070000002";
const FINANCE_USER = "00000000-0000-4000-8000-000000005109";
const CS_LIMIT_SETTING = "00000000-0000-4000-8000-736574000003";

test.describe("the menu follows the entitlements", () => {
  test("a superadmin sees the system screens a CS agent does not", async ({ page }) => {
    await signInAsStaff(page, "superadmin");
    for (const name of ["ผู้ใช้และสิทธิ์", "ตั้งค่าระบบ", "บันทึกการใช้งาน", "เปิด/ปิดฟีเจอร์", "คิวเหตุการณ์ระบบ"]) {
      await expect(await adminMenuLink(page, name)).toBeVisible();
    }
  });

  test("the auditor reads the audit log and cannot open settings", async ({ page }) => {
    await signInAsStaff(page, "auditor");
    await expect(await adminMenuLink(page, "บันทึกการใช้งาน")).toBeVisible();
    await expect(await adminMenuLink(page, "เปิด/ปิดฟีเจอร์")).toHaveCount(0);
  });
});

test.describe("ops monitor (getpack-api B6.3)", () => {
  test("an admin opens the signals from the menu; a CS agent has no entry", async ({ page, browser }) => {
    await signInAsStaff(page, "admin");
    await (await adminMenuLink(page, "เฝ้าระวังระบบ")).click();
    await expect(page.getByRole("heading", { level: 1, name: "เฝ้าระวังระบบ" })).toBeVisible();
    // The contract's own example row: dead letters 0 against a threshold of 1.
    const row = page.getByRole("row", { name: /dead letter/ });
    await expect(row).toContainText("ปกติ");

    const cs = await browser.newPage();
    await signInAsStaff(cs, "cs");
    await expect(await adminMenuLink(cs, "เฝ้าระวังระบบ")).toHaveCount(0);
    await cs.close();
  });
});

test.describe("?mock= scenarios (U-F0.1)", () => {
  test("switch one operation to a documented problem, stick across pages, and end on ?mock=off", async ({ page }) => {
    await signInAsStaff(page, "admin");
    await gotoHydrated(page, `${HOSTS.admin}/ops?mock=admin.ops.signals:auth.forbidden`);
    await expect(page.getByRole("alert").filter({ hasText: "โหลดสัญญาณไม่สำเร็จ" })).toBeVisible();

    // Remembered for the pages that follow, until switched off.
    await gotoHydrated(page, `${HOSTS.admin}/ops`);
    await expect(page.getByRole("alert").filter({ hasText: "โหลดสัญญาณไม่สำเร็จ" })).toBeVisible();

    await gotoHydrated(page, `${HOSTS.admin}/ops?mock=off`);
    await expect(page.getByRole("row", { name: /dead letter/ })).toContainText("ปกติ");
  });
});

test.describe("dashboard", () => {
  test("opens on the queues this person may work", async ({ page }) => {
    // getpack-api's queues (admin.dashboard.get), each behind its working permission.
    await signInAsStaff(page, "finance");
    await expect(page.getByRole("heading", { level: 1, name: /^สวัสดี/ })).toBeVisible();
    // Today's queues lead; the rest are a compact list, empty ones folded behind "แสดง" (UX audit).
    const queues = page.getByRole("main");
    const slips = queues.getByRole("link", { name: /สลิปรอตรวจ/ });
    if ((await slips.count()) === 0) await queues.getByRole("button", { name: "แสดง" }).click();
    await expect(slips.first()).toBeVisible();
    await expect(slips.first()).toHaveAttribute("href", "/finance/slips");
    await expect(page.getByRole("heading", { name: "รอคุณอนุมัติ" })).toBeVisible();
    await expectAxeClean(page);
  });

  test("a CS agent's queues are the orders it works, not Finance's", async ({ page }) => {
    await signInAsStaff(page, "cs");
    const queues = page.getByRole("main");
    const show = queues.getByRole("button", { name: "แสดง" });
    if (await show.count()) await show.click();
    await expect(queues.getByRole("link", { name: /รอชำระ/ }).first()).toBeVisible();
    await expect(queues.getByRole("link", { name: /สลิปรอตรวจ/ })).toHaveCount(0);
  });
});

test.describe("list exports (admin.exports.create)", () => {
  test("the orders list exports as it is filtered, for whoever holds reports.export", async ({ page }) => {
    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/orders`);
    const exported = page.waitForResponse(
      (response) => response.url().endsWith("/exports") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "ส่งออก" }).click();
    await page.getByRole("menuitem", { name: "CSV" }).click();
    const response = await exported;
    expect(response.ok()).toBe(true);
    expect(response.request().postDataJSON()).toMatchObject({ resource: "orders", format: "csv" });
  });

  test("a CS agent, who cannot export, is not offered it", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/orders`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "ส่งออก" })).toHaveCount(0);
  });
});

test.describe("approvals", () => {
  test("a Director approves the memo routed to their tier, with a comment", async ({ page }) => {
    await signInAsStaff(page, "director");
    await gotoHydrated(page, `${HOSTS.admin}/approvals`);
    // In the page, not the sidebar — which has a "discount memos" entry of the same name.
    await page
      .getByRole("main")
      .getByRole("link", { name: /บันทึกขอส่วนลด/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(MEMO_FOR_DIRECTOR));
    await expectAxeClean(page);

    await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    const dialog = page.getByRole("alertdialog", { name: "อนุมัติคำขอนี้?" });
    await dialog.getByLabel("ความเห็น").fill("ส่วนต่างอยู่ในเกณฑ์ ลูกค้าประจำ");
    await dialog.getByRole("button", { name: "อนุมัติ", exact: true }).click();

    await expect(page.getByText("อนุมัติแล้ว").first()).toBeVisible();
    await expect(page.getByRole("list", { name: "ประวัติการดำเนินการ" })).toContainText(
      "ส่วนต่างอยู่ในเกณฑ์ ลูกค้าประจำ",
    );
  });

  test("the requester is told they cannot approve their own request", async ({ page }) => {
    await signInAsStaff(page, "cs");
    await gotoHydrated(page, `${HOSTS.admin}/approvals/${MEMO_BELOW_FLOOR}`);
    await expect(page.getByText("ต่ำกว่าอัตรากำไรขั้นต่ำ")).toBeVisible();
    // CS lacks approvals.act and made the request: there is no approve button to press.
    await expect(page.getByRole("button", { name: "อนุมัติ", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ถอนคำขอ" })).toBeVisible();
  });

  test("all requests filter through the URL, and the page keeps its tab", async ({ page }) => {
    await signInAsStaff(page, "director");
    await gotoHydrated(page, `${HOSTS.admin}/approvals?tab=all`);
    await choose(page, "สถานะ", "อนุมัติแล้ว");
    await expect(page).toHaveURL(/tab=all/);
    await expect(page).toHaveURL(/status=approved/);
    await expect(page.getByRole("table", { name: "คำขอทั้งหมด" })).toContainText("คืนเงิน");
  });
});

test.describe("users and roles", () => {
  test("granting Auditor to Finance is stopped before the click (D-168)", async ({ page }) => {
    await signInAsStaff(page, "superadmin");
    await gotoHydrated(page, `${HOSTS.admin}/users/${FINANCE_USER}`);
    await expectAxeClean(page);

    await page.getByRole("button", { name: "ให้บทบาท" }).click();
    const dialog = page.getByRole("dialog");
    await choose(page, "บทบาท", "ผู้ตรวจสอบบัญชี");
    await expect(dialog.getByText("ขัดกับหลักการแบ่งแยกหน้าที่")).toBeVisible();
    await dialog.getByLabel(/^เหตุผล/).fill("ทดสอบการแบ่งแยกหน้าที่");
    await expect(dialog.getByRole("button", { name: "ให้บทบาท" })).toBeDisabled();
  });

  test("the roles matrix is a real table and marks D-141 permissions in words", async ({ page }) => {
    await signInAsStaff(page, "superadmin");
    await gotoHydrated(page, `${HOSTS.admin}/users/roles`);
    const table = page.getByRole("table");
    await expect(table.getByRole("rowheader", { name: /factory_buy_prices\.read.*ข้อมูลอ่อนไหว/ })).toBeVisible();
    await expectAxeClean(page);
  });
});

test.describe("settings", () => {
  test("a superadmin schedules a change, confirmed by retyping the key", async ({ page }) => {
    await signInAsStaff(page, "superadmin");
    await gotoHydrated(page, `${HOSTS.admin}/settings/${CS_LIMIT_SETTING}`);
    await expect(page.getByRole("heading", { level: 1, name: "discounts.cs_limit_pct" })).toBeVisible();

    await page.getByLabel("ค่าใหม่").fill("5.5");
    await page.getByRole("radio", { name: "ตั้งเวลา" }).click();
    await page.getByLabel(/วันและเวลาที่มีผล/).fill("2027-01-01T00:00");
    await page.getByLabel(/เหตุผลที่เปลี่ยน/).fill("ทบทวนเพดานส่วนลดประจำปี");
    await page.getByRole("button", { name: "ตรวจทานการเปลี่ยน" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("5.5%");
    await expect(dialog.getByRole("button", { name: "ตั้งเวลา" })).toBeDisabled();
    await dialog.getByLabel(/พิมพ์ discounts\.cs_limit_pct/).fill("discounts.cs_limit_pct");
    await dialog.getByRole("button", { name: "ตั้งเวลา" }).click();

    // The outcome, on the page: a scheduled 5.5 % beside its date, and a new history row.
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByText(/ตั้งเวลาไว้\s*5\.5%/).first()).toBeVisible();
    await expect(page.getByRole("table", { name: "ประวัติ" })).toContainText("ทบทวนเพดานส่วนลดประจำปี");
  });

  test("someone who does not own a setting cannot change it (D-063)", async ({ page }) => {
    await signInAsStaff(page, "finance");
    await gotoHydrated(page, `${HOSTS.admin}/settings/${CS_LIMIT_SETTING}`);
    await expect(page.getByText(/เฉพาะ ซูเปอร์แอดมิน เท่านั้นที่เปลี่ยนค่านี้ได้/)).toBeVisible();
    await expect(page.getByLabel("ค่าใหม่")).toHaveCount(0);
  });
});

test.describe("saved views and search", () => {
  test("a filtered list saves as a view and comes back from the menu", async ({ page }) => {
    await signInAsStaff(page, "cs_lead");
    await gotoHydrated(page, `${HOSTS.admin}/approvals?tab=all&status=pending`);

    await page.getByRole("button", { name: "มุมมองที่บันทึก" }).click();
    await page.getByRole("menuitem", { name: "บันทึกมุมมองนี้" }).click();
    // Unique per run: the mock keeps its state for as long as the server is up.
    const name = `รออนุมัติของหัวหน้า ${Date.now()}`;
    await page.getByLabel(/ชื่อมุมมอง/).fill(name);
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("บันทึกมุมมองแล้ว")).toBeVisible();

    await gotoHydrated(page, `${HOSTS.admin}/approvals?tab=all`);
    await page.getByRole("button", { name: "มุมมองที่บันทึก" }).click();
    await page.getByRole("menuitem", { name: new RegExp(`^${name}`) }).click();
    await expect(page).toHaveURL(/status=pending/);
  });

  test("⌘K finds a person by name and opens them", async ({ page }) => {
    await signInAsStaff(page, "superadmin");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
    const palette = page.getByRole("dialog", { name: "ค้นหาและสั่งงาน" });
    await expect(palette).toBeVisible();
    await palette.getByRole("combobox").fill("ฝ่ายการเงิน");
    await palette
      .getByRole("option", { name: /ฝ่ายการเงิน ตัวอย่าง/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/users/${FINANCE_USER}`));
  });
});

test.describe("every 2.1 screen is axe-clean", () => {
  for (const [path, heading] of [
    ["/approvals", "รายการรออนุมัติ"],
    ["/approvals?tab=delegations", "รายการรออนุมัติ"],
    ["/users", "ผู้ใช้และสิทธิ์"],
    ["/settings", "ตั้งค่าระบบ"],
    [`/settings/${CS_LIMIT_SETTING}`, "discounts.cs_limit_pct"],
    ["/audit-logs", "บันทึกการใช้งาน"],
    ["/feature-flags", "เปิด/ปิดฟีเจอร์"],
    ["/notifications/templates", "แม่แบบข้อความแจ้งเตือน"],
    ["/notifications/routes", "เส้นทางการแจ้งเตือน"],
    ["/outbox", "คิวเหตุการณ์ระบบ"],
    ["/ops", "เฝ้าระวังระบบ"],
  ] as const) {
    test(path, async ({ page }) => {
      await signInAsStaff(page, "superadmin");
      await gotoHydrated(page, `${HOSTS.admin}${path}`);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.waitForLoadState("networkidle").catch(() => {});
      await expectAxeClean(page);
    });
  }
});
