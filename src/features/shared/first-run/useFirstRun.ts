"use client";

import { useEffect, useState } from "react";

/**
 * Whether this browser has seen a first-run hint (U5.2): read after hydration, remembered when it
 * is dismissed. A per-viewer convenience in local storage — never data, and a blocked storage just
 * means the hint shows again.
 */
export function useFirstRun(key: string): { show: boolean; dismiss: () => void; reopen: () => void } {
  const storageKey = `packio.firstRun.${key}`;
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(storageKey) === "1";
    } catch {
      seen = true;
    }
    // Decided in the browser only: the server cannot know what this browser has seen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setShow(true);
  }, [storageKey]);
  return {
    show,
    dismiss: () => {
      setShow(false);
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // Storage blocked: it shows again next time, which is harmless.
      }
    },
    reopen: () => setShow(true),
  };
}
