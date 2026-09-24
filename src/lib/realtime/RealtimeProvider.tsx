"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { clientEnv } from "@/lib/env";
import { browserBffUrl, type Zone } from "@/lib/zones";

import { invalidationKeys, parseEvent } from "./events";

/**
 * Subscribes to this zone's realtime feed and turns events into cache invalidations.
 *
 * Renders nothing, and does nothing at all unless `NEXT_PUBLIC_REALTIME_DRIVER` is set — so a
 * local checkout and every environment without a realtime backend simply have no socket, and
 * the app works the way it does today, by fetching.
 *
 * Server-sent events rather than a websocket: traffic is one-way (the client never pushes),
 * SSE reconnects by itself with `Last-Event-ID`, and it rides the existing BFF — same origin,
 * same cookie, same allow-list, no second authorisation path to get right (ADR-0005). A Pusher
 * driver is the other option the env schema allows; it would go beside this one.
 *
 * CONTRACT-REQUEST `realtime.stream`.
 */
export function RealtimeProvider({ zone }: { zone: Zone }) {
  const queryClient = useQueryClient();
  const driver = clientEnv.NEXT_PUBLIC_REALTIME_DRIVER;

  useEffect(() => {
    if (driver !== "sse") return;
    if (typeof EventSource === "undefined") return;

    // Through the BFF, so the httpOnly cookie authenticates it and the allow-list applies.
    // `withCredentials` is unnecessary and harmful here: this is same-origin, and setting it
    // makes the browser treat the request as CORS.
    const source = new EventSource(browserBffUrl(zone, "/realtime/stream"));

    source.addEventListener("message", (message) => {
      let raw: unknown;
      try {
        raw = JSON.parse(message.data as string);
      } catch {
        // A malformed frame is the server's problem, not something to crash a page over.
        return;
      }

      const event = parseEvent(raw);
      if (!event) return;

      for (const queryKey of invalidationKeys(zone, event)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    });

    // EventSource reconnects on its own with backoff; an `onerror` handler that closed the
    // stream would turn a five-second network blip into a session with no realtime until the
    // next full page load.
    return () => source.close();
  }, [driver, queryClient, zone]);

  return null;
}
