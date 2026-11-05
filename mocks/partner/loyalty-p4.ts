/**
 * Loyalty P4 (D-506): the factory's own co-funding offers — list, detail with the orders counted, accept and decline.
 *
 * Contract requests (`mockRequest`), validated against `src/lib/api/requests/partner-loyalty-p4.ts`. The offers are the
 * shared ones of `../admin/cofunding-state.ts`; a factory sees only its own (another factory's id answers 404, as the
 * API's scope check does). Accept / decline need `factory_cofunding.decide` (the owner).
 */

import { partnerPersonaOf } from "../auth";
import { cofunding, expireDue, partnerOfferDetailOf, partnerOfferOf } from "../admin/cofunding-state";
import { mockRequest } from "../route";
import { bangkokIso, paginate, problem } from "../support";
import { canPartner } from "./personas";

const notFound = () => problem(404, "http.not_found", "ไม่พบรายการนี้");
const forbidden = () => problem(403, "http.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");

/** The netted shares of a factory's offers — the `cofunding` lines of its latest billing statement (`./billing.ts`). */
export function cofundingSharesOf(factoryId: string): { orderCode: string; dealName: string; amount: number }[] {
  return cofunding.contributions
    .filter((row) => row.status === "netted")
    .flatMap((row) => {
      const offer = cofunding.offers.find((candidate) => candidate.id === row.offerId);
      return offer && offer.factoryId === factoryId
        ? [{ orderCode: row.orderCode, dealName: offer.deal.name, amount: Math.round(Number(row.shareAmount) * 100) }]
        : [];
    });
}

function mine(request: Request, offerId: string) {
  const who = partnerPersonaOf(request);
  if (!who) return { error: problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ") };
  if (!canPartner(who, "factory_cofunding.read")) return { error: forbidden() };
  const offer = cofunding.offers.find((candidate) => candidate.id === offerId && candidate.factoryId === who.factoryId);
  return offer ? { who, offer } : { error: notFound() };
}

export const partnerLoyaltyP4Handlers = [
  // CONTRACT-REQUEST partner.cofunding-offers — newest first, the caller's factory only
  mockRequest("GET /v1/partner/cofunding-offers", ({ request, query }) => {
    const who = partnerPersonaOf(request);
    if (!who) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    if (!canPartner(who, "factory_cofunding.read")) return forbidden();
    if (query.factoryId && query.factoryId !== who.factoryId) return notFound();
    expireDue();
    const decide = canPartner(who, "factory_cofunding.decide");
    const rows = cofunding.offers
      .filter((offer) => offer.factoryId === who.factoryId && (!query.status || offer.status === query.status))
      .sort((a, b) => b.proposedAt.localeCompare(a.proposedAt))
      .map((offer) => partnerOfferOf(offer, decide));
    return paginate(rows, { page: query.page, perPage: query.perPage ?? 50 });
  }),
  // CONTRACT-REQUEST partner.cofunding-offers
  mockRequest("GET /v1/partner/cofunding-offers/{offerId}", ({ request, params }) => {
    expireDue();
    const found = mine(request, params.offerId!);
    if ("error" in found) return found.error!;
    return partnerOfferDetailOf(found.offer, canPartner(found.who, "factory_cofunding.decide"));
  }),
  // CONTRACT-REQUEST partner.cofunding-offers
  mockRequest("POST /v1/partner/cofunding-offers/{offerId}/actions/accept", ({ request, params }) => {
    const found = mine(request, params.offerId!);
    if ("error" in found) return found.error!;
    const { who, offer } = found;
    if (!canPartner(who, "factory_cofunding.decide")) return forbidden();
    if (offer.status !== "proposed") return problem(409, "cofunding.invalid_transition", "ข้อเสนอนี้ตอบไปแล้ว");
    if (offer.respondBy < bangkokIso(0)) return problem(409, "cofunding.response_closed", "หมดเวลาตอบข้อเสนอนี้แล้ว");
    Object.assign(offer, {
      status: "accepted",
      answeredAt: bangkokIso(0),
      answeredBy: { id: who.id, displayName: who.displayName },
      rowVersion: offer.rowVersion + 1,
    });
    return partnerOfferOf(offer, true);
  }),
  // CONTRACT-REQUEST partner.cofunding-offers
  mockRequest("POST /v1/partner/cofunding-offers/{offerId}/actions/decline", ({ request, params, body }) => {
    const found = mine(request, params.offerId!);
    if ("error" in found) return found.error!;
    const { who, offer } = found;
    if (!canPartner(who, "factory_cofunding.decide")) return forbidden();
    if (offer.status !== "proposed") return problem(409, "cofunding.invalid_transition", "ข้อเสนอนี้ตอบไปแล้ว");
    if (offer.respondBy < bangkokIso(0)) return problem(409, "cofunding.response_closed", "หมดเวลาตอบข้อเสนอนี้แล้ว");
    Object.assign(offer, {
      status: "declined",
      answeredAt: bangkokIso(0),
      answeredBy: { id: who.id, displayName: who.displayName },
      declineReason: body.reason,
      rowVersion: offer.rowVersion + 1,
    });
    return partnerOfferOf(offer, true);
  }),
];
