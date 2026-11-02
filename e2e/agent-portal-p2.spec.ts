import { expect, test, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { AGENT_PHONE, ENDED_AGENT_PHONE, signInToAgentZone } from "./helpers/agent";
import { signInAsCustomer } from "./helpers/customer";
import { gotoHydrated, MOCK_OTP } from "./helpers/session";

/**
 * Agent portal P2 (D-467): getpack Agent on its own host — the hand-off from the storefront, sign-in there, every
 * page, the 308s from the old storefront URLs, the BFF's allow-list, host-only cookies, notification choices, the
 * share fallbacks and the three navigation shapes.
 */
const shots = process.env["E2E_SHOTS"];
const WIDTHS = [360, 375, 393, 768, 1024, 1280, 1440, 1920] as const;
const STATEMENT_ID = "0192f3a0-7c1e-7d2a-9b1f-0000000a6009";

const PAGES = [
  { path: "/", name: "overview", heading: /^สวัสดี/ },
  { path: "/leads", name: "leads", heading: "ลูกค้ามุ่งหวัง" },
  { path: "/quotes", name: "quotes", heading: "ใบเสนอราคา" },
  { path: "/commissions", name: "commissions", heading: "ค่าคอมมิชชัน" },
  { path: "/statements", name: "statements", heading: "รายงานค่าคอมและ 50 ทวิ" },
  { path: `/statements/${STATEMENT_ID}`, name: "statement", heading: /^สรุปค่าตอบแทน/ },
  { path: "/customers", name: "customers", heading: "ลูกค้าของฉัน" },
  { path: "/payout", name: "payout", heading: "ข้อมูลรับเงิน" },
  { path: "/tax", name: "tax", heading: "ข้อมูลลดหย่อนภาษี (ล.ย.01)" },
  { path: "/notifications", name: "notifications", heading: "การแจ้งเตือน" },
  { path: "/profile", name: "profile", heading: "โปรไฟล์และสัญญา" },
] as const;

async function noHorizontalScroll(page: Page, label: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${label}: horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function shoot(
  page: Page,
  name: string,
  sizes: readonly ("phone" | "tablet" | "desktop")[] = ["phone", "desktop"],
) {
  if (!shots) return;
  const widths = { phone: 390, tablet: 768, desktop: 1440 } as const;
  for (const size of sizes) {
    await page.setViewportSize({
      width: widths[size],
      height: size === "phone" ? 844 : size === "tablet" ? 1024 : 900,
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${shots}/${name}-${size}-${widths[size]}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test.describe("agent portal P2 — getpack Agent zone (D-467)", () => {
  test("the storefront opens getpack Agent signed in, through a one-time hand-off", async ({ page, context }) => {
    await signInAsCustomer(page, "/account", AGENT_PHONE);
    await page.getByRole("button", { name: "เปิด getpack Agent" }).click();
    await expect(page).toHaveURL(`${HOSTS.agent}/`, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: /^สวัสดี/ })).toBeVisible();
    await expect(page.getByTestId("agent-code")).toHaveText("MOCKAG01");

    // Host-only: the agent host's own httpOnly session cookies, set without a Domain attribute.
    const all = await context.cookies();
    const agentSession = all.filter((cookie) => cookie.domain === "agent.localhost" && /pk_(at|rt)$/.test(cookie.name));
    expect(agentSession.length).toBeGreaterThanOrEqual(2);
    for (const cookie of agentSession) expect(cookie.httpOnly, cookie.name).toBe(true);
    expect(all.filter((cookie) => cookie.domain.startsWith(".")).map((cookie) => cookie.name)).toEqual([]);

    // The agent host never rides the storefront's cookies: drop its own and it asks to sign in…
    await context.clearCookies({ domain: "agent.localhost" });
    await gotoHydrated(page, `${HOSTS.agent}/leads`);
    await expect(page).toHaveURL(`${HOSTS.agent}/sign-in?returnTo=%2Fleads`);
    // …while the storefront is still signed in.
    await gotoHydrated(page, `${HOSTS.customer}/account`);
    await expect(page).toHaveURL(`${HOSTS.customer}/account`);
  });

  test("a spent hand-off code shows the neutral refusal and the way to sign in", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.agent}/handoff#code=hc_mock_not_a_real_code&to=%2F`);
    await expect(page.getByRole("heading", { level: 1, name: "เปิดต่อจากลิงก์นี้ไม่ได้" })).toBeVisible();
    // The code is wiped from the address bar at once.
    expect(page.url()).toBe(`${HOSTS.agent}/handoff`);
    await expect(page.getByRole("link", { name: "เข้าสู่ระบบ" })).toHaveAttribute("href", "/sign-in");
  });

  test("signing in on getpack Agent itself: phone, OTP, back to the page asked for", async ({ page }) => {
    await gotoHydrated(page, `${HOSTS.agent}/leads`);
    await expect(page).toHaveURL(`${HOSTS.agent}/sign-in?returnTo=%2Fleads`);
    await expect(page.getByRole("heading", { level: 1, name: "เข้าสู่ระบบ getpack Agent" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Apple/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /LINE/ })).toBeVisible();
    await noHorizontalScroll(page, "sign-in");
    await shoot(page, "sign-in");
    await page.getByLabel("เบอร์มือถือ").fill(AGENT_PHONE);
    await page.getByRole("button", { name: "ขอรหัส OTP" }).click();
    await page.getByLabel("รหัส OTP").fill(MOCK_OTP.code);
    await expect(page).toHaveURL(`${HOSTS.agent}/leads`, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "ลูกค้ามุ่งหวัง" })).toBeVisible();
  });

  test("every page renders, scrolls only vertically at every width, and is photographed", async ({ page }) => {
    test.setTimeout(240_000);
    await signInToAgentZone(page, "/");
    for (const target of PAGES) {
      await gotoHydrated(page, `${HOSTS.agent}${target.path}`);
      await expect(page.getByRole("heading", { level: 1, name: target.heading }), target.path).toBeVisible();
      await expect(page.locator("main")).not.toContainText(/โรงงาน|factory|กำไร|margin|profit|coming soon|กำลังพัฒนา/i);
      await noHorizontalScroll(page, target.path);
      if (target.name !== "statement" && target.name !== "customers" && target.name !== "quotes") {
        await shoot(page, target.name);
      }
    }
    await gotoHydrated(page, `${HOSTS.agent}/`);
    await shoot(page, "overview", ["tablet"]);
    await gotoHydrated(page, `${HOSTS.agent}/quotes`);
    await shoot(page, "quotes", ["phone"]);
  });

  test("the navigation is a tab bar on a phone, a rail on a tablet and a sidebar on a desktop", async ({ page }) => {
    await signInToAgentZone(page, "/");
    const visibleNavs = () => page.locator('nav[aria-label="เมนู getpack Agent"]:visible');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(visibleNavs()).toHaveCount(1);
    const tabs = visibleNavs().getByRole("link");
    await expect(tabs).toHaveText(["ภาพรวม", "ลูกค้ามุ่งหวัง", "ใบเสนอราคา", "ค่าคอม"]);
    const box = await visibleNavs().boundingBox();
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(843);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(visibleNavs()).toHaveCount(1);
    const rail = await visibleNavs().boundingBox();
    expect(rail!.width).toBeLessThan(100);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(visibleNavs()).toHaveCount(1);
    const sidebar = await visibleNavs().boundingBox();
    expect(sidebar!.width).toBeGreaterThan(200);
    await expect(visibleNavs().getByRole("link", { name: "ลดหย่อนภาษี" })).toBeVisible();

    // The profile menu carries the account pages and sign-out on every size.
    await page.getByRole("button", { name: "เมนูโปรไฟล์" }).click();
    const menu = page.getByRole("menu");
    for (const item of ["โปรไฟล์และสัญญา", "ข้อมูลรับเงิน", "ลดหย่อนภาษี", "การแจ้งเตือน", "ออกจากระบบ"]) {
      await expect(menu.getByRole("menuitem", { name: item })).toBeVisible();
    }
  });

  test("old /account/agent/** URLs answer an agent with a 308 to the same page in getpack Agent", async ({ page }) => {
    await signInAsCustomer(page, "/account", AGENT_PHONE);
    const map: [string, string][] = [
      ["/account/agent", "/"],
      ["/account/agent/leads?page=2", "/leads?page=2"],
      ["/account/agent/customers", "/customers"],
      ["/account/agent/commissions", "/commissions"],
      ["/account/agent/statements", "/statements"],
      [`/account/agent/statements/${STATEMENT_ID}`, `/statements/${STATEMENT_ID}`],
      ["/account/agent/tax", "/tax"],
      ["/account/agent/payout?from=email", "/payout?from=email"],
    ];
    for (const [from, to] of map) {
      const response = await page.request.get(`${HOSTS.customer}${from}`, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      expect(response.headers()["location"], from).toBe(`${HOSTS.agent}${to}`);
    }
  });

  test("a customer who is not an agent keeps the programme landing, and its sub-pages lead there", async ({ page }) => {
    await signInAsCustomer(page, "/account");
    await gotoHydrated(page, `${HOSTS.customer}/account/agent/leads`);
    await expect(page).toHaveURL(`${HOSTS.customer}/account/agent`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "เปิด getpack Agent" })).toHaveCount(0);
  });

  test("getpack Agent's BFF refuses every store path outside its allow-list", async ({ page }) => {
    await signInToAgentZone(page, "/");
    // From the page itself, so the browser's own cookies and origin are what the BFF sees.
    const call = (path: string) =>
      page.evaluate(async (url) => {
        const response = await fetch(url);
        const body = (await response.json().catch(() => ({}))) as { code?: string };
        return { status: response.status, code: body.code ?? null };
      }, `/bff${path}`);
    expect((await call("/v1/store/agent")).status).toBe(200);
    expect((await call("/v1/store/me/sessions")).status).toBe(200);
    for (const path of ["/v1/store/orders", "/v1/store/cart", "/v1/store/notifications", "/v1/admin/me"]) {
      expect(await call(path), path).toEqual({ status: 404, code: "bff.unknown_path" });
    }
  });

  test("notification choices switch at once; the money e-mails stay on", async ({ page }) => {
    await signInToAgentZone(page, "/notifications");
    const lineForConverted = page.getByRole("group", { name: /ลูกค้ามุ่งหวังเปิดบัญชีแล้ว/ }).getByRole("switch", {
      name: "LINE OA",
    });
    await expect(lineForConverted).toBeChecked();
    await lineForConverted.click();
    await expect(page.getByText("ปิดการแจ้งเตือนแล้ว").first()).toBeVisible();
    await expect(lineForConverted).not.toBeChecked();
    const lockedEmail = page.getByRole("group", { name: /โอนเงินแล้ว/ }).getByRole("switch", { name: "อีเมล" });
    await expect(lockedEmail).toBeChecked();
    await expect(lockedEmail).toBeDisabled();
    // `reachable` says LINE cannot reach this person, and the page says why.
    await expect(page.getByText(/ยังไม่ได้เชื่อม LINE กับบัญชีนี้/)).toBeVisible();
    await lineForConverted.click();
    await expect(lineForConverted).toBeChecked();
  });

  test("sharing falls back to copy, LINE and a full-screen QR", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: HOSTS.agent });
    await signInToAgentZone(page, "/");
    // Headless Chromium has no Web Share, so our own sheet opens.
    await page.getByRole("button", { name: "แชร์ลิงก์" }).first().click();
    const sheet = page.getByRole("dialog", { name: "แชร์ลิงก์ของคุณ" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link", { name: "ส่งทาง LINE" })).toHaveAttribute(
      "href",
      /^https:\/\/line\.me\/R\/share\?text=.+MOCKAG01$/,
    );
    await sheet.getByRole("button", { name: /คัดลอกลิงก์/ }).click();
    await expect(page.getByText("คัดลอกลิงก์แล้ว").first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("/a/MOCKAG01");

    await page.getByRole("button", { name: "แสดง QR" }).first().click();
    const qr = page.getByRole("dialog", { name: "QR ของคุณ" });
    await expect(qr.getByRole("img", { name: "QR ลิงก์ตัวแทนของคุณ" })).toBeVisible();
    const size = await qr.boundingBox();
    expect(size!.width).toBeGreaterThanOrEqual(1270);
  });

  test("sign-ins per surface, and signing getpack Agent out on other devices", async ({ page }) => {
    await signInToAgentZone(page, "/profile");
    await expect(page.getByText("เครื่องนี้")).toBeVisible();
    await expect(page.getByText("getpack.co", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "ออกจากระบบเครื่องอื่น" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ออกจากระบบเครื่องอื่น" }).click();
    await expect(page.getByText("ออกจากระบบแล้ว 1 เครื่อง")).toBeVisible();
  });

  test("an ended agent keeps the statements and 50 ทวิ only", async ({ page }) => {
    await signInToAgentZone(page, "/statements", ENDED_AGENT_PHONE);
    await expect(page.getByText("สัญญาตัวแทนสิ้นสุดแล้ว")).toBeVisible();
    await gotoHydrated(page, `${HOSTS.agent}/leads`);
    await expect(page).toHaveURL(`${HOSTS.agent}/statements`);
    await expect(page.locator('nav[aria-label="เมนู getpack Agent"]:visible').getByRole("link")).toHaveText([
      "รายงานค่าคอม",
    ]);
  });

  test("a signed-in customer who is not an agent is pointed to the programme", async ({ page }) => {
    await signInToAgentZone(page, "/", "0812345678");
    await expect(page.getByRole("heading", { level: 1, name: "getpack Agent สำหรับตัวแทนขาย" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ดูโปรแกรมตัวแทนขาย" })).toHaveAttribute(
      "href",
      `${HOSTS.customer}/agent`,
    );
  });

  test("installable: its own manifest and worker, nothing for crawlers", async ({ page }) => {
    const signIn = await page.goto(`${HOSTS.agent}/sign-in`);
    expect(signIn!.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    const status = (path: string) => page.evaluate(async (url) => (await fetch(url)).status, path);
    const body = await page.evaluate(async () => (await fetch("/manifest.webmanifest")).json());
    expect(body).toMatchObject({ name: "getpack Agent", short_name: "getpack Agent", display: "standalone" });
    for (const icon of body.icons as { src: string }[]) expect(await status(icon.src), icon.src).toBe(200);
    expect(await status("/agent-sw.js")).toBe(200);
    expect(await status("/robots.txt")).toBe(404);

    await signInToAgentZone(page, "/");
    await expect
      .poll(
        () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL ?? null),
        {
          timeout: 15_000,
        },
      )
      .toBe(`${HOSTS.agent}/agent-sw.js`);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
  });
});
