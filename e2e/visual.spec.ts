import { expect, test } from "@playwright/test";

/**
 * Visual snapshots of the design system's shell furniture (design-system.md §9) and of the
 * designer's editor states (F4 Part E).
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

/**
 * Storybook's iframe renders one story without its navigation chrome. `globals` sets the
 * toolbar values (theme, zone) the same way the toolbar does, so one story can be shot as the
 * zone that actually renders it.
 */
function storyUrl(id: string, globals?: string): string {
  return `/iframe.html?id=${id}&viewMode=story${globals ? `&globals=${globals}` : ""}`;
}

/** The instant the story fixtures are written around (`data.stories.tsx`). */
const STORY_NOW = new Date("2026-09-25T10:00:00+07:00");

interface Shot {
  id: string;
  /** Storybook globals, e.g. `theme:hc;zone:partner`. */
  globals?: string;
  /** Appended to the snapshot name when the same story is shot twice. */
  suffix?: string;
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
  // The designer's editor states (F4 Part E): properties per element kind, a locked element,
  // arranging a multi-selection, the live print checks, layers, the box's faces, the elements.
  "designer-panels--text-properties",
  "designer-panels--image-properties",
  "designer-panels--shape-properties",
  "designer-panels--locked-code",
  "designer-panels--arrange",
  "designer-panels--print-checks",
  "designer-panels--layers",
  "designer-panels--box",
  "designer-panels--elements",
];

/**
 * The art direction (D-180) as each zone wears it: the storefront's paper, pill CTA and
 * product cards; the admin's dense back office on the same tokens; the partner's shop floor
 * in high contrast, the theme most likely to be forgotten.
 */
const ZONE_SHOTS: Shot[] = [
  { id: "storefront-art-direction--composition", globals: "zone:customer" },
  { id: "storefront-art-direction--composition", globals: "theme:dark;zone:customer", suffix: "dark" },
  { id: "storefront-art-direction--composition", globals: "zone:admin", suffix: "admin-radius" },
  { id: "docs-tokens--art-direction" },
  { id: "foundations-button--variants", globals: "zone:customer", suffix: "customer" },
  { id: "foundations-button--variants", globals: "zone:admin", suffix: "admin" },
  { id: "foundations-badge--tones" },
  { id: "foundations-feedback-and-surfaces--surfaces" },
  { id: "forms-field-and-controls--text-controls" },
  { id: "commerce-catalogue--product-grid", globals: "zone:customer" },
  { id: "commerce-catalogue--product-grid", globals: "theme:dark;zone:customer", suffix: "dark" },
  { id: "commerce-configure-and-quote--dock", globals: "zone:customer" },
  { id: "data-display-back-office--server-list", globals: "zone:admin" },
  { id: "data-display-back-office--detail", globals: "zone:admin" },
  { id: "partner-shop-floor--stages", globals: "theme:hc;zone:partner", suffix: "hc" },
  { id: "partner-shop-floor--big-action", globals: "theme:hc;zone:partner", suffix: "hc" },
];

const SHOTS: Shot[] = [...STORIES.map((id) => ({ id })), ...ZONE_SHOTS];

for (const { id, globals, suffix } of SHOTS) {
  const name = suffix ? `${id}--${suffix}` : id;
  test(`${name} looks the way it did`, async ({ page }) => {
    // A fixed clock: the stories' fixtures are dated around this instant, and a component
    // that reads the time (an SLA countdown) would otherwise change the shot every minute.
    await page.clock.setFixedTime(STORY_NOW);
    await page.goto(storyUrl(id, globals));

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
    await expect(page.locator("#storybook-root")).toHaveScreenshot(`${name}.png`, {
      // Antialiasing differs run to run even on one machine, but a colour or layout change is
      // orders of magnitude larger than 0.2% of a component-sized shot.
      maxDiffPixelRatio: 0.002,
      /*
       * Per-pixel colour tolerance. Playwright's default (0.2) forgives any shift smaller than
       * that, which let the whole D-180 rebrand (white → #FBF8F3 page, cool → warm greys) pass
       * against the old baselines unnoticed. Token changes are exactly what this suite is for,
       * so a pixel counts as changed at a much smaller shift; antialiasing noise is still
       * absorbed by `maxDiffPixelRatio`.
       */
      threshold: 0.02,
      animations: "disabled",
    });
  });
}
