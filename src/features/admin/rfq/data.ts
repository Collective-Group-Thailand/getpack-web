"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import type { Rfq } from "./resources";

/** One RFQ (`admin.rfqs.get`) — its thread, consultations and quotation versions come inline. */
export function useRfq(rfqId: string, initial?: Rfq | null) {
  return useQuery({
    queryKey: queryKeys.detail("admin", "rfq", rfqId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/rfqs/{rfqId}", { params: { path: { rfqId } } })).data!,
    initialData: initial ?? undefined,
    staleTime: STALE_TIME.transactional,
  });
}

/**
 * Keeps the screen, the queues and the dashboard counts in step after an action. Every published
 * RFQ action answers the whole `StaffRfqDto`, which goes straight into the cache; an action that
 * is still a contract request (start review, record acceptance, the draft edit) refetches instead.
 */
export function useSettleRfq(rfqId: string) {
  const queryClient = useQueryClient();
  return (updated?: Rfq) => {
    if (updated) queryClient.setQueryData(queryKeys.detail("admin", "rfq", rfqId), updated);
    else void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "rfq", rfqId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "rfq") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
}

/**
 * The unmet-demand reasons (D-102), a contract request (`admin.unmet-demand-reasons`): the decline
 * dialog offers them, and a declined RFQ names its reason by looking its code up here.
 */
export function useUnmetDemandReasons(enabled: boolean) {
  const allowed = useCan("rfqs.read");
  return useQuery({
    queryKey: queryKeys.list("admin", "unmet_demand_reason", {}),
    queryFn: () => adminBrowserApis().requests.call("GET /v1/admin/unmet-demand-reasons"),
    staleTime: STALE_TIME.reference,
    enabled: enabled && allowed,
  });
}
