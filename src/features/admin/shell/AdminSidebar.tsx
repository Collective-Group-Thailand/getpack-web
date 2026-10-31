"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { StaffMe } from "@/lib/api/types";
import { Avatar } from "@/ui/components/Avatar";
import { Tooltip } from "@/ui/components/Tooltip";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { listTotalQuery, useQueues } from "../console/queues";
import { MENU_BADGES } from "./badges";
import { groupSidebar, isCurrent, menuLabel, type SidebarItem } from "./menu";
import { isSubnavCurrent, type SubnavGroup, type SubnavItem, useSubnavDesks, useSubnavItems } from "./subnav";

// Which groups the reader opened or closed, remembered on this device (as the factory app does).
const STORE = "getpack.admin.sidebar.open";
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
let memory = "{}";
const readFolds = () => {
  try {
    return window.localStorage.getItem(STORE) ?? memory;
  } catch {
    return memory; // private mode or blocked storage: remembered for this page only
  }
};
const writeFolds = (next: Record<string, boolean>) => {
  memory = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORE, memory);
  } catch {
    // not remembered on this device — fine
  }
  listeners.forEach((listener) => listener());
};

/** More entries than this and the groups fold and a menu search appears (the factory app's rule). */
const FOLD_FROM = 14;

/**
 * The back-office navigation, rendered from the entitlements `/v1/admin/me` returned.
 *
 * Nothing here consults a role. If an entry is in the list the API sent, this person may open
 * it; if it is not, it does not exist as far as this zone is concerned (D-140, ADR-0005). The
 * groups are presentation — each is a list named by its heading, so a screen reader can skip a
 * whole group — and never add or hide an entry.
 *
 * Styled as the factory app's menu (product owner, 2026-10-13): a white panel, the page you are on
 * marked by a teal edge and teal words on a tint, body-size rows. A long menu folds — the overview
 * and the group you are in stay open, what the reader opens or closes is remembered — and gets a
 * search box ("/" jumps to it, Enter opens the first match). The collapsed rail shows every icon.
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
  const router = useRouter();
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
  // A list with work queues counts the tab it opens on, with that tab's own read — the same number the tab shows.
  const badged = items.filter((item) => MENU_BADGES[item.key]);
  const totals = useQueries({ queries: badged.map((item) => listTotalQuery(MENU_BADGES[item.key]!.source)) });
  badged.forEach((item, index) => {
    const total = totals[index]?.data;
    if (typeof total === "number") waiting.set(item.key, { count: total, overdue: false });
    else waiting.delete(item.key);
  });
  const subnav = useSubnavItems();
  const desks = useSubnavDesks();
  const roleLabel = (role: string) => (t.has(`roles.${role}`) ? t(`roles.${role}`) : role);
  const label = (key: string) => menuLabel(key, t);

  const many = !collapsed && items.length > FOLD_FROM;
  const activeGroup = groups.find((group) => group.items.some((item) => isCurrent(item.href, pathname)))?.key;
  const stored = useSyncExternalStore(subscribe, readFolds, () => "{}");
  const open = useMemo(() => {
    try {
      return JSON.parse(stored) as Record<string, boolean>;
    } catch {
      return {};
    }
  }, [stored]);
  const isOpen = (key: string) => !many || key === activeGroup || (open[key] ?? key === "overview");
  const toggle = (key: string) => writeFolds({ ...open, [key]: !isOpen(key) });

  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // "/" jumps to the menu search from anywhere that is not a text field.
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (!search.current || search.current.offsetParent === null) return;
      event.preventDefault();
      search.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const needle = many ? query.trim().toLocaleLowerCase("th") : "";
  const shown = needle
    ? groups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => label(item.key).toLocaleLowerCase("th").includes(needle) || item.key.includes(needle),
          ),
        }))
        .filter((group) => group.items.length)
    : groups;
  const first = shown[0]?.items[0];

  return (
    // The menu scrolls; the account block stays at the foot of the column (it was cut off on a 900 px screen).
    <div className="flex min-h-full flex-col md:h-[calc(100dvh-5.5rem)] md:min-h-0">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-2 pb-4 md:gap-3">
        {many ? (
          <div className="relative px-1">
            <Icon
              name="search"
              size={16}
              className="text-muted pointer-events-none absolute start-4 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              ref={search}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && first) {
                  setQuery("");
                  router.push(first.href);
                }
                if (event.key === "Escape") setQuery("");
              }}
              aria-label={t("shell.searchMenu")}
              placeholder={t("shell.searchMenuPlaceholder")}
              className="border-border bg-surface focus-visible:outline-primary h-9 w-full rounded-lg border ps-9 pe-3 text-sm"
            />
          </div>
        ) : null}
        {shown.length === 0 ? <p className="text-muted px-3 text-sm">{t("shell.noMenuMatch")}</p> : null}
        {shown.map((group) => {
          const headingId = `nav-group-${group.key}`;
          const listId = `nav-list-${group.key}`;
          const expanded = needle !== "" || isOpen(group.key);
          return (
            <div key={group.key} className="flex flex-col gap-1">
              {many && !needle ? (
                <button
                  type="button"
                  id={headingId}
                  onClick={() => toggle(group.key)}
                  aria-expanded={expanded}
                  aria-controls={listId}
                  className="text-muted hover:text-fg flex items-center justify-between rounded-md px-3 pt-1 text-start text-sm font-semibold"
                >
                  <span>{t(`menuGroups.${group.key}`)}</span>
                  <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} aria-hidden="true" />
                </button>
              ) : (
                <p id={headingId} className={cn("text-muted px-3 pt-1 text-sm font-semibold", collapsed && "sr-only")}>
                  {t(`menuGroups.${group.key}`)}
                </p>
              )}
              {collapsed ? <hr aria-hidden className="border-border mx-2 mb-1" /> : null}
              <ul
                id={listId}
                aria-labelledby={headingId}
                className={cn("flex flex-col gap-0.5", !expanded && "hidden")}
              >
                {group.items.map((item) => {
                  const name = label(item.key);
                  const current = isCurrent(item.href, pathname);
                  const queue = waiting.get(item.key);

                  const link = (
                    <Link
                      href={`${item.href}${MENU_BADGES[item.key]?.search ?? ""}`}
                      onClick={() => setQuery("")}
                      // Marks the page for a screen reader, not just with a colour.
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 border-s-[3px] px-3 text-base md:min-h-9 md:gap-2.5",
                        collapsed ? "justify-center rounded-lg border-transparent px-0" : "rounded-e-lg",
                        // The page you are on: a teal edge and teal words on a tint — seen at a glance, not guessed.
                        current
                          ? cn("bg-primary-subtle text-primary-subtle-fg font-semibold", !collapsed && "border-primary")
                          : "text-fg hover:bg-bg border-transparent font-medium",
                      )}
                    >
                      {item.icon ? (
                        <Icon
                          name={item.icon}
                          size={20}
                          className={cn("shrink-0 md:size-[18px]", current ? "text-primary" : "text-muted")}
                          aria-hidden="true"
                        />
                      ) : null}
                      {/*
                      Collapsed, the label is still in the DOM and still read aloud — it is only
                      hidden visually. Removing it would make the whole nav unusable to a screen
                      reader the moment a sighted colleague collapsed it.
                    */}
                      <span className={cn("truncate", collapsed && "sr-only")}>{name}</span>
                      {queue?.count ? (
                        <span
                          className={cn(
                            "rounded-control ms-auto px-1.5 text-xs font-medium tabular-nums",
                            queue.overdue ? "bg-danger-subtle text-danger-subtle-fg" : "bg-bg text-fg",
                            collapsed && "sr-only",
                          )}
                        >
                          {queue.count}
                          <span className="sr-only"> {t("shell.waiting")}</span>
                        </span>
                      ) : null}
                    </Link>
                  );

                  return (
                    <li key={item.key}>
                      {collapsed ? <Tooltip content={name}>{link}</Tooltip> : link}
                      {/* The workspace's desks (finance) or the area's own pages (its `SectionNav`), under the entry you are in. */}
                      {current && !collapsed && (desks?.length || subnav?.length) ? (
                        <SubnavTree label={name} desks={desks} pages={subnav} pathname={pathname} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {actor && !collapsed ? (
        <div className="border-border mx-2 mt-auto flex shrink-0 items-center gap-3 border-t px-2 pt-3">
          <Avatar name={actor.displayName} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{actor.displayName}</p>
            <p className="text-muted truncate text-sm">{actor.roles.map(roleLabel).join(" · ")}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const SUB_LINK = "flex min-h-11 items-center rounded-lg px-2.5 text-sm md:min-h-8";

function SubnavLink({ page, pathname }: { page: SubnavItem; pathname: string }) {
  const here = isSubnavCurrent(page, pathname);
  return (
    <Link
      href={page.href}
      aria-current={here ? "page" : undefined}
      className={cn(
        SUB_LINK,
        here
          ? "text-primary-subtle-fg bg-primary-subtle font-semibold"
          : "text-muted hover:bg-bg hover:text-fg font-medium",
      )}
    >
      {page.label}
    </Link>
  );
}

/**
 * What sits under the open entry: a workspace's desks in their named runs (finance), with the open desk's own pages
 * one step further in; or, for a plain area, its pages. The current desk reads in ink (its page carries the tint), so
 * exactly one row is marked as "here".
 */
function SubnavTree({
  label,
  desks,
  pages,
  pathname,
}: {
  label: string;
  desks: readonly SubnavGroup[] | null;
  pages: readonly SubnavItem[] | null;
  pathname: string;
}) {
  const rail = "border-border ms-[1.375rem] mt-0.5 mb-1 flex flex-col border-s ps-2";
  if (!desks?.length) {
    return (
      <ul aria-label={label} className={rail}>
        {(pages ?? []).map((page) => (
          <li key={page.href}>
            <SubnavLink page={page} pathname={pathname} />
          </li>
        ))}
      </ul>
    );
  }
  // The desk whose pages are open: the longest desk path the address starts with (the home is exact).
  const open = desks
    .flatMap((group) => group.items)
    .filter((desk) => isSubnavCurrent(desk, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <div aria-label={label} role="group" className={cn(rail, "gap-2")}>
      {desks.map((group) => (
        <div key={group.label} className="flex flex-col">
          <p className="text-muted px-2.5 pt-1 pb-0.5 text-xs font-semibold">{group.label}</p>
          <ul aria-label={group.label} className="flex flex-col">
            {group.items.map((desk) => {
              const isOpen = desk.href === open?.href;
              const own = isOpen && pages?.length ? pages : null;
              const exact = pathname === desk.href;
              return (
                <li key={desk.href}>
                  {own ? (
                    <>
                      <Link
                        href={desk.href}
                        aria-current={exact ? "page" : undefined}
                        className={cn(
                          SUB_LINK,
                          exact
                            ? "text-primary-subtle-fg bg-primary-subtle font-semibold"
                            : "text-fg hover:bg-bg font-semibold",
                        )}
                      >
                        {desk.label}
                      </Link>
                      <ul aria-label={desk.label} className="border-border ms-3 mb-1 flex flex-col border-s ps-1.5">
                        {own
                          .filter((page) => page.href !== desk.href)
                          .map((page) => (
                            <li key={page.href}>
                              <SubnavLink page={page} pathname={pathname} />
                            </li>
                          ))}
                      </ul>
                    </>
                  ) : (
                    <SubnavLink page={isOpen ? { ...desk, exact: false } : desk} pathname={pathname} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
