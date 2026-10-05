/**
 * Repeat business (U2.F5) for the storefront mock:
 * - `store.reorderSuggestions.*` (D-288): one suggestion per product type the customer has bought,
 *   from their latest order; dismissing keeps it out of the list;
 * - `store.callOffs.*` (D-290): a call-off asked for on a saved quotation is `pending_factory`; the
 *   mock's factory accepts it on the next read (the real one decides). A release ≥ the minimum and
 *   ≤ what is left puts a quotation at the locked price in the cart and answers the cart;
 * - `store.companyApiClients.*` (D-291): a Company Admin's API clients, the secret answered once.
 * Every amount is the mock's own fake one; nothing is priced here.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, mockId, problem } from "../support";
import { companyMembershipOf } from "./business";
import { addToCart, toCartDto } from "./cart";
import { customerOf, type MockCustomer } from "./customers";
import { ordersOf } from "./orders";
import { findQuote, nextQuoteId, quotesOf, type StoreQuote } from "./quotes";

const DAY = 24 * 60;

/** The mock's product type as the published `CodeNameRefDto` (one name for both languages). */
const typeRef = (type: { code: string; name: string }) =>
  ({
    code: type.code,
    id: mockId("ptp", type.code.length),
    nameTh: type.name,
    nameEn: type.name,
  }) as Schemas["CodeNameRefDto"];
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");

/* --------------------------------------------------------------------------- suggestions */

const dismissed = new Map<string, Set<string>>();

export function suggestionsOf(customer: MockCustomer): Schemas["ReorderSuggestionDto"][] {
  const gone = dismissed.get(customer.persona) ?? new Set<string>();
  const latestByType = new Map<string, ReturnType<typeof ordersOf>[number]>();
  for (const order of ordersOf(customer)) {
    if (!["completed", "shipping"].includes(order.status)) continue;
    if (!latestByType.has(order.productType.code)) latestByType.set(order.productType.code, order);
  }
  return [...latestByType.values()].map((order, i) => {
    const id = mockId("rsg", i + 1 + customer.persona.length * 10);
    return {
      id,
      status: gone.has(id) ? "dismissed" : "open",
      company: null,
      computedAt: bangkokIso(-60),
      averageIntervalDays: "30.00",
      lastLeadTimeDays: 10,
      lastOrder: { orderCode: order.orderCode, orderId: order.id, quantity: order.quantity, unit: order.unit },
      nextNeedOn: bangkokIso(20 * DAY).slice(0, 10),
      suggestedOn: bangkokIso(8 * DAY).slice(0, 10),
      suggestedQuantity: order.quantity,
      orderCount: 3,
      productType: typeRef(order.productType),
    } as Schemas["ReorderSuggestionDto"];
  });
}

/* ------------------------------------------------------------------------------ call-offs */

const agreements = new Map<string, Schemas["CallOffAgreementDto"][]>();
const agreementsOf = (customer: MockCustomer) => {
  if (!agreements.has(customer.persona)) agreements.set(customer.persona, []);
  return agreements.get(customer.persona)!;
};
let agreementSeq = 1;
let releaseSeq = 1;

/** The mock's factory accepts a pending call-off when it is next read. */
function settle(agreement: Schemas["CallOffAgreementDto"]) {
  if (agreement.status !== "pending_factory") return agreement;
  agreement.status = "active";
  agreement.startsAt = bangkokIso();
  agreement.expiresAt = bangkokIso(agreement.months * 30 * DAY);
  return agreement;
}

/* ---------------------------------------------------------------------------- API clients */

const clients = new Map<string, Schemas["CompanyApiClientDto"][]>();
let clientSeq = 1;

function admin(request: Request, companyId: string) {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const membership = companyMembershipOf(customer);
  if (!membership || membership.companyId !== companyId) return problem(404, "http.not_found", "ไม่พบบริษัทนี้");
  if (!membership.roles.includes("company_admin")) return problem(403, "auth.forbidden", "เฉพาะผู้ดูแลบริษัท");
  return customer;
}

export const repeatHandlers = [
  http.get("*/v1/store/reorder-suggestions", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return HttpResponse.json(suggestionsOf(customer).filter((s) => s.status !== "dismissed"));
  }),
  http.post("*/v1/store/reorder-suggestions/:suggestionId/actions/dismiss", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const suggestion = suggestionsOf(customer).find((s) => s.id === params.suggestionId);
    if (!suggestion) return problem(404, "http.not_found", "ไม่พบคำแนะนำนี้");
    if (suggestion.status === "dismissed") return problem(409, "reorders.suggestion_decided", "จัดการคำแนะนำนี้แล้ว");
    if (!dismissed.has(customer.persona)) dismissed.set(customer.persona, new Set());
    dismissed.get(customer.persona)!.add(suggestion.id);
    return HttpResponse.json({ ...suggestion, status: "dismissed" });
  }),

  http.get("*/v1/store/call-off-agreements", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return HttpResponse.json(agreementsOf(customer).map(settle));
  }),
  http.get("*/v1/store/call-off-agreements/:agreementId", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const agreement = agreementsOf(customer).find((a) => a.id === params.agreementId);
    return agreement ? HttpResponse.json(settle(agreement)) : problem(404, "http.not_found", "ไม่พบสัญญานี้");
  }),
  http.post("*/v1/store/call-off-agreements", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = (await request.json().catch(() => null)) as Schemas["RequestCallOffDto"] | null;
    const quote = body ? findQuote(body.quoteId) : undefined;
    if (!body || !quote || !quotesOf(customer.persona).includes(quote))
      return problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");
    if (!(body.months >= 1 && body.months <= 12))
      return problem(422, "validation.failed", "ระยะเวลา 1–12 เดือน", [
        { path: "months", code: "range", message: "1..12" },
      ]);
    if (agreementsOf(customer).some((a) => a.quoteId === quote.id && ["pending_factory", "active"].includes(a.status)))
      return problem(409, "call_offs.already_requested", "ใบเสนอราคานี้มีสัญญาอยู่แล้ว");
    const agreement: Schemas["CallOffAgreementDto"] = {
      id: mockId("cof", agreementSeq++),
      status: "pending_factory",
      quoteId: quote.id,
      quoteOptionId: body.quoteOptionId,
      quoteCode: quote.quoteCode,
      productType: typeRef(quote.productType),
      committedQuantity: quote.quantity,
      releasedQuantity: 0,
      remainingQuantity: quote.quantity,
      lapsedQuantity: null,
      minReleaseQuantity: Math.max(1, Math.round(quote.quantity / 10)),
      months: body.months,
      unit: quote.unit,
      unitPrice: quote.unitPrice,
      buyUnitPrice: null,
      factory: null,
      declineReason: null,
      createdAt: bangkokIso(),
      startsAt: null,
      expiresAt: null,
      releases: [],
    } as Schemas["CallOffAgreementDto"];
    agreementsOf(customer).unshift(agreement);
    return HttpResponse.json(agreement, { status: 201 });
  }),
  http.post("*/v1/store/call-off-agreements/:agreementId/releases", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const agreement = agreementsOf(customer).find((a) => a.id === params.agreementId);
    if (!agreement) return problem(404, "http.not_found", "ไม่พบสัญญานี้");
    if (settle(agreement).status !== "active")
      return problem(409, "call_offs.invalid_status", "สัญญานี้ยังเรียกของไม่ได้");
    const body = (await request.json().catch(() => null)) as Schemas["ReleaseCallOffDto"] | null;
    const quantity = body?.quantity ?? 0;
    if (quantity < agreement.minReleaseQuantity || quantity > agreement.remainingQuantity)
      return problem(422, "call_offs.release_quantity", "จำนวนต้องไม่น้อยกว่าขั้นต่ำ และไม่เกินที่เหลือ");
    // A quotation at the locked unit price for this quantity (the mock copies the agreement's quotation).
    const source = findQuote(agreement.quoteId)!;
    const { id, quoteCode } = nextQuoteId();
    const quote: StoreQuote = { ...structuredClone(source), id, quoteCode, quantity, status: "saved" };
    quotesOf(customer.persona).unshift(quote);
    addToCart(customer, quote);
    agreement.releasedQuantity += quantity;
    agreement.remainingQuantity -= quantity;
    agreement.releases.push({
      id: mockId("cor", releaseSeq++),
      seq: agreement.releases.length + 1,
      quantity,
      quoteId: quote.id,
      includesOneOffs: agreement.releases.length === 0,
      order: null,
      status: "quoted",
      createdAt: bangkokIso(),
    });
    return HttpResponse.json(toCartDto(customer), { status: 201 });
  }),
  http.post("*/v1/store/call-off-agreements/:agreementId/actions/cancel", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const agreement = agreementsOf(customer).find((a) => a.id === params.agreementId);
    if (!agreement) return problem(404, "http.not_found", "ไม่พบสัญญานี้");
    if (!["pending_factory", "active"].includes(agreement.status))
      return problem(409, "call_offs.invalid_status", "ยกเลิกสัญญานี้ไม่ได้");
    agreement.status = "cancelled";
    agreement.lapsedQuantity = agreement.remainingQuantity;
    return HttpResponse.json(agreement);
  }),

  http.get("*/v1/store/companies/:companyId/api-clients", ({ params, request }) => {
    const who = admin(request, String(params.companyId));
    if (who instanceof Response) return who;
    return HttpResponse.json(clients.get(String(params.companyId)) ?? []);
  }),
  http.post("*/v1/store/companies/:companyId/api-clients", async ({ params, request }) => {
    const who = admin(request, String(params.companyId));
    if (who instanceof Response) return who;
    const body = (await request.json().catch(() => null)) as Schemas["IssueApiClientDto"] | null;
    if (!body?.name?.trim() || !body.scopes?.length)
      return problem(422, "validation.failed", "ตั้งชื่อและเลือกสิทธิ์อย่างน้อย 1 ข้อ", [
        { path: "scopes", code: "required", message: "required" },
      ]);
    const list = clients.get(String(params.companyId)) ?? [];
    if (list.filter((c) => c.status === "active").length >= 5)
      return problem(409, "b2b.client_limit", "มีคีย์ที่ใช้งานครบ 5 ชุดแล้ว");
    const n = clientSeq++;
    const client: Schemas["CompanyApiClientDto"] = {
      id: mockId("apc", n),
      clientId: `pk_live_${n.toString(36)}${Math.random().toString(36).slice(2, 10)}`,
      name: body.name.trim(),
      scopes: body.scopes,
      status: "active",
      createdAt: bangkokIso(),
      lastUsedAt: null,
      owner: { id: who.id, displayName: who.displayName },
    } as Schemas["CompanyApiClientDto"];
    clients.set(String(params.companyId), [client, ...list]);
    return HttpResponse.json(
      {
        ...client,
        clientSecret: `sk_${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url")}`,
      },
      { status: 201 },
    );
  }),
  http.post("*/v1/store/companies/:companyId/api-clients/:clientId/actions/revoke", ({ params, request }) => {
    const who = admin(request, String(params.companyId));
    if (who instanceof Response) return who;
    const client = (clients.get(String(params.companyId)) ?? []).find((c) => c.id === params.clientId);
    if (!client) return problem(404, "http.not_found", "ไม่พบคีย์นี้");
    if (client.status === "revoked") return problem(409, "b2b.client_revoked", "ยกเลิกคีย์นี้แล้ว");
    client.status = "revoked";
    return HttpResponse.json(client);
  }),
];
