"use client";

import { useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { trackProducts } from "@/lib/analytics/products";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export interface ToolbarTab {
  mode: string;
  label: string;
  count: number;
  href: string;
  current: boolean;
}

export interface ToolbarChip {
  key: string;
  label: string;
  href: string;
  current: boolean;
}

/**
 * The catalogue's toolbar (prompt item 5, prototype `.toolbar` + `.cats`): the mode tabs with their
 * counts, the sort, the grid ↔ price-table toggle, and the category chips of the current mode. Every
 * control is a link to a URL state (tabs, chips and the view push a history entry, so Back restores
 * them); the sort is a native select that pushes too. Analytics follow each change.
 */
export function HubToolbar({
  tabs,
  tabsLabel,
  chips,
  chipsLabel,
  sort,
  views,
}: {
  tabs: ToolbarTab[];
  tabsLabel: string;
  chips: ToolbarChip[];
  chipsLabel: string;
  sort: { label: string; value: string; options: { value: string; label: string; href: string }[] };
  views: { label: string; options: { view: "grid" | "table"; label: string; href: string; current: boolean }[] };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const linkClass = "focus-visible:ring-focus-ring outline-none focus-visible:ring-2";
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        <nav aria-label={tabsLabel} className="max-w-full">
          <ul className="border-border bg-bg-subtle flex max-w-full [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-xl border p-[3px] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => (
              <li key={tab.mode} className="shrink-0">
                <Link
                  href={tab.href}
                  scroll={false}
                  aria-current={tab.current ? "page" : undefined}
                  onClick={() => trackProducts("products_tab", { mode: tab.mode })}
                  className={cn(
                    linkClass,
                    "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap",
                    tab.current ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
                  )}
                >
                  {tab.label}
                  <small className="text-muted text-xs tabular-nums">{tab.count}</small>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2.5 max-sm:w-full sm:ms-auto">
          <NativeSelect
            aria-label={sort.label}
            className="h-10 w-full min-w-48 text-[0.84375rem] font-medium sm:w-auto"
            value={sort.value}
            options={sort.options.map(({ value, label }) => ({ value, label }))}
            onValueChange={(value) => {
              const target = sort.options.find((option) => option.value === value);
              if (target) startTransition(() => router.push(target.href, { scroll: false }));
            }}
          />
          <nav aria-label={views.label} className="border-border rounded-control flex shrink-0 overflow-hidden border">
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
                  linkClass,
                  "grid h-9.5 w-10 place-items-center",
                  option.current ? "bg-bg-subtle text-fg" : "bg-surface text-muted hover:text-fg",
                )}
              >
                <Icon name={option.view === "grid" ? "dashboard" : "spreadsheet"} size={18} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </div>
      </div>
      {chips.length > 1 ? (
        <nav aria-label={chipsLabel}>
          <ul className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
            {chips.map((chip) => (
              <li key={chip.key} className="shrink-0">
                <Link
                  href={chip.href}
                  scroll={false}
                  aria-current={chip.current ? "true" : undefined}
                  className={cn(
                    linkClass,
                    "rounded-control inline-flex min-h-8 items-center border px-3.5 text-[0.84375rem] whitespace-nowrap",
                    chip.current
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border bg-surface text-muted hover:text-fg hover:border-border-strong",
                  )}
                >
                  {chip.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
