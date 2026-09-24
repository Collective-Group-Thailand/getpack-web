"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useSelectedLayoutSegments } from "next/navigation";

import { ZONE_CONFIG, type Zone } from "@/lib/zones";

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
 * Where the browser posts a sample: this zone's BFF, then this zone's upstream surface.
 *
 * Both halves are needed. `bffPath` is the route on *this* origin (`/admin/bff`), and the rest
 * is the upstream path the BFF allow-lists — it refuses anything that does not start with the
 * zone's `apiPrefix`, so `/admin/bff/rum/web-vitals` would be a 404 rather than a report.
 */
export function rumEndpoint(zone: Zone): string {
  const { bffPath, apiPrefix } = ZONE_CONFIG[zone];
  return `${bffPath}${apiPrefix}/rum/web-vitals`;
}
