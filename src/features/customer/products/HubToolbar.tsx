"use client";

import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { trackProducts } from "@/lib/analytics/products";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Sheet } from "@/ui/components/Sheet";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export interface ToolbarTab {
  mode: string;
  label: string;
  count: number;
  href: string;
  current: boolean;
  /** The mode's key figure from the API ("เริ่ม ฿3.50/ชิ้น"), shown under the name on a wide screen. */
  line?: React.ReactNode;
}

export interface ToolbarChip {
  key: string;
  label: string;
  /** A link to the URL state; or, with `onSelect`, a toggle button for a list filtered in the browser. */
  href?: string;
  onSelect?: () => void;
  current: boolean;
  /** A count after the label ("34 แบบ"), quieter than it. */
  count?: string;
}

type SortProp = { label: string; value: string; options: { value: string; label: string; href: string }[] };
type ViewsProp = {
  label: string;
  options: { view: "grid" | "table"; label: string; href: string; current: boolean }[];
};

const FOCUS = "focus-visible:ring-focus-ring outline-none focus-visible:ring-2";

/**
 * The catalogue's toolbar (prompt item 5; Project A): the search, the buying-mode tabs (each with its count
 * and, on a wide screen, its key figure — the role the four mode cards had), the sort, the grid ↔ price-table
 * toggle and the category chips of the current mode. Every control is a link to a URL state (tabs, chips and
 * the view push a history entry, so Back restores them); the sort pushes too. Analytics follow each change.
 *
 * `sticky`: the toolbar stays under the site header while the catalogue scrolls. On a phone only the tabs
 * and the chips stick (both rows scroll sideways inside themselves, never the page); the search scrolls
 * away above them, and the sort and view move into a bottom sheet behind one button.
 */
export function HubToolbar({
  tabs,
  tabsLabel,
  chips,
  chipsLabel,
  sort,
  views,
  search,
  sticky = false,
  closeLabel,
}: {
  tabs: ToolbarTab[];
  tabsLabel: string;
  chips: ToolbarChip[];
  chipsLabel: string;
  sort: SortProp;
  views: ViewsProp;
  /** The page's search field, drawn at the toolbar's start. */
  search?: React.ReactNode;
  sticky?: boolean;
  /** The bottom sheet's close button (phones, `sticky` only). */
  closeLabel?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sheet, setSheet] = useState(false);
  const pushSort = (value: string) => {
    const target = sort.options.find((option) => option.value === value);
    if (target) startTransition(() => router.push(target.href, { scroll: false }));
  };
  const phoneSheet = sticky && closeLabel !== undefined;

  // The modes (Project A). From `lg` a segmented row: one cell per mode sharing the width, the chosen one on the
  // brand tint with a green rule. Narrower, each mode is its own bordered cell sized to its label, in a row that
  // scrolls inside itself and — in the sticky bar — runs to the screen's edge with room after the last cell, so a
  // half-shown next cell reads as "more this way" and no label is ever cut at a container edge.
  const tabRow = (
    <nav aria-label={tabsLabel} className="min-w-0">
      <ul
        className={cn(
          "flex [scrollbar-width:none] gap-1.5 overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden",
          "lg:border-border lg:bg-surface lg:divide-border lg:gap-0 lg:divide-x lg:rounded-xl lg:border",
          sticky && "max-md:-mx-5 max-md:px-5 md:max-lg:-mx-8 md:max-lg:px-8",
        )}
      >
        {tabs.map((tab) => (
          <li key={tab.mode} className="flex shrink-0 lg:flex-1">
            <Link
              href={tab.href}
              scroll={false}
              aria-current={tab.current ? "page" : undefined}
              onClick={() => trackProducts("products_tab", { mode: tab.mode })}
              className={cn(
                FOCUS,
                "rounded-control relative flex min-h-11 w-full flex-col justify-center gap-0.5 border px-3.5 py-2 text-start lg:rounded-none lg:border-0 lg:px-4 lg:focus-visible:ring-inset",
                tab.current
                  ? "border-primary bg-primary-subtle text-primary-subtle-fg lg:after:bg-primary lg:after:absolute lg:after:inset-x-0 lg:after:bottom-0 lg:after:h-0.5"
                  : "border-border bg-surface text-fg hover:bg-surface-subtle",
              )}
            >
              <span className="flex items-baseline gap-1.5 text-sm font-semibold whitespace-nowrap">
                {tab.label}
                <span className="text-muted text-xs font-normal tabular-nums">{tab.count}</span>
              </span>
              {tab.line ? (
                <span className="text-muted [&_b]:text-fg text-xs leading-snug whitespace-nowrap tabular-nums max-lg:hidden [&_b]:font-semibold">
                  {tab.line}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  const viewToggle = (
    <nav
      aria-label={views.label}
      className="border-border rounded-control bg-surface flex shrink-0 overflow-hidden border"
    >
      {views.options.map((option) => (
        <Link
          key={option.view}
          href={option.href}
          scroll={false}
          aria-current={option.current ? "true" : undefined}
          aria-label={option.label}
          title={option.label}
          onClick={() => trackProducts("products_view_toggle", { view: option.view })}
          className={cn(
            FOCUS,
            "grid h-[2.625rem] w-11 place-items-center",
            option.current ? "bg-primary-subtle text-primary-subtle-fg" : "text-muted hover:text-fg",
          )}
        >
          <Icon name={option.view === "grid" ? "dashboard" : "spreadsheet"} size={18} aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );

  const sortSelect = (
    <SearchableSelect
      aria-label={sort.label}
      className="w-full min-w-52 sm:w-auto"
      value={sort.value}
      options={sort.options.map(({ value, label }) => ({ value, label }))}
      onValueChange={pushSort}
    />
  );

  const chipRow = chips.length > 1 ? <ChipRow chips={chips} label={chipsLabel} bleed={sticky} /> : null;

  if (!sticky)
    return (
      <div className="flex flex-col gap-3.5">
        {search ? <div className="min-w-0">{search}</div> : null}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
          <div className="min-w-0 max-sm:w-full sm:flex-1">{tabRow}</div>
          <div className="flex items-center gap-2.5 max-sm:w-full sm:ms-auto">
            {sortSelect}
            {viewToggle}
          </div>
        </div>
        {chipRow}
      </div>
    );

  const currentSort = sort.options.find((option) => option.value === sort.value);
  return (
    // From `md` the whole toolbar is one sticky bar. Below it the wrapper dissolves (`contents`) so the
    // search scrolls away and only the second block — tabs, the sheet button and the chips — sticks.
    // The bar's paper reaches the container's edges (its padding), so what scrolls under it is hidden.
    <div
      className="md:bg-bg/95 md:border-border md:z-sticky max-md:contents md:sticky md:-mx-8 md:border-b md:px-8 md:backdrop-blur xl:-mx-12 xl:px-12"
      style={{ top: "var(--site-sticky-top)" }}
    >
      {/* Row 1: the search across the bar, the sort and the view at its end (from `md`). */}
      <div className="flex items-center gap-2.5 md:pt-3">
        {search ? <div className="min-w-0 flex-1">{search}</div> : null}
        <div className="ms-auto flex shrink-0 items-center gap-2.5 max-md:hidden">
          {sortSelect}
          {viewToggle}
        </div>
      </div>
      <div
        className="max-md:bg-bg/95 max-md:border-border max-md:z-sticky flex flex-col gap-2 py-2.5 max-md:sticky max-md:-mx-5 max-md:border-b max-md:px-5 max-md:backdrop-blur md:pt-2.5 md:pb-3"
        style={{ top: "var(--site-sticky-top)" }}
      >
        {tabRow}
        <div className="flex items-center gap-2">
          {phoneSheet ? (
            <button
              type="button"
              onClick={() => setSheet(true)}
              aria-haspopup="dialog"
              aria-label={currentSort?.label ?? sort.label}
              title={currentSort?.label ?? sort.label}
              className={cn(
                FOCUS,
                "border-border bg-surface text-fg rounded-control grid size-10 shrink-0 place-items-center border md:hidden",
              )}
            >
              <Icon name="sliders" size={18} aria-hidden="true" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">{chipRow}</div>
        </div>
      </div>
      {phoneSheet ? (
        <Sheet side="bottom" open={sheet} onOpenChange={setSheet} title={sort.label} closeLabel={closeLabel}>
          <ul className="flex flex-col gap-1">
            {sort.options.map((option) => (
              <li key={option.value}>
                <Link
                  href={option.href}
                  scroll={false}
                  aria-current={option.value === sort.value ? "true" : undefined}
                  onClick={() => setSheet(false)}
                  className={cn(
                    FOCUS,
                    "rounded-control flex min-h-11 items-center justify-between gap-3 px-3 text-[0.9375rem]",
                    option.value === sort.value
                      ? "bg-primary-subtle text-primary-subtle-fg font-medium"
                      : "hover:bg-bg-subtle",
                  )}
                >
                  {option.label}
                  {option.value === sort.value ? <Icon name="check" size={18} aria-hidden="true" /> : null}
                </Link>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 mb-2 text-sm font-semibold">{views.label}</h3>
          <ul className="grid grid-cols-2 gap-2">
            {views.options.map((option) => (
              <li key={option.view}>
                <Link
                  href={option.href}
                  scroll={false}
                  aria-current={option.current ? "true" : undefined}
                  onClick={() => {
                    trackProducts("products_view_toggle", { view: option.view });
                    setSheet(false);
                  }}
                  className={cn(
                    FOCUS,
                    "rounded-control flex min-h-11 items-center justify-center gap-2 border px-3 text-sm",
                    option.current
                      ? "border-primary bg-primary-subtle text-primary-subtle-fg font-medium"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <Icon name={option.view === "grid" ? "dashboard" : "spreadsheet"} size={18} aria-hidden="true" />
                  {option.label}
                </Link>
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}
    </div>
  );
}

/**
 * The category chips. Phones: one row that scrolls inside itself, edge to edge in the sticky bar with room after
 * the last chip. From `md`: the chips wrap, at most two lines; what does not fit folds behind a "+n" chip that
 * opens the full list (and "แสดงน้อยลง" folds it again). The chosen category is never folded away.
 */
export function ChipRow({ chips, label, bleed }: { chips: ToolbarChip[]; label: string; bleed: boolean }) {
  const t = useTranslations("products.catalogue");
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  /** How many chips fit in two lines with the "+n" chip; null = all fit, or not measured yet. */
  const [limit, setLimit] = useState<number | null>(null);
  const [measure, setMeasure] = useState(0);

  // Measured with every chip drawn: the first chip that starts a third line, less one for the "+n" chip.
  useLayoutEffect(() => {
    const element = list.current;
    if (!element || open || limit !== null) return;
    if (!window.matchMedia("(min-width: 48rem)").matches) return;
    const items = [...element.querySelectorAll<HTMLElement>(":scope > li[data-chip]")];
    const tops = [...new Set(items.map((item) => item.offsetTop))].sort((x, y) => x - y);
    if (tops.length <= 2) return;
    const firstHidden = items.findIndex((item) => item.offsetTop > tops[1]!);
    setLimit(Math.max(1, firstHidden - 1));
  }, [open, limit, measure, chips]);

  // A new width measures again (from the full list).
  useEffect(() => {
    const element = list.current?.parentElement;
    if (!element || typeof ResizeObserver === "undefined") return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      setLimit(null);
      setMeasure((value) => value + 1);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const currentAt = chips.findIndex((chip) => chip.current);
  const folded = !open && limit !== null && currentAt < limit;
  const shown = folded ? chips.slice(0, limit) : chips;
  const chipClass = (current: boolean) =>
    cn(
      FOCUS,
      "rounded-control inline-flex min-h-8 items-center border px-3.5 text-[0.84375rem] whitespace-nowrap",
      current
        ? "border-primary bg-primary text-primary-fg"
        : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg",
    );
  return (
    <nav aria-label={label} className="min-w-0">
      <ul
        ref={list}
        className={cn(
          "flex [scrollbar-width:none] gap-1.5 overflow-x-auto overscroll-x-contain py-0.5 md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden",
          bleed && "max-md:-me-5 max-md:pe-5",
        )}
      >
        {shown.map((chip) => (
          <li key={chip.key} data-chip="" className="shrink-0">
            {chip.onSelect || !chip.href ? (
              <button
                type="button"
                aria-pressed={chip.current}
                onClick={chip.onSelect}
                className={chipClass(chip.current)}
              >
                {chip.label}
                {chip.count ? <span className="ms-1.5 text-xs font-normal tabular-nums">{chip.count}</span> : null}
              </button>
            ) : (
              <Link
                href={chip.href}
                scroll={false}
                aria-current={chip.current ? "true" : undefined}
                className={chipClass(chip.current)}
              >
                {chip.label}
                {chip.count ? <span className="ms-1.5 text-xs font-normal tabular-nums">{chip.count}</span> : null}
              </Link>
            )}
          </li>
        ))}
        {folded || (open && limit !== null) ? (
          <li className="shrink-0">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className={cn(chipClass(false), "text-primary hover:text-primary-hover font-medium")}
            >
              {open ? t("fewerCategories") : t("moreCategories", { count: chips.length - (limit ?? 0) })}
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
