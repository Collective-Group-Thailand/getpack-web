"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useParams, useSelectedLayoutSegments } from "next/navigation";

import { browserBffUrl, type Zone } from "@/lib/zones";

import { routePattern } from "./route-pattern";
import { rumZone, sendReport, shouldReport } from "./web-vitals";

/**
 * Reports field Web Vitals for the zone it is mounted in.
 *
 * Renders nothing. Mounted once per zone root layout, below the providers, so it is inside
 * the tree whose performance it measures.
 */
export function WebVitals({ zone }: { zone: Zone }) {
  // The route pattern (`/orders/[orderId]`), never the URL: segments alone are the values —
  // the real order code or tracking token — so the parameters are mapped back to their names.
  // See `WebVitalReport.route` and `./route-pattern.ts`.
  const route = routePattern(useSelectedLayoutSegments(), useParams());

  useReportWebVitals((metric) => {
    const { name } = metric;
    if (!shouldReport(name)) return;

    sendReport(rumEndpoint(zone), {
      name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      route,
      zone: rumZone(zone),
    });
  });

  return null;
}

/**
 * Where the browser posts a sample.
 *
 * `browserBffUrl` because both halves matter and both are easy to get wrong: the BFF is always
 * `/bff` from the browser whatever the zone, and the upstream path must start with the zone's
 * `apiPrefix` or the allow-list answers 404 rather than recording anything.
 */
export function rumEndpoint(zone: Zone): string {
  return browserBffUrl(zone, "/rum/web-vitals");
}
