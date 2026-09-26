"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import type { ApiPaths } from "@/lib/api/types";

import { adminBrowserApis } from "../console/api";
import { loose } from "../catalogue/api";

/** Every `GET` under one factory, as the contract names it. */
type FactoryGetPath = {
  [P in keyof ApiPaths]: P extends `/v1/admin/factories/{factoryId}${string}`
    ? ApiPaths[P] extends { get: unknown }
      ? P
      : never
    : never;
}[keyof ApiPaths];

type Data<P extends keyof ApiPaths> = ApiPaths[P] extends {
  get: { responses: { 200: { content: { "application/json": infer D } } } };
}
  ? D
  : never;

/**
 * One sub-resource of a factory — its steps, documents, capabilities, configuration — typed by
 * the contract's own path. Every one is keyed under the factory's detail key, so invalidating
 * the factory refreshes everything the workspace shows about it.
 */
export function useFactoryPart<P extends FactoryGetPath>(
  factoryId: string,
  path: P,
  query?: Record<string, string | number>,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [...queryKeys.related("admin", "factory", factoryId, path), query ?? null],
    queryFn: async () =>
      (
        await loose(adminBrowserApis().contract).GET(path, {
          params: { path: { factoryId }, ...(query ? { query } : {}) },
        })
      ).data as Data<P>,
    enabled: options.enabled ?? true,
  });
}

/** Refreshes one factory everywhere, and the lists and dashboard that count it. */
export function useFactoryRefresh(factoryId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "factory", factoryId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "factory") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
  };
}

/** A date input's value as the start of that day in Bangkok, the form the contract takes. */
export const bangkokDay = (value: string) => `${value}T00:00:00+07:00`;
