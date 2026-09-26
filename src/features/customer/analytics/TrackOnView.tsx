"use client";

import { useEffect } from "react";

import type { AnalyticsProperties, FunnelEvent } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";

/**
 * Fires one funnel event when a server-rendered page is shown — `product_viewed` on a product
 * page, say. The properties are the dimensions D-102 slices by and nothing that identifies a
 * person (`AnalyticsProperties`).
 */
export function TrackOnView({ name, properties }: { name: FunnelEvent; properties?: AnalyticsProperties }) {
  const key = JSON.stringify(properties ?? {});
  useEffect(() => {
    track(name, JSON.parse(key) as AnalyticsProperties);
  }, [name, key]);
  return null;
}
