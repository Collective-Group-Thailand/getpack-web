"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { categoryIcon } from "./category-icons";

export interface RailItem {
  /** The category code, or `null` for "ทั้งหมด". */
  category: string | null;
  label: string;
  /** Its count from the API's facet; `undefined` hides the line (never a guess). */
  countLabel?: string;
  href: string;
  current: boolean;
}

/**
 * The category rail (styles redesign §3), replacing the chips: one outline icon, the name and the
 * count of each category, one row that scrolls sideways and shares the width when it fits. The
 * selected one carries `aria-current`. Plain links — a category is its own page, not a filter.
 *
 * Names are never cut: a card has a minimum width and the name wraps to a second line. When the
 * row is wider than the page, a veil (the design language has no gradients) marks each edge with more behind it and an arrow button
 * (pointer users; touch swipes) steps a screenful; both are absent when everything fits.
 */
export function CategoryRail({ items, label }: { items: RailItem[]; label: string }) {
  const t = useTranslations("styles.library");
  const scroller = useRef<HTMLElement>(null);
  const [more, setMore] = useState({ before: false, after: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    // Logical scrollLeft is negative in RTL; the absolute value is the distance from the start.
    const start = Math.abs(el.scrollLeft);
    const before = start > 4;
    const after = start + el.clientWidth < el.scrollWidth - 4;
    setMore((prev) => (prev.before === before && prev.after === after ? prev : { before, after }));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure, items.length]);

  // The selected card is brought into view on arrival, so a deep category is not off-screen.
  useEffect(() => {
    const el = scroller.current;
    const current = el?.querySelector<HTMLElement>("[aria-current='page']");
    if (!el || !current) return;
    const left = current.offsetLeft - el.offsetLeft;
    if (left + current.offsetWidth > el.clientWidth) el.scrollLeft = left - 24;
  }, []);

  const step = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: direction * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const arrow =
    "border-border bg-surface text-fg hover:border-border-strong focus-visible:ring-focus-ring absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full border shadow-overlay outline-none focus-visible:ring-2 md:grid";
  const fade =
    "bg-bg/80 pointer-events-none absolute inset-y-0 z-[5] w-6 backdrop-blur-[2px] transition-opacity duration-fast motion-reduce:transition-none md:w-8";

  return (
    <div className="relative -mx-5 mt-6 md:-mx-8 xl:-mx-12">
      <nav
        ref={scroller}
        aria-label={label}
        onScroll={measure}
        className="overflow-x-auto overscroll-x-contain px-5 pb-1 [scrollbar-width:none] md:px-8 xl:px-12 [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex gap-2.5">
          {items.map((item) => (
            <li key={item.category ?? "all"} className="shrink-0 md:max-w-60 md:min-w-34 md:flex-1">
              <Link
                href={item.href}
                aria-current={item.current ? "page" : undefined}
                className={cn(
                  "rounded-card focus-visible:ring-focus-ring flex h-full min-w-36 items-center gap-3 border p-3 outline-none focus-visible:ring-2",
                  "md:min-w-0 md:flex-col md:items-start md:gap-3.5 md:px-3.5 md:pt-3.5 md:pb-3",
                  "transition-colors duration-fast motion-reduce:transition-none",
                  item.current
                    ? "border-primary bg-primary-subtle text-primary-subtle-fg ring-primary ring-1"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <Icon
                  name={categoryIcon(item.category)}
                  size={26}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={item.current ? "text-primary" : "text-muted"}
                />
                <span className="min-w-0 leading-snug">
                  <span className="block text-sm font-semibold [text-wrap:balance]">{item.label}</span>
                  {item.countLabel ? (
                    <span className={cn("block text-[0.78rem] tabular-nums", !item.current && "text-muted")}>
                      {item.countLabel}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <span
        aria-hidden="true"
        className={cn(
          fade,
          "start-0",
          more.before ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          fade,
          "end-0",
          more.after ? "opacity-100" : "opacity-0",
        )}
      />
      {more.before ? (
        <button type="button" aria-label={t("railPrevious")} onClick={() => step(-1)} className={cn(arrow, "start-3")}>
          <Icon name="chevron-left" size={18} className="rtl:rotate-180" />
        </button>
      ) : null}
      {more.after ? (
        <button type="button" aria-label={t("railNext")} onClick={() => step(1)} className={cn(arrow, "end-3")}>
          <Icon name="chevron-right" size={18} className="rtl:rotate-180" />
        </button>
      ) : null}
    </div>
  );
}
