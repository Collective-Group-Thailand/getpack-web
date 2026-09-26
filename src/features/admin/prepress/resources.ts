/** The prepress desk's list and types, in a plain module so Server Components can call its fetcher. */

import type { z } from "zod";

import type { prepressDetail, prepressItem, proofAnnotation } from "@/lib/api/requests/admin-prepress";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type PrepressItem = z.output<typeof prepressItem>;
export type PrepressDetail = z.output<typeof prepressDetail>;
export type ProofAnnotation = z.output<typeof proofAnnotation>;

export const PREPRESS_QUEUES = [
  "preflight",
  "proof",
  "awaiting_customer",
  "changes_requested",
  "template",
  "design",
  "mockup",
] as const;

/** The workspace's tabs, for the page to validate `?tab=` against. */
export const PREPRESS_TABS = ["artwork", "proofs", "template", "design", "mockup"] as const;
export type PrepressTab = (typeof PREPRESS_TABS)[number];

export const prepressList = defineList<PrepressItem>({
  key: "prepress",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/prepress", { query: query as never }),
  getRowId: (row) => row.orderId,
  getRowName: (row) => row.orderCode,
  defaults: { filterKeys: ["queue", "artworkStatus", "productType", "assigneeId"] },
  staleTime: STALE_TIME.live,
});
