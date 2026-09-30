import "server-only";

import { orderActions } from "@/domain/next-actions/store";
import type { NextAction } from "@/domain/status/next-action";
import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type OrderGroup = Schemas["OrderGroupDto"];
export type Order = Schemas["OrderDto"];
export type OrderView = "active" | "completed" | "cancelled";

/** An order and what its page shows beside it, each from its own published read. */
export interface OrderDetail {
  order: Order;
  group: OrderGroup | null;
  schedule: Schemas["PaymentScheduleDto"] | null;
  timeline: Schemas["TimelineEntryDto"][];
  progress: Schemas["OrderProgressDto"] | null;
  shipments: Schemas["StoreShipmentDto"][];
  documents: Schemas["CustomerDocumentDto"][];
  claims: Schemas["StoreClaimDto"][];
  /** What the customer is offered now (`src/domain/next-actions/store.ts`). */
  actions: NextAction[];
}

/** The API's `null`: a 404 or 403 (not this customer's) is "not there" to a page. */
async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}

/** Which view an order belongs to — the customer's own filter over what the API listed. */
export function viewOf(order: Pick<Order, "status">): OrderView {
  return order.status === "cancelled" ? "cancelled" : order.status === "completed" ? "completed" : "active";
}

/**
 * The customer's order groups (`store.orders.listGroups`), newest first as the API lists them —
 * one customer's data, never cached. Each group holds its orders (D-110: one checkout, several).
 */
export async function listMyOrderGroups(page = 1): Promise<Schemas["OrderGroupDto"][]> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/order-groups", {
    params: { query: { page, perPage: 20 } },
  });
  return data!.data;
}

/** An order in a list, with its group and what is offered on it from what the list says. */
export interface OrderRow {
  order: Order;
  group: OrderGroup;
  actions: NextAction[];
}

/**
 * The customer's orders in a view, group by group. A listed order says nothing of its deliveries or
 * instalments, so a list offers what its status and its group's say (paying, artwork, a proof); for
 * an order out for delivery it reads the deliveries too, so receiving, claiming and reordering are
 * offered from the list as well.
 *
 * CONTRACT-GAP entity.next-actions — one extra read per order in `shipping`; drop it when the
 * listed orders carry their own actions.
 */
export async function listMyOrders(view?: OrderView): Promise<OrderRow[]> {
  const api = await serverApi("customer");
  const groups = await listMyOrderGroups();
  const rows = groups.flatMap((group) =>
    group.orders.filter((order) => !view || viewOf(order) === view).map((order) => ({ order, group })),
  );
  const delivered = await Promise.all(
    rows.map(({ order }) =>
      order.status === "shipping"
        ? orNull(
            api
              .GET("/v1/store/orders/{orderId}/shipments", { params: { path: { orderId: order.id } } })
              .then(({ data }) => data!.some((shipment) => shipment.status === "delivered")),
          ).then(Boolean)
        : false,
    ),
  );
  return rows.map(({ order, group }, index) => ({
    order,
    group,
    actions: orderActions({
      status: order.status,
      artworkStatus: order.artworkStatus,
      designOption: order.designOption,
      delivered: delivered[index]!,
      instalmentDue: group.status === "waiting_payment",
    }),
  }));
}

/**
 * The group an order belongs to, found by the order's code (`store.orders.listGroups?q=`).
 * CONTRACT-GAP store.order-group-ref — `OrderDto` does not name its group.
 */
export async function findGroupOf(orderCode: string): Promise<OrderGroup | null> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/order-groups", {
    params: { query: { q: orderCode } },
  });
  return data?.data.find((group) => group.orders.some((order) => order.orderCode === orderCode)) ?? null;
}

/**
 * One of their orders with everything its page needs, or `null` for anyone else's (the API's 404).
 *
 * CONTRACT-GAP store.orders — the published order is lean: its product is its type, and there are
 * no receipt dates, no tolerance outcome and no estimated delivery; documents are the customer's
 * (filtered here to the order), and a claim or document is found by the order it names.
 */
export async function getMyOrder(orderId: string): Promise<OrderDetail | null> {
  const api = await serverApi("customer");
  const order = await orNull(
    api.GET("/v1/store/orders/{orderId}", { params: { path: { orderId } } }).then(({ data }) => data!),
  );
  if (!order) return null;
  const path = { params: { path: { orderId } } };
  const [group, timeline, progress, shipments, documents, claims] = await Promise.all([
    findGroupOf(order.orderCode),
    orNull(api.GET("/v1/store/orders/{orderId}/timeline", path).then(({ data }) => data!.data)),
    orNull(api.GET("/v1/store/orders/{orderId}/progress", path).then(({ data }) => data!)),
    orNull(api.GET("/v1/store/orders/{orderId}/shipments", path).then(({ data }) => data!)),
    orNull(api.GET("/v1/store/documents", { params: { query: { perPage: 100 } } }).then(({ data }) => data!.data)),
    orNull(api.GET("/v1/store/claims", { params: { query: { orderId } } }).then(({ data }) => data!.data)),
  ]);
  const schedule = group
    ? await orNull(
        api
          .GET("/v1/store/order-groups/{groupId}/payment-schedule", { params: { path: { groupId: group.id } } })
          .then(({ data }) => data!),
      )
    : null;
  const due = schedule?.instalments.some(
    (instalment) => instalment.status === "due" || instalment.status === "overdue",
  );
  return {
    order,
    group,
    schedule,
    timeline: timeline ?? [],
    progress,
    shipments: shipments ?? [],
    documents: (documents ?? []).filter((document) => document.orderId === order.id),
    claims: claims ?? [],
    actions: orderActions({
      status: order.status,
      artworkStatus: order.artworkStatus,
      designOption: order.designOption,
      delivered: (shipments ?? []).some((shipment) => shipment.status === "delivered"),
      instalmentDue: Boolean(due),
    }),
  };
}
