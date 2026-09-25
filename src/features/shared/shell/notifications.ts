"use client";

import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import type { Zone } from "@/lib/zones";

/**
 * The in-app notification centre's data (D-143), on the contract packio-api B1.3 published:
 * `GET /v1/{surface}/notifications` (a cursor feed) and
 * `POST /v1/{surface}/notifications/{id}/actions/read` (one item, idempotent).
 *
 * Two things the F1 contract request asked for did not ship, and the UI is honest about both
 * rather than inventing them (`notifications.unread-and-link` in `docs/contract-requests.md`):
 *
 * - **No `unreadCount`.** The badge counts the unread items in the first page, and says "more"
 *   when a full page came back unread with more behind it — a lower bound that never lies,
 *   instead of a number that might.
 * - **No link.** `InboxItemDto` carries an `eventType` and a body, not a URL, so an item marks
 *   itself read rather than pretending to navigate somewhere.
 */
export type NotificationItem = Schemas["InboxItemDto"];

/** One page is plenty for a popover; the full history belongs on a screen of its own. */
export const FEED_PAGE_SIZE = 50;

export interface NotificationFeed {
  items: NotificationItem[];
  /** Unread among `items`. */
  unreadCount: number;
  /** True when the first page was entirely unread and the API has more: the count is a floor. */
  unreadIsLowerBound: boolean;
}

const EMPTY: NotificationFeed = { items: [], unreadCount: 0, unreadIsLowerBound: false };

/**
 * One call per surface, because openapi-fetch types a request by its literal path — a union of
 * three paths would erase the response type the whole point of the typed client is to keep.
 */
async function fetchFeed(zone: Zone) {
  const query = { params: { query: { limit: FEED_PAGE_SIZE } } };
  const api = browserApi();
  switch (zone) {
    case "admin":
      return (await api.GET("/v1/admin/notifications", query)).data;
    case "partner":
      return (await api.GET("/v1/partner/notifications", query)).data;
    case "customer":
      return (await api.GET("/v1/store/notifications", query)).data;
  }
}

export function summariseFeed(page: {
  data: NotificationItem[];
  meta: { nextCursor: string | null };
}): NotificationFeed {
  const unreadCount = page.data.filter((item) => item.readAt === null).length;
  return {
    items: page.data,
    unreadCount,
    unreadIsLowerBound: unreadCount === page.data.length && page.data.length > 0 && page.meta.nextCursor !== null,
  };
}

export function useNotifications(zone: Zone) {
  return useQuery({
    queryKey: queryKeys.list(zone, "notifications"),
    queryFn: async (): Promise<NotificationFeed> => {
      try {
        const page = await fetchFeed(zone);
        return page ? summariseFeed(page) : EMPTY;
      } catch {
        // 401 here means the session ended in another tab; the layout guard deals with it on
        // the next navigation. A bell that throws would replace the page with an error
        // boundary over a notification count.
        return EMPTY;
      }
    },
    // A queue with an SLA timer on it (`STALE_TIME.live`); the badge should not lag a shift.
    staleTime: STALE_TIME.live,
    // Realtime (`notification.created`) invalidates this key, so polling is only the fallback
    // for deployments with no realtime driver.
    refetchInterval: 60_000,
  });
}

/** Marks one item read. The endpoint is idempotent, so a double click costs nothing. */
export async function markRead(zone: Zone, notificationId: string): Promise<void> {
  const api = browserApi();
  const params = { params: { path: { notificationId } } };
  switch (zone) {
    case "admin":
      await api.POST("/v1/admin/notifications/{notificationId}/actions/read", params);
      return;
    case "partner":
      await api.POST("/v1/partner/notifications/{notificationId}/actions/read", params);
      return;
    case "customer":
      await api.POST("/v1/store/notifications/{notificationId}/actions/read", params);
      return;
  }
}

/**
 * Marks every unread item on the page read — one request each, since the contract has no bulk
 * endpoint yet. `allSettled`, so one failure does not leave the rest unmarked.
 */
export async function markAllRead(zone: Zone, items: readonly NotificationItem[]): Promise<void> {
  await Promise.allSettled(items.filter((item) => item.readAt === null).map((item) => markRead(zone, item.id)));
}
