"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { isCurrent, type AgentNavItem } from "./nav";

/**
 * The phone's tab bar (< 640 px): four destinations under the thumb, 56 px tall plus the home indicator's inset.
 * The tab you are on carries a tint behind its icon as well as its colour, so it never rests on colour alone.
 */
export function AgentTabBar({ items }: { items: readonly AgentNavItem[] }) {
  const t = useTranslations("agentZone.nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("label")}
      className="border-border bg-surface z-sticky fixed inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)] ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)] sm:hidden print:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const current = isCurrent(item.href, pathname);
          return (
            <li key={item.key} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs leading-tight",
                  "focus-visible:ring-focus-ring outline-none focus-visible:ring-2 focus-visible:ring-inset",
                  "active:bg-bg-subtle motion-safe:transition-colors motion-safe:duration-100",
                  current ? "text-primary-subtle-fg font-semibold" : "text-muted font-medium",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full",
                    current && "bg-primary-subtle",
                  )}
                >
                  <Icon name={item.icon} size={22} className={current ? "text-primary" : undefined} aria-hidden="true" />
                </span>
                <span className="max-w-full truncate">{t(item.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The tablet rail (640–1023 px): an icon over a short label, 72 px wide, beside the page. */
export function AgentRail({ items }: { items: readonly AgentNavItem[] }) {
  const t = useTranslations("agentZone.nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("label")}
      className="border-border bg-surface sticky top-16 hidden h-[calc(100dvh-4rem)] w-[4.5rem] shrink-0 border-e ps-[env(safe-area-inset-left)] sm:block lg:hidden print:hidden"
    >
      <ul className="flex flex-col gap-1 px-1.5 py-3">
        {items.map((item) => {
          const current = isCurrent(item.href, pathname);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-center text-xs leading-tight",
                  "focus-visible:ring-focus-ring outline-none focus-visible:ring-2",
                  "hover:bg-bg motion-safe:transition-colors motion-safe:duration-100",
                  current ? "text-primary-subtle-fg font-semibold" : "text-muted font-medium",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full",
                    current && "bg-primary-subtle",
                  )}
                >
                  <Icon name={item.icon} size={22} className={current ? "text-primary" : undefined} aria-hidden="true" />
                </span>
                <span className="line-clamp-2 break-words">{t(item.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The desktop sidebar (≥ 1024 px): the destinations in three groups under small headings. */
export function AgentSidebar({
  groups,
}: {
  groups: readonly { key: "sell" | "earn" | "account"; items: readonly AgentNavItem[] }[];
}) {
  const t = useTranslations("agentZone.nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("label")}
      className="border-border bg-surface sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto border-e lg:block print:hidden"
    >
      <div className="flex flex-col gap-6 px-3 py-5">
        {groups.map((group) => (
          <div key={group.key}>
            <h2 className="text-muted px-3 pb-1.5 text-xs font-medium">{t(`groups.${group.key}`)}</h2>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const current = isCurrent(item.href, pathname);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-lg px-3 text-sm",
                        "focus-visible:ring-focus-ring outline-none focus-visible:ring-2",
                        "motion-safe:transition-colors motion-safe:duration-100",
                        current
                          ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                          : "text-fg hover:bg-bg font-medium",
                      )}
                    >
                      <Icon
                        name={item.icon}
                        size={20}
                        className={current ? "text-primary" : "text-muted"}
                        aria-hidden="true"
                      />
                      {t(item.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
