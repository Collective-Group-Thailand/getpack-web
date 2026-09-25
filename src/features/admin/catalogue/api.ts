/**
 * The published catalogue tables, addressed generically by their collection path.
 *
 * `TABLES` declares ~40 tables whose operations are all the same shape (api-conventions §3):
 * `GET` a page, `POST` a row, `GET` a row with its `ETag`, `PATCH` it under `If-Match`. Typing
 * each call against its own path would mean one hand-written screen per table; this calls the
 * contract client with the path as data instead, and the registry's field names — checked
 * against the DTOs in `./tables.ts` — are what keep it honest.
 */

import { ifMatch } from "@/lib/api/client";
import type { Page } from "@/lib/api/requests/define";

import type { AdminApis } from "../console/api";

export type CatalogueRow = { id: string; updatedAt?: string; status?: string } & Record<string, unknown>;

type Init = {
  params?: { path?: Record<string, string>; query?: Record<string, unknown>; header?: Record<string, string> };
  body?: unknown;
  headers?: Record<string, string>;
};
type Result = { data?: unknown; response: Response };
type Loose = Record<"GET" | "POST" | "PATCH" | "PUT" | "DELETE", (path: string, init?: Init) => Promise<Result>>;

/** The contract client with its path types set aside — see the module comment. */
export const loose = (contract: AdminApis["contract"]) => contract as unknown as Loose;

export async function listRows(contract: AdminApis["contract"], path: string, query: Record<string, unknown>) {
  return (await loose(contract).GET(path, { params: { query } })).data as Page<CatalogueRow>;
}

export async function getRow(contract: AdminApis["contract"], path: string, id: string) {
  const { data, response } = await loose(contract).GET(`${path}/{id}`, { params: { path: { id } } });
  return { row: data as CatalogueRow, etag: response.headers.get("etag") ?? "" };
}

export async function createRow(contract: AdminApis["contract"], path: string, body: Record<string, unknown>) {
  return (await loose(contract).POST(path, { body })).data as CatalogueRow;
}

/**
 * Reads the row's current `ETag`, then patches under it. Two people editing the same row: the
 * second save answers `412`, which the form shows as "changed since you opened it" rather than
 * silently overwriting the first.
 */
export async function updateRow(
  contract: AdminApis["contract"],
  path: string,
  id: string,
  body: Record<string, unknown>,
  etag?: string,
) {
  const current = etag ?? (await getRow(contract, path, id)).etag;
  const { data } = await loose(contract).PATCH(`${path}/{id}`, {
    params: { path: { id } },
    body,
    headers: ifMatch(current),
  });
  return data as CatalogueRow;
}

export async function deleteRow(contract: AdminApis["contract"], path: string, id: string) {
  const { etag } = await getRow(contract, path, id);
  await loose(contract).DELETE(`${path}/{id}`, { params: { path: { id } }, headers: ifMatch(etag) });
}

/** A readable name for a row of any table, for reference pickers and restatements. */
export function rowLabel(row: CatalogueRow, locale: string): string {
  const pick = (...keys: string[]) =>
    keys.map((key) => row[key]).find((value) => typeof value === "string" && value.length > 0) as string | undefined;
  return (
    (locale === "en" ? pick("nameEn", "titleEn", "name", "nameTh", "titleTh") : pick("nameTh", "titleTh", "name")) ??
    pick("title", "questionTh", "code", "slug", "sku", "pageKey") ??
    row.id
  );
}
