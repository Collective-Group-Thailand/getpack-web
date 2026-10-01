/** The prepress desk's list and types, in a plain module so Server Components can call its fetcher. */

import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type PrepressQueueItem = Schemas["PrepressQueueItemDto"];
export type PrepressQueueKind = Schemas["PrepressQueueKind"];
export type ArtworkSubmission = Schemas["ArtworkSubmissionDto"];
export type Proof = Schemas["ProofDto"];
export type ProofAnnotation = Schemas["AnnotationDto"];
export type DielineDelivery = Schemas["DielineDeliveryDto"];
export type DrawingJob = Schemas["DrawingJobDto"];
export type DesignService = Schemas["DesignServiceDto"];
export type DesignDocument = Schemas["DesignDocumentDto"];

/** packio-api's prepress queues (`admin.artwork.queue`), in the desk's order; the first is the default. */
export const PREPRESS_QUEUES = [
  "submissions",
  "changes_requested",
  "proofs_waiting",
] as const satisfies readonly PrepressQueueKind[];

/** The workspace's tabs, for the page to validate `?tab=` against. */
export const PREPRESS_TABS = ["artwork", "proofs", "template", "design"] as const;
export type PrepressTab = (typeof PREPRESS_TABS)[number];

/**
 * The prepress desk is its three queues (`GET /v1/admin/prepress/queue?kind=`): files to review,
 * proofs the customer sent back, proofs with the customer. `?kind=` picks one and the desk opens on
 * the first. Each row is one submission or one proof (`itemId`), so an order can appear twice.
 *
 * Each row names the customer, the product type, the order's artwork status and its Prepress
 * owner, and the queue filters by owner (`assigneeId`, `none` for nobody), product type and artwork
 * status. CONTRACT-GAP admin.prepress — no all-stages queue (template, design and mockup stages).
 */
export const prepressList = defineList<PrepressQueueItem>({
  key: "prepress",
  fetch: async ({ contract }, { kind, ...query }) => {
    const chosen = (PREPRESS_QUEUES as readonly string[]).includes(String(kind))
      ? (kind as PrepressQueueKind)
      : PREPRESS_QUEUES[0];
    return (
      await contract.GET("/v1/admin/prepress/queue", { params: { query: { ...(query as object), kind: chosen } } })
    ).data!;
  },
  getRowId: (row) => row.itemId,
  getRowName: (row) => row.orderCode,
  defaults: { filterKeys: ["kind", "assigneeId", "productTypeCode", "artworkStatus"] },
  // A queue with SLA timers on it.
  staleTime: STALE_TIME.live,
});
