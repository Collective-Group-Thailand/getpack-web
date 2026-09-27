import "server-only";

import { isApiError } from "@/lib/api/problem";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { serverRequests } from "@/lib/api/requests/server";

export type MyDesign = ResponseOf<Requests, "GET /v1/store/designs/{designId}">;
export type MyDesignSummary = ResponseOf<Requests, "GET /v1/store/designs">["data"][number];

/** One of the customer's designs with its ETag; `null` for a design that is not theirs (404). Never cached. */
export async function getMyDesign(designId: string): Promise<{ data: MyDesign; etag: string | null } | null> {
  try {
    return await (await serverRequests("customer")).read("GET /v1/store/designs/{designId}", { path: { designId } });
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** The customer's designs, newest first. */
export async function listMyDesigns(): Promise<MyDesignSummary[]> {
  const page = await (await serverRequests("customer")).call("GET /v1/store/designs", { query: { perPage: 100 } });
  return page.data;
}
