/** The platform lists, in a plain module so Server Components can call their fetchers. */

import type { Schemas } from "@/lib/api/types";

import { asPage, defineList } from "../console/resource";

export type FeatureFlag = Schemas["FeatureFlagDto"];
export type OutboxMessage = Schemas["OutboxMessageDto"];

export const flagsList = defineList<FeatureFlag>({
  key: "feature_flag",
  // An array endpoint: every flag at once, no server paging.
  fetch: async ({ contract }) => asPage((await contract.GET("/v1/admin/feature-flags")).data!),
  getRowId: (row) => row.key,
  getRowName: (row) => row.key,
});

export const outboxList = defineList<OutboxMessage>({
  key: "outbox",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/outbox", { params: { query: query as never } })).data!,
  getRowId: (row) => row.eventId,
  getRowName: (row) => row.type,
  defaults: { filterKeys: ["status"], filters: { status: "dead" } },
});
