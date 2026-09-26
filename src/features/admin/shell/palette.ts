"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { z } from "zod";

import { queryKeys } from "@/lib/api/query-keys";
import type { searchResultType } from "@/lib/api/requests/admin-console";
import { browserRequests } from "@/lib/api/requests/browser";
import type { CommandItem } from "@/ui/components/CommandPalette";
import type { IconName } from "@/ui/icons";

import { menuLabel, type SidebarItem } from "./menu";

type ResultType = z.output<typeof searchResultType>;

/** Where each kind of search hit opens, in this zone's own routes. */
export const RESULT_ROUTES: Record<ResultType, { path: (id: string) => string; icon: IconName }> = {
  order: { path: (id) => `/orders/${id}`, icon: "package" },
  order_group: { path: (id) => `/orders/groups/${id}`, icon: "layers" },
  quote: { path: (id) => `/quotations/${id}`, icon: "receipt" },
  rfq: { path: (id) => `/rfq/${id}`, icon: "chat" },
  customer: { path: (id) => `/customers/${id}`, icon: "user" },
  company: { path: (id) => `/companies/${id}`, icon: "building" },
  factory: { path: (id) => `/partners/${id}`, icon: "factory" },
  shipment: { path: (id) => `/shipments/${id}`, icon: "truck" },
  claim: { path: (id) => `/claims/${id}`, icon: "flag" },
  user: { path: (id) => `/users/${id}`, icon: "users" },
};

/** Characters before the API is asked — the request's own minimum (`admin.search`). */
const MIN_QUERY = 2;

/**
 * What ⌘K offers for a query (F2 §2: jump to order / group / RFQ / customer / company / factory
 * by code, phone, e-mail): the screens this person may open, matched on their translated
 * names, then the records the API finds — which only the API may decide this person can see.
 */
export function usePaletteItems(
  query: string,
  screens: readonly SidebarItem[],
  close: () => void,
): {
  items: CommandItem[];
  loading: boolean;
} {
  const t = useTranslations("admin");
  const router = useRouter();
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useQuery({
    queryKey: queryKeys.list("admin", "search", { q: debounced }),
    queryFn: () => browserRequests().call("GET /v1/admin/search", { query: { q: debounced, limit: 10 } }),
    enabled: debounced.length >= MIN_QUERY,
    staleTime: 30_000,
  });

  const go = (href: string) => {
    close();
    router.push(href);
  };

  const needle = query.trim().toLowerCase();
  const screenItems: CommandItem[] = screens
    .map((screen) => ({ screen, label: menuLabel(screen.key, t) }))
    .filter(({ label }) => !needle || label.toLowerCase().includes(needle))
    .map(({ screen, label }) => ({
      id: `screen:${screen.key}`,
      label,
      group: t("palette.screens"),
      icon: screen.icon,
      onSelect: () => go(screen.href),
    }));

  const recordItems: CommandItem[] =
    debounced.length >= MIN_QUERY
      ? (search.data?.data ?? []).map((result) => ({
          id: `${result.type}:${result.id}`,
          label: result.title,
          hint: [result.code, result.subtitle].filter(Boolean).join(" · "),
          group: t(`palette.types.${result.type}`),
          icon: RESULT_ROUTES[result.type].icon,
          onSelect: () => go(RESULT_ROUTES[result.type].path(result.id)),
        }))
      : [];

  return { items: [...screenItems, ...recordItems], loading: search.isFetching };
}
