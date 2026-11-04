import { expect, test, type Browser, type Page } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInToAgentZone } from "./helpers/agent";
import { acceptCookies, signInAsCustomer } from "./helpers/customer";
import { auditWidth } from "./helpers/responsive";
import { gotoHydrated, signInAsStaff, type Persona } from "./helpers/session";

/**
 * Agent portal P7 — the responsive QA gate. Every route the agent portal pack added (the public landing and apply page,
 * every getpack Agent page, the admin sales desk, the discount approval desk, the agents' waiting list and the P&L
 * planner) at every width of the <responsive> contract, with four checks a person would otherwise make by eye:
 *
 * 1. the page never scrolls sideways;
 * 2. no visible element reaches past the viewport's sides unless it sits inside a container that scrolls or clips it
 *    (a table in its own scroll frame is fine; a button half off-screen is not);
 * 3. a fixed bar along the bottom (the tab bar, a sticky action bar) pads itself by the safe-area inset, and with the
 *    page scrolled to its end the last piece of content sits above the bar, so nothing is unreachable behind it;
 * 4. no h1 / h2 is clipped or overflows its own box (scrollWidth > clientWidth).
 *
 * Admin desks are desktop tools: at phone widths they only have to hold together (checks 1–4), not be redesigned.
 * Runs against the MSW mock server (`API_MOCKS=1`); detail pages are found through their lists, so no id is pinned.
 */
const WIDTHS = [360, 375, 393, 768, 1024, 1280, 1440, 1920] as const;
const shots = process.env["E2E_SHOTS"];
/** The routes the contact sheet shows at 360 and 1920 (docs/design/agent-portal/screenshots/P7). */
const SHEET: Record<string, string> = {};

/** Opens a route and runs the audit at every width; returns the findings, labelled. */
async function audit(page: Page, url: string, label: string): Promise<string[]> {
  await gotoHydrated(page, url);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const findings: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 640 ? 800 : 900 });
    await page.waitForTimeout(250);
    for (const finding of await auditWidth(page)) findings.push(`${label} @${width}: ${finding}`);
    if (shots && SHEET[label] !== undefined && (width === 360 || width === 1920)) {
      await page.screenshot({ path: `${shots}/p7-sheet-${SHEET[label]}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  return findings;
}

/** The first link on the current page whose path matches, e.g. a lead's detail page from the pipeline. */
async function firstHref(page: Page, pattern: RegExp): Promise<string | null> {
  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  return hrefs.map((href) => href.replace(/^https?:\/\/[^/]+/, "")).find((href) => pattern.test(href)) ?? null;
}

async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  return context.newPage();
}

function sheet(label: string, name: string) {
  SHEET[label] = name;
  return label;
}

test.setTimeout(240_000);

test.describe("agent portal P7 — responsive QA at 360–1920", () => {
  test("signed out: the landing (th, en), getpack Agent sign-in, hand-off and offline", async ({ browser }) => {
    const page = await freshPage(browser);
    await acceptCookies(page);
    const findings = [
      ...(await audit(page, `${HOSTS.customer}/agent`, sheet("landing", "landing"))),
      ...(await audit(page, `${HOSTS.customer}/en/agent`, "landing en")),
      ...(await audit(page, `${HOSTS.agent}/sign-in`, sheet("agent sign-in", "agent-sign-in"))),
      ...(await audit(page, `${HOSTS.agent}/handoff`, "agent handoff")),
      ...(await audit(page, `${HOSTS.agent}/offline`, "agent offline")),
    ];
    expect(findings, findings.join("\n")).toEqual([]);
    await page.context().close();
  });

  test("signed-in customer: the apply page", async ({ browser }) => {
    const page = await freshPage(browser);
    await signInAsCustomer(page, "/agent/apply");
    const findings = [
      ...(await audit(page, `${HOSTS.customer}/agent/apply`, sheet("apply", "apply"))),
      ...(await audit(page, `${HOSTS.customer}/agent`, "landing signed in")),
    ];
    expect(findings, findings.join("\n")).toEqual([]);
    await page.context().close();
  });

  test("getpack Agent: every page of the zone", async ({ browser }) => {
    const page = await freshPage(browser);
    await signInToAgentZone(page, "/");
    const a = HOSTS.agent;
    const findings: string[] = [];
    for (const [path, label] of [
      ["/", sheet("agent home", "agent-home")],
      ["/leads", sheet("agent leads", "agent-leads")],
      ["/leads?layout=board", "agent leads board"],
      ["/leads/import", "agent lead import"],
      ["/quotes", "agent quotes"],
      ["/quotes/new", "agent new quote"],
      ["/commissions", "agent commissions"],
      ["/commissions?view=forecast", "agent forecast"],
      ["/statements", "agent statements"],
      ["/customers", "agent customers"],
      ["/payout", "agent payout"],
      ["/tax", "agent tax"],
      ["/playbook", "agent playbook"],
      ["/notifications", "agent notifications"],
      ["/profile", "agent profile"],
    ] as const) {
      findings.push(...(await audit(page, `${a}${path}`, label)));
    }
    await gotoHydrated(page, `${a}/leads`);
    const lead = await firstHref(page, /^\/leads\/(?!import)[^/?#]+$/);
    expect(lead, "a lead to open").not.toBeNull();
    findings.push(...(await audit(page, `${a}${lead}`, sheet("agent lead", "agent-lead"))));
    await gotoHydrated(page, `${a}/quotes`);
    const quote = await firstHref(page, /^\/quotes\/(?!new)[^/?#]+$/);
    expect(quote, "a quote to open").not.toBeNull();
    findings.push(...(await audit(page, `${a}${quote}`, "agent quote")));
    findings.push(...(await audit(page, `${a}${quote}/discount`, "agent discount request")));
    await gotoHydrated(page, `${a}/statements`);
    const statement = await firstHref(page, /^\/statements\/[^/?#]+$/);
    if (statement) findings.push(...(await audit(page, `${a}${statement}`, "agent statement")));
    expect(findings, findings.join("\n")).toEqual([]);
    await page.context().close();
  });

  async function staffRoutes(browser: Browser, persona: Persona, routes: readonly (readonly [string, string])[]) {
    const page = await freshPage(browser);
    await signInAsStaff(page, persona);
    const findings: string[] = [];
    for (const [path, label] of routes) findings.push(...(await audit(page, `${HOSTS.admin}${path}`, label)));
    return { page, findings };
  }

  test("admin sales desk and approval desk (Sales Manager)", async ({ browser }) => {
    const { page, findings } = await staffRoutes(browser, "sales_manager", [
      ["/sales", sheet("sales inbox", "sales-inbox")],
      ["/sales/pipeline", "sales pipeline"],
      ["/sales/pipeline?layout=board", "sales pipeline board"],
      ["/sales/quotes", "sales quotes"],
      ["/sales/dashboard", sheet("sales dashboard", "sales-dashboard")],
      ["/sales/approvals", "approvals"],
      ["/sales/playbook", "playbook admin"],
      ["/sales/reports/lost-to-price", "report lost to price"],
      ["/sales/reports/negotiations", "report negotiations"],
      ["/sales/reports/post-deal", "report post-deal"],
      ["/agents/waitlist", "agents waitlist"],
    ]);
    await gotoHydrated(page, `${HOSTS.admin}/sales/pipeline`);
    const lead = await firstHref(page, /^\/sales\/leads\/[^/?#]+$/);
    expect(lead, "a pipeline lead to open").not.toBeNull();
    findings.push(...(await audit(page, `${HOSTS.admin}${lead}`, "sales lead")));
    await gotoHydrated(page, `${HOSTS.admin}/sales/approvals`);
    const approval = await firstHref(page, /^\/sales\/approvals\/(?!views)[^/?#]+$/);
    expect(approval, "an approval to open").not.toBeNull();
    findings.push(...(await audit(page, `${HOSTS.admin}${approval}`, sheet("approval", "approval"))));
    await gotoHydrated(page, `${HOSTS.admin}/sales/playbook`);
    const card = await firstHref(page, /^\/sales\/playbook\/[^/?#]+$/);
    if (card) findings.push(...(await audit(page, `${HOSTS.admin}${card}`, "playbook card")));
    expect(findings, findings.join("\n")).toEqual([]);
    await page.context().close();
  });

  test("approval views (Auditor) and the P&L planner (Finance Manager)", async ({ browser }) => {
    const auditor = await staffRoutes(browser, "auditor", [["/sales/approvals/views", "approval views"]]);
    await auditor.page.context().close();
    const finance = await staffRoutes(browser, "finance_manager", [["/finance/pnl", sheet("pnl", "pnl")]]);
    await finance.page.context().close();
    const findings = [...auditor.findings, ...finance.findings];
    expect(findings, findings.join("\n")).toEqual([]);
  });
});
