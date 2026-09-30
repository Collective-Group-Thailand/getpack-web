/** The RFQ desk's list and types, in a plain module so Server Components can call its fetcher. */

import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

/** One RFQ as packio-api publishes it (`admin.rfqs.get`): messages, consultations and quotations inline. */
export type Rfq = Schemas["StaffRfqDto"];
export type RfqQuote = Schemas["StaffRfqQuotationDto"];
export type RfqQuoteLine = Schemas["StaffRfqQuoteLineDto"];
export type RfqConsultation = Schemas["RfqConsultationDto"];
export type RfqMessage = Schemas["StaffRfqMessageDto"];

/**
 * The desk's queues, each a filter of `admin.rfqs.list`: `new` is `status=submitted`, `mine` is
 * `assignedToId=<me>`, `overdue` is `overdue=true`. CONTRACT-GAP admin.rfqs — there is no
 * "awaiting a factory" filter, and "new" cannot say "nobody owns it yet".
 */
export const RFQ_QUEUES = ["new", "mine", "need_info", "quoted", "overdue"] as const;
export type RfqQueue = (typeof RFQ_QUEUES)[number];

/** The detail's tabs, for the page to validate `?tab=` against. */
export const RFQ_TABS = ["request", "factories", "quotes", "messages"] as const;
export type RfqTab = (typeof RFQ_TABS)[number];

/**
 * `admin.rfqs.list`. A queue is turned into the published filters here, so the server and the
 * browser ask the same thing; `mine` needs the actor's id, read from `/v1/admin/me`.
 * CONTRACT-GAP admin.rfqs — no product type, channel or submitted-date filters.
 */
export const rfqList = defineList<Rfq>({
  key: "rfq",
  fetch: async ({ contract }, { queue, ...query }) => {
    const filters: Record<string, string | number | boolean> = { ...query };
    switch (queue as RfqQueue | undefined) {
      case "new":
        filters.status = "submitted";
        break;
      case "need_info":
      case "quoted":
        filters.status = String(queue);
        break;
      case "overdue":
        filters.overdue = true;
        break;
      case "mine": {
        const me = (await contract.GET("/v1/admin/me")).data;
        if (me) filters.assignedToId = me.id;
        break;
      }
      default:
        break;
    }
    return (await contract.GET("/v1/admin/rfqs", { params: { query: filters as never } })).data!;
  },
  getRowId: (row) => row.id,
  getRowName: (row) => row.rfqCode,
  defaults: { filterKeys: ["queue", "status"] },
  // A queue with SLA timers on it.
  staleTime: STALE_TIME.live,
});

/** The draft version, if one is open (at most one, D-100). */
export const draftOf = (rfq: Pick<Rfq, "quotations">) => rfq.quotations.find((quote) => quote.status === "draft");

/** The version standing with the customer, if any. */
export const sentOf = (rfq: Pick<Rfq, "quotations">) => rfq.quotations.find((quote) => quote.status === "sent");

/** The newest version the customer has seen — or the draft, while nothing was sent. */
export function latestQuotation(rfq: Pick<Rfq, "quotations">): RfqQuote | null {
  const seen = rfq.quotations.filter((quote) => quote.status !== "draft");
  const pool = seen.length > 0 ? seen : rfq.quotations;
  return pool.reduce<RfqQuote | null>(
    (latest, quote) => (!latest || quote.versionNo > latest.versionNo ? quote : latest),
    null,
  );
}

/** Newest version first, for the quotes tab. */
export const byVersionDesc = (quotes: readonly RfqQuote[]) => [...quotes].sort((a, b) => b.versionNo - a.versionNo);
