"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { trackAccount } from "@/lib/analytics/account";
import { SearchInput } from "@/ui/components/SearchInput";

import { TabBar } from "../../account/AccountTabs";

const DEBOUNCE_MS = 350;

export interface OrdersTabItem {
  key: string;
  label: string;
  count: number | null;
}

/**
 * The orders list's tabs with their counts and its search (account pack Phase 2 item 3). The search waits for a
 * pause in typing, then puts `q` in the address (so it can be shared and survives a reload) and the API filters
 * (`store.orders.listGroups?q=`, D-453); the result count is announced politely. Tabs report `orders_tab`.
 */
export function OrdersToolbar({
  tabs,
  tab,
  q,
  results,
}: {
  tabs: OrdersTabItem[];
  tab: string;
  q: string;
  results: number;
}) {
  const t = useTranslations("myOrders.list");
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(q);
  const [pending, startTransition] = useTransition();
  const last = useRef(q);

  useEffect(() => {
    const next = value.trim();
    if (next === last.current) return;
    const timer = setTimeout(() => {
      last.current = next;
      const params = new URLSearchParams();
      if (tab !== "active") params.set("tab", tab);
      if (next) params.set("q", next);
      const query = params.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
      if (next) trackAccount("orders_search", { length: next.length });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, tab, pathname, router]);

  const hrefOf = (key: string) => {
    const params = new URLSearchParams();
    if (key !== "active") params.set("tab", key);
    if (q) params.set("q", q);
    const query = params.toString();
    return query ? `/account/orders?${query}` : "/account/orders";
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <TabBar
        label={t("tabsLabel")}
        items={tabs.map((item) => ({
          key: item.key,
          href: hrefOf(item.key),
          label: item.label,
          count: item.count,
          current: item.key === tab,
        }))}
        onSelect={(key) => trackAccount("orders_tab", { tab: key })}
      />
      <div className="w-full sm:ms-auto sm:w-auto sm:max-w-[22.5rem] sm:min-w-[12.5rem] sm:flex-1">
        <SearchInput
          value={value}
          onValueChange={setValue}
          clearLabel={t("searchClear")}
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          aria-busy={pending || undefined}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {q ? t("searchResults", { count: results }) : ""}
      </p>
    </div>
  );
}
