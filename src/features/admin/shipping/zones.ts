"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

import { adminBrowserApis } from "../console";

export type Zone = Schemas["ZoneDto"];
export type ZoneScheme = Schemas["ZoneSchemeDto"];

/** The scheme every customer rate and factory payout line is written against (B2.4). */
export const CUSTOMER_SCHEME = "customer_default";

export async function readSchemes(): Promise<ZoneScheme[]> {
  const api = adminBrowserApis().contract;
  const schemes: ZoneScheme[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.GET("/v1/admin/shipping/zone-schemes", {
      params: { query: { page, perPage: 100, sort: "code" } },
    });
    schemes.push(...data!.data);
    if (page * data!.meta.perPage >= data!.meta.total) return schemes;
  }
}

export async function readZones(schemeId: string): Promise<Zone[]> {
  const api = adminBrowserApis().contract;
  const zones: Zone[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.GET("/v1/admin/shipping/zones", {
      params: { query: { page, perPage: 100, sort: "code", schemeId } },
    });
    zones.push(...data!.data);
    if (page * data!.meta.perPage >= data!.meta.total) return zones;
  }
}

export function useSchemes() {
  return useQuery({ queryKey: queryKeys.list("admin", "zone_scheme", {}), queryFn: readSchemes });
}

/** The zones of `customer_default`, by code — what a rate line chooses from. */
export function useCustomerZones() {
  return useQuery({
    queryKey: queryKeys.list("admin", "zone", { scheme: CUSTOMER_SCHEME }),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const scheme = (await readSchemes()).find((s) => s.code === CUSTOMER_SCHEME);
      return scheme ? readZones(scheme.id) : [];
    },
  });
}

/** A zone as staff read it: the Thai or English name, then the code. */
export const zoneLabel = (zone: Pick<Zone, "code" | "nameTh" | "nameEn">, locale: string) =>
  `${locale === "en" ? zone.nameEn : zone.nameTh} (${zone.code})`;
