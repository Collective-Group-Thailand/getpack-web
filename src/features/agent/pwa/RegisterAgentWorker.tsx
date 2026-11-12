"use client";

import { useEffect } from "react";

import { serviceWorkerPath } from "@/lib/push/usePushSubscription";

/**
 * Registers getpack Agent's worker (`/agent-sw.js`, D-467) once the page has loaded: the offline shell and push both
 * need it, and an installable app needs a worker in control. Renders nothing; a browser without workers loses only
 * the offline page.
 */
export function RegisterAgentWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () =>
      void navigator.serviceWorker.register(serviceWorkerPath("agent"), { scope: "/" }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
