"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the viewport is at least `px` wide, live. The server and the first paint assume a phone (mobile-first),
 * so a sheet is what renders before hydration; the dialog takes over from 640 px once the script runs.
 */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
