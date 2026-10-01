/**
 * Customers on the published contract (`admin.customers.*`, U-F0.3): the list, find-or-create, the
 * customer, and its addresses and tax profiles as separate resources.
 *
 * The rows are the fake commerce customers (`./commerce`), the same arrays the storefront's
 * address book reads (`../store/book.ts`), so what CS adds a customer sees. A new address arrives
 * with geography ids and is kept under the names they resolve to (`./catalogue` geography tables).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { toAddressDto, toTaxProfileDto } from "../store/book";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";
import { catalogueRows } from "./catalogue";
import { customers } from "./commerce";
import type { CustomerRow } from "./customer-model";

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const notFound = () => problem(404, "http.not_found", "ไม่พบลูกค้านี้");

const pageOf = (url: URL) => ({
  page: Number(url.searchParams.get("page") ?? 1),
  perPage: Number(url.searchParams.get("perPage") ?? 25),
});

export function toAdminCustomerDto(customer: CustomerRow): Schemas["AdminCustomerDto"] {
  const [firstName, ...rest] = customer.displayName.split(" ");
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    displayName: customer.displayName,
    firstName: firstName ?? null,
    lastName: rest.join(" ") || null,
    email: customer.email,
    phone: customer.phone,
    customerType: customer.customerType,
    createdVia: customer.createdVia,
    createdAt: customer.createdAt,
    status: "active",
    lastLoginAt: null,
    companyName: customer.companyName,
    ordersCount: customer.ordersCount,
    lastOrderAt: customer.lastOrderAt,
    referralCode: customer.referralCode,
    // The rows keep no profile-save stamp.
    profileCompletedAt: null,
  };
}

function allowed(request: Request, permission: string) {
  const who = staffPersonaOf(request);
  return who && can(who, permission) ? who : null;
}

function customerOf(id: unknown) {
  return customers.find((customer) => customer.id === id);
}

/** Thai mobile or E.164 → the local form the rows keep, so a match finds either spelling. */
const localPhone = (phone: string | undefined) => (phone?.startsWith("+66") ? `0${phone.slice(3)}` : phone);

export const customerHandlers = [
  http.get("*/v1/admin/customers", ({ request }) => {
    if (!allowed(request, "customers.read")) return forbidden();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const rows = customers
      .filter((customer) =>
        matchesQuery(q, customer.displayName, customer.phone, customer.email, customer.customerCode),
      )
      .map(toAdminCustomerDto);
    const sort = url.searchParams.get("sort") ?? "createdAt";
    const order = (url.searchParams.get("order") as "asc" | "desc" | null) ?? "desc";
    return HttpResponse.json(paginate(sortBy(rows, sort, order), pageOf(url)));
  }),

  // Find-or-create: a phone or e-mail that matches an account answers it with 200.
  http.post("*/v1/admin/customers", async ({ request }) => {
    if (!allowed(request, "customers.manage")) return forbidden();
    const body = (await request.json().catch(() => null)) as Schemas["FindOrCreateCustomerDto"] | null;
    if (!body?.displayName?.trim() || (!body.phone && !body.email)) {
      return problem(422, "validation.failed", "ต้องระบุชื่อ และเบอร์โทรหรืออีเมล", [
        { path: "phone", code: "required", message: "phone or email is required" },
      ]);
    }
    const phone = localPhone(body.phone);
    const match = customers.find(
      (customer) => (phone && customer.phone === phone) || (body.email && customer.email === body.email),
    );
    if (match) {
      const found: Schemas["FindOrCreateCustomerResultDto"] = { created: false, customer: toAdminCustomerDto(match) };
      return HttpResponse.json(found);
    }
    const customer: CustomerRow = {
      id: mockId("cus", customers.length + 1),
      customerCode: `C${250001 + customers.length}`,
      displayName: body.displayName.trim(),
      phone: phone ?? null,
      email: body.email ?? null,
      customerType: body.customerType ?? "individual",
      companyName: null,
      createdVia: "cs",
      ordersCount: 0,
      createdAt: bangkokIso(),
      referralCode: `PK${9000 + customers.length}`,
      loyalty: { tier: "member", availablePoints: 0, spend12m: "0.00" },
      lastOrderAt: null,
      birthDate: null,
      addresses: [],
      taxProfiles: [],
    };
    customers.push(customer);
    const created: Schemas["FindOrCreateCustomerResultDto"] = { created: true, customer: toAdminCustomerDto(customer) };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get("*/v1/admin/customers/:customerId", ({ params, request }) => {
    if (!allowed(request, "customers.read")) return forbidden();
    const customer = customerOf(params.customerId);
    return customer ? HttpResponse.json(toAdminCustomerDto(customer)) : notFound();
  }),

  http.get("*/v1/admin/customers/:customerId/addresses", ({ params, request }) => {
    if (!allowed(request, "customers.read")) return forbidden();
    const customer = customerOf(params.customerId);
    if (!customer) return notFound();
    return HttpResponse.json(paginate(customer.addresses.map(toAddressDto), pageOf(new URL(request.url))));
  }),

  http.post("*/v1/admin/customers/:customerId/addresses", async ({ params, request }) => {
    if (!allowed(request, "customers.manage")) return forbidden();
    const customer = customerOf(params.customerId);
    if (!customer) return notFound();
    const body = (await request.json().catch(() => null)) as Schemas["AddressInputDto"] | null;
    const province = catalogueRows("provinces").find((row) => row.id === body?.provinceId);
    const subdistrict = body?.subdistrictId
      ? catalogueRows("subdistricts").find((row) => row.id === body.subdistrictId)
      : undefined;
    if (!body || !province || (body.subdistrictId && !subdistrict)) {
      return problem(422, "validation.failed", "ไม่พบจังหวัดหรือตำบลนี้", [
        { path: province ? "subdistrictId" : "provinceId", code: "not_found", message: "unknown geography id" },
      ]);
    }
    const district = subdistrict ? catalogueRows("districts").find((row) => row.id === subdistrict.districtId) : null;
    const address = {
      id: mockId("adr", 200 + customer.addresses.length + customers.indexOf(customer) * 10),
      kind: body.kind,
      label: body.label,
      recipientName: body.recipientName,
      phone: body.phone,
      line1: body.line1,
      line2: body.line2 ?? null,
      subdistrict: subdistrict ? String(subdistrict.nameTh) : null,
      district: district ? String(district.nameTh) : null,
      province: String(province.nameTh),
      postcode: body.postcode,
      isDefault: body.isDefault ?? customer.addresses.length === 0,
    };
    customer.addresses.push(address);
    return HttpResponse.json(toAddressDto(address), { status: 201 });
  }),

  http.get("*/v1/admin/customers/:customerId/tax-profiles", ({ params, request }) => {
    if (!allowed(request, "customers.read")) return forbidden();
    const customer = customerOf(params.customerId);
    if (!customer) return notFound();
    return HttpResponse.json(paginate(customer.taxProfiles.map(toTaxProfileDto), pageOf(new URL(request.url))));
  }),
];
