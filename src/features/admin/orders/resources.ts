/** The order-desk lists, in a plain module so Server Components can call their fetchers. */

import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type Order = Schemas["AdminOrderDto"];
export type OrderGroup = Schemas["AdminOrderGroupDto"];
export type OrderQueueItem = Schemas["OrderQueueItemDto"];
export type OrderListItem = Schemas["AdminOrderListItemDto"];
export type OrderQueue = Schemas["OrderQueue"];
export type CancelReason = Schemas["CancelReasonDto"];
export type Quotation = Schemas["AdminSavedQuoteDto"];
export type DiscountMemo = Schemas["DiscountMemoDto"];

/** packio-api's order queues, in the desk's order. The first is the one the desk opens on. */
export const ORDER_QUEUES = [
  "waiting_payment",
  "artwork_review",
  "waiting_production",
  "due_soon",
  "late",
] as const satisfies readonly OrderQueue[];

/** The tab of the desk that is every order (`admin.orders.list`) rather than one of the queues. */
export const ALL_ORDERS = "all";

/**
 * The order desk is its queues (`admin.orderOperations.queue`): `?queue=` picks one and the desk
 * opens on the first; `q` searches within it. `?queue=all` is every order instead
 * (`allOrdersList`).
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

/**
 * Every order, newest placed first (`admin.orders.list`, v0.5.0), with the desk's filters. Its rows
 * carry what a queue row does not: the customer and factory refs, the quantity, the group's next
 * unpaid instalment and a slip waiting for Finance with its review due time (D-061, D-175).
 */
export const allOrdersList = defineList<OrderListItem>({
  key: "order",
  resourceName: "order_all",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/orders", { params: { query: query as never } })).data!,
  getRowId: (row) => row.orderId,
  getRowName: (row) => row.orderCode,
  // `?queue=all` is the page's tab, not a filter: the list keeps it in the URL and never sends it.
  defaults: { filterKeys: ["status", "artworkStatus", "channel", "productTypeCode", "placedFrom", "placedTo"] },
  staleTime: STALE_TIME.live,
});

export const quotationsList = defineList<Quotation>({
  key: "quote",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/quotes", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.quoteCode ?? row.id.slice(0, 8),
  defaults: { filterKeys: ["status", "customerId", "channel"], sort: "createdAt", order: "desc" },
});

export const memosList = defineList<DiscountMemo>({
  key: "discount_memo",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/discount-memos", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  // A memo has no code of its own (CONTRACT-GAP admin.discount-memos: no series decided); its customer names it.
  getRowName: (row) => row.customer?.displayName ?? row.id.slice(0, 8),
  defaults: { filterKeys: ["status", "customerId", "requestedBy"], sort: "createdAt", order: "desc" },
});
