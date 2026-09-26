import "server-only";

import { adminServerApis } from "./api.server";
import { parseListState, toApiQuery } from "./list-state";
import type { InitialPage, ListResource } from "./resource";

type SearchParams = Record<string, string | string[] | undefined>;

export function toSearchParams(params: SearchParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") search.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) search.set(key, value[0]);
  }
  return search;
}

/**
 * The first page of a list, fetched while the HTML renders (00-master-plan.md §4: "lists render
 * initial data on the server and hydrate TanStack Query").
 *
 * A failure is not thrown: the client makes the same request, gets the same answer, and renders
 * it as an error state with a retry and a request id — which a crashed Server Component cannot.
 */
export async function prefetchList<TRow>(
  resource: ListResource<TRow>,
  searchParams: SearchParams,
): Promise<InitialPage<TRow> | null> {
  const query = toApiQuery(parseListState(toSearchParams(searchParams), resource.defaults));
  try {
    return { query, data: await resource.fetch(await adminServerApis(), query) };
  } catch {
    return null;
  }
}
