"use client";

import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";

/**
 * The calls the E4 sales and receivables screens make on a document of the factory's (D-359 – D-367). Every
 * path is a contract path under `/v1/partner/factories/{factoryId}/erp`; a mutation carries one
 * `Idempotency-Key` per intent and, for a document read with its ETag, `If-Match`.
 */

type Init = {
  params: { path: Record<string, string>; header?: Record<string, string | undefined>; query?: Record<string, string> };
  body?: unknown;
};
type Call = (path: string, init: Init) => Promise<{ data?: unknown }>;

export const ERP = "/v1/partner/factories/{factoryId}/erp";

/** `POST` to an E4 path; `path` is relative to `…/erp` with its `{placeholders}` filled from `params`. */
export async function erpPost<T = unknown>(
  factoryId: string,
  path: string,
  params: Record<string, string>,
  body?: unknown,
  options: { idempotencyKey?: string; etag?: string | null } = {},
): Promise<T> {
  const post = browserApi().POST as unknown as Call;
  const { data } = await post(`${ERP}${path}`, {
    params: {
      path: { factoryId, ...params },
      header: {
        "Idempotency-Key": options.idempotencyKey ?? newIdempotencyKey(),
        ...(options.etag ? { "If-Match": options.etag } : {}),
      },
    },
    body: body ?? {},
  });
  return data as T;
}

/** `PUT` / `PATCH` a draft under `If-Match`. */
export async function erpSave<T = unknown>(
  method: "PUT" | "PATCH",
  factoryId: string,
  path: string,
  params: Record<string, string>,
  body: unknown,
  etag: string | null | undefined,
): Promise<T> {
  const send = (method === "PUT" ? browserApi().PUT : browserApi().PATCH) as unknown as Call;
  const { data } = await send(`${ERP}${path}`, {
    params: { path: { factoryId, ...params }, header: etag === null ? {} : { "If-Match": etag ?? "" } },
    body,
  });
  return data as T;
}

/** `DELETE` a draft. */
export async function erpDelete(factoryId: string, path: string, params: Record<string, string>) {
  const remove = browserApi().DELETE as unknown as Call;
  await remove(`${ERP}${path}`, { params: { path: { factoryId, ...params } } });
}

/** `GET` an E4 read from the browser (a picker that depends on a choice already made). */
export async function erpGet<T = unknown>(
  factoryId: string,
  path: string,
  params: Record<string, string> = {},
  query: Record<string, string> = {},
): Promise<T> {
  const get = browserApi().GET as unknown as Call;
  const { data } = await get(`${ERP}${path}`, { params: { path: { factoryId, ...params }, query } });
  return data as T;
}

/** Opens a document's PDF (a short-lived link the API hands out) in a new tab. */
export async function openPdf(factoryId: string, path: string, params: Record<string, string>) {
  const tab = window.open("", "_blank");
  try {
    const link = await erpGet<{ url: string }>(factoryId, path, params);
    if (tab) tab.location.href = link.url;
    else window.location.assign(link.url);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
