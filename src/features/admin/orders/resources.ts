/** The order-desk lists, in a plain module so Server Components can call their fetchers. */

import type { z } from "zod";

import type { discountMemo, quotationSummary } from "@/lib/api/requests/admin-sales";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type Order = Schemas["AdminOrderDto"];
export type OrderGroup = Schemas["AdminOrderGroupDto"];
export type OrderQueueItem = Schemas["OrderQueueItemDto"];
export type OrderQueue = Schemas["OrderQueue"];
export type QuotationSummary = z.output<typeof quotationSummary>;
export type DiscountMemo = z.output<typeof discountMemo>;

/** packio-api's order queues, in the desk's order. The first is the one the desk opens on. */
export const ORDER_QUEUES = [
  "waiting_payment",
  "artwork_review",
  "waiting_production",
  "due_soon",
  "late",
] as const satisfies readonly OrderQueue[];

/**
 * The order desk is its queues (`admin.orderOperations.queue`). There is no all-orders list with
 * filters on the published contract (CONTRACT-GAP admin.orders), so `?queue=` picks one and the
 * desk opens on the first; `q` searches within it.
 */
export const ordersList = defineList<OrderQueueItem>({
  key: "order",
  fetch: async ({ contract }, { queue, ...query }) => {
    const chosen = (ORDER_QUEUES as readonly string[]).includes(String(queue))
      ? (queue as OrderQueue)
      : ORDER_QUEUES[0];
    return (
      await contract.GET("/v1/admin/order-queues/{queue}", {
        params: { path: { queue: chosen }, query: query as never },
      })
    ).data!;
  },
  getRowId: (row) => row.orderId,
  getRowName: (row) => row.orderCode,
  defaults: { filterKeys: ["queue"] },
  // A queue with SLA timers on it.
  staleTime: STALE_TIME.live,
});

export const quotationsList = defineList<QuotationSummary>({
  key: "quote",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/quotations", { query: query as never }),
  getRowId: (row) => row.id,
  getRowName: (row) => row.quoteCode,
  defaults: { filterKeys: ["status", "channel", "customerId"], sort: "createdAt", order: "desc" },
});

export const memosList = defineList<DiscountMemo>({
  key: "discount_memo",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/discount-memos", { query: query as never }),
  getRowId: (row) => row.id,
  getRowName: (row) => row.memoCode,
  defaults: { filterKeys: ["status"], sort: "createdAt", order: "desc" },
});
