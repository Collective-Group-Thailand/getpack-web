import "server-only";

import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

import type { Address, TaxProfile } from "./address";

export type Points = Schemas["LoyaltySummaryDto"];
export type PointsEntry = Schemas["PointsEntryDto"];
export type Referral = Schemas["MyReferralDto"];
export type StoreCredit = Schemas["StoreCreditDto"];
export type PrivacyRequest = Schemas["PrivacyRequestDto"];

/** The customer's export and deletion requests, newest first (`store.me.listPrivacyRequests`, D-222). */
export async function getPrivacyRequests(): Promise<PrivacyRequest[]> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/me/privacy-requests");
  return data ?? [];
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

/** The promotion codes the customer holds — assigned or saved — with whether each is usable (`store.promotions.listMine`). */
export async function getMyCodes(): Promise<Schemas["PromotionOfferDto"][]> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/promotions/mine");
  return data ?? [];
}

/** The customer's saved quotations, newest first as the API lists them (`store.quotes.list`). */
export async function getSavedQuotes(): Promise<Schemas["SavedQuoteDto"][]> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/quotes", { params: { query: { perPage: 50 } } });
  return data!.data;
}

/**
 * The saved addresses and tax-invoice profiles (`store.addresses.list`, `store.taxProfiles.list`),
 * as one page each — a book large enough to need a second page is not a customer's.
 */
export async function getAddressBook(): Promise<{ addresses: Address[]; taxProfiles: TaxProfile[] }> {
  const api = await serverApi("customer");
  const [addresses, taxProfiles] = await Promise.all([
    api.GET("/v1/store/addresses", { params: { query: { perPage: 100 } } }),
    api.GET("/v1/store/tax-profiles", { params: { query: { perPage: 100 } } }),
  ]);
  return { addresses: addresses.data!.data, taxProfiles: taxProfiles.data!.data };
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
