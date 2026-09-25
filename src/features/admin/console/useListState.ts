"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { mergeIntoUrl, parseListState, updateListState, type ListDefaults, type ListState } from "./list-state";

/**
 * The list's state, read from and written to the URL (see `./list-state.ts`).
 *
 * Writes use `replace`, not `push`, for typing and paging: a search box that pushed a history
 * entry per keystroke would make the back button useless. `scroll: false` keeps the table where
 * the person was looking.
 */
export function useListState(defaults: ListDefaults = {}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // `defaults` is usually a literal at the call site; key the memo on its content.
  const defaultsKey = JSON.stringify(defaults);
  const stableDefaults = useMemo<ListDefaults>(() => JSON.parse(defaultsKey), [defaultsKey]);
  const state = useMemo(() => parseListState(params, stableDefaults), [params, stableDefaults]);

  const navigate = useCallback(
    (next: ListState) => {
      const query = mergeIntoUrl(new URLSearchParams(params.toString()), next, stableDefaults).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router, stableDefaults],
  );

  const update = useCallback((patch: Partial<ListState>) => navigate(updateListState(state, patch)), [navigate, state]);

  const setFilter = useCallback(
    (id: string, value: string | null) => {
      const filters = { ...state.filters };
      if (value === null || value === "") delete filters[id];
      else filters[id] = value;
      update({ filters });
    },
    [state.filters, update],
  );

  /** Applies a saved view: its query replaces the current one wholesale. */
  const applyQuery = useCallback(
    (query: Record<string, string>) =>
      navigate({ ...parseListState(new URLSearchParams(query), stableDefaults), hidden: state.hidden }),
    [navigate, stableDefaults, state.hidden],
  );

  return { state, update, setFilter, applyQuery, defaults: stableDefaults };
}
