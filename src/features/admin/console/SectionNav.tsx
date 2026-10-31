"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { cn } from "@/ui/lib/cn";

import { isSubnavCurrent, usePublishSubnav } from "../shell/subnav";
import { useActor } from "./actor";

/**
 * The pages of one area side by side (partners: factories, proposals, coverage, indices). An item whose permission
 * this role lacks is not offered.
 *
 * On a desk the area's pages are listed in the sidebar under the area's entry (the shell takes them from here), so
 * the page starts with one tab row at most — the list's own views. Without the sidebar (a phone) they are a light
 * line of links under the header, never a second underlined tab row.
 */
export function SectionNav({
  label,
  items,
}: {
  label: string;
  items: readonly { href: string; label: string; permission?: string; exact?: boolean }[];
}) {
  const pathname = usePathname();
  const actor = useActor();
  const shown = items
    .filter((item) => !item.permission || actor.permissions.includes(item.permission))
    .map(({ href, label: name, exact }) => ({ href, label: name, ...(exact ? { exact } : {}) }));
  const inShell = usePublishSubnav(shown);
  const row = useRef<HTMLElement>(null);
  // One line that scrolls sideways (never three wrapped lines above the list's own tabs): the current page is
  // brought into view once, so it is never hidden past the edge.
  useEffect(() => {
    const current = row.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const box = row.current;
    if (current && box && box.scrollWidth > box.clientWidth) {
      box.scrollLeft = current.offsetLeft - (box.clientWidth - current.offsetWidth) / 2;
    }
  }, [pathname]);
  return (
    <nav
      ref={row}
      aria-label={label}
      className={cn(
        "relative -mx-4 -mt-2 flex [scrollbar-width:none] items-center gap-x-1 overflow-x-auto overscroll-x-contain px-4 text-sm md:mx-0 md:flex-wrap md:gap-y-1.5 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden",
        inShell && "md:hidden",
      )}
    >
      {shown.map((item) => {
        const active = isSubnavCurrent(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-visible:ring-focus-ring inline-flex min-h-11 shrink-0 items-center rounded-lg px-2.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-inset md:min-h-8",
              // Plain words, the current one in ink — lighter than the list's own view tabs under it.
              active ? "text-fg font-semibold underline underline-offset-4" : "text-muted hover:text-fg font-medium",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
