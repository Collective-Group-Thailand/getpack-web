"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import type { Order, OrderGroup } from "./resources";

export type QueuedSlip = Schemas["SlipQueueItemDto"];

/** The lean published order (`admin.orders.get`); the rest of the page reads its own resources. */
export function useOrder(orderId: string, initial?: Order | null) {
  return useQuery({
    queryKey: queryKeys.detail("admin", "order", orderId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}", { params: { path: { orderId } } })).data!,
    initialData: initial ?? undefined,
    staleTime: STALE_TIME.transactional,
  });
}

/**
 * The order's group. `AdminOrderDto` still does not name its group (CONTRACT-GAP admin.orders), so
 * it is the group whose orders include this one, found by the order's code (`q` matches it).
 */
export function useOrderGroup(order: Pick<Order, "id" | "orderCode"> | undefined) {
  return useQuery({
    queryKey: queryKeys.related("admin", "order", order?.id ?? "", "group"),
    enabled: Boolean(order),
    queryFn: async (): Promise<OrderGroup | null> => {
      const groups = (
        await adminBrowserApis().contract.GET("/v1/admin/order-groups", {
          params: { query: { q: order!.orderCode, perPage: 10 } },
        })
      ).data!.data;
      return groups.find((group) => group.orders.some((member) => member.id === order!.id)) ?? null;
    },
    staleTime: STALE_TIME.transactional,
  });
}

/**
 * The group's slips waiting for Finance (D-061), from the slip queue, which is Finance's to work
 * (`payments.verify_slip`). The queue is searched by group code and kept to this group. Every other
 * role learns a slip waits from the group's `hasSlipToReview`.
 */
export function useGroupSlips(group: Pick<OrderGroup, "id" | "groupCode"> | null | undefined) {
  const allowed = useCan("payments.verify_slip");
  return useQuery({
    queryKey: queryKeys.list("admin", "slip", { groupId: group?.id }),
    enabled: Boolean(group) && allowed,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/slips", {
          params: { query: { q: group!.groupCode, perPage: 50 } },
        })
      ).data!.data.filter((slip) => slip.groupId === group!.id),
    staleTime: STALE_TIME.live,
  });
}

/** The group's payment schedule (`admin.paymentSchedules.get`) — the instalments live there. */
export function useGroupSchedule(groupId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.related("admin", "order_group", groupId ?? "", "schedule"),
    enabled: Boolean(groupId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/order-groups/{groupId}/payment-schedule", {
          params: { path: { groupId: groupId! } },
        })
      ).data!,
    staleTime: STALE_TIME.transactional,
  });
}

/**
 * The group's payments with their slips (`admin.payments.list?groupId`, v0.5.0), for roles that read
 * payments (`payments.read`).
 */
export function useGroupPayments(groupId: string | undefined) {
  const allowed = useCan("payments.read");
  return useQuery({
    queryKey: queryKeys.list("admin", "payment", { groupId }),
    enabled: Boolean(groupId) && allowed,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/payments", {
          params: { query: { groupId: groupId!, perPage: 50, sort: "createdAt", order: "desc" } },
        })
      ).data!,
    staleTime: STALE_TIME.transactional,
  });
}
