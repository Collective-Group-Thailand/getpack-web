import type { ReactNode } from "react";

/**
 * The results' toolbar (styles redesign §5): how many match, then the narrow-screen filter button,
 * the view toggle, the optional "ราคารวม VAT" switch, copy-link and the order. The VAT switch is a
 * slot: the page passes it only when the shared price helper says the API supplied both figures
 * (ruling C1) — today it does not, so the slot stays empty and nothing is drawn or invented.
 */
export function LibraryToolbar({
  count,
  filters,
  views,
  vatSwitch,
  copyLink,
  sort,
}: {
  /** The headline: "50 แบบ" with its search words. Live-announced. */
  count: ReactNode;
  filters?: ReactNode;
  views?: ReactNode;
  vatSwitch?: ReactNode;
  copyLink: ReactNode;
  sort: ReactNode;
}) {
  // Project A: from a tablet up the toolbar sticks under the site header while the results scroll, on the
  // page's own paper (edge to edge on a tablet; within the results column beside the filter sidebar). On a
  // phone it wraps to several rows, so it stays in the flow there.
  return (
    <div
      className="md:bg-bg/95 md:border-border md:z-sticky flex flex-wrap items-center gap-x-4 gap-y-3 md:sticky md:-mx-8 md:border-b md:px-8 md:py-3 md:backdrop-blur min-[65rem]:mx-0 min-[65rem]:px-0"
      style={{ top: "var(--site-sticky-top)" }}
    >
      <h2 id="library-results" className="me-auto text-xl font-semibold tabular-nums" aria-live="polite">
        {count}
      </h2>
      {filters ? <div className="min-[65rem]:hidden">{filters}</div> : null}
      {views}
      {vatSwitch ? <div data-slot="vat-switch">{vatSwitch}</div> : null}
      {copyLink}
      {sort}
    </div>
  );
}
