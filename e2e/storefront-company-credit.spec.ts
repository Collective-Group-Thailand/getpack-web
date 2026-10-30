import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInAsCustomer } from "./helpers/customer";
import { signInAsStaff } from "./helpers/session";

/** The mock company B2606 on a temporary THB 150,000 / 90-day limit over THB 30,000 / 30 days (D-462). */
const CREDIT_ADMIN_PHONE = "0891112222";
const CREDIT_BUYER_PHONE = "0892223333";
const shots = process.env["E2E_SHOTS"];

test.describe("company credit (D-462)", () => {
  test("a buyer sees the available credit, the term and the end date — not the limit", async ({ page }) => {
    await signInAsCustomer(page, "/business", CREDIT_BUYER_PHONE);
    // The credit is the first of the dashboard's summary cards (`SummaryCards`, a term and its values).
    const card = page.locator("dl > div").filter({ has: page.getByRole("term").filter({ hasText: "เครดิตคงเหลือ" }) });
    await expect(card).toContainText("฿");
    await expect(card).toContainText("เครดิต 90 วันหลังส่งมอบ");
    await expect(card).toContainText("วงเงินชั่วคราว ใช้ได้ถึง");
    if (shots) await page.screenshot({ path: `${shots}/buyer-dashboard.png`, fullPage: true });

    await page.goto(`${HOSTS.customer}/business/credit`);
    await expect(page.getByRole("heading", { level: 1, name: "เครดิตและใบแจ้งยอด" })).toBeVisible();
    await expect(page.getByText("วงเงินนี้เป็นวงเงินชั่วคราว")).toBeVisible();
    await expect(page.getByText("วงเงิน", { exact: true })).toHaveCount(0);
    if (shots) await page.screenshot({ path: `${shots}/buyer-credit.png`, fullPage: true });
  });

  test("the company admin sees the temporary limit and what applies after it", async ({ page }) => {
    await signInAsCustomer(page, "/business/credit", CREDIT_ADMIN_PHONE);
    await expect(page.getByText("วงเงินนี้เป็นวงเงินชั่วคราว")).toBeVisible();
    await expect(page.getByText(/หลังจากนั้นกลับไปใช้วงเงิน ฿30,000/)).toBeVisible();
    if (shots) await page.screenshot({ path: `${shots}/admin-credit.png`, fullPage: true });
  });

  test("a customer without a company is invited to open one from the account home", async ({ page }) => {
    await signInAsCustomer(page, "/account");
    await expect(page.getByRole("heading", { name: "สั่งในนามบริษัท และจ่ายแบบเครดิตเทอม" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ดูบัญชีบริษัท" })).toHaveAttribute("href", /\/business$/);
    if (shots) await page.screenshot({ path: `${shots}/account-invite.png`, fullPage: true });
  });

  test("Finance requests a temporary limit with a custom term", async ({ page }) => {
    await signInAsStaff(page, "finance_manager");
    await page.goto(`${HOSTS.admin}/companies`);
    // B2606: the sixth mock company (คุณนภา ตัวอย่าง), already on a temporary limit.
    await page.getByRole("link", { name: "คุณนภา ตัวอย่าง (ข้อมูลจำลอง)" }).click();
    await page.getByRole("tab", { name: "เครดิต" }).click();
    await expect(page.getByText(/วงเงินชั่วคราว ใช้ได้ถึง/)).toBeVisible();
    await expect(page.getByRole("cell", { name: /กำหนดเอง/ })).toBeVisible();
    if (shots) await page.screenshot({ path: `${shots}/backoffice-credit.png`, fullPage: true });

    await page.getByRole("button", { name: "ขอวงเงิน" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("วงเงินชั่วคราว", { exact: true })).toBeVisible();
    if (shots) await page.screenshot({ path: `${shots}/backoffice-dialog.png` });
  });
});
