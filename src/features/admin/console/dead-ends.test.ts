import { globSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Zero dead ends in the admin console, group by group (CAPTURE-PLAN-ADMIN §3): every empty state offers the next
 * action. An empty state may leave out `action` only where the next step is right beside it on the same screen —
 * listed here with why. G1 (sales and service), G2 (production and logistics), G3 (catalogue and content) and the
 * console frame are covered; later groups join as they are redesigned.
 */
const ACTION_BESIDE_IT: Record<string, string> = {
  "src/features/admin/orders/OrderTabs.tsx":
    "an order's tabs: the step is the tab section's own action (record a slip, open a claim) or the next-steps panel",
  "src/features/admin/orders/PartyOrders.tsx":
    "a customer's or company's orders tab; the record's actions are beside it",
  "src/features/admin/rfq/RfqTabs.tsx":
    "an RFQ's tabs: consult factories and compose a quote are the tab's own buttons",
  "src/features/admin/customers/CustomerDetail.tsx":
    "a customer's tabs: adjust points and the referral queue are the section's own actions",
  "src/features/admin/companies/CompanyWorkspace.tsx":
    "a company's tabs: review KYC, set the credit limit and issue documents are the section's own actions",
  "src/features/admin/cs/CalculatorWorkspace.tsx": "the result's place beside the calculator form, which is the step",
  // G2
  "src/features/admin/shipping/RatesTable.tsx":
    "a rate version's lines, drawn inside the version editor whose own controls add and import lines",
  "src/features/admin/prepress/PrepressTabs.tsx":
    "an order's prepress tabs: upload on the customer's behalf and the workspace's next-steps panel are the step",
  "src/features/admin/partners/tabs/Processes.tsx":
    "a factory's processes: adding a capability is the section's own action above the table",
  // G3
  "src/features/admin/agents/AgentDetail.tsx":
    "an agent's record: each table's own 'view all' link and the record panel's steps are beside it",
  "src/features/admin/pricing/PaymentSchedules.tsx":
    "payment schedule templates come from the platform (the API has no create); each template's own button adds a version",
};

const G1 = [
  "src/app/admin/[(]console[)]/page.tsx",
  ...[
    "approvals",
    "inbox",
    "orders",
    "quotations",
    "rfq",
    "customers",
    "companies",
    "cs",
    "claims",
    "samples",
    "reviews",
    "notifications",
    "assistant",
    "advisor",
  ].map((area) => `src/app/admin/[(]console[)]/${area}/**/*.tsx`),
  ...[
    "console",
    "dashboard",
    "approvals",
    "inbox",
    "orders",
    "rfq",
    "customers",
    "companies",
    "cs",
    "samples",
    "assistant",
    "advisor",
  ].map((area) => `src/features/admin/${area}/**/*.tsx`),
  "src/features/admin/logistics/Claim*.tsx",
];

/** G3 — catalogue and content (CAPTURE-PLAN-ADMIN §1). */
const G3 = [
  ...[
    "catalogue",
    "style-library",
    "studio-catalog",
    "pricing",
    "discount-memos",
    "cms",
    "marketing",
    "line",
    "document-branding",
    "agents",
  ].map((area) => `src/app/admin/[(]console[)]/${area}/**/*.tsx`),
  ...["catalogue", "style-library", "pricing", "cms", "marketing", "agents", "document-branding"].map(
    (area) => `src/features/admin/${area}/**/*.tsx`,
  ),
  "src/features/admin/content/Studio*.tsx",
  "src/features/admin/content/LineMenusDesk.tsx",
];

/** G2 — production and logistics (CAPTURE-PLAN-ADMIN §1). */
const G2 = [
  ...[
    "production",
    "prepress",
    "shipping",
    "shipments",
    "partners",
    "style-intakes",
    "structural-requests",
    "ops",
    "outbox",
  ].map((area) => `src/app/admin/[(]console[)]/${area}/**/*.tsx`),
  ...["production", "prepress", "shipping", "partners", "structural"].map(
    (area) => `src/features/admin/${area}/**/*.tsx`,
  ),
  "src/features/admin/logistics/Ship*.tsx",
  "src/features/admin/logistics/HandoverPanel.tsx",
  "src/features/admin/platform/Outbox.tsx",
  "src/features/admin/platform/OpsSignals.tsx",
];

function emptyStatesWithoutAction(file: string): number {
  const source = readFileSync(file, "utf8");
  let missing = 0;
  for (const match of source.matchAll(/<EmptyState([\s\S]*?)\/>/g)) {
    if (!/\baction=/.test(match[1]!)) missing += 1;
  }
  return missing;
}

const filesOf = (patterns: readonly string[]) =>
  [...new Set(patterns.flatMap((pattern) => globSync(pattern)))].filter((file) => !/\.(test|stories)\.tsx$/.test(file));

describe("zero dead ends in the admin console (frame + G1 + G2 + G3)", () => {
  const files = filesOf([...G1, ...G2, ...G3]);

  it("finds the groups' files", () => {
    expect(filesOf(G1).length).toBeGreaterThan(60);
    expect(filesOf(G2).length).toBeGreaterThan(70);
    expect(filesOf(G3).length).toBeGreaterThan(90);
  });

  it("gives every empty state a next action", () => {
    const offenders = files.filter((file) => !(file in ACTION_BESIDE_IT) && emptyStatesWithoutAction(file) > 0);
    expect(offenders).toEqual([]);
  });

  it("keeps the allow-list honest", () => {
    for (const file of Object.keys(ACTION_BESIDE_IT)) expect(emptyStatesWithoutAction(file), file).toBeGreaterThan(0);
  });
});
