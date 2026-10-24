/**
 * The customer's address book and tax-invoice profiles, on the published contract
 * (`store.addresses.*`, `store.taxProfiles.*`, U-F0.2): paged lists, reads with an `ETag`, edits
 * under `If-Match`.
 *
 * The returning customer's book **is** the first fake commerce customer's (`../admin/commerce`),
 * the same arrays the back office's customer screen reads (`../admin/customers.ts`), so an address
 * edited here is one CS sees. The newcomer starts with an empty book on
 * every sign-in. A create takes the province and sub-district ids the postcode lookup returned
 * (`./catalog`) and files the names they stand for.
 */

import { http, HttpResponse } from "msw";
import type { Schemas } from "@/lib/api/types";

import { customers as fakeCustomers } from "../admin/commerce";
import type { CustomerAddressRow, TaxProfileRow } from "../admin/customer-model";
import { mockId, paginate, precondition, problem, versionTag, withEtag } from "../support";
import { areaOfIds } from "./catalog";
import { customerOf, type MockCustomer } from "./customers";

type Address = CustomerAddressRow;
type TaxProfile = TaxProfileRow;

const newcomer = { addresses: [] as Address[], taxProfiles: [] as TaxProfile[] };

export function bookOf(customer: MockCustomer): { addresses: Address[]; taxProfiles: TaxProfile[] } {
  if (customer.ownerIndex !== null) return fakeCustomers[customer.ownerIndex]!;
  return newcomer;
}

/** Called when the newcomer persona signs in again: a first sign-in has no addresses. */
export function resetNewcomerBook(): void {
  newcomer.addresses = [];
  newcomer.taxProfiles = [];
}

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");

/** A stable fake geo id per name — the rows hold names, the contract ids. */
function geoRef(namespace: string, nameTh: string | null): Schemas["GeoRefDto"] | null {
  if (!nameTh) return null;
  const n = [...nameTh].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 0xfffff, 7);
  return { id: mockId(namespace, n), nameTh, nameEn: nameTh };
}

const versions = new Map<string, number>();
const tagOf = (id: string) => versionTag(id, versions.get(id) ?? 1);
const bump = (id: string) => versions.set(id, (versions.get(id) ?? 1) + 1);
const UPDATED_AT = "2026-09-20T10:00:00+07:00";
/** What a tax profile holds that the admin row has no column for. */
const documentEmails = new Map<string, string | null>();

export function toAddressDto(address: Address): Schemas["AddressDto"] {
  return {
    id: address.id,
    kind: address.kind,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    subdistrict: geoRef("sdt", address.subdistrict),
    province: geoRef("prv", address.province)!,
    postcode: address.postcode,
    lat: null,
    lng: null,
    isDefault: address.isDefault,
    updatedAt: UPDATED_AT,
  };
}

/** The row's one-line address is split back into what the contract holds. */
export function toTaxProfileDto(profile: TaxProfile): Schemas["TaxProfileDto"] {
  const postcode = profile.address.match(/(\d{5})\s*$/)?.[1] ?? "10110";
  const province = PROVINCES.find((name) => profile.address.includes(name)) ?? "กรุงเทพมหานคร";
  const line1 = profile.address.replace(postcode, "").replace(province, "").trim() || profile.address;
  return {
    id: profile.id,
    name: profile.name,
    taxId: profile.taxId,
    taxType: profile.taxType,
    branchType: profile.branchType,
    branchCode: profile.branchType === "head_office" ? "00000" : profile.branchCode,
    line1,
    line2: null,
    subdistrict: null,
    province: geoRef("prv", province)!,
    postcode,
    documentEmail: documentEmails.get(profile.id) ?? null,
    withholdsTax: profile.withholdsTax,
    isDefault: profile.isDefault,
    updatedAt: UPDATED_AT,
  };
}

const PROVINCES = ["กรุงเทพมหานคร", "เชียงใหม่", "ชลบุรี", "สงขลา", "ขอนแก่น"];

/** The API's answer to ids that are not the postcode's (`validation.failed` on `postcode`). */
const mismatch = () =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
    { path: "postcode", code: "invalid", message: "does not match the subdistrict" },
  ]);

const perPageOf = (request: Request) => ({
  page: Number(new URL(request.url).searchParams.get("page") ?? 1),
  perPage: Number(new URL(request.url).searchParams.get("perPage") ?? 25),
});

export const storeBookHandlers = [
  http.get("*/v1/store/addresses", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return HttpResponse.json(paginate(bookOf(customer).addresses.map(toAddressDto), perPageOf(request)));
  }),
  http.post("*/v1/store/addresses", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const body = (await request.json().catch(() => ({}))) as Schemas["AddressInputDto"];
    const area = areaOfIds(body.postcode, body.provinceId, body.subdistrictId);
    if (!area) return mismatch();
    const first = !book.addresses.some((address) => address.kind === body.kind);
    if (body.isDefault) for (const other of book.addresses) if (other.kind === body.kind) other.isDefault = false;
    const address: Address = {
      id: mockId("adr", Date.now() % 0xfffff),
      kind: body.kind,
      label: body.label,
      recipientName: body.recipientName,
      phone: body.phone,
      line1: body.line1,
      line2: body.line2 ?? null,
      subdistrict: body.subdistrictId ? area.subdistrict : null,
      district: area.district,
      province: area.province,
      postcode: body.postcode,
      isDefault: body.isDefault === true || first,
    };
    book.addresses.push(address);
    return withEtag(toAddressDto(address), tagOf(address.id), 201);
  }),
  http.get("*/v1/store/addresses/:addressId", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const address = bookOf(customer).addresses.find((candidate) => candidate.id === params.addressId);
    return address
      ? withEtag(toAddressDto(address), tagOf(address.id))
      : problem(404, "http.not_found", "ไม่พบที่อยู่นี้");
  }),
  http.patch("*/v1/store/addresses/:addressId", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const address = book.addresses.find((candidate) => candidate.id === params.addressId);
    if (!address) return problem(404, "http.not_found", "ไม่พบที่อยู่นี้");
    const refused = precondition(request, tagOf(address.id));
    if (refused) return refused;
    const body = (await request.json().catch(() => ({}))) as Schemas["UpdateAddressDto"];
    if (body.provinceId !== undefined || body.subdistrictId !== undefined || body.postcode !== undefined) {
      // A new area comes whole, as on create: the postcode and the ids it covers.
      const area =
        body.postcode !== undefined && body.provinceId !== undefined
          ? areaOfIds(body.postcode, body.provinceId, body.subdistrictId)
          : undefined;
      if (!area) return mismatch();
      Object.assign(address, {
        subdistrict: body.subdistrictId ? area.subdistrict : null,
        district: area.district,
        province: area.province,
        postcode: body.postcode,
      });
    }
    if (body.isDefault) for (const other of book.addresses) other.isDefault = false;
    if (body.label !== undefined) address.label = body.label;
    if (body.recipientName !== undefined) address.recipientName = body.recipientName;
    if (body.phone !== undefined) address.phone = body.phone;
    if (body.line1 !== undefined) address.line1 = body.line1;
    if (body.line2 !== undefined) address.line2 = body.line2 ?? null;
    if (body.isDefault !== undefined) address.isDefault = body.isDefault;
    bump(address.id);
    return withEtag(toAddressDto(address), tagOf(address.id));
  }),
  http.delete("*/v1/store/addresses/:addressId", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const index = book.addresses.findIndex((candidate) => candidate.id === params.addressId);
    if (index < 0) return problem(404, "http.not_found", "ไม่พบที่อยู่นี้");
    const [removed] = book.addresses.splice(index, 1);
    if (removed?.isDefault && book.addresses[0]) book.addresses[0].isDefault = true;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/v1/store/tax-profiles", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return HttpResponse.json(paginate(bookOf(customer).taxProfiles.map(toTaxProfileDto), perPageOf(request)));
  }),
  http.post("*/v1/store/tax-profiles", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const body = (await request.json().catch(() => ({}))) as Schemas["TaxProfileInputDto"];
    const area = areaOfIds(body.postcode, body.provinceId, body.subdistrictId);
    if (!area) return mismatch();
    const first = book.taxProfiles.length === 0;
    if (body.isDefault) for (const other of book.taxProfiles) other.isDefault = false;
    const profile: TaxProfile = {
      id: mockId("txp", Date.now() % 0xfffff),
      taxType: body.taxType,
      name: body.name,
      taxId: body.taxId,
      branchType: body.branchType,
      branchCode: body.branchType === "head_office" ? "00000" : (body.branchCode ?? "00000"),
      address: [body.line1, body.line2, area.province, body.postcode].filter(Boolean).join(" "),
      withholdsTax: body.withholdsTax ?? false,
      isDefault: body.isDefault === true || first,
    };
    if (body.documentEmail) documentEmails.set(profile.id, body.documentEmail);
    book.taxProfiles.push(profile);
    return withEtag(toTaxProfileDto(profile), tagOf(profile.id), 201);
  }),
  http.get("*/v1/store/tax-profiles/:taxProfileId", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const profile = bookOf(customer).taxProfiles.find((candidate) => candidate.id === params.taxProfileId);
    return profile
      ? withEtag(toTaxProfileDto(profile), tagOf(profile.id))
      : problem(404, "http.not_found", "ไม่พบข้อมูลใบกำกับภาษีนี้");
  }),
  http.patch("*/v1/store/tax-profiles/:taxProfileId", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const profile = book.taxProfiles.find((candidate) => candidate.id === params.taxProfileId);
    if (!profile) return problem(404, "http.not_found", "ไม่พบข้อมูลใบกำกับภาษีนี้");
    const refused = precondition(request, tagOf(profile.id));
    if (refused) return refused;
    const body = (await request.json().catch(() => ({}))) as Schemas["UpdateTaxProfileDto"];
    if (body.isDefault) for (const other of book.taxProfiles) other.isDefault = false;
    const dto = toTaxProfileDto(profile);
    if (body.name !== undefined) profile.name = body.name;
    if (body.line1 !== undefined || body.line2 !== undefined) {
      const line1 = body.line1 ?? dto.line1;
      const line2 = body.line2 === undefined ? dto.line2 : body.line2;
      profile.address = [line1, line2, dto.province.nameTh, dto.postcode].filter(Boolean).join(" ");
    }
    if (body.documentEmail !== undefined) documentEmails.set(profile.id, body.documentEmail);
    if (body.withholdsTax !== undefined) profile.withholdsTax = body.withholdsTax;
    if (body.isDefault !== undefined) profile.isDefault = body.isDefault;
    bump(profile.id);
    return withEtag(toTaxProfileDto(profile), tagOf(profile.id));
  }),
  http.delete("*/v1/store/tax-profiles/:taxProfileId", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const index = book.taxProfiles.findIndex((candidate) => candidate.id === params.taxProfileId);
    if (index < 0) return problem(404, "http.not_found", "ไม่พบข้อมูลใบกำกับภาษีนี้");
    book.taxProfiles.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
