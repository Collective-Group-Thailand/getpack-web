"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";

import { adminBrowserApis } from "../console/api";
import type { Order } from "../orders/resources";
import type { DesignService, Proof } from "./resources";

/*
 * The prepress workspace, composed (U-F0.3): packio-api publishes no workspace aggregate, so the
 * page reads the order (`admin.orders.get`) and each of its artwork resources. The keys sit under
 * the order's, so the order screen's artwork tab and this page share one cache, and one
 * invalidation of the order refreshes both.
 */

const path = (orderId: string) => ({ path: { orderId } });

/** The order's artwork versions, newest first, with their preflight reports (`admin.artwork.list`). */
export function useSubmissions(orderId: string) {
  return useQuery({
    queryKey: queryKeys.related("admin", "order", orderId, "artwork"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/artwork-submissions", {
          params: path(orderId),
        })
      ).data!,
    staleTime: STALE_TIME.transactional,
  });
}

/** The order's proof versions, newest first, each with its annotations (`admin.artwork.listProofs`). */
export function useProofs(orderId: string) {
  return useQuery({
    queryKey: queryKeys.related("admin", "order", orderId, "proofs"),
    queryFn: async () =>
      [
        ...(await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/proofs", { params: path(orderId) }))
          .data!,
      ].sort((a, b) => b.versionNo - a.versionNo),
    staleTime: STALE_TIME.transactional,
  });
}

/** One proof with its annotation threads inline (`admin.artwork.getProof`). */
export function useProof(proof: Proof) {
  return useQuery({
    queryKey: queryKeys.detail("admin", "proof", proof.id),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/proofs/{proofId}", { params: { path: { proofId: proof.id } } }))
        .data!,
    initialData: proof,
    staleTime: STALE_TIME.transactional,
  });
}

/** The dieline templates sent to the customer (`admin.artwork.listTemplates`). */
export function useTemplates(orderId: string) {
  return useQuery({
    queryKey: queryKeys.related("admin", "order", orderId, "templates"),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/templates", { params: path(orderId) })).data!,
    staleTime: STALE_TIME.transactional,
  });
}

/** The order's dieline drawings, newest first (`admin.designs.listOrderDrawings`). */
export function useDrawings(orderId: string) {
  return useQuery({
    queryKey: queryKeys.related("admin", "order", orderId, "drawings"),
    queryFn: async () =>
      [
        ...(await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/drawings", { params: path(orderId) }))
          .data!,
      ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    staleTime: STALE_TIME.transactional,
  });
}

const PER_PAGE = 100;
const MAX_PAGES = 10;

/**
 * The order's hired design (D-071), for an order that chose one.
 *
 * CONTRACT-GAP admin.prepress — the order does not name its design service and
 * `admin.designServices.list` has no order filter (its `q` is not applied), so the list is paged
 * until the service whose `orderId` is this order's turns up.
 */
export function useOrderDesignService(order: Pick<Order, "id" | "designOption"> | undefined) {
  return useQuery({
    queryKey: queryKeys.related("admin", "order", order?.id ?? "", "design_service"),
    enabled: order?.designOption === "hired_design",
    queryFn: async (): Promise<DesignService | null> => {
      const contract = adminBrowserApis().contract;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { data } = await contract.GET("/v1/admin/design-services", {
          params: { query: { page, perPage: PER_PAGE } },
        });
        const found = data!.data.find((service) => service.orderId === order!.id);
        if (found) return found;
        if (page * PER_PAGE >= data!.meta.total) break;
      }
      return null;
    },
    staleTime: STALE_TIME.transactional,
  });
}

/** Keeps the workspace, the desk, the order screen and the dashboard in step after a write. */
export function usePrepressSettle(orderId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "order", orderId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "proof") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "prepress") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "order") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
}
