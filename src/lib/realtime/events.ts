/**
 * Realtime events, and the query keys they invalidate.
 *
 * api-conventions §6 is emphatic: "Event payloads carry ids + type only; the client refetches
 * through the normal API (no business data in realtime payloads)." That is not a size
 * optimisation. A realtime channel has a different authorisation path from the REST surface,
 * so putting an order total in a payload means a second place that has to get permissions
 * right — and the one that is easier to get wrong. An id tells the client *what changed*; the
 * API still decides what this actor may see when the refetch arrives.
 *
 * So this module never returns data. It turns an event into a set of cache keys to drop, and
 * TanStack Query does the rest.
 *
 * CONTRACT-REQUEST `realtime.auth` and `realtime.stream`: neither endpoint exists yet.
 */

import { queryKeys } from "@/lib/api/query-keys";
import type { Zone } from "@/lib/zones";

/**
 * What arrives on the wire. `type` is `<resource>.<past-tense verb>` — `order.paid`,
 * `job.accepted` — matching the domain event names the backend already emits.
 */
export interface RealtimeEvent {
  type: string;
  /** The uuid of the thing that changed, when the event is about one thing. */
  id?: string;
  /** Present when the change is scoped to a parent, e.g. a job inside an order. */
  parentId?: string;
}

/** A defensive parse: anything off the wire is untrusted until it has this shape. */
export function parseEvent(raw: unknown): RealtimeEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.type !== "string" || candidate.type.length === 0) return null;

  return {
    type: candidate.type,
    id: typeof candidate.id === "string" ? candidate.id : undefined,
    parentId: typeof candidate.parentId === "string" ? candidate.parentId : undefined,
  };
}

/**
 * The cache keys an event invalidates.
 *
 * The resource is the part of the type before the first dot, which is why the naming
 * convention matters: `order.paid` invalidates orders without this module needing a table of
 * every event the backend will ever emit. An event about a resource the UI has never heard of
 * still invalidates that resource's keys — harmless if nothing is cached under them, and
 * correct if something is.
 */
export function invalidationKeys(zone: Zone, event: RealtimeEvent): readonly (readonly unknown[])[] {
  const resource = event.type.split(".")[0];
  if (!resource) return [];

  const keys: (readonly unknown[])[] = [];

  // The detail, when the event names one record. Listed before the collection so a screen
  // showing that record refetches first.
  if (event.id) keys.push(queryKeys.detail(zone, resource, event.id));
  if (event.parentId) keys.push(queryKeys.detail(zone, resource, event.parentId));

  // The collection: a new or changed record moves between queues, so every list of this
  // resource is now potentially wrong, whatever filters it carries.
  keys.push(queryKeys.resource(zone, resource));

  // Notification counts change with almost everything, and an unread badge that is only
  // right after a reload is worse than no badge.
  keys.push(queryKeys.list(zone, "notifications"));

  return keys;
}
