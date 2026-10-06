import { expect, test } from "@playwright/test";

import { entitled, MENU_CATALOGUE, PERSONAS } from "../mocks/personas";
import { HOSTS } from "../playwright.config";
import { gotoHydrated, signInAsStaff, type Persona } from "./helpers/session";

/**
 * F2 2.8 — every back-office role, end to end: the sidebar holds exactly the entries the role is
 * entitled to (the mock builds `/v1/admin/me` from the same catalogue packio-api's menu follows),
 * and every one of them opens — a heading, no "no permission" page, no failed load. A screen
 * that asks the API for something the role may not read shows up here as a red row.
 */

const FORBIDDEN = "คุณไม่มีสิทธิ์เปิดหน้านี้";
const FAILED = "โหลดข้อมูลไม่สำเร็จ";

for (const persona of PERSONAS) {
  test(`${persona.key}: the menu it is entitled to, and every entry opens`, async ({ page }) => {
    test.setTimeout(120_000);
    await signInAsStaff(page, persona.key as Persona);
    await gotoHydrated(page, `${HOSTS.admin}/`);

    const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
    const entries = MENU_CATALOGUE.filter((entry) => entitled(persona, entry));
    // The sidebar also offers screens packio-api's menu does not list yet, by permission
    // (`localItems`, CONTRACT-REQUEST admin.menu-samples); every one of them must open too.
    const LOCAL = ["/samples", "/structural-requests", "/style-intakes"];
    await expect(nav.getByRole("link").first()).toBeVisible();
    const hrefs = await nav.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
    expect(hrefs.filter((href) => !LOCAL.includes(href) || entries.some((entry) => entry.path === href))).toHaveLength(
      entries.length,
    );
    for (const href of hrefs) {
      await gotoHydrated(page, `${HOSTS.admin}${href}`);
      await expect(page.getByRole("heading", { level: 1 }), href).toBeVisible();
      await expect(page.getByText(FORBIDDEN), href).toHaveCount(0);
      await expect(page.getByText(FAILED), href).toHaveCount(0);
    }
  });
}
