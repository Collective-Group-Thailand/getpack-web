"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useSelectedLayoutSegments } from "next/navigation";

import { browserBffUrl, type Zone } from "@/lib/zones";

import { sendReport, shouldReport } from "./web-vitals";

/**
 * Reports field Web Vitals for the zone it is mounted in.
 *
 * Renders nothing. Mounted once per zone root layout, below the providers, so it is inside
 * the tree whose performance it measures.
 */
export function WebVitals({ zone }: { zone: Zone }) {
  // Segments, not `usePathname`: this gives `["orders", "[orderId]"]` — the route pattern —
  // where `usePathname` would give the real order code. See `WebVitalReport.route`.
  const segments = useSelectedLayoutSegments();
  const route = `/${segments.filter((segment) => !segment.startsWith("(")).join("/")}`;

  useReportWebVitals((metric) => {
    if (!shouldReport(metric.name)) return;

    sendReport(rumEndpoint(zone), {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      route,
      zone,
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
