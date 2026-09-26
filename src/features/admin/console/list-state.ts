/**
 * A back-office list's state lives in its URL (F2 A.3: "saved filters in URL query").
 *
 * That one decision buys most of the list behaviour F2 asks for without further machinery: a
 * view is shareable by copying the address bar, the back button undoes a filter, a saved view
 * is just a stored query string (`admin.saved-views`), a server component can render the first
 * page from the same parameters the client refetches with, and a reload lands where you were.
 *
 * This module is pure — parse and serialise — so the rules are testable without a router.
 */

export interface ListState {
  page: number;
  perPage: number;
  /** Column id the API sorts by. */
  sort: string | null;
  order: "asc" | "desc";
  q: string;
  /** Resource-specific filters, as their URL values. */
  filters: Record<string, string>;
  /** Columns hidden by the person looking — presentation only, never sent to the API. */
  hidden: string[];
}

export interface ListDefaults {
  /**
   * The URL parameters that are this list's filters. Anything else in the URL — a page's own
   * tab, a panel that is open — is left alone and never reaches the API.
   */
  filterKeys?: readonly string[];
  perPage?: number;
  sort?: string | null;
  order?: "asc" | "desc";
  filters?: Record<string, string>;
  hidden?: string[];
}

export const PAGE_SIZES = [25, 50, 100] as const;

/** URL parameters with a fixed meaning; everything else is a filter. */
const RESERVED = new Set(["page", "perPage", "sort", "order", "q", "hide", "view"]);

type SearchParamsLike = { get(name: string): string | null; forEach(cb: (value: string, key: string) => void): void };

export function parseListState(params: SearchParamsLike, defaults: ListDefaults = {}): ListState {
  const perPage = Number(params.get("perPage"));
  const page = Number(params.get("page"));
  const order = params.get("order");
  const filters: Record<string, string> = { ...defaults.filters };

  const allowed = defaults.filterKeys ? new Set(defaults.filterKeys) : null;
  params.forEach((value, key) => {
    if (RESERVED.has(key) || value === "") return;
    if (allowed && !allowed.has(key)) return;
    filters[key] = value;
  });

  const hide = params.get("hide");
  return {
    // A page size outside the allowed set is someone editing the URL; the API would refuse
    // anything over 100 anyway (api-conventions §3).
    perPage: (PAGE_SIZES as readonly number[]).includes(perPage) ? perPage : (defaults.perPage ?? PAGE_SIZES[0]),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    sort: params.get("sort") ?? defaults.sort ?? null,
    order: order === "asc" || order === "desc" ? order : (defaults.order ?? "desc"),
    q: params.get("q") ?? "",
    filters,
    hidden: hide !== null ? hide.split(",").filter(Boolean) : (defaults.hidden ?? []),
  };
}

/**
 * The URL for a state — only what differs from the defaults, so a fresh list has a clean
 * address and a shared link says exactly what was chosen.
 */
export function serialiseListState(state: ListState, defaults: ListDefaults = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  for (const [key, value] of Object.entries(state.filters).sort(([a], [b]) => a.localeCompare(b))) {
    if (value !== "" && defaults.filters?.[key] !== value) params.set(key, value);
  }
  if (state.sort && state.sort !== (defaults.sort ?? null)) params.set("sort", state.sort);
  if (state.order !== (defaults.order ?? "desc")) params.set("order", state.order);
  if (state.perPage !== (defaults.perPage ?? PAGE_SIZES[0])) params.set("perPage", String(state.perPage));
  if (state.page > 1) params.set("page", String(state.page));
  const hidden = [...state.hidden].sort().join(",");
  if (hidden !== [...(defaults.hidden ?? [])].sort().join(",")) params.set("hide", hidden);
  return params;
}

/** The query the API receives: pagination, sort, search and filters — never presentation. */
export function toApiQuery(state: ListState): Record<string, string | number> {
  return {
    page: state.page,
    perPage: state.perPage,
    ...(state.sort ? { sort: state.sort, order: state.order } : {}),
    ...(state.q ? { q: state.q } : {}),
    ...state.filters,
  };
}

/**
 * Applies a change. Anything that alters *which* rows match — search, a filter, the page size,
 * the sort — goes back to page 1, or the person is left on page 9 of a list with three pages.
 */
export function updateListState(state: ListState, patch: Partial<ListState>): ListState {
  const narrows =
    patch.q !== undefined || patch.filters !== undefined || patch.perPage !== undefined || patch.sort !== undefined;
  return { ...state, ...patch, page: patch.page ?? (narrows ? 1 : state.page) };
}

/** A saved view's query — the URL parameters, as `SavedViewDto.query` stores them. */
export function viewQuery(state: ListState, defaults: ListDefaults = {}): Record<string, string> {
  const params = serialiseListState({ ...state, page: 1 }, defaults);
  params.delete("hide");
  return Object.fromEntries(params);
}

/**
 * The URL after a change: the list's own parameters rewritten, everything else — the page's tab,
 * an open panel — kept exactly as it was. Without this, filtering the "all requests" tab would
 * drop `?tab=all` and put the person back on the inbox.
 */
export function mergeIntoUrl(current: URLSearchParams, state: ListState, defaults: ListDefaults = {}): URLSearchParams {
  const next = new URLSearchParams();
  const allowed = defaults.filterKeys ? new Set(defaults.filterKeys) : null;
  current.forEach((value, key) => {
    const ownedByList = RESERVED.has(key) || (allowed ? allowed.has(key) : true);
    if (!ownedByList || key === "view") next.set(key, value);
  });
  serialiseListState(state, defaults).forEach((value, key) => next.set(key, value));
  return next;
}
