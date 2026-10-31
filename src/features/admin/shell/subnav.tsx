"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

/** One page of an area (orders: the desk, reorders, call-offs), as the area's `SectionNav` declared it. */
export interface SubnavItem {
  href: string;
  label: string;
  exact?: boolean;
}

/** A named run of desks inside a large workspace (finance: daily work, customers, suppliers…). */
export interface SubnavGroup {
  label: string;
  items: readonly SubnavItem[];
}

const SubnavContext = createContext<{
  items: readonly SubnavItem[] | null;
  set: (items: readonly SubnavItem[] | null) => void;
  desks: readonly SubnavGroup[] | null;
  setDesks: (groups: readonly SubnavGroup[] | null) => void;
  /** Whether the sidebar lists what is handed to it (false while it is collapsed to icons). */
  listed: boolean;
} | null>(null);

/**
 * Where an area's pages go: the page's `SectionNav` hands them to the shell, and the sidebar lists them under the
 * area's entry — so the content starts with at most one tab row (the list's views), never two stacked underline rows.
 *
 * A workspace with desks of its own (finance) hands its desks over too: the sidebar nests them, grouped, under the
 * workspace's entry, and the open desk's pages under the desk — one navigation column instead of a second sidebar.
 */
export function SubnavProvider({ children, listed = true }: { children: React.ReactNode; listed?: boolean }) {
  const [items, set] = useState<readonly SubnavItem[] | null>(null);
  const [desks, setDesks] = useState<readonly SubnavGroup[] | null>(null);
  const value = useMemo(() => ({ items, set, desks, setDesks, listed }), [items, desks, listed]);
  return <SubnavContext.Provider value={value}>{children}</SubnavContext.Provider>;
}

/** The current area's pages, for the sidebar. */
export function useSubnavItems() {
  return useContext(SubnavContext)?.items ?? null;
}

/** The current workspace's desks, for the sidebar. */
export function useSubnavDesks() {
  return useContext(SubnavContext)?.desks ?? null;
}

/**
 * Hands an area's pages to the sidebar while the page is open; `false` when no sidebar will list them (no shell, or
 * the sidebar is collapsed to icons) — the page then shows them itself.
 */
export function usePublishSubnav(items: readonly SubnavItem[]) {
  const context = useContext(SubnavContext);
  const set = context?.set;
  const key = JSON.stringify(items);
  useEffect(() => {
    if (!set) return;
    set(JSON.parse(key) as SubnavItem[]);
    return () => set(null);
  }, [set, key]);
  return Boolean(context?.listed);
}

/** Hands a workspace's desks to the sidebar; `false` when no sidebar will list them (see `usePublishSubnav`). */
export function usePublishDesks(groups: readonly SubnavGroup[]) {
  const context = useContext(SubnavContext);
  const set = context?.setDesks;
  const key = JSON.stringify(groups);
  useEffect(() => {
    if (!set) return;
    set(JSON.parse(key) as SubnavGroup[]);
    return () => set(null);
  }, [set, key]);
  return Boolean(context?.listed);
}

/** Whether an area page is the one open: exact for the area's home, by prefix for the others. */
export function isSubnavCurrent(item: SubnavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
