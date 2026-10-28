"use client";

import { useEffect, useRef } from "react";

import { Link } from "@/i18n/navigation";
import { trackCategory, type CategoryEventName, type CategoryEvents } from "@/lib/analytics/category";

type Tracked = { [K in CategoryEventName]: { event: K; properties: CategoryEvents[K] } }[CategoryEventName];

/**
 * A server-rendered link of the category page (a use-case chip, the view toggle, the style library) that also
 * reports its category event when pressed — the page itself stays a crawlable list of links.
 */
export function TrackedLink({ track, ...props }: React.ComponentProps<typeof Link> & { track: Tracked }) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackCategory(track.event, track.properties as never);
        props.onClick?.(event);
      }}
    />
  );
}

/** Reports a section once it has come into view (`category_guide_view`). */
export function SeenTracker({ track, children }: { track: Tracked; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const sent = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (sent.current || !entries.some((entry) => entry.isIntersecting)) return;
        sent.current = true;
        trackCategory(track.event, track.properties as never);
        observer.disconnect();
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [track]);
  return <div ref={ref}>{children}</div>;
}
