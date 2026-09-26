/**
 * The customer's address book and tax-invoice profiles, mocked (CONTRACT-REQUEST
 * store.address-book).
 *
 * The returning customer's book **is** the first fake commerce customer's (`../admin/commerce`),
 * the same arrays the back office's customer screen reads, so an address added at checkout is
 * one CS sees. The newcomer starts with an empty book on every sign-in.
 */

import type { z } from "zod";

import type { customerAddress, taxProfile } from "@/lib/api/requests/admin-customers";

import { customers as fakeCustomers } from "../admin/commerce";
import { mockRequest } from "../route";
import { mockId, problem } from "../support";
import { customerOf, type MockCustomer } from "./customers";

type Address = z.output<typeof customerAddress>;
type TaxProfile = z.output<typeof taxProfile>;

const newcomer = { addresses: [] as Address[], taxProfiles: [] as TaxProfile[] };

export function bookOf(customer: MockCustomer): { addresses: Address[]; taxProfiles: TaxProfile[] } {
  if (customer.persona === "returning") return fakeCustomers[0]!;
  return newcomer;
}

/** Called when the newcomer persona signs in again: a first sign-in has no addresses. */
export function resetNewcomerBook(): void {
  newcomer.addresses = [];
  newcomer.taxProfiles = [];
}

let seq = 0;
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");

/** The Thai tax id checksum (13 digits): the last digit checks the first twelve. */
export function validTaxId(taxId: string): boolean {
  if (!/^\d{13}$/.test(taxId)) return false;
  const digits = [...taxId].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === digits[12];
}

export const storeBookHandlers = [
  mockRequest("GET /v1/store/me/addresses", ({ request }) => {
    const customer = customerOf(request);
    return customer ? { data: bookOf(customer).addresses } : unauthenticated();
  }),
  mockRequest("POST /v1/store/me/addresses", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    seq += 1;
    const makeDefault = body.isDefault ?? book.addresses.length === 0;
    if (makeDefault) for (const address of book.addresses) address.isDefault = false;
    const address: Address = {
      id: mockId("sad", seq),
      kind: "delivery",
      label: body.label,
      recipientName: body.recipientName,
      phone: body.phone,
      line1: body.line1,
      line2: body.line2 ?? null,
      subdistrict: body.subdistrict ?? null,
      district: body.district ?? null,
      province: body.province,
      postcode: body.postcode,
      isDefault: makeDefault,
    };
    book.addresses.push(address);
    return address;
  }),
  mockRequest("PATCH /v1/store/me/addresses/{addressId}", ({ params, body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const address = book.addresses.find((candidate) => candidate.id === params.addressId);
    if (!address) return problem(404, "http.not_found", "ไม่พบที่อยู่นี้");
    if (body.isDefault) for (const other of book.addresses) other.isDefault = false;
    Object.assign(address, {
      ...body,
      ...(body.line2 !== undefined ? { line2: body.line2 || null } : {}),
    });
    return address;
  }),
  mockRequest("DELETE /v1/store/me/addresses/{addressId}", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const index = book.addresses.findIndex((candidate) => candidate.id === params.addressId);
    if (index < 0) return problem(404, "http.not_found", "ไม่พบที่อยู่นี้");
    const [removed] = book.addresses.splice(index, 1);
    if (removed?.isDefault && book.addresses[0]) book.addresses[0].isDefault = true;
    return undefined;
  }),
  mockRequest("GET /v1/store/me/tax-profiles", ({ request }) => {
    const customer = customerOf(request);
    return customer ? { data: bookOf(customer).taxProfiles } : unauthenticated();
  }),
  mockRequest("POST /v1/store/me/tax-profiles", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (!validTaxId(body.taxId))
      return problem(422, "validation.failed", "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง", [
        { path: "taxId", code: "checksum", message: "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง" },
      ]);
    const book = bookOf(customer);
    seq += 1;
    const makeDefault = body.isDefault ?? book.taxProfiles.length === 0;
    if (makeDefault) for (const profile of book.taxProfiles) profile.isDefault = false;
    const profile: TaxProfile = { id: mockId("stx", seq), ...body, isDefault: makeDefault };
    book.taxProfiles.push(profile);
    return profile;
  }),
  mockRequest("PATCH /v1/store/me/tax-profiles/{profileId}", ({ params, body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const profile = book.taxProfiles.find((candidate) => candidate.id === params.profileId);
    if (!profile) return problem(404, "http.not_found", "ไม่พบข้อมูลใบกำกับภาษีนี้");
    if (body.taxId && !validTaxId(body.taxId))
      return problem(422, "validation.failed", "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง", [
        { path: "taxId", code: "checksum", message: "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง" },
      ]);
    if (body.isDefault) for (const other of book.taxProfiles) other.isDefault = false;
    Object.assign(profile, body);
    return profile;
  }),
  mockRequest("DELETE /v1/store/me/tax-profiles/{profileId}", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const book = bookOf(customer);
    const index = book.taxProfiles.findIndex((candidate) => candidate.id === params.profileId);
    if (index < 0) return problem(404, "http.not_found", "ไม่พบข้อมูลใบกำกับภาษีนี้");
    book.taxProfiles.splice(index, 1);
    return undefined;
  }),
];
