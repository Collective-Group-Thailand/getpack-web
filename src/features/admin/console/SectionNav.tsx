"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/ui/lib/cn";

import { useActor } from "./actor";

/**
 * The pages of one area side by side (partners: factories, proposals, coverage, indices), as
 * links that say which one is current. An item whose permission this role lacks is not offered.
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
  const shown = items.filter((item) => !item.permission || actor.permissions.includes(item.permission));
  return (
    <nav aria-label={label} className="border-border flex gap-1 overflow-x-auto border-b">
      {shown.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              active ? "border-primary text-fg" : "text-muted hover:text-fg border-transparent",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
