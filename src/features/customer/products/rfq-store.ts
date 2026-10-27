"use client";

import { useSyncExternalStore } from "react";

/**
 * The /products "ใบขอราคา" tray (prompt item 8): the made-to-spec, stock and service items a visitor
 * wants priced together. Kept in this browser (localStorage, in try/catch — a private window or
 * blocked storage keeps the tray for the page only) so it survives moving between the hub, category
 * pages and product pages. An item leaves the tray when it becomes a line of the account's draft
 * RFQ basket (`store.rfqBaskets`, D-301) — that basket is the account-side copy.
 *
 * Each entry keeps its product reference (DECISIONS-STAGE-A §4): slug or SKU, product type, names.
 */
export interface TrayItem {
  kind: "catalog" | "stock";
  /** Catalogue slug or stock SKU. */
  key: string;
  productTypeCode: string | null;
  categoryCode: string | null;
  nameTh: string;
  nameEn: string;
}

/** A draft basket holds at most 20 lines (D-301); the tray holds no more than it can turn into. */
export const TRAY_MAX = 20;
export const TRAY_STORAGE_KEY = "pk_rfq_tray";

const EMPTY: TrayItem[] = [];
let items: TrayItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

const isItem = (value: unknown): value is TrayItem => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.kind === "catalog" || v.kind === "stock") &&
    typeof v.key === "string" &&
    v.key !== "" &&
    typeof v.nameTh === "string" &&
    typeof v.nameEn === "string" &&
    (v.productTypeCode === null || typeof v.productTypeCode === "string") &&
    (v.categoryCode === null || typeof v.categoryCode === "string")
  );
};

/** What storage holds, checked entry by entry; anything unreadable is an empty tray. */
export function readTray(): TrayItem[] {
  try {
    if (typeof window === "undefined") return EMPTY;
    const parsed: unknown = JSON.parse(window.localStorage.getItem(TRAY_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return EMPTY;
    const seen = new Set<string>();
    return parsed
      .filter(isItem)
      .filter((item) => {
        const id = trayId(item);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, TRAY_MAX);
  } catch {
    return EMPTY;
  }
}

function current(): TrayItem[] {
  if (!loaded && typeof window !== "undefined") {
    items = readTray();
    loaded = true;
  }
  return items;
}

function write(next: TrayItem[]) {
  items = next;
  loaded = true;
  try {
    window.localStorage.setItem(TRAY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked or full: the tray still works for this page.
  }
  listeners.forEach((listener) => listener());
}

/** One identity per product: a slug and a SKU never collide (`catalog:` / `stock:`). */
export const trayId = (item: Pick<TrayItem, "kind" | "key">) => `${item.kind}:${item.key}`;

export const trayStore = {
  items: current,
  has: (item: Pick<TrayItem, "kind" | "key">) => current().some((entry) => trayId(entry) === trayId(item)),
  /** `false` when the tray is full (the caller says so). Adding an item already in it is a no-op. */
  add(item: TrayItem): boolean {
    const now = current();
    if (now.some((entry) => trayId(entry) === trayId(item))) return true;
    if (now.length >= TRAY_MAX) return false;
    write([...now, item]);
    return true;
  },
  remove(item: Pick<TrayItem, "kind" | "key">) {
    write(current().filter((entry) => trayId(entry) !== trayId(item)));
  },
  clear() {
    write([]);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    // Another tab changed the tray: re-read it.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== TRAY_STORAGE_KEY) return;
      items = readTray();
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  /** Tests only: forget what was read, so the next read comes from storage again. */
  reset() {
    items = EMPTY;
    loaded = false;
  },
};

export function useTray(): TrayItem[] {
  return useSyncExternalStore(trayStore.subscribe, current, () => EMPTY);
}
