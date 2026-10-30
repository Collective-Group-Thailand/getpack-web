"use client";

import { cn } from "../lib/cn";
import { scrollToStep, useActiveStep } from "./StepChips";

export interface AnchorNavItem {
  /** The id of the section it scrolls to. */
  id: string;
  label: React.ReactNode;
}

export interface AnchorNavProps {
  items: readonly AnchorNavItem[];
  "aria-label": string;
  /** Where the bar sticks: a CSS length, normally the storefront header's token. */
  top?: string;
  className?: string;
  /** The bar's inner width (the page's own container classes). */
  innerClassName?: string;
}

/**
 * A long page's sticky section bar (products redesign item 3, prototype `.secnav`): one link per
 * section, the one in view highlighted (`aria-current="true"`, read with the same IntersectionObserver
 * as `StepChips`), a click that scrolls there (instantly under reduced motion) and moves focus to it.
 * On a phone the row scrolls inside the bar, never the page.
 */
export function AnchorNav({ items, top, className, innerClassName, ...props }: AnchorNavProps) {
  const active = useActiveStep(items.map((item) => item.id));
  return (
    <nav
      aria-label={props["aria-label"]}
      className={cn("bg-bg/92 border-border z-sticky sticky border-b backdrop-blur", className)}
      style={{ top: top ?? "var(--site-sticky-top)" }}
    >
      <ul
        className={cn(
          "m-0 flex [scrollbar-width:none] list-none gap-1 overflow-x-auto overscroll-x-contain p-0 py-2 [&::-webkit-scrollbar]:hidden",
          innerClassName,
        )}
      >
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "true" : undefined}
              onClick={(event) => {
                event.preventDefault();
                // A section folded to its heading (`<details>`) opens when the bar sends the reader to it.
                const folded = document.getElementById(item.id)?.querySelector("details");
                if (folded && !folded.open) folded.open = true;
                scrollToStep(item.id);
              }}
              className={cn(
                "focus-visible:ring-focus-ring inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap no-underline outline-none focus-visible:ring-2",
                active === item.id
                  ? "bg-primary-subtle text-primary-subtle-fg"
                  : "text-muted hover:bg-bg-subtle hover:text-fg",
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
