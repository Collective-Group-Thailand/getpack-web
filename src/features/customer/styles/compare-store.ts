"use client";

import { useSyncExternalStore } from "react";

/**
 * The styles chosen to compare (D-246: up to three) — a per-viewer convenience, kept in this
 * browser so the choice survives moving between the library and a style's page. Storage may be
 * unavailable (a private window): the choice then lasts the page.
 */

export const COMPARE_LIMIT = 3;
const KEY = "pk_style_compare";

let codes: string[] = read();
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string").slice(0, COMPARE_LIMIT)
      : [];
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
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => codes,
    () => EMPTY,
  );
  return {
    codes: current,
    has: (code: string) => current.includes(code),
    full: current.length >= COMPARE_LIMIT,
    toggle: (code: string) =>
      write(current.includes(code) ? current.filter((c) => c !== code) : [...current, code].slice(0, COMPARE_LIMIT)),
    clear: () => write([]),
  };
}
