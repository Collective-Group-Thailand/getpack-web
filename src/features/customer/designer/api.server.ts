import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type MyDesign = Schemas["DesignDocumentDto"];

export interface OpenedDesign {
  data: MyDesign;
  etag: string | null;
  /** Each image asset with a signed URL, to refresh the document's image sources on open. */
  assets: { id: string; url: string }[];
}

/**
 * One of the customer's designs with its ETag; `null` for a design that is not theirs (404). Never
 * cached. An asset carries its signed URL once scanned clean; one without is signed for here.
 */
export async function getMyDesign(designId: string): Promise<OpenedDesign | null> {
  const api = await serverApi("customer");
  try {
    const { data, response } = await api.GET("/v1/store/designs/{designId}", { params: { path: { designId } } });
    const assets = await Promise.all(
      data!.assets.map(async (asset) => {
        if (asset.url) return [{ id: asset.id, url: asset.url }];
        const signed = await api
          .GET("/v1/store/files/{fileId}/download", { params: { path: { fileId: asset.fileId } } })
          .then(({ data: download }) => download?.url ?? null)
          .catch(() => null);
        return signed ? [{ id: asset.id, url: signed }] : [];
      }),
    );
    return { data: data!, etag: response.headers.get("etag"), assets: assets.flat() };
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** The customer's designs, newest first (`store.designs.list`). */
export async function listMyDesigns(): Promise<MyDesign[]> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/designs", {
    params: { query: { perPage: 100, sort: "updatedAt", order: "desc" } },
  });
  return data!.data;
}

/** The customer's latest designs and how many there are in all (the studio's front door). */
export async function listRecentDesigns(perPage: number): Promise<{ data: MyDesign[]; total: number }> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/designs", {
    params: { query: { perPage, sort: "updatedAt", order: "desc" } },
  });
  return { data: data!.data, total: data!.meta.total };
}

export type SharedDesignData = Schemas["SharedDesignDto"];

/**
 * A design shared by link (`store.designs.getShared`) with its ETag (an edit link's), `null` when
 * revoked, expired or unknown, or `"sign-in"` for a comment or edit link opened signed out (D-285).
 * Never cached.
 */
export async function getSharedDesign(
  token: string,
): Promise<{ data: SharedDesignData; etag: string | null } | "sign-in" | null> {
  try {
    const { data, response } = await (
      await serverApi("customer")
    ).GET("/v1/store/shared-designs/{token}", {
      params: { path: { token } },
    });
    return { data: data!, etag: response.headers.get("etag") };
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    if (isApiError(error) && error.status === 401) return "sign-in";
    throw error;
  }
}
