"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

/** One page of an area (orders: the desk, reorders, call-offs), as the area's `SectionNav` declared it. */
export interface SubnavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const SubnavContext = createContext<{
  items: readonly SubnavItem[] | null;
  set: (items: readonly SubnavItem[] | null) => void;
} | null>(null);

/**
 * Where an area's pages go: the page's `SectionNav` hands them to the shell, and the sidebar lists them under the
 * area's entry — so the content starts with at most one tab row (the list's views), never two stacked underline rows.
 */
export function SubnavProvider({ children }: { children: React.ReactNode }) {
  const [items, set] = useState<readonly SubnavItem[] | null>(null);
  const value = useMemo(() => ({ items, set }), [items]);
  return <SubnavContext.Provider value={value}>{children}</SubnavContext.Provider>;
}

/** The current area's pages, for the sidebar. */
export function useSubnavItems() {
  return useContext(SubnavContext)?.items ?? null;
}

/** Hands an area's pages to the sidebar while the page is open; `false` when there is no shell to take them. */
export function usePublishSubnav(items: readonly SubnavItem[]) {
  const context = useContext(SubnavContext);
  const set = context?.set;
  const key = JSON.stringify(items);
  useEffect(() => {
    if (!set) return;
    set(JSON.parse(key) as SubnavItem[]);
    return () => set(null);
  }, [set, key]);
  return Boolean(context);
}

/** Whether an area page is the one open: exact for the area's home, by prefix for the others. */
export function isSubnavCurrent(item: SubnavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
