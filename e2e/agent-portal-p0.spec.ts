import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInAsCustomer } from "./helpers/customer";
import { signInAsStaff } from "./helpers/session";

/** The mock persona `agent` (mocks/store/agent.ts): an approved freelance agent. */
const AGENT_PHONE = "0861234567";
const shots = process.env["E2E_SHOTS"];
const WIDTHS = [360, 375, 393, 768, 1024, 1280, 1440, 1920] as const;

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function shoot(page: Page, name: string) {
  if (!shots) return;
  for (const [label, width] of [
    ["phone", 390],
    ["desktop", 1440],
  ] as const) {
    await page.setViewportSize({ width, height: label === "phone" ? 844 : 900 });
    await page.screenshot({ path: `${shots}/${name}-${label}-${width}.png`, fullPage: true });
  }
}

test.describe("agent portal P0 (D-464, D-465)", () => {
  test("the agent's terms say there is no cap and never speak of profit", async ({ page }) => {
    await signInAsCustomer(page, "/account/agent", AGENT_PHONE);
    await expect(page.getByText("ไม่จำกัดรายได้ ยิ่งขายมาก ยิ่งได้มาก")).toBeVisible();
    await expect(page.getByText(/กำไร/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "ลดหย่อนภาษี" })).toBeVisible();
    await shoot(page, "agent-home");
  });

  test("the lead form registers customers only and points manufacturers to the partner page", async ({ page }) => {
    await signInAsCustomer(page, "/account/agent/leads", AGENT_PHONE);
    await page.getByRole("button", { name: "ลงทะเบียนผู้มุ่งหวัง" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("ประเภท")).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "หน้าสมัครพาร์ทเนอร์" })).toHaveAttribute(
      "href",
      /\/partner-with-us$/,
    );
    await expect(dialog.getByText(/โรงงาน/)).toHaveCount(0);
  });

  test("an agent sends a ล.ย.01 and waits for Finance", async ({ page }) => {
    await signInAsCustomer(page, "/account/agent/tax", AGENT_PHONE);
    await expect(page.getByRole("heading", { level: 1, name: "ข้อมูลลดหย่อนภาษี (ล.ย.01)" })).toBeVisible();
    await expect(page.getByText(/ถ้าไม่ส่ง ระบบใช้ค่าลดหย่อนส่วนตัวตามกฎหมายเท่านั้น/)).toBeVisible();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await noHorizontalScroll(page);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await shoot(page, "agent-tax-empty");
    await page.getByLabel("คู่สมรสไม่มีเงินได้", { exact: true }).fill("abc");
    await page.getByRole("button", { name: "ส่งให้ทีมบัญชีตรวจ" }).click();
    await expect(page.getByText("ใส่จำนวนเงิน เช่น 25000 หรือ 25000.50")).toBeVisible();
    await page.getByLabel("คู่สมรสไม่มีเงินได้", { exact: true }).fill("60000");
    await page.getByLabel("เบี้ยประกันชีวิต", { exact: true }).fill("30000");
    await page.getByRole("button", { name: "ส่งให้ทีมบัญชีตรวจ" }).click();
    await expect(page.getByText("ส่งแล้ว ทีมบัญชีจะตรวจและแจ้งผล")).toBeVisible();
    await expect(page.getByText("ส่งได้อีกครั้งเมื่อทีมบัญชีตรวจฉบับที่รออยู่แล้ว")).toBeVisible();
    await shoot(page, "agent-tax-submitted");
  });

  test("a statement shows how the withholding was worked out", async ({ page }) => {
    await signInAsCustomer(page, "/account/agent/statements", AGENT_PHONE);
    await page.getByRole("link", { name: "ต.ค. 2569" }).click();
    await expect(page.getByText("บุคคลธรรมดา: คำนวณตามอัตราก้าวหน้า")).toBeVisible();
    await shoot(page, "agent-statement");
  });

  test("Finance reviews a ล.ย.01 with its evidence and accepts it", async ({ page }) => {
    await signInAsStaff(page, "finance_manager");
    await page.goto(`${HOSTS.admin}/agents/tax-declarations`);
    await expect(page.getByRole("heading", { level: 1, name: "แบบ ล.ย.01 ของตัวแทน" })).toBeVisible();
    await shoot(page, "admin-tax-declarations");
    await page.getByRole("link", { name: "สมชาย ขายเก่ง" }).first().click();
    await expect(page.getByText("คู่สมรสไม่มีเงินได้")).toBeVisible();
    await page.getByRole("button", { name: "ยอมรับ" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ยอมรับ" }).click();
    await expect(page.getByText("ยอมรับแล้ว")).toBeVisible();
    await shoot(page, "admin-tax-declaration");
  });
});
