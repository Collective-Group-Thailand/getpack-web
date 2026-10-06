"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import type { StaffMe } from "@/lib/api/types";
import { Avatar } from "@/ui/components/Avatar";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";
import { Tooltip } from "@/ui/components/Tooltip";

import { useQueues } from "../console/queues";
import { groupSidebar, isCurrent, menuLabel, type SidebarItem } from "./menu";

/**
 * The back-office navigation, rendered from the entitlements `/v1/admin/me` returned.
 *
 * Nothing here consults a role. If an entry is in the list the API sent, this person may open
 * it; if it is not, it does not exist as far as this zone is concerned (D-140, ADR-0005). The
 * groups are presentation — each is a list named by its heading, so a screen reader can skip a
 * whole group — and never add or hide an entry.
 */
export function AdminSidebar({
  items,
  collapsed,
  actor,
}: {
  items: readonly SidebarItem[];
  collapsed: boolean;
  /** For the name-and-role block at the foot (UX audit: "avatar + ชื่อ + role"). */
  actor?: StaffMe;
}) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const groups = groupSidebar(items);
  // What waits behind each entry, from the same queues the dashboard counts (UX audit: badges on
  // the queue menus). A queue key is `<menu>.<queue>`: their counts add up under the menu entry.
  const queues = useQueues().data?.queues ?? [];
  const waiting = new Map<string, { count: number; overdue: boolean }>();
  for (const queue of queues) {
    const key = queue.key.split(".")[0] ?? queue.key;
    const entry = waiting.get(key) ?? { count: 0, overdue: false };
    waiting.set(key, { count: entry.count + queue.count, overdue: entry.overdue || queue.overdueCount > 0 });
  }
  const roleLabel = (role: string) => (t.has(`roles.${role}`) ? t(`roles.${role}`) : role);

  return (
    <div className="flex min-h-full flex-col gap-4 px-2 pb-4">
      {groups.map((group) => {
        const headingId = `nav-group-${group.key}`;
        return (
          <div key={group.key}>
            <p
              id={headingId}
              className={cn("eyebrow mb-1 px-3 text-[11px] tracking-[0.06em]", collapsed && "sr-only")}
            >
              {t(`menuGroups.${group.key}`)}
            </p>
            {collapsed ? <hr aria-hidden className="border-border mx-2 mb-2" /> : null}
            <ul aria-labelledby={headingId} className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const label = menuLabel(item.key, t);
                const current = isCurrent(item.href, pathname);

                const link = (
                  <Link
                    href={item.href}
                    // Marks the page for a screen reader, not just with a colour.
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-lg px-3 text-sm",
                      collapsed && "justify-center px-0",
                      current
                        ? "bg-primary-subtle text-primary-subtle-fg font-medium"
                        : "text-muted hover:bg-surface-subtle",
                    )}
                  >
                    {item.icon ? <Icon name={item.icon} size={18} className="shrink-0" /> : null}
                    {/*
                      Collapsed, the label is still in the DOM and still read aloud — it is only
                      hidden visually. Removing it would make the whole nav unusable to a screen
                      reader the moment a sighted colleague collapsed it.
                    */}
                    <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
                    {waiting.get(item.key)?.count ? (
                      <span
                        className={cn(
                          "ms-auto rounded-full px-1.5 text-xs font-medium tabular-nums",
                          waiting.get(item.key)!.overdue
                            ? "bg-danger-subtle text-danger-subtle-fg"
                            : "bg-surface-subtle text-fg",
                          collapsed && "sr-only",
                        )}
                      >
                        {waiting.get(item.key)!.count}
                        <span className="sr-only"> {t("shell.waiting")}</span>
                      </span>
                    ) : null}
                  </Link>
                );

                return <li key={item.key}>{collapsed ? <Tooltip content={label}>{link}</Tooltip> : link}</li>;
              })}
            </ul>
          </div>
        );
      })}
      {actor && !collapsed ? (
        <div className="border-border mt-auto flex items-center gap-3 border-t px-2 pt-4">
          <Avatar name={actor.displayName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{actor.displayName}</p>
            <p className="text-muted truncate text-xs">{actor.roles.map(roleLabel).join(" · ")}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
