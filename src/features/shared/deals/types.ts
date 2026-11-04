/**
 * Points & Deals P1.5: the deals surface's shapes, from the generated contract (`store.promotions.listPublic` /
 * `getPublic` / `save`, `store.cart.applicableCodes`, `store.quotes.ladder`).
 *
 * What the API sends is display-ready: the deal's text comes from `promotions.display` in the request's locale, the
 * benefit carries its own one-line summary, and money is a decimal string the web only formats. The web adds no
 * deal, never computes a saving and never re-orders the list.
 */

import type { Schemas } from "@/lib/api/types";

export type Deal = Schemas["DealDto"];
export type DealDetail = Schemas["DealDetailDto"];
export type DealList = Schemas["DealListDto"];
export type DealBenefit = Schemas["DealBenefitDto"];
export type DealTab = Schemas["DealTab"];
export type DealMyStatus = Schemas["DealMyStatus"];
export type ApplicableCodes = Schemas["ApplicableCodesDto"];
/** `saving` is ex-VAT: what `checkCode` / apply takes off the goods before VAT. */
export type ApplicableCode = Schemas["ApplicableCodeDto"];
export type NotYetCode = Schemas["NotYetCodeDto"];
/** VAT-inclusive unit prices (D-220), the quotation's own options. */
export type QuoteLadder = Schemas["QuoteLadderDto"];

export const DEAL_TABS = ["all", "for_you", "ending_soon", "points"] as const satisfies readonly DealTab[];
