/** The order-desk lists, in a plain module so Server Components can call their fetchers. */

import type { z } from "zod";

import type { orderDetail, orderSummary } from "@/lib/api/requests/admin-orders";
import type { discountMemo, quotationSummary } from "@/lib/api/requests/admin-sales";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type Order = z.output<typeof orderDetail>;
export type OrderSummary = z.output<typeof orderSummary>;
export type QuotationSummary = z.output<typeof quotationSummary>;
export type DiscountMemo = z.output<typeof discountMemo>;

export const ordersList = defineList<OrderSummary>({
  key: "order",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/orders", { query: query as never }),
  getRowId: (row) => row.id,
  getRowName: (row) => row.orderCode,
  defaults: {
    filterKeys: ["queue", "status", "artworkStatus", "channel", "productType", "factoryId", "createdFrom", "createdTo"],
    sort: "createdAt",
    order: "desc",
  },
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
