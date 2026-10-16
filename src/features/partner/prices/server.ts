import "server-only";

import { getLocale } from "next-intl/server";
import { cache } from "react";

import { attempt, partnerServerApis } from "@/features/partner/context/server";
import type { Schemas } from "@/lib/api/types";

import { productTypeName, toPriceReferences } from "./values";

type Proposal = Schemas["PriceProposalSummaryDto"];

/** A proposal is open while it can still change: a draft, or waiting on either side. */
export const OPEN_PROPOSAL: readonly Proposal["status"][] = ["draft", "submitted", "under_review", "countered"];

/**
 * Everything the price screens read for one factory, once per render: its price lists, its
 * configuration (mode and tiers), the component definitions, its references and its proposals.
 * Nothing here can hold another factory's price or a getpack suggestion (D-044) — the partner
 * DTOs have no field for one.
 */
export const loadPrices = cache(async (factoryId: string) => {
  const [{ contract }, locale] = await Promise.all([partnerServerApis(), getLocale()]);
  const path = { params: { path: { factoryId } } };
  const [lists, config, components, references, proposals] = await Promise.all([
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/price-lists", path)).data ?? []),
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/configuration", path)).data!),
    attempt(async () => (await contract.GET("/v1/partner/price-components", {})).data ?? []),
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/references", path)).data!),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/price-proposals", {
            params: { path: { factoryId }, query: { perPage: 100, sort: "createdAt", order: "desc" } },
          })
        ).data?.data ?? [],
    ),
  ]);
  const productTypes = (references.data?.productTypes ?? []).map((type) => ({
    id: type.id,
    code: type.code,
    name: productTypeName(type, locale),
  }));
  return {
    lists,
    config,
    components: components.data ?? [],
    references: toPriceReferences(references.data?.items ?? [], locale),
    proposals: proposals.data ?? [],
    productTypes,
    typeName: (idOrCode: string) =>
      productTypes.find((type) => type.id === idOrCode || type.code === idOrCode)?.name ?? idOrCode,
    mode: config.data?.pricingArrangement.current?.ownershipMode ?? null,
    tierOf: (productTypeId: string) =>
      config.data?.participations.find((item) => item.productTypeId === productTypeId)?.current ?? null,
  };
});

/** The rows of one version, every component, for a read-only table (at most 100 per component). */
export async function loadRows(factoryId: string, versionId: string, components: Schemas["PriceComponent"][]) {
  const { contract } = await partnerServerApis();
  const results = await Promise.all(
    components.map((component) =>
      attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/price-list-versions/{versionId}/lines", {
              params: { path: { factoryId, versionId }, query: { component, perPage: 500 } },
            })
          ).data?.data ?? [],
      ),
    ),
  );
  return components.map((component, index) => ({
    component,
    rows: results[index]?.data ?? [],
    error: results[index]?.error,
  }));
}

/** Lines per component of one version (D-406); an empty map when the read fails — the screen still works. */
export async function loadCounts(factoryId: string, versionId: string): Promise<Map<string, number>> {
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/price-list-versions/{versionId}/component-counts", {
          params: { path: { factoryId, versionId } },
        })
      ).data ?? [],
  );
  return new Map((read.data ?? []).map((item) => [item.component, item.lines]));
}
