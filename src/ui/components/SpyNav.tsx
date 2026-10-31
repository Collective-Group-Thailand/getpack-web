"use client";

import { useEffect, useState } from "react";

import { cn } from "../lib/cn";

export interface SpyNavItem {
  /** The id of the section on the page. */
  id: string;
  label: React.ReactNode;
  /** A muted figure at the end (how many settings the section holds). */
  count?: React.ReactNode;
}

/**
 * The sections of one long page as a column beside it (a desk only): each a link to its anchor, the one
 * being read on the pale tint and followed as the page scrolls. Same look as the partner settings nav.
 */
export function SpyNav({ label, items, className }: { label: string; items: SpyNavItem[]; className?: string }) {
  const [active, setActive] = useState(items[0]?.id);
  const ids = items.map((item) => item.id).join(" ");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = ids
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
        const first = sections.find((el) => seen.get(el.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={selected ? "location" : undefined}
                onClick={() => setActive(item.id)}
                className={cn(
                  "focus-visible:ring-focus-ring flex min-h-9 items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm leading-snug outline-none focus-visible:ring-2",
                  selected
                    ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                    : "text-muted hover:bg-surface-subtle hover:text-fg",
                )}
              >
                <span className="min-w-0">{item.label}</span>
                {item.count !== undefined ? (
                  <span className={cn("shrink-0 text-xs tabular-nums", selected ? "font-medium" : "text-muted")}>
                    {item.count}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
