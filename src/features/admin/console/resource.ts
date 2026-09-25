/**
 * What a back-office list needs to know about the resource behind it.
 *
 * Deliberately not a React module: the same definition is imported by the Server Component
 * that renders the first page and by the Client Component that refetches, so the fetcher and
 * the defaults cannot disagree between the two.
 */

import type { Page } from "@/lib/api/requests/define";

import type { AdminApis } from "./api";
import type { ListDefaults } from "./list-state";

export interface ListResource<TRow> {
  /**
   * The resource name used in query keys, singular and matching the realtime event prefix
   * (`order.paid` invalidates `order`), so a realtime event refreshes this list by itself.
   */
  key: string;
  /** The name exports, imports and saved views use; defaults to `key`. */
  resourceName?: string;
  fetch: (apis: AdminApis, query: Record<string, string | number>) => Promise<Page<TRow>>;
  getRowId: (row: TRow) => string;
  /** A short human name for a row — its code — used to label checkboxes and confirmations. */
  getRowName?: (row: TRow) => string;
  defaults?: ListDefaults;
  /** How fresh the list must be; queues pass `STALE_TIME.live`. */
  staleTime?: number;
}

export function defineList<TRow>(resource: ListResource<TRow>): ListResource<TRow> {
  return resource;
}

/** The page the server already fetched, and the query it fetched it for. */
export interface InitialPage<TRow> {
  query: Record<string, string | number>;
  data: Page<TRow>;
}

/** Wraps an array endpoint (`RoleDto[]`, `SettingDto[]`) as a single page. */
export function asPage<TRow>(rows: TRow[]): Page<TRow> {
  return { data: rows, meta: { page: 1, perPage: rows.length || 1, total: rows.length } };
}

/** "order · 0192f3a0" — a record named by its type and the start of its id, for logs and tables. */
export function shortRef(type: string | null | undefined, id: string | null | undefined): string {
  if (!type) return "—";
  return id ? `${type} · ${id.slice(0, 8)}` : type;
}
