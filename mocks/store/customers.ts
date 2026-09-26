/**
 * The storefront's mock customers, and what a signed-in customer owns: a profile, consent
 * records and orders. Two personas, chosen by the phone number an OTP is sent to:
 *
 *   returning  0812345678 — the account F1's tests sign in with: complete profile, every
 *              consent purpose answered, a handful of orders. Signing in lands straight home.
 *   newcomer   0898765432 — a first sign-in: no consents recorded, no e-mail. Reset on every
 *              sign-in, so the consent and profile steps can be walked again and again.
 *   buyer      0823456789 — another complete account (the second fake customer), so a flow
 *              that owns a cart end to end (checkout) does not share it with parallel tests.
 *
 * The consent purposes are packio-api's seeded identities (`prisma/seed/data/reference.ts`),
 * with obviously fake texts.
 */

import type { Schemas } from "@/lib/api/types";

import { principalOf } from "../support";

export type CustomerPersona = "returning" | "newcomer" | "buyer";

export const MOCK_CUSTOMER_PHONES: Record<string, CustomerPersona> = {
  "0812345678": "returning",
  "0898765432": "newcomer",
  "0823456789": "buyer",
};

export const CONSENT_PURPOSES = [
  { purpose: "terms_of_service", required: true, summary: "ข้อกำหนดการใช้บริการ Packio" },
  { purpose: "privacy_notice", required: true, summary: "ประกาศความเป็นส่วนตัว" },
  { purpose: "marketing_email", required: false, summary: "รับข่าวสารและโปรโมชันทางอีเมล" },
  { purpose: "marketing_line", required: false, summary: "รับข่าวสารและโปรโมชันทาง LINE" },
  { purpose: "marketing_sms", required: false, summary: "รับข่าวสารและโปรโมชันทาง SMS" },
  { purpose: "analytics_cookies", required: false, summary: "คุกกี้เพื่อการวิเคราะห์" },
  { purpose: "personalisation", required: false, summary: "แนะนำสินค้าให้ตรงกับความสนใจ" },
] as const;

type Consent = { granted: boolean; versionNo: number };

export interface MockCustomer {
  persona: CustomerPersona;
  id: string;
  displayName: string;
  email: string | null;
  phone: string;
  customerType: "individual" | "juristic" | "government" | null;
  identities: Schemas["LinkedIdentityDto"][];
  consents: Map<string, Consent>;
  /** Available loyalty points (D-130–D-133); the storefront's own ledger in the mock. */
  points: number;
  /**
   * Which fake commerce customer (`../admin/commerce` `customers[n]`) this persona is — whose
   * orders, RFQs and address book it owns. `null`: a customer the back office has not seen yet.
   */
  ownerIndex: number | null;
}

function fresh(persona: CustomerPersona): MockCustomer {
  if (persona === "newcomer") {
    return {
      persona,
      id: "00000000-0000-4000-8000-000000000002",
      displayName: "ลูกค้าใหม่ 089-876-5432",
      email: null,
      phone: "0898765432",
      customerType: null,
      identities: [{ provider: "phone_otp", linkedAt: new Date().toISOString() }],
      consents: new Map(),
      points: 0,
      ownerIndex: null,
    };
  }
  const buyer = persona === "buyer";
  return {
    persona,
    id: buyer ? "00000000-0000-4000-8000-000000000003" : "00000000-0000-4000-8000-000000000001",
    displayName: buyer ? "ลูกค้าผู้ซื้อ (ข้อมูลจำลอง)" : "ลูกค้าตัวอย่าง (ข้อมูลจำลอง)",
    email: buyer ? "seed.buyer@packio.invalid" : "seed.customer@packio.invalid",
    phone: buyer ? "0823456789" : "0812345678",
    ownerIndex: buyer ? 1 : 0,
    customerType: "individual",
    identities: [{ provider: "phone_otp", linkedAt: "2026-09-23T10:00:00+07:00" }],
    points: 1250,
    consents: new Map(
      CONSENT_PURPOSES.map(({ purpose, required }) => [
        purpose,
        { granted: required || purpose === "marketing_email", versionNo: 1 },
      ]),
    ),
  };
}

const customers: Record<CustomerPersona, MockCustomer> = {
  returning: fresh("returning"),
  newcomer: fresh("newcomer"),
  buyer: fresh("buyer"),
};

/** A first sign-in starts from nothing, every time. */
export function resetCustomer(persona: CustomerPersona): void {
  customers[persona] = fresh(persona);
}

/** The customer behind a request's mock token, or `null` for anyone else. */
export function customerOf(request: Request): MockCustomer | null {
  const principal = principalOf(request);
  if (principal?.audience !== "customer") return null;
  const persona = principal.persona as CustomerPersona | undefined;
  return customers[persona && persona in customers ? persona : "returning"];
}

export function customerMe(customer: MockCustomer): Schemas["StoreMeDto"] {
  return {
    id: customer.id,
    displayName: customer.displayName,
    email: customer.email,
    phone: customer.phone,
    locale: "th",
    roles: ["customer"],
    permissions: [],
    scopes: [],
    identities: customer.identities,
  };
}

export function consentsOf(customer: MockCustomer): Schemas["ConsentDto"][] {
  return CONSENT_PURPOSES.map(({ purpose, required, summary }) => {
    const record = customer.consents.get(purpose);
    return {
      purpose,
      required,
      granted: record?.granted ?? null,
      outdated: false,
      versionNo: record?.versionNo ?? null,
      summary,
      text: `${summary} — ข้อความฉบับเต็ม (ข้อมูลจำลอง)`,
    };
  });
}
