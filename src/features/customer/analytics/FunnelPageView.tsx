"use client";

import { useParams, usePathname, useSelectedLayoutSegments } from "next/navigation";
import { useEffect } from "react";

import { track } from "@/lib/analytics/track";
import { routePattern } from "@/lib/observability/route-pattern";

/**
 * The funnel's first step, "visit" (D-102): one `page_view` per storefront navigation, with the
 * route pattern and never the URL. Mounted once in the storefront layout; renders nothing.
 */
export function FunnelPageView() {
  const route = routePattern(useSelectedLayoutSegments(), useParams());
  const pathname = usePathname();

  useEffect(() => {
    track("page_view", { route });
    // The pathname is the trigger — a new page — but only the pattern travels.
  }, [pathname, route]);

  return null;
}
