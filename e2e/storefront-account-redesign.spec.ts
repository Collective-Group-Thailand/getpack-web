import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInAsCustomer } from "./helpers/customer";
import { gotoHydrated } from "./helpers/session";

/**
 * Stage C · C6 — the account redesign (account pack Phases 1–4) against the mock backend: the nine-section menu and
 * its tabs (old addresses still open, now as tabs), the orders list (to-do strip, tabs with counts, URL-synced
 * search, export), the order page (journey, payment, documents) and the overview. Written in C6; run locally
 * (owner rule 2026-10-28: e2e is written, not run, in the cloud).
 */
const CLAIM_ORDER = "00000000-0000-4000-8000-6f7264000025";
const UNPAID_ORDER = "00000000-0000-4000-8000-6f7264000001";

test.describe("account redesign (C6)", () => {
  test("the menu has nine sections; grouped pages are tabs and keep their addresses", async ({ page }) => {
    await signInAsCustomer(page, "/account/rfqs");
    const nav = page.getByRole("navigation", { name: "บัญชีของฉัน" });
    for (const name of [
      "ภาพรวม",
      "ใบเสนอราคา",
      "งานออกแบบ",
      "สั่งซ้ำ",
      "เอกสาร",
      "ข้อความ",
      "คะแนนและสิทธิพิเศษ",
      "ข้อมูลบัญชี",
    ]) {
      await expect(nav.getByRole("link", { name, exact: true }).first()).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "ใบเสนอราคา", exact: true }).first()).toHaveAttribute(
      "aria-current",
      "page",
    );
    const tabs = page.getByRole("navigation", { name: "หน้าในหมวดนี้" });
    await expect(tabs.getByRole("link", { name: "คำขอใบเสนอราคา" })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "ใบเสนอราคา", exact: true }).click();
    await expect(page).toHaveURL(/\/account\/quotes$/);

    await gotoHydrated(page, `${HOSTS.customer}/account/call-offs`);
    await expect(
      page.getByRole("navigation", { name: "หน้าในหมวดนี้" }).getByRole("link", { name: "สัญญาเรียกของ" }),
    ).toHaveAttribute("aria-current", "page");
    // งวดชำระ left the menu; its page still opens under คำสั่งซื้อ.
    await gotoHydrated(page, `${HOSTS.customer}/account/instalments`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("orders: to-do strip, tab counts, search in the address, export", async ({ page }) => {
    await signInAsCustomer(page, "/account/orders");
    await expect(page.getByRole("heading", { level: 1, name: "คำสั่งซื้อ" })).toBeVisible();
    const todo = page.getByRole("region", { name: "ต้องทำตอนนี้" });
    await expect(todo.getByText(/^ชำระ ฿/)).toBeVisible();
    await expect(todo.getByText(/เคลมกำลังตรวจ/)).toBeVisible();

    const tabs = page.getByRole("navigation", { name: "สถานะคำสั่งซื้อ" });
    await expect(tabs.getByRole("link", { name: /ต้องทำ\s*2/ })).toBeVisible();
    await tabs.getByRole("link", { name: /ต้องทำ/ }).click();
    await expect(page).toHaveURL(/tab=todo/);
    await expect(page.getByText("PK-2569-00124")).toHaveCount(0);

    await page.getByRole("searchbox", { name: "ค้นหาคำสั่งซื้อ" }).fill("00112");
    await expect(page).toHaveURL(/q=00112/);
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);

    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "ส่งออก" }).click();
    expect((await download).suggestedFilename()).toBe("getpack-orders-todo.csv");
  });

  test("an order card opens the order; the order page shows its journey, payment and documents", async ({ page }) => {
    await signInAsCustomer(page, "/account/orders");
    await page.getByRole("link", { name: "กล่องกระดาษแข็ง" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/account/orders/${UNPAID_ORDER}`));
    const progress = page.getByRole("region", { name: "ความคืบหน้า" });
    await expect(progress.getByText("รอชำระเงิน ชำระแล้วจึงเริ่มผลิต")).toBeVisible();
    await expect(page.getByRole("region", { name: "การชำระเงิน" }).getByText("ยอดรวม")).toBeVisible();

    await gotoHydrated(page, `${HOSTS.customer}/account/orders/${CLAIM_ORDER}`);
    await expect(page.getByRole("region", { name: /เคลม CL-/ })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "เอกสาร" }).getByRole("button", { name: /^ดาวน์โหลด TR-/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "สั่งซ้ำ" }).getByRole("link", { name: /สั่งซ้ำ 500 ชิ้น/ }),
    ).toBeVisible();
  });

  test("no horizontal scroll at 390 px on the account pages", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsCustomer(page, "/account");
    for (const path of ["/account", "/account/orders", `/account/orders/${CLAIM_ORDER}`, "/account/documents"]) {
      await gotoHydrated(page, `${HOSTS.customer}${path}`);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, path).toBeLessThanOrEqual(390);
    }
  });
});
