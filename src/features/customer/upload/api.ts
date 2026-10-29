"use client";

import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

/** C9 (D-457): the own-file check before ordering (`store.fileChecks.*`) as the upload page uses it. */

export type FileCheck = Schemas["FileCheckDto"];
export type FileCheckVersion = Schemas["FileCheckVersionDto"];
export type FileCheckItem = Schemas["FileCheckItemDto"];
export type FileCheckRules = Schemas["FileCheckRulesDto"];
export type PrintMethod = Schemas["PrintSideMethod"];

const RESOURCE = "file-checks";
/** How often the page asks while a file is being checked (the API's worker runs every 3 s). */
export const POLL_MS = 1_000;

export const checkKey = (id: string) => queryKeys.detail("customer", RESOURCE, id);

export function useFileCheckRules() {
  return useQuery({
    queryKey: [...queryKeys.zone("customer"), RESOURCE, "rules"],
    queryFn: async () => (await browserApi().GET("/v1/store/file-checks/rules")).data!,
    staleTime: 5 * 60_000,
  });
}

/** The check, polled while any of its files is still being checked. */
export function useFileCheck(id: string | null) {
  return useQuery({
    queryKey: checkKey(id ?? "none"),
    queryFn: async ({ signal }) =>
      (await browserApi().GET("/v1/store/file-checks/{checkId}", { params: { path: { checkId: id! } }, signal })).data!,
    enabled: id !== null,
    refetchInterval: (query) => (query.state.data && !query.state.data.done ? POLL_MS : false),
  });
}

export function useReorderable(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.list("customer", RESOURCE, { reorderable: true }),
    queryFn: async () => (await browserApi().GET("/v1/store/file-checks/reorderable")).data!.data,
    enabled,
    staleTime: 60_000,
  });
}

export async function createCheck(body: Schemas["CreateFileCheckDto"]): Promise<FileCheck> {
  const { data } = await browserApi().POST("/v1/store/file-checks", {
    params: { header: { "Idempotency-Key": newIdempotencyKey() } },
    body,
  });
  return data!;
}

export async function addFile(checkId: string, body: Schemas["AddFileCheckFileDto"]): Promise<FileCheck> {
  const { data } = await browserApi().POST("/v1/store/file-checks/{checkId}/files", {
    params: { path: { checkId }, header: { "Idempotency-Key": newIdempotencyKey() } },
    body,
  });
  return data!;
}

export async function removeVariant(checkId: string, variantNo: number): Promise<FileCheck> {
  const { data } = await browserApi().DELETE("/v1/store/file-checks/{checkId}/variants/{variantNo}", {
    params: { path: { checkId, variantNo } },
  });
  return data!;
}

export async function updateSpec(checkId: string, body: Schemas["UpdateFileCheckSpecDto"]): Promise<FileCheck> {
  const { data } = await browserApi().PATCH("/v1/store/file-checks/{checkId}", {
    params: { path: { checkId } },
    body,
  });
  return data!;
}

export async function addCheckedFileToCart(
  checkId: string,
  body: Schemas["FileCheckCartDto"],
): Promise<Schemas["FileCheckCartResultDto"]> {
  const { data } = await browserApi().POST("/v1/store/file-checks/{checkId}/actions/add-to-cart", {
    params: { path: { checkId }, header: { "Idempotency-Key": newIdempotencyKey() } },
    body,
  });
  return data!;
}

export async function versionFileUrl(checkId: string, versionId: string): Promise<string> {
  const { data } = await browserApi().GET("/v1/store/file-checks/{checkId}/versions/{versionId}/file", {
    params: { path: { checkId, versionId } },
  });
  return data!.url;
}

/** The current versions that finished their check. */
export const checkedVersions = (check: FileCheck) =>
  check.variants.map((v) => v.current).filter((v) => v.status === "done" && v.report);

/** The product's configurator (its sizes, materials, print model) — the same data /configure prices from. */
export function useConfigurator(slug: string | null) {
  return useQuery({
    queryKey: queryKeys.detail("customer", "configurator", slug ?? "none"),
    queryFn: async ({ signal }) =>
      (
        await browserApi().GET("/v1/store/catalog/products/{slug}/configurator", {
          params: { path: { slug: slug! } },
          signal,
        })
      ).data!,
    enabled: slug !== null,
    staleTime: 5 * 60_000,
  });
}
