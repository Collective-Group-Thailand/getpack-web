/**
 * Query keys, built in one place so an invalidation cannot miss a cache by spelling.
 *
 * Every key starts with the zone. Zones never share a QueryClient — they do not even share a
 * browser origin — but a realtime event carries ids and a type, and the handler that turns it
 * into an invalidation is shared code (ADR-0005). Keeping the zone in the key means that
 * helper can invalidate precisely rather than by prefix and hope.
 */

import type { Zone } from "@/lib/zones";

/** Anything narrowing a list: filters, pagination, sort. Serialised structurally by TanStack. */
export type QueryParams = Record<string, unknown> | undefined;

export const queryKeys = {
  zone: (zone: Zone) => [zone] as const,

  /** The signed-in principal from `/v1/{surface}/me`. */
  me: (zone: Zone) => [zone, "me"] as const,

  /** A resource collection, optionally narrowed. */
  list: (zone: Zone, resource: string, params?: QueryParams) => [zone, resource, "list", params ?? null] as const,

  /** One resource by id. */
  detail: (zone: Zone, resource: string, id: string) => [zone, resource, "detail", id] as const,

  /** A named sub-resource of one record, e.g. an order's timeline. */
  related: (zone: Zone, resource: string, id: string, relation: string) =>
    [zone, resource, "detail", id, relation] as const,

  /** Everything cached for one resource in one zone — the usual invalidation after a write. */
  resource: (zone: Zone, resource: string) => [zone, resource] as const,
} as const;
