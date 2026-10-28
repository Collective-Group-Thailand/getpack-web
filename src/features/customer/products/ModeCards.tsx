"use client";

import { useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { trackProducts } from "@/lib/analytics/products";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { HubMode } from "./hub";

export interface ModeCard {
  mode: HubMode;
  name: string;
  description: string;
  /** The data line from the API's figures; absent when the data has none. */
  line?: React.ReactNode;
  /** Where pressing it goes: the catalogue filtered by this mode, or unfiltered when it is the current one. */
  href: string;
  pressed: boolean;
}

const ICONS: Record<HubMode, IconName> = { instant: "zap", quote: "document", stock: "truck", service: "wrench" };

/** One row on a wide screen however many modes the catalogue has (a mode without items is not drawn). */
const COLUMNS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" };

/**
 * The four buying modes (prompt item 2, prototype `.modes`): icon, name, one line, and a data line.
 * Pressing one filters the catalogue by that mode (pressing it again clears it) and scrolls to it. A
 * toggle button each (`aria-pressed`), in a labelled group; without JavaScript the filter still works
 * through the catalogue's own tabs.
 */
export function ModeCards({ cards, label }: { cards: ModeCard[]; label: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("mt-7 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3", COLUMNS[cards.length] ?? "lg:grid-cols-4")}
    >
      {cards.map((card) => (
        <button
          key={card.mode}
          type="button"
          aria-pressed={card.pressed}
          onClick={() => {
            trackProducts("products_mode_select", { mode: card.mode, action: card.pressed ? "clear" : "select" });
            startTransition(() => router.push(`${card.href}#catalog`, { scroll: false }));
            const target = document.getElementById("catalog");
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
          }}
          className={cn(
            "border-border bg-surface rounded-card focus-visible:ring-focus-ring flex flex-wrap items-center gap-x-3 gap-y-1.5 border p-3.5 text-start outline-none focus-visible:ring-2 sm:flex-col sm:flex-nowrap sm:items-stretch sm:gap-2.5 sm:p-4.5",
            "hover:border-border-strong hover:shadow-card duration-fast ease-standard transition-[border-color,box-shadow] motion-reduce:transition-none",
            "aria-pressed:border-primary aria-pressed:ring-primary aria-pressed:ring-1",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg",
              card.mode === "instant" ? "bg-instant-subtle text-instant-subtle-fg" : "bg-bg-subtle text-muted",
            )}
          >
            <Icon name={ICONS[card.mode]} size={20} />
          </span>
          <b className="text-base font-semibold">{card.name}</b>
          <span className="text-muted basis-full text-[0.84375rem] leading-normal sm:basis-auto">
            {card.description}
          </span>
          {card.line ? (
            <span className="text-muted [&_b]:text-fg text-[0.78125rem] tabular-nums sm:mt-auto [&_b]:font-semibold">
              {card.line}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
