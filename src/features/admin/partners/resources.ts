/** The partner lists and types, in a plain module so Server Components can prefetch. */

import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type Factory = Schemas["FactoryDto"];
export type Proposal = Schemas["PriceProposalDto"];
export type ProposalSummary = Schemas["PriceProposalSummaryDto"];
export type Inspection = Schemas["InspectionDto"];

export const FACTORY_STATUSES = ["applied", "under_review", "trial", "active", "suspended", "offboarded"] as const;

/** The workspace's tabs, for the page to validate `?tab=` against. */
export const FACTORY_TABS = [
  "onboarding",
  "profile",
  "compliance",
  "operations",
  "terms",
  "visits",
  "pricing",
  "shipping",
  "erp",
] as const;
export type FactoryTab = (typeof FACTORY_TABS)[number];

export const factoriesList = defineList<Factory>({
  key: "factory",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/factories", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.code,
  defaults: { filterKeys: ["status"], sort: "code", order: "asc" },
});

export const proposalsList = defineList<ProposalSummary>({
  key: "price_proposal",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/price-proposals", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => `${row.factoryCode} · ${row.productTypeCode}`,
  defaults: { filterKeys: ["status", "direction", "factoryId"] },
  staleTime: STALE_TIME.live,
});

/** Packio's inspections (`admin.inspections.list`), by status and factory; no search or sort. */
export const inspectionsList = defineList<Inspection>({
  key: "inspection",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/inspections", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.jobNo,
  defaults: { filterKeys: ["status", "factoryId"] },
  staleTime: STALE_TIME.live,
});
