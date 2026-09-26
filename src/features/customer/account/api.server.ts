import "server-only";

import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { serverRequests } from "@/lib/api/requests/server";
import { serverApi } from "@/lib/api/server";

export type Points = ResponseOf<Requests, "GET /v1/store/me/points">;
export type PointsEntries = ResponseOf<Requests, "GET /v1/store/me/points/entries">;
export type Referral = ResponseOf<Requests, "GET /v1/store/me/referral">;
export type Wallet = ResponseOf<Requests, "GET /v1/store/me/wallet">;
export type PrivacyRequest = ResponseOf<Requests, "GET /v1/store/me/privacy-requests">["data"][number];
export type Quotes = ResponseOf<Requests, "GET /v1/store/quotes">;

/** Everything here is one customer's, so none of it is cached (`catalog/api.server.ts`). */
export async function accountRequests() {
  return serverRequests("customer");
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
