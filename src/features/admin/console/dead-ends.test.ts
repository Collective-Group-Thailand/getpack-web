import { globSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Zero dead ends in the admin console, group by group (CAPTURE-PLAN-ADMIN §3): every empty state offers the next
 * action. An empty state may leave out `action` only where the next step is right beside it on the same screen —
 * listed here with why. G1 (sales and service) and the console frame are covered; later groups join as they are
 * redesigned.
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

function emptyStatesWithoutAction(file: string): number {
  const source = readFileSync(file, "utf8");
  let missing = 0;
  for (const match of source.matchAll(/<EmptyState([\s\S]*?)\/>/g)) {
    if (!/\baction=/.test(match[1]!)) missing += 1;
  }
  return missing;
}

describe("zero dead ends in the admin console (frame + G1)", () => {
  const files = [...new Set(G1.flatMap((pattern) => globSync(pattern)))].filter(
    (file) => !/\.(test|stories)\.tsx$/.test(file),
  );

  it("finds the group's files", () => {
    expect(files.length).toBeGreaterThan(60);
  });

  it("gives every empty state a next action", () => {
    const offenders = files.filter((file) => !(file in ACTION_BESIDE_IT) && emptyStatesWithoutAction(file) > 0);
    expect(offenders).toEqual([]);
  });

  it("keeps the allow-list honest", () => {
    for (const file of Object.keys(ACTION_BESIDE_IT)) expect(emptyStatesWithoutAction(file), file).toBeGreaterThan(0);
  });
});
