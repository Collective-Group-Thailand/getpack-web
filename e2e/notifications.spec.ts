import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInAsStaff } from "./helpers/session";

/**
 * Notification centre, service worker and PWA manifest (F1 1.3 §6, D-143).
 *
 * The feed is a contract request, so these run against the MSW mock — what is being asserted
 * is this app's half: the count reaches the accessible name, the worker is served from a scope
 * that can actually receive a push, and the manifest differs per zone.
 */

test.describe("notification centre", () => {
  test("puts the unread count in the accessible name, not only in a dot", async ({ page }) => {
    await signInAsStaff(page);

    // A red dot says "something" to a sighted user and nothing at all to a screen reader.
    const bell = page.getByRole("button", { name: /การแจ้งเตือน \(1 รายการที่ยังไม่ได้อ่าน\)/ });
    await expect(bell).toBeVisible();
  });

  test("lists what the API returned and marks it read", async ({ page }) => {
    await signInAsStaff(page);

    await expect(async () => {
      await page.getByRole("button", { name: /การแจ้งเตือน/ }).click();
      await expect(page.getByText("รับชำระเงินแล้ว (ข้อมูลจำลอง)")).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    await expect(page.getByRole("button", { name: "อ่านทั้งหมดแล้ว" })).toBeVisible();
  });
});

test.describe("service worker and manifest", () => {
  test("the worker is served from the root, so its scope is the whole origin", async ({ request }) => {
    for (const host of [HOSTS.customer, HOSTS.partner]) {
      const response = await request.get(`${host}/sw.js`);
      expect(response.status(), host).toBe(200);
      // Rewritten onto a zone segment it would still 200, but the browser would refuse to
      // register it for "/" — so assert the content, not just the status.
      expect(await response.text()).toContain("notificationclick");
    }
  });

  test("the worker caches nothing — it has no fetch handler at all", async ({ request }) => {
    // Caching a storefront that shows live prices, or a shop-floor app whose job states must
    // be current, is how people act on stale information. Offline sync is R2 (D-111).
    const body = await (await request.get(`${HOSTS.customer}/sw.js`)).text();
    expect(body).not.toContain('addEventListener("fetch"');
    expect(body).not.toContain("caches.open");
  });

  test("the partner zone is installable and the storefront is not", async ({ request }) => {
    const partner = await (await request.get(`${HOSTS.partner}/manifest.webmanifest`)).json();
    expect(partner.display).toBe("standalone");
    expect(partner.orientation).toBe("portrait");
    expect(partner.name).toContain("Partner");

    const customer = await (await request.get(`${HOSTS.customer}/manifest.webmanifest`)).json();
    // Installing a shortcut to the shop is not the point; the storefront is a website.
    expect(customer.display).toBe("browser");
    expect(customer.name).toBe("Packio");
  });

  test("nothing asks for notification permission on page load", async ({ page }) => {
    // The whole reason `usePushSubscription` exposes `enable` and no effect: a prompt on load
    // is refused by most people, and a refusal is permanent.
    let asked = false;
    await page.addInitScript(() => {
      const original = Notification.requestPermission.bind(Notification);
      Notification.requestPermission = () => {
        (window as unknown as { __asked?: boolean }).__asked = true;
        return original();
      };
    });

    await page.goto(HOSTS.customer);
    await page.waitForLoadState("networkidle").catch(() => {});
    asked = await page.evaluate(() => Boolean((window as unknown as { __asked?: boolean }).__asked));

    expect(asked).toBe(false);
  });
});
