"use client";

import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import type { Zone } from "@/lib/zones";

/**
 * The in-app notification centre's data (D-143): `GET /v1/{surface}/notifications` (a cursor feed
 * whose `meta.unreadCount` counts all of my unread, not only the page),
 * `POST /v1/{surface}/notifications/{id}/actions/read` (one item, idempotent) and
 * `POST /v1/{surface}/notifications/actions/read-all` (contract v0.6.0,
 * `notifications.unread-and-link`). Each item carries the zone-relative `url` of what it is about,
 * or `null` when the zone has no page for it.
 */
export type NotificationItem = Schemas["InboxItemDto"];

/** One page is plenty for a popover; the full history belongs on a screen of its own. */
export const FEED_PAGE_SIZE = 50;

export interface NotificationFeed {
  items: NotificationItem[];
  /** All my unread in-app notifications, as the API counts them. */
  unreadCount: number;
}

const EMPTY: NotificationFeed = { items: [], unreadCount: 0 };

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

export function summariseFeed(page: Schemas["InboxPageDto"]): NotificationFeed {
  return { items: page.data, unreadCount: page.meta.unreadCount };
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

/** Marks all of my unread notifications read, not only the ones on the page, in one request. */
export async function markAllRead(zone: Zone): Promise<void> {
  const api = browserApi();
  switch (zone) {
    case "admin":
      await api.POST("/v1/admin/notifications/actions/read-all", {});
      return;
    case "partner":
      await api.POST("/v1/partner/notifications/actions/read-all", {});
      return;
    case "customer":
      await api.POST("/v1/store/notifications/actions/read-all", {});
      return;
  }
}
