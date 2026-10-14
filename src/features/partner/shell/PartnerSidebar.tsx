"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { currentHref } from "./nav";
import type { SidebarGroup } from "./sidebar";

const STORE = "packio.partner.sidebar.open";
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

/**
 * The partner sidebar on tablets and office screens (round 2, Phase 1): the role's destinations in
 * four groups under small group labels, the factory at the top and who is signed in at the foot. It
 * sits inside AppShell's own `<nav>`, so it adds no landmark of its own.
 */
export function PartnerSidebar({
  groups,
  factory,
  user,
}: {
  groups: SidebarGroup[];
  factory: { name: string; status: string | null };
  user: { name: string; roles: string };
}) {
  const t = useTranslations("partner.sidebar");
  const pathname = usePathname();
  const router = useRouter();
  const active = currentHref(
    groups.flatMap((group) => group.items.map((item) => item.href)),
    pathname,
  );
  const activeGroup = groups.find((group) => group.items.some((item) => item.href === active))?.key;
  // Long menus (an owner sees every group) fold: the day's work and the group you are in stay open; what the
  // reader opens or closes is remembered on this device.
  const many = groups.reduce((n, group) => n + group.items.length, 0) > 14;
  const stored = useSyncExternalStore(subscribe, readFolds, () => "{}");
  const open = useMemo(() => {
    try {
      return JSON.parse(stored) as Record<string, boolean>;
    } catch {
      return {};
    }
  }, [stored]);
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
  const isOpen = (key: string) => !many || key === activeGroup || (open[key] ?? key === "daily");
  const toggle = (key: string) => writeFolds({ ...open, [key]: !isOpen(key) });
  const needle = query.trim().toLocaleLowerCase("th");
  const label = (key: string) => t(`items.${key}` as never);
  const shown = needle
    ? groups
        .map((group) => ({ ...group, items: group.items.filter((item) => label(item.key).toLocaleLowerCase("th").includes(needle)) }))
        .filter((group) => group.items.length)
    : groups;
  const first = shown[0]?.items[0];

  return (
    <div className="flex h-full flex-col gap-4 px-2 py-3 md:gap-3">
      <div className="bg-bg rounded-lg px-3 py-2.5 md:py-2">
        <p className="truncate font-semibold">{factory.name}</p>
        {factory.status ? <p className="text-muted text-sm">{factory.status}</p> : null}
      </div>
      {many ? (
        <div className="relative px-1">
          <Icon name="search" size={16} className="text-muted pointer-events-none absolute start-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
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
            aria-label={t("search")}
            placeholder={t("searchPlaceholder")}
            className="border-border bg-surface focus-visible:outline-primary h-9 w-full rounded-lg border ps-9 pe-3 text-sm"
          />
        </div>
      ) : null}
      {shown.length === 0 ? <p className="text-muted px-3 text-sm">{t("noMatch")}</p> : null}
      {shown.map((group) => {
        const expanded = needle !== "" || isOpen(group.key);
        const listId = `sidebar-${group.key}`;
        return (
          <div key={group.key} className="flex flex-col gap-1">
            {many && !needle ? (
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={expanded}
                aria-controls={listId}
                className="text-muted hover:text-fg flex items-center justify-between rounded-md px-3 pt-1 text-start text-sm font-semibold"
              >
                <span>{t(`groups.${group.key}`)}</span>
                <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} aria-hidden="true" />
              </button>
            ) : (
              <p className="text-muted px-3 pt-1 text-sm font-semibold">{t(`groups.${group.key}`)}</p>
            )}
            <ul id={listId} className={cn("flex flex-col gap-0.5", !expanded && "hidden")}>
              {group.items.map((item) => {
                const current = item.href === active;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => setQuery("")}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-e-lg border-s-[3px] px-3 text-base md:min-h-9 md:gap-2.5",
                        // The page you are on: a teal edge and teal words on a tint — seen at a glance, not guessed.
                        current
                          ? "border-primary bg-primary-subtle text-primary-subtle-fg font-semibold"
                          : "text-fg hover:bg-bg border-transparent font-medium",
                      )}
                    >
                      <Icon
                        name={item.icon}
                        size={20}
                        className={cn("md:size-[18px]", current ? "text-primary" : "text-muted")}
                        aria-hidden="true"
                      />
                      {label(item.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div className="border-border mt-auto border-t px-3 pt-3">
        <p className="truncate font-medium">{user.name}</p>
        <p className="text-muted truncate text-sm">{user.roles}</p>
      </div>
    </div>
  );
}
