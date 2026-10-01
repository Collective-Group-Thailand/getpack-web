/**
 * The signed-in customer's own endpoints: `/me`, consents (published, B1.3), the customer profile
 * (`store.customerProfile.*`, under `If-Match`) and finding an order by its code
 * (`store.orders.getByCode`).
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { customers as fakeCustomers, orders } from "../admin/commerce";
import { precondition, problem, versionTag, withEtag } from "../support";
import { CONSENT_PURPOSES, consentsOf, customerMe, customerOf, type MockCustomer } from "./customers";
import { toStoreOrderDto } from "./order-dto";

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

  http.get("*/v1/store/customer-profile", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return withEtag(profileOf(customer), profileTag(customer));
  }),

  http.patch("*/v1/store/customer-profile", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const refused = precondition(request, profileTag(customer));
    if (refused) return refused;
    const body = (await request.json().catch(() => null)) as Schemas["UpdateCustomerProfileDto"] | null;
    if (!body || Object.keys(body).some((key) => !UPDATABLE.has(key))) {
      // The API's pipe refuses fields it does not know (`forbidNonWhitelisted`).
      return problem(400, "http.bad_request", "มีข้อมูลที่ไม่รู้จัก");
    }
    const extra = names.get(customer.id) ?? { firstName: null, lastName: null, version: 1 };
    if (body.displayName !== undefined) customer.displayName = body.displayName;
    if (body.customerType !== undefined) customer.customerType = body.customerType;
    if (body.firstName !== undefined) extra.firstName = body.firstName;
    if (body.lastName !== undefined) extra.lastName = body.lastName;
    names.set(customer.id, { ...extra, version: extra.version + 1 });
    return withEtag(profileOf(customer), profileTag(customer));
  }),

  // The returning customer owns the first fake customer's orders; the newcomer owns none. Anyone
  // else's code is a 404, never a 403, so a guess cannot learn that a code exists.
  http.get("*/v1/store/orders/by-code/:orderCode", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = customer.ownerIndex === null ? undefined : fakeCustomers[customer.ownerIndex]?.id;
    const order = orders.find(
      (candidate) => candidate.orderCode === params.orderCode && candidate.customer.id === owner,
    );
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    return HttpResponse.json(toStoreOrderDto(order));
  }),
];

const UPDATABLE = new Set(["displayName", "customerType", "firstName", "lastName"]);

/** What the profile holds beyond the persona: names and the version its `ETag` counts. */
const names = new Map<string, { firstName: string | null; lastName: string | null; version: number }>();

const profileTag = (customer: MockCustomer) => versionTag(customer.id, names.get(customer.id)?.version ?? 1);

function profileOf(customer: MockCustomer): Schemas["CustomerProfileDto"] {
  const extra = names.get(customer.id);
  return {
    id: customer.id,
    customerCode: customer.ownerIndex === null ? null : `CU-${String(customer.ownerIndex + 1).padStart(6, "0")}`,
    displayName: customer.displayName,
    firstName: extra?.firstName ?? null,
    lastName: extra?.lastName ?? null,
    email: customer.email,
    phone: customer.phone,
    customerType: customer.customerType ?? "individual",
    createdVia: "self",
    createdAt: "2026-09-01T09:00:00+07:00",
    // A persona without a customer type has not saved a profile yet (the newcomer); the others did
    // when they signed up.
    profileCompletedAt: customer.customerType === null ? null : "2026-09-01T09:00:00+07:00",
  };
}
