"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";

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
 * Keeps the screen, the queues and the dashboard counts in step after an action. Every RFQ action
 * answers the whole `StaffRfqDto`, which goes straight into the cache; one that answers nothing
 * (a reminder) refetches instead.
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
 * The unmet-demand reasons (D-102, `admin.rfqs.listUnmetDemandReasons`): the decline dialog offers
 * them, and a declined RFQ names its reason by looking its code up here. `nameOf` reads the name
 * in the screen's language.
 */
export function useUnmetDemandReasons(enabled: boolean) {
  const allowed = useCan("rfqs.read");
  const locale = useLocale();
  const query = useQuery({
    queryKey: queryKeys.list("admin", "unmet_demand_reason", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/unmet-demand-reasons")).data!,
    staleTime: STALE_TIME.reference,
    enabled: enabled && allowed,
  });
  const reasons = query.data ?? [];
  return {
    ...query,
    reasons,
    nameOf: (code: string) => {
      const reason = reasons.find((candidate) => candidate.code === code);
      return reason ? (locale === "en" ? reason.nameEn : reason.nameTh) : code;
    },
  };
}

/**
 * The factories that could quote the RFQ (`admin.rfqs.listCandidateFactories`, D-043): the
 * consultation dialog picks from them, and the factories tab names a consulted factory by them —
 * a consultation itself carries the factory's code only.
 */
export function useCandidateFactories(rfqId: string, enabled = true) {
  const allowed = useCan("rfqs.read");
  return useQuery({
    queryKey: queryKeys.related("admin", "rfq", rfqId, "candidate_factories"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/rfqs/{rfqId}/candidate-factories", {
          params: { path: { rfqId } },
        })
      ).data!,
    staleTime: STALE_TIME.transactional,
    enabled: enabled && allowed,
  });
}
