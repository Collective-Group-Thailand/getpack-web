"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis } from "./api";

/**
 * The dashboard's queue summaries (`admin.dashboard.get`): only the queues this person may work,
 * with their counts and SLA state, shared by every queue tab. A tab whose key the API does not
 * send shows no count.
 */
export function useQueues() {
  return useQuery({
    queryKey: queryKeys.list("admin", "dashboard"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/dashboard")).data!,
    staleTime: STALE_TIME.live,
    refetchInterval: 60_000,
  });
}

export interface QueueTab {
  /** The `?queue=` value, or `null` for "everything". */
  value: string | null;
  label: string;
  /** The dashboard key whose count this tab shows, e.g. `orders.waiting_payment`. */
  countKey?: string;
}

/**
 * Work queues first (F2 A.3): a list opens on actionable queues with counts and SLA state.
 * Links, not tabs — each queue is a URL someone can bookmark or send, and the back button works.
 */
export function QueueTabs({
  tabs,
  param = "queue",
  label,
  hideEmpty = false,
}: {
  tabs: readonly QueueTab[];
  param?: string;
  label: string;
  /** Leave out a counted tab with nothing in it, unless it is the one open (UX audit, /companies). */
  hideEmpty?: boolean;
}) {
  const t = useTranslations("console.queues");
  const format = useFormat();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(param);
  const queues = useQueues().data?.queues ?? [];

  return (
    <nav aria-label={label} className="border-border -mb-px flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => {
        const summary = tab.countKey ? queues.find((queue) => queue.key === tab.countKey) : undefined;
        if (hideEmpty && summary && summary.count === 0 && current !== tab.value) return null;
        const href = tab.value ? `${pathname}?${param}=${encodeURIComponent(tab.value)}` : pathname;
        const active = current === tab.value || (!current && tab.value === null);
        return (
          <Link
            // Not "all": a list whose default tab is a queue may also have a tab valued "all" (orders),
            // and two "all" keys was the duplicate-key error the UX audit saw on /orders (bug #5).
            key={tab.value === null ? "\u0000default" : tab.value}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              active ? "border-primary text-fg" : "text-muted hover:text-fg border-transparent",
            )}
          >
            {tab.label}
            {summary ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  summary.overdueCount > 0 ? "bg-danger-subtle text-danger-subtle-fg" : "bg-surface-subtle text-muted",
                )}
              >
                {format.number(summary.count)}
                {summary.overdueCount > 0 ? (
                  <span className="sr-only">{t("overdue", { count: summary.overdueCount })}</span>
                ) : null}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
