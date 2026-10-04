"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

import { buildConfiguration } from "./build";
import { POSTCODE, type Configurator, type ConfiguratorState, type LoadInput } from "./state";

export type Recommendation = Schemas["AdvisoryRecommendationDto"];
export type AdvisorOption = Schemas["AdvisoryOptionDto"];
export type AdvisorMethod = Schemas["AdvisoryMethodDto"];

/**
 * The Structure Advisor (U2.2, D-235–D-240) answers for corrugated boxes only; the storefront asks
 * it whether it is on (`store.advisory.getMethod.available` — the rule set is set and the flag is
 * on) and shows nothing of it otherwise.
 */
export function useAdvisorMethod(configurator: Configurator) {
  const eligible = configurator.calculator === "corrugate" && configurator.instant;
  return useQuery({
    queryKey: [...queryKeys.zone("customer"), "advisory-method"],
    queryFn: async () => (await browserApi().GET("/v1/store/advisory/method")).data!,
    enabled: eligible,
    staleTime: 5 * 60_000,
    retry: false,
    select: (method) => (eligible ? method : null),
  });
}

/** The load the API takes (`AdvisoryLoadDto`), once every required answer is in; `null` before. */
export function loadOf(load: LoadInput): Schemas["AdvisoryLoadDto"] | null {
  const { productWeightG, unitsPerBox, stackLayers, fragility, transportMode, humidity, storage, pallet } = load;
  if (
    productWeightG === null ||
    unitsPerBox === null ||
    stackLayers === null ||
    !fragility ||
    !transportMode ||
    !humidity ||
    !storage
  )
    return null;
  return { productWeightG, unitsPerBox, stackLayers, fragility, transportMode, humidity, storage, pallet };
}

/**
 * The advisor for this configurator visit: a recommendation on request, the board the customer
 * takes (`store.advisory.choose`, every warning of it acknowledged, D-240), and the
 * `anonymousId` both are tied to. The id lives as long as the page — nothing is stored in the
 * browser (PDPA); a signed-in customer's recommendation is also theirs by session.
 */
export function useAdvisor(configurator: Configurator) {
  const [anonymousId] = useState(() => crypto.randomUUID());
  const recommend = useMutation({
    mutationFn: async ({ load, state }: { load: Schemas["AdvisoryLoadDto"]; state: ConfiguratorState }) =>
      (
        await browserApi().POST("/v1/store/advisory/recommendations", {
          body: {
            productTypeCode: configurator.productTypeCode,
            configuration: buildConfiguration(configurator, state) as unknown as Record<string, unknown>,
            load,
            anonymousId,
            ...(POSTCODE.test(state.postcode) ? { deliveryPostcode: state.postcode } : {}),
          },
        })
      ).data!,
  });
  const choose = useMutation({
    mutationFn: async ({ recommendationId, option }: { recommendationId: string; option: AdvisorOption }) =>
      (
        await browserApi().POST("/v1/store/advisory/recommendations/{recommendationId}/actions/choose", {
          params: { path: { recommendationId } },
          body: { materialId: option.board.id, acknowledgedWarnings: option.warnings, anonymousId },
        })
      ).data!,
  });
  return { anonymousId, recommend, choose };
}
