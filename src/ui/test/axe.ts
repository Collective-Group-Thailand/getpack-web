import axe, { type AxeResults, type RunOptions } from "axe-core";
import { expect } from "vitest";

/**
 * Runs axe over a rendered component (design-system.md §6: axe in CI for every component).
 *
 * Two rules are off here, deliberately:
 *
 * - `color-contrast` — jsdom has no layout and no colour, so axe cannot measure it and
 *   reports incomplete results either way. Contrast is gated properly instead by
 *   `scripts/check-contrast.ts`, which does the OKLCH → sRGB maths on the tokens themselves
 *   in all three themes, and by `@axe-core/playwright` in e2e, where a real browser has
 *   real pixels.
 * - `region` — a component under test is a fragment, not a page, so "content outside a
 *   landmark" is an artefact of the harness. Landmarks are asserted on real pages in e2e.
 */
const DISABLED_IN_JSDOM = ["color-contrast", "region"];

export async function runAxe(container: Element, options: RunOptions = {}): Promise<AxeResults> {
  return axe.run(container, {
    ...options,
    rules: {
      ...Object.fromEntries(DISABLED_IN_JSDOM.map((id) => [id, { enabled: false }])),
      ...options.rules,
    },
    // WCAG 2.2 AA is the target (design-system.md §6); `best-practice` is advisory and is
    // included so a missing accessible name or a nested-interactive slip still fails.
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
  });
}

/** Fails with the rule id, the impact and the offending markup, not just a count. */
export async function expectNoA11yViolations(container: Element, options?: RunOptions): Promise<void> {
  const { violations } = await runAxe(container, options);
  const report = violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.html).join("\n  ")}`)
    .join("\n\n");
  expect(violations, report || undefined).toHaveLength(0);
}
