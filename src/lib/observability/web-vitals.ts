/**
 * Field Web Vitals, posted to the API through the zone BFF.
 *
 * Lighthouse CI measures a cold, throttled, synthetic load; it cannot tell you that INP is
 * fine on a desktop and terrible on the mid-range Android the design system names as the
 * reference device (design-system.md §6). Only field data does, which is why
 * `docs/performance-budgets.md` asks for both.
 *
 * `{store,admin,partner}.rum.recordWebVital` (contract v0.6.0, `rum.web-vitals`) takes one sample
 * as `WebVitalDto` and answers 202. Its `route` is the route *pattern*, never the URL:
 * `/orders/[orderId]`, not `/orders/PK-2569-00042`. A real path would put an order code — and on
 * some screens a tracking token — into an analytics store, which is both a PDPA problem (D-144)
 * and useless for aggregation; the API refuses one with a 422.
 */

import type { Schemas } from "@/lib/api/types";
import type { Zone } from "@/lib/zones";

export type WebVitalReport = Schemas["WebVitalDto"];

/** The API names the customer zone after its surface. */
export function rumZone(zone: Zone): Schemas["RumZone"] {
  return zone === "customer" ? "store" : zone;
}

/**
 * Metrics worth sending. Everything else `next/web-vitals` reports is a Next-internal timing
 * that means nothing without the others, and sending them all would triple the traffic for
 * numbers no budget is written against.
 */
const REPORTED: ReadonlySet<string> = new Set<Schemas["WebVitalName"]>(["LCP", "INP", "CLS", "FCP", "TTFB"]);

export function shouldReport(name: string): name is Schemas["WebVitalName"] {
  return REPORTED.has(name);
}

/**
 * `sendBeacon` where it exists, `fetch` with `keepalive` otherwise.
 *
 * Both survive the page being closed, which is exactly when the last and most interesting
 * metrics arrive — an ordinary `fetch` is cancelled on unload and CLS, the metric that is only
 * final when the page goes away, would almost never be recorded.
 *
 * Returns `false` when the browser refused to queue it. Nothing retries: a lost sample is a
 * lost sample, and retrying performance telemetry during teardown would cost the user more
 * than the datapoint is worth.
 */
export function sendReport(endpoint: string, report: WebVitalReport): boolean {
  const body = JSON.stringify(report);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    // `type` matters: without it the browser sends `text/plain` and the API rejects the body.
    return navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
  }

  if (typeof fetch !== "function") return false;

  void fetch(endpoint, {
    method: "POST",
    body,
    keepalive: true,
    headers: { "content-type": "application/json", "x-packio-csrf": "1" },
  }).catch(() => {
    // Telemetry must never surface as an error to the person using the page.
  });
  return true;
}
