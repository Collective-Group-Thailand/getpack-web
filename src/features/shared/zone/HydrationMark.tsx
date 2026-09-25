"use client";

import { useEffect } from "react";

/**
 * Stamps `data-hydrated` on `<html>` once React has taken over the page.
 *
 * A control exists in the server HTML before the JavaScript that makes it work has hydrated, and
 * a click in that window is silently dropped — which is why several F1 e2e helpers retry. This
 * gives tests (and nothing else) a real signal to wait for instead. It carries no data and is
 * invisible to people.
 */
export function HydrationMark() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
