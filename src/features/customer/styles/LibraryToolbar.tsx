import type { ReactNode } from "react";

/**
 * The results' toolbar (styles redesign §5): how many match, then the narrow-screen filter button,
 * the view toggle, the optional "ราคารวม VAT" switch, copy-link and the order. The VAT switch is a
 * slot: the page passes it only when the shared price helper says the API supplied both figures
 * (ruling C1) — today it does not, so the slot stays empty and nothing is drawn or invented.
 */
export function LibraryToolbar({
  count,
  categories,
  filters,
  views,
  vatSwitch,
  copyLink,
  sort,
}: {
  /** The headline: "50 แบบ" with its search words. Live-announced. */
  count: ReactNode;
  /** The category tabs with their counts (the redesign moved them here from the tile rail). */
  categories?: ReactNode;
  filters?: ReactNode;
  views?: ReactNode;
  vatSwitch?: ReactNode;
  copyLink: ReactNode;
  sort: ReactNode;
}) {
  // Owner redesign 2026-10-30: one toolbar over the full-width grid — the category tabs, then how many match with
  // the view switch, the order, copy-link and "ตัวกรอง (n)" (the filters live in a sheet now, at every width).
  // From a tablet up it sticks under the site header, edge to edge on the page's own paper.
  return (
    <div
      className="md:bg-bg/95 md:border-border md:z-sticky flex flex-col gap-3 md:sticky md:-mx-8 md:border-b md:px-8 md:py-3 md:backdrop-blur xl:-mx-12 xl:px-12"
      style={{ top: "var(--site-sticky-top)" }}
    >
      {categories}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <h2 id="library-results" className="me-auto text-lg font-semibold tabular-nums" aria-live="polite">
          {count}
        </h2>
        {views}
        {vatSwitch ? <div data-slot="vat-switch">{vatSwitch}</div> : null}
        {/* One row on a phone too: copy-link, the order taking the room left, and the filters. */}
        <div className="flex w-full items-center gap-2 md:w-auto">
          {copyLink}
          <div className="min-w-0 flex-1 md:flex-none [&_button]:w-full [&_button]:min-w-0 md:[&_button]:min-w-44">
            {sort}
          </div>
          {filters}
        </div>
      </div>
    </div>
  );
}
