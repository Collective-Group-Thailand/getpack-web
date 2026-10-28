import "server-only";

import type { NextAction } from "@/domain/status/next-action";
import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type OrderGroup = Schemas["OrderGroupDto"];
export type Order = Schemas["OrderDto"];
export type OrderView = "active" | "completed" | "cancelled";
/** D-453: the account list's tabs (`store.orders.listGroups?tab=`), the API's rules over the customer status. */
export type OrderTab = Schemas["StoreOrderTab"];
export type OrderTabCounts = Schemas["StoreOrderTabCountsDto"];

/** An order and what its page shows beside it, each from its own published read. */
export interface OrderDetail {
  order: Order;
  group: OrderGroup | null;
  /** The instalments that pay for this order (`store.paymentSchedules.listInstalments`), each saying if it can be paid now. */
  instalments: Schemas["StoreInstalmentDto"][];
  timeline: Schemas["TimelineEntryDto"][];
  progress: Schemas["OrderProgressDto"] | null;
  shipments: Schemas["StoreShipmentDto"][];
  documents: Schemas["CustomerDocumentDto"][];
  claims: Schemas["StoreClaimDto"][];
  /** What the customer may do now: the order's own `nextActions` (U-B0.3). */
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

/** An order in a list, with its group and its own `nextActions`. */
export interface OrderRow {
  order: Order;
  group: OrderGroup;
  actions: NextAction[];
}

/**
 * The customer's orders in a view, group by group, each with what the API says can be done on it
 * now (`nextActions`). Paying is the group's: a row in a group waiting for payment links to it.
 */
export async function listMyOrders(view?: OrderView): Promise<OrderRow[]> {
  const groups = await listMyOrderGroups();
  return groups.flatMap((group) =>
    group.orders
      .filter((order) => !view || viewOf(order) === view)
      .map((order) => ({ order, group, actions: order.nextActions })),
  );
}

/** How many of the customer's orders each tab holds (`store.orders.tabCounts`, D-453). */
export async function getOrderTabCounts(): Promise<OrderTabCounts> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/order-tabs");
  return data!;
}

/** One page of the account list (D-453): the groups with orders in `tab` matching `q`, as the API filters them. */
export async function listOrderPage(
  tab: OrderTab,
  q: string,
  page: number,
  perPage = 20,
): Promise<{ groups: OrderGroup[]; total: number }> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/order-groups", {
    params: { query: { tab, page, perPage, ...(q ? { q } : {}) } },
  });
  return { groups: data!.data, total: data!.meta.total };
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
 * Documents are the customer's (filtered here to the order); a claim is found by the order it
 * names; the instalments that pay for it by the orders each names.
 */
export async function getMyOrder(orderId: string): Promise<OrderDetail | null> {
  const api = await serverApi("customer");
  const order = await orNull(
    api.GET("/v1/store/orders/{orderId}", { params: { path: { orderId } } }).then(({ data }) => data!),
  );
  if (!order) return null;
  const path = { params: { path: { orderId } } };
  const [group, instalments, timeline, progress, shipments, documents, claims] = await Promise.all([
    orNull(
      api
        .GET("/v1/store/order-groups/{groupId}", { params: { path: { groupId: order.payment.groupId } } })
        .then(({ data }) => data!),
    ),
    orNull(api.GET("/v1/store/instalments", { params: { query: { perPage: 100 } } }).then(({ data }) => data!.data)),
    orNull(api.GET("/v1/store/orders/{orderId}/timeline", path).then(({ data }) => data!.data)),
    orNull(api.GET("/v1/store/orders/{orderId}/progress", path).then(({ data }) => data!)),
    orNull(api.GET("/v1/store/orders/{orderId}/shipments", path).then(({ data }) => data!)),
    orNull(api.GET("/v1/store/documents", { params: { query: { perPage: 100 } } }).then(({ data }) => data!.data)),
    orNull(api.GET("/v1/store/claims", { params: { query: { orderId } } }).then(({ data }) => data!.data)),
  ]);
  return {
    order,
    group,
    instalments: (instalments ?? [])
      .filter((instalment) => instalment.orders.some((ref) => ref.orderId === order.id))
      .sort((a, b) => a.seq - b.seq),
    timeline: timeline ?? [],
    progress,
    shipments: shipments ?? [],
    documents: (documents ?? []).filter((document) => document.orderId === order.id),
    claims: claims ?? [],
    actions: order.nextActions,
  };
}

/**
 * The studio design an order locked (D-276): the customer's linked designs, the one whose lock
 * names this order. The API has no lookup by order, so the first page of linked designs is read.
 */
export async function findLockedDesignOf(
  orderId: string,
): Promise<{ designId: string; title: string; versionNo: number } | null> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/designs", { params: { query: { linked: "linked", perPage: 100 } } });
  const design = data?.data.find((candidate) => candidate.lock?.orderId === orderId);
  return design?.lock ? { designId: design.id, title: design.title, versionNo: design.lock.versionNo } : null;
}

/** The document of a design version, as the studio saved it (read-only, for the proof screen). */
export async function getDesignVersion(
  designId: string,
  versionNo: number,
): Promise<{ spec: unknown; content: unknown } | null> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/designs/{designId}/versions/{versionNo}", { params: { path: { designId, versionNo } } });
  return data?.document ? { spec: data.document.spec, content: data.document.content } : null;
}
