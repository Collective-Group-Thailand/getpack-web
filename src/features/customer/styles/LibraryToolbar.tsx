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
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
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
