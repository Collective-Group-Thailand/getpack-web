/** The RFQ desk's list and types, in a plain module so Server Components can call its fetcher. */

import type { z } from "zod";

import type { consultation, rfqDetail, rfqMessage, rfqQuote, rfqSummary } from "@/lib/api/requests/admin-rfq";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type Rfq = z.output<typeof rfqDetail>;
export type RfqSummary = z.output<typeof rfqSummary>;
export type RfqQuote = z.output<typeof rfqQuote>;
export type RfqConsultation = z.output<typeof consultation>;
export type RfqMessage = z.output<typeof rfqMessage>;

export const RFQ_QUEUES = ["new", "mine", "need_info", "awaiting_factory", "quoted", "overdue"] as const;

/** The detail's tabs, for the page to validate `?tab=` against. */
export const RFQ_TABS = ["request", "factories", "quotes", "messages"] as const;
export type RfqTab = (typeof RFQ_TABS)[number];

export const rfqList = defineList<RfqSummary>({
  key: "rfq",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/rfqs", { query: query as never }),
  getRowId: (row) => row.id,
  getRowName: (row) => row.rfqCode,
  defaults: {
    filterKeys: ["queue", "status", "productType", "assigneeId", "channel", "submittedFrom", "submittedTo"],
  },
  // A queue with SLA timers on it.
  staleTime: STALE_TIME.live,
});
