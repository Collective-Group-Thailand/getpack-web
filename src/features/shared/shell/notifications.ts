"use client";

import { useQuery } from "@tanstack/react-query";

import { CSRF_HEADER } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { browserBffUrl, type Zone } from "@/lib/zones";

/**
 * The in-app notification centre's data (D-143).
 *
 * CONTRACT-REQUEST `notifications.feed`. Typed here by hand *and said so*: these are not
 * response types pulled out of thin air but the shape `docs/contract-requests.md` asks the
 * backend for, in one place, so the day it lands the diff is this file and nothing else.
 * `browserApi` is deliberately not used — the typed client only knows paths in the contract,
 * and forcing this through would defeat the check that exists to stop invented types
 * (ADR-0006).
 */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationFeed {
  data: NotificationItem[];
  meta: { nextCursor: string | null; unreadCount: number };
}

const EMPTY: NotificationFeed = { data: [], meta: { nextCursor: null, unreadCount: 0 } };

export function useNotifications(zone: Zone) {
  return useQuery({
    queryKey: queryKeys.list(zone, "notifications"),
    queryFn: async (): Promise<NotificationFeed> => {
      const response = await fetch(browserBffUrl(zone, "/notifications"), {
        headers: { accept: "application/json" },
      });
      // 401 here means the session ended in another tab. The layout guard will deal with it
      // on the next navigation; a bell that throws would replace the page with an error
      // boundary over a notification count.
      if (!response.ok) return EMPTY;
      return (await response.json()) as NotificationFeed;
    },
    // A queue with an SLA timer on it (`STALE_TIME.live`); the badge should not lag a shift.
    staleTime: STALE_TIME.live,
    // Realtime invalidates this key on almost every event, so polling is the fallback for
    // deployments with no realtime driver rather than the primary mechanism.
    refetchInterval: 60_000,
  });
}

/** Marks everything read. Optimism is the caller's business; this just does the write. */
export async function markAllRead(zone: Zone): Promise<void> {
  await fetch(browserBffUrl(zone, "/notifications/read"), {
    method: "POST",
    headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
    body: JSON.stringify({ all: true }),
  });
}
