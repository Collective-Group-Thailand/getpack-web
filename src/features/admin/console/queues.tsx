"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { ViewTabs } from "@/ui/components/ViewTabs";

import { adminBrowserApis } from "./api";
import { parseListState, toCountQuery } from "./list-state";
import type { ListResource } from "./resource";

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
  /**
   * The dashboard key whose count this tab shows, e.g. `orders.waiting_payment` — only on a list that has no
   * `countFrom` yet. The dashboard counts by its own rules, so it can disagree with the rows; `countFrom` cannot.
   */
  countKey?: string;
}

/** Where a tab's count comes from: the same list read as the tab opens, for its `meta.total` only. */
export interface TabCountSource {
  // A list of any row type: only `meta.total` is read.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource: ListResource<any>;
  /** The list's query for that tab (its filters and search), without paging. */
  query: Record<string, string | number>;
}

/**
 * The read behind a tab's count (and the sidebar badge that names the same tab): page 1 of one row, so the number is
 * the list's own `meta.total` — what the tab opens is what it counts.
 */
export function listTotalQuery({ resource, query }: TabCountSource) {
  const read = { ...query, page: 1, perPage: 1 };
  return {
    // Named by the list too: two lists of one resource (orders' queues and "all") share `key` but not their rows.
    queryKey: queryKeys.list("admin", resource.key, { ...read, total: resource.resourceName ?? resource.key }),
    queryFn: async () => (await resource.fetch(adminBrowserApis(), read)).meta.total,
    staleTime: STALE_TIME.live,
    refetchInterval: 60_000,
  };
}

/** The query a list sends for one of its tabs: the URL's search and filters, the tab's own value in `param`. */
export function tabQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource: ListResource<any>,
  params: { get(name: string): string | null; forEach(cb: (value: string, key: string) => void): void },
  param: string,
  value: string | null,
): Record<string, string | number> {
  const state = parseListState(params, resource.defaults);
  const filters = { ...state.filters };
  // A list whose filters do not include the tab's parameter (orders' "all" tab) is never sent it.
  const takes = !resource.defaults?.filterKeys || resource.defaults.filterKeys.includes(param);
  // No value is the list's default view: with no parameter in the address the list reads its default filter (the
  // certificates still awaited), so the count reads the same.
  const fallback = resource.defaults?.filters?.[param];
  if (!takes || (value === null && fallback === undefined)) delete filters[param];
  else filters[param] = value ?? fallback!;
  return toCountQuery({ ...state, filters });
}

/**
 * Work queues first (F2 A.3): a list opens on actionable queues, drawn as the segmented view tabs every desk list
 * shares (`ViewTabs`). Links, not tabs — each queue is a URL someone can bookmark or send, and the back button works.
 *
 * With `countFrom`, each tab's count is the rows that tab lists (the same read, `meta.total`, with the same search and
 * filters), so the count and the rows can never disagree; the sidebar badge reads the same source.
 */
export function QueueTabs({
  tabs,
  param = "queue",
  label,
  hideEmpty = false,
  countFrom,
}: {
  tabs: readonly QueueTab[];
  param?: string;
  label: string;
  /** Leave out a counted tab with nothing in it, unless it is the one open (UX audit, /companies). */
  hideEmpty?: boolean;
  /**
   * The list behind the tabs (or, per tab, the list it opens), read with this page's search and filters and the
   * tab's own value, for a count equal to its rows.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  countFrom?: ListResource<any> | ((value: string | null) => ListResource<any> | null);
}) {
  const format = useFormat();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(param);
  const queues = useQueues().data?.queues ?? [];
  const totals = useQueries({
    queries: tabs.map((tab) => {
      const resource = typeof countFrom === "function" ? countFrom(tab.value) : (countFrom ?? null);
      return resource
        ? listTotalQuery({ resource, query: tabQuery(resource, params, param, tab.value) })
        : { queryKey: ["admin", "no-count", tab.value], queryFn: () => null, enabled: false };
    }),
  });

  const items = tabs.flatMap((tab, index) => {
    const active = current === tab.value || (!current && tab.value === null);
    const counted = countFrom ? (totals[index]?.data ?? null) : null;
    const summary = !countFrom && tab.countKey ? queues.find((queue) => queue.key === tab.countKey) : undefined;
    const count = typeof counted === "number" ? counted : summary ? summary.count : null;
    if (hideEmpty && count === 0 && !active) return [];
    // Keep the rest of the address (the search) when switching tabs; the page goes back to 1.
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    if (tab.value) next.set(param, tab.value);
    else next.delete(param);
    const query = next.toString();
    return [
      {
        // Not "all": a list whose default tab is a queue may also have a tab valued "all" (orders),
        // and two "all" keys was the duplicate-key error the UX audit saw on /orders (bug #5).
        key: tab.value === null ? "\u0000default" : tab.value,
        href: query ? `${pathname}?${query}` : pathname,
        label: tab.label,
        count: count === null ? null : format.number(count),
        active,
      },
    ];
  });
  const currentKey = items.find((item) => item.active)?.key ?? "";
  return <ViewTabs label={label} items={items} current={currentKey} />;
}
