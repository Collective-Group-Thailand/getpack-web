"use client";

import { CSRF_HEADER } from "@/lib/api/client";
import { browserBffUrl } from "@/lib/zones";

import type { AnalyticsEvent, AnalyticsProperties, FunnelEvent } from "./events";

/**
 * Sends a funnel event to Packio's own API through the storefront BFF.
 *
 * Customer zone only: D-102's funnel is about customers, and staff clicking around the back
 * office would be noise in every conversion rate. The zone is fixed here rather than taken as
 * an argument so there is no call site that can get it wrong.
 *
 * Fire-and-forget, `keepalive`, never throws. `order_placed` fires as the page is navigating
 * away, which is exactly when an ordinary fetch is cancelled — and a funnel that loses its
 * last step measures the wrong thing.
 */
export function track(name: FunnelEvent, properties?: AnalyticsProperties): void {
  if (typeof window === "undefined") return;

  const event: AnalyticsEvent = { name, properties, occurredAt: Date.now() };
  const url = browserBffUrl("customer", "/analytics/events");
  const body = JSON.stringify(event);

  if (typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }

  void fetch(url, {
    method: "POST",
    body,
    keepalive: true,
    headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
  }).catch(() => {
    // Measurement must never surface as an error to the person being measured.
  });
}
