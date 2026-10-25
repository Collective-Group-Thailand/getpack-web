"use client";

import { createContext, createElement, useContext, useSyncExternalStore } from "react";

import { COMPARE_LIMIT } from "./compare-limit";

/**
 * The styles chosen to compare — a per-viewer convenience, kept in this browser so the choice
 * survives moving between the library and a style's page. Storage may be unavailable (a private
 * window): the choice then lasts the page.
 *
 * How many is staff's to set (`store.style-library.settings.compareLimit`); a page that read it
 * wraps its content in `CompareLimitProvider`. Without it, D-246's three.
 */

export { COMPARE_LIMIT };
/** Never more kept in storage than any limit staff can set (`compareLimit` ≤ 6). */
const STORED_MAX = 6;

const CompareLimitContext = createContext(COMPARE_LIMIT);

export function CompareLimitProvider({ limit, children }: { limit?: number | null; children: React.ReactNode }) {
  return createElement(CompareLimitContext.Provider, { value: limit ?? COMPARE_LIMIT }, children);
}

const KEY = "pk_style_compare";

let codes: string[] = read();
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string").slice(0, STORED_MAX) : [];
  } catch {
    return [];
  }
}

function write(next: string[]) {
  codes = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the in-memory choice still works for this page.
  }
  listeners.forEach((l) => l());
}

const EMPTY: string[] = [];

export function useCompare() {
  const limit = useContext(CompareLimitContext);
  const stored = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => codes,
    () => EMPTY,
  );
  // A limit lowered since the choice was made shows (and compares) only the first ones.
  const current = stored.length > limit ? stored.slice(0, limit) : stored;
  return {
    codes: current,
    limit,
    has: (code: string) => current.includes(code),
    full: current.length >= limit,
    /** `false` when the limit refused it — the caller says so (a toast). */
    toggle: (code: string): boolean => {
      if (current.includes(code)) {
        write(current.filter((c) => c !== code));
        return true;
      }
      if (current.length >= limit) return false;
      write([...current, code]);
      return true;
    },
    remove: (code: string) => write(current.filter((c) => c !== code)),
    clear: () => write([]),
  };
}
