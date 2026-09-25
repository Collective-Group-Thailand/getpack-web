import { expect, test } from "@playwright/test";

/**
 * Visual snapshots of the design system's shell furniture (design-system.md §9).
 *
 * Against **Storybook**, not the app: a story is a fixed tree with no session, no API and no
 * clock, so a diff means someone changed how a component looks. The same shot of a real page
 * would move whenever a mock, a date or a piece of copy did, and a snapshot suite that cries
 * wolf is one people delete.
 *
 * Screenshots are platform-specific — fonts rasterise differently on macOS and Linux — so
 * `snapshotPathTemplate` in `playwright.config.ts` keys them by platform and this project runs
 * only where baselines exist. Generate them with:
 *
 *     pnpm build-storybook && pnpm e2e --project=visual --update-snapshots
 */

/** Storybook's iframe renders one story without its navigation chrome. */
function storyUrl(id: string): string {
  return `/iframe.html?id=${id}&viewMode=story`;
}

const STORIES = [
  "navigation-shell-furniture--workspace-shell",
  "navigation-shell-furniture--palette",
  "navigation-shell-furniture--shortcuts",
  "navigation-shell-furniture--avatars",
  "data-display-charts--bars",
  "data-display-charts--horizontal-grouped",
  "data-display-charts--lines",
  "data-display-charts--meter-with-threshold",
];

for (const id of STORIES) {
  test(`${id} looks the way it did`, async ({ page }) => {
    await page.goto(storyUrl(id));

    // Storybook renders the story into `#storybook-root`; waiting for it avoids catching a
    // blank frame on a slow first paint.
    await page.locator("#storybook-root").waitFor({ state: "visible" });
    // Fonts are the single largest source of false diffs: text laid out in the fallback and
    // then reflowed looks like a redesign.
    await page.evaluate(() => document.fonts.ready);

    /*
     * The story's own root, not `fullPage`.
     *
     * A full-page shot of a sparse story is mostly background, so a real change — three
     * avatars going from teal to red — is a tiny fraction of the pixels and hides inside the
     * tolerance. Shooting the component makes the change a large fraction of a small image.
     * (Verified by making that exact change and watching the test fail.)
     */
    await expect(page.locator("#storybook-root")).toHaveScreenshot(`${id}.png`, {
      // Antialiasing differs run to run even on one machine, but a colour or layout change is
      // orders of magnitude larger than 0.2% of a component-sized shot.
      maxDiffPixelRatio: 0.002,
      animations: "disabled",
    });
  });
}
