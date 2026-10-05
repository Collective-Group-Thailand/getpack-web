/** The samples list and types, in a plain module so Server Components can prefetch (U2.F3). */

import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type AdminSample = Schemas["AdminSampleDto"];

/** The statuses as the queue tabs show them, the work first. */
export const SAMPLE_QUEUE = [
  "requested",
  "paid",
  "in_production",
  "delivered",
  "changes_requested",
] as const satisfies readonly Schemas["SampleStatus"][];

export const samplesList = defineList<AdminSample>({
  key: "sample",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/samples", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.id,
  defaults: { filterKeys: ["status", "kind", "orderId"] },
  staleTime: STALE_TIME.live,
});
