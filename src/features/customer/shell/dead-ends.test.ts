import { globSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Zero dead ends (U5.1 §3): every empty state in the customer zone offers the next action, and the
 * zone's not-found and error boundaries offer more than one. An empty state may leave out `action`
 * only where the next step is right beside it on the same screen — listed here with why.
 */
const ACTION_BESIDE_IT: Record<string, string> = {
  "src/features/shared/shell/NotificationBell.tsx": "inside the bell's popover; closing it is the next step",
  "src/app/[locale]/(storefront)/account/referral/page.tsx": "the invite link and its copy button are above it",
  "src/features/customer/account/AddressBook.tsx": "the add-address form is right below it",
};

const CUSTOMER = ["src/app/[[]locale]/**/*.tsx", "src/features/customer/**/*.tsx", "src/features/shared/**/*.tsx"];

function emptyStatesWithoutAction(file: string): number {
  const source = readFileSync(file, "utf8");
  let missing = 0;
  for (const match of source.matchAll(/<EmptyState([\s\S]*?)\/>/g)) {
    if (!/\baction=/.test(match[1]!)) missing += 1;
  }
  return missing;
}

describe("zero dead ends in the customer zone", () => {
  const files = CUSTOMER.flatMap((pattern) => globSync(pattern)).filter((file) => !/\.(test|stories)\.tsx$/.test(file));

  it("finds the customer zone's files", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("gives every empty state a next action", () => {
    const offenders = files.filter((file) => !(file in ACTION_BESIDE_IT) && emptyStatesWithoutAction(file) > 0);
    expect(offenders).toEqual([]);
  });

  it("keeps the allow-list honest", () => {
    for (const file of Object.keys(ACTION_BESIDE_IT)) expect(emptyStatesWithoutAction(file), file).toBeGreaterThan(0);
  });

  it("offers more than a retry when something breaks or is missing", () => {
    for (const file of ["src/app/[locale]/not-found.tsx", "src/app/[locale]/error.tsx"]) {
      expect(readFileSync(file, "utf8"), file).toMatch(/<NextStep /);
    }
  });
});
