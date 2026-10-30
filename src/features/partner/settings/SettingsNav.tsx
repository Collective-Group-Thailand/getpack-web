"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/ui/lib/cn";

export interface SettingsNavItem {
  key: string;
  href: string;
  label: string;
  /** A section of the settings overview (`/settings#users`): followed with the scroll instead of by the address. */
  anchor?: string;
}

/**
 * The settings sections on a desk, beside the page: the overview's own sections (followed as they scroll past),
 * then the settings that have a page of their own. The current one sits on the pale tint with a green rule.
 */
export function SettingsNav({ label, items, current }: { label: string; items: SettingsNavItem[]; current: string }) {
  const anchors = items.filter((item) => item.anchor);
  const onOverview = anchors.some((item) => item.key === current) || current === "overview";
  const [active, setActive] = useState(onOverview ? (anchors[0]?.key ?? current) : current);

  useEffect(() => {
    if (!onOverview || typeof IntersectionObserver === "undefined") return;
    const sections = anchors
      .map((item) => ({ key: item.key, el: document.getElementById(item.anchor!) }))
      .filter((entry): entry is { key: string; el: HTMLElement } => entry.el !== null);
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = sections.find((s) => s.el === entry.target)?.key;
          if (key) seen.set(key, entry.isIntersecting);
        }
        const first = sections.find((s) => seen.get(s.key));
        if (first) setActive(first.key);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s.el));
    return () => observer.disconnect();
    // The sections are fixed for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOverview]);

  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item, at) => {
          const selected = item.key === active;
          const firstPage = !item.anchor && at > 0 && items[at - 1]?.anchor;
          return (
            <li key={item.key} className={cn(firstPage && "border-border mt-2 border-t pt-2")}>
              <Link
                href={item.href}
                aria-current={selected ? (item.anchor ? "location" : "page") : undefined}
                onClick={item.anchor ? () => setActive(item.key) : undefined}
                className={cn(
                  "focus-visible:ring-focus-ring relative flex min-h-9 items-center rounded-lg px-3 py-1.5 text-sm leading-snug outline-none focus-visible:ring-2",
                  selected
                    ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                    : "text-muted hover:bg-surface-subtle hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
