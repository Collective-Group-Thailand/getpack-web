import type { CofundingOfferStatus, PartnerCofundingOffer } from "@/lib/api/requests/partner-loyalty-p4";

/** Badge tone per offer status: amber only for the one state that waits on the factory (P4 design rule). */
export const OFFER_STATUS_TONE: Record<CofundingOfferStatus, "accent" | "success" | "neutral"> = {
  proposed: "accent",
  accepted: "success",
  declined: "neutral",
  withdrawn: "neutral",
  expired: "neutral",
  ended: "neutral",
};

export const OFFER_VIEWS = ["open", "accepted", "all"] as const;
export type OfferView = (typeof OFFER_VIEWS)[number];

/** Live offers first (awaiting an answer, then accepted), the rest under "ที่ผ่านมา". */
export const isClosed = (offer: Pick<PartnerCofundingOffer, "status">) =>
  !["proposed", "accepted"].includes(offer.status);

export function inView(offer: Pick<PartnerCofundingOffer, "status">, view: OfferView): boolean {
  if (view === "open") return offer.status === "proposed";
  if (view === "accepted") return offer.status === "accepted";
  return true;
}

/** Accrued as a share of the cap, for the meter only (two strings the API sent). */
export const capPct = (offer: Pick<PartnerCofundingOffer, "accruedAmount" | "capAmount">) =>
  Number(offer.capAmount) > 0 ? Math.round((Number(offer.accruedAmount) / Number(offer.capAmount)) * 100) : 0;
