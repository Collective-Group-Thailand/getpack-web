import "server-only";

import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { serverRequests } from "@/lib/api/requests/server";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type Points = Schemas["LoyaltySummaryDto"];
export type PointsEntry = Schemas["PointsEntryDto"];
export type Referral = Schemas["MyReferralDto"];
export type StoreCredit = Schemas["StoreCreditDto"];
export type PrivacyRequest = ResponseOf<Requests, "GET /v1/store/me/privacy-requests">["data"][number];
export type Quotes = ResponseOf<Requests, "GET /v1/store/quotes">;

/** Everything here is one customer's, so none of it is cached (`catalog/api.server.ts`). */
export async function accountRequests() {
  return serverRequests("customer");
}

/** Balance, what expires soon and the tier (`store.loyalty.get`, D-130–D-134). */
export async function getPoints(): Promise<Points> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/loyalty");
  return data!;
}

/** The points ledger, in the API's order (`store.loyalty.ledger`). */
export async function getPointsEntries(perPage = 50): Promise<PointsEntry[]> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/loyalty/ledger", {
    params: { query: { perPage } },
  });
  return data!.data;
}

/** The customer's referral code, its link and how many friends used it (`store.referral.get`, D-136). */
export async function getReferral(): Promise<Referral> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/referral");
  return data!;
}

/** Store credit and its history (`store.documents.storeCredit`, D-080). */
export async function getStoreCredit(): Promise<StoreCredit> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/store-credit");
  return data!;
}

export async function getPreferences() {
  const api = await serverApi("customer");
  const [preferences, consents, me] = await Promise.all([
    api.GET("/v1/store/me/notification-preferences").then((response) => response.data ?? []),
    api.GET("/v1/store/me/consents").then((response) => response.data ?? []),
    api.GET("/v1/store/me").then((response) => response.data!),
  ]);
  return { preferences, consents, me };
}
