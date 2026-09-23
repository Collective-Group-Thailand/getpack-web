"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";
import { Tooltip } from "@/ui/components/Tooltip";

import { isCurrent, menuLabel, type SidebarItem } from "./menu";

/**
 * The back-office navigation, rendered from the entitlements `/v1/admin/me` returned.
 *
 * Nothing here consults a role. If an entry is in the list the API sent, this person may open
 * it; if it is not, it does not exist as far as this zone is concerned (D-140, ADR-0005).
 */
export function AdminSidebar({ items, collapsed }: { items: readonly SidebarItem[]; collapsed: boolean }) {
  const t = useTranslations("admin");
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-0.5 px-2">
      {items.map((item) => {
        const label = menuLabel(item.key, t);
        const current = isCurrent(item.href, pathname);

        const link = (
          <Link
            href={item.href}
            // Marks the page for a screen reader, not just with a colour.
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm",
              collapsed && "justify-center px-0",
              current ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "text-muted hover:bg-surface-subtle",
            )}
          >
            {item.icon ? <Icon name={item.icon} size={18} className="shrink-0" /> : null}
            {/*
              Collapsed, the label is still in the DOM and still read aloud — it is only
              hidden visually. Removing it would make the whole nav unusable to a screen
              reader the moment a sighted colleague collapsed it.
            */}
            <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
          </Link>
        );

        return <li key={item.key}>{collapsed ? <Tooltip content={label}>{link}</Tooltip> : link}</li>;
      })}
    </ul>
  );
}
