"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { browserApi } from "@/lib/api/browser";
import { clientEnv } from "@/lib/env";
import { BROWSER_BFF_PATH, ZONE_CONFIG, type Zone } from "@/lib/zones";

import { invalidationKeys, parseEvent } from "./events";
import { backoffMs, readSse } from "./sse";

/**
 * Subscribes to this zone's realtime feed and turns events into cache invalidations.
 *
 * Renders nothing, and does nothing at all unless `NEXT_PUBLIC_REALTIME_DRIVER` is `sse` — so a
 * local checkout and every environment without a realtime backend simply have no connection,
 * and the app works the way it does without one, by fetching.
 *
 * The handshake is getpack-api B1.3's (contract §6): `POST /v1/{surface}/realtime/auth` returns
 * a 60-second channel token and the stream path; the stream is then read through the BFF, so
 * the httpOnly session cookie authorises it and the allow-list applies. Every (re)connection
 * asks for a new token — see `./sse.ts` for why this is `fetch` and not `EventSource`.
 */
export function RealtimeProvider({ zone }: { zone: Zone }) {
  const queryClient = useQueryClient();
  const driver = clientEnv.NEXT_PUBLIC_REALTIME_DRIVER;

  useEffect(() => {
    if (driver !== "sse") return;

    const controller = new AbortController();
    const { signal } = controller;

    const onFrame = ({ data }: { data: string }) => {
      let raw: unknown;
      try {
        raw = JSON.parse(data);
      } catch {
        // A malformed frame is the server's problem, not something to crash a page over.
        return;
      }
      const event = parseEvent(raw);
      if (!event) return;
      for (const queryKey of invalidationKeys(zone, event)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    async function run() {
      for (let attempt = 0; !signal.aborted; attempt += 1) {
        try {
          const auth = await authorise(zone);
          const url = streamUrl(zone, auth.streamPath, auth.token);
          if (!url) return; // A stream path outside this surface is refused, not followed.

          const response = await fetch(url, { headers: { accept: "text/event-stream" }, signal });
          if (response.status === 401 || response.status === 403) return; // Signed out: stop.
          if (response.ok) {
            attempt = -1; // A healthy connection resets the backoff once it ends.
            await readSse(response, onFrame, signal);
          }
        } catch {
          if (signal.aborted) return;
        }
        // Whatever ended the stream, refetch once: events may have been missed while it was down.
        void queryClient.invalidateQueries({ queryKey: [zone] });
        await sleep(backoffMs(Math.max(0, attempt)), signal);
      }
    }

    void run();
    return () => controller.abort();
  }, [driver, queryClient, zone]);

  return null;
}

async function authorise(zone: Zone) {
  const api = browserApi();
  const response =
    zone === "admin"
      ? await api.POST("/v1/admin/realtime/auth")
      : zone === "partner"
        ? await api.POST("/v1/partner/realtime/auth")
        : await api.POST("/v1/store/realtime/auth");
  if (!response.data) throw new Error("realtime auth returned no body");
  return response.data;
}

/**
 * The browser URL for a stream path the API returned — only if it is on this zone's own surface.
 * A server-provided path is data; following one anywhere else would be an open redirect for a
 * long-lived connection that carries the session cookie.
 */
export function streamUrl(zone: Zone, streamPath: string, token: string): string | null {
  const prefix = `${ZONE_CONFIG[zone].apiPrefix}/`;
  if (!streamPath.startsWith(prefix) || streamPath.includes("..") || streamPath.includes("?")) return null;
  return `${BROWSER_BFF_PATH}${streamPath}?token=${encodeURIComponent(token)}`;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
