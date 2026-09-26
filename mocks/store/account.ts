/**
 * The signed-in customer's own endpoints: `/me`, consents (published, B1.3), and the
 * contract requests CONTRACT-REQUEST store.profile and store.order-by-code.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import { customers as fakeCustomers, orders } from "../admin/commerce";
import { mockRequest } from "../route";
import { problem } from "../support";
import { CONSENT_PURPOSES, consentsOf, customerMe, customerOf } from "./customers";

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");

export const storeAccountHandlers: HttpHandler[] = [
  http.get("*/v1/store/me", ({ request }) => {
    const customer = customerOf(request);
    return customer ? HttpResponse.json(customerMe(customer)) : unauthenticated();
  }),

  http.get("*/v1/store/me/consents", ({ request }) => {
    const customer = customerOf(request);
    return customer ? HttpResponse.json(consentsOf(customer)) : unauthenticated();
  }),

  http.post("*/v1/store/me/consents", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = (await request.json().catch(() => null)) as { purpose?: string; granted?: boolean } | null;
    if (!body || typeof body.granted !== "boolean" || !CONSENT_PURPOSES.some((p) => p.purpose === body.purpose)) {
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "purpose", code: "enum", message: "unknown purpose" },
      ]);
    }
    customer.consents.set(body.purpose!, { granted: body.granted, versionNo: 1 });
    return HttpResponse.json(consentsOf(customer), { status: 201 });
  }),

  // CONTRACT-REQUEST store.profile
  mockRequest("PATCH /v1/store/me", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (body.displayName !== undefined) customer.displayName = body.displayName;
    if (body.email !== undefined) customer.email = body.email;
    if (body.customerType !== undefined) customer.customerType = body.customerType;
    return {
      id: customer.id,
      displayName: customer.displayName,
      email: customer.email,
      phone: customer.phone,
      customerType: customer.customerType,
    };
  }),

  // CONTRACT-REQUEST store.order-by-code — the returning customer owns the first fake
  // customer's orders; the newcomer owns none. Anyone else's code is a 404, never a 403, so a
  // guess cannot learn that a code exists.
  mockRequest("GET /v1/store/orders/by-code/{orderCode}", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = customer.persona === "returning" ? fakeCustomers[0]?.id : undefined;
    const order = orders.find(
      (candidate) => candidate.orderCode === params.orderCode && candidate.customer.id === owner,
    );
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    return { orderId: order.id, orderCode: order.orderCode, status: order.status, createdAt: order.createdAt };
  }),
];
