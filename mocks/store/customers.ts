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
 *   receiver   0845678901 — the eighth fake customer, whose order was delivered yesterday a little
 *              short: receipt, tolerance credit, claims and reorder (F3 3.6) walk it.
 *   companyadmin   0867890123 — the admin and approver of the first fake company (B2601: credit,
 *              a THB 50,000 approval threshold, PO numbers required), F3 3.7.
 *   companybuyer   0878901234 — a buyer in the same company, whose large orders wait for approval.
 *   founder    0889012345 — no company yet: signs one up (F3 3.7).
 *   artist     0834567890 — the fourth fake customer, whose unpaid order waiting for artwork
 *              the artwork and proof flow (F3 3.5) walks end to end on its own.
 *   designer   0856789012 — the tenth fake customer, whose orders were set up for the online
 *              designer: the account designs and send-to-print flow (F4 Part C) walks them.
 *
 * The consent purposes are packio-api's seeded identities (`prisma/seed/data/reference.ts`),
 * with obviously fake texts.
 */

import type { Schemas } from "@/lib/api/types";

import { principalOf } from "../support";

export type CustomerPersona =
  "returning" | "newcomer" | "buyer" | "artist" | "receiver" | "companyadmin" | "companybuyer" | "founder" | "designer";

export const MOCK_CUSTOMER_PHONES: Record<string, CustomerPersona> = {
  "0812345678": "returning",
  "0898765432": "newcomer",
  "0823456789": "buyer",
  "0834567890": "artist",
  "0845678901": "receiver",
  "0867890123": "companyadmin",
  "0878901234": "companybuyer",
  "0889012345": "founder",
  "0856789012": "designer",
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
  const accounts: Record<
    Exclude<CustomerPersona, "newcomer">,
    { n: number; name: string; email: string; phone: string; ownerIndex: number | null }
  > = {
    companyadmin: {
      n: 6,
      name: "ผู้ดูแลบัญชีบริษัท (ข้อมูลจำลอง)",
      email: "seed.companyadmin",
      phone: "0867890123",
      ownerIndex: 1,
    },
    companybuyer: {
      n: 7,
      name: "ฝ่ายจัดซื้อบริษัท (ข้อมูลจำลอง)",
      email: "seed.companybuyer",
      phone: "0878901234",
      ownerIndex: 1,
    },
    founder: {
      n: 8,
      name: "ผู้ก่อตั้งบริษัท (ข้อมูลจำลอง)",
      email: "seed.founder",
      phone: "0889012345",
      ownerIndex: null,
    },
    returning: {
      n: 1,
      name: "ลูกค้าตัวอย่าง (ข้อมูลจำลอง)",
      email: "seed.customer",
      phone: "0812345678",
      ownerIndex: 0,
    },
    buyer: { n: 3, name: "ลูกค้าผู้ซื้อ (ข้อมูลจำลอง)", email: "seed.buyer", phone: "0823456789", ownerIndex: 1 },
    receiver: {
      n: 5,
      name: "ลูกค้ารับสินค้า (ข้อมูลจำลอง)",
      email: "seed.receiver",
      phone: "0845678901",
      ownerIndex: 7,
    },
    artist: { n: 4, name: "ลูกค้าส่งไฟล์งาน (ข้อมูลจำลอง)", email: "seed.artist", phone: "0834567890", ownerIndex: 3 },
    designer: {
      n: 9,
      name: "ลูกค้าออกแบบออนไลน์ (ข้อมูลจำลอง)",
      email: "seed.designer",
      phone: "0856789012",
      ownerIndex: 9,
    },
  };
  const account = accounts[persona as Exclude<CustomerPersona, "newcomer">];
  return {
    persona,
    id: `00000000-0000-4000-8000-00000000000${account.n}`,
    displayName: account.name,
    email: `${account.email}@packio.invalid`,
    phone: account.phone,
    ownerIndex: account.ownerIndex,
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
  artist: fresh("artist"),
  receiver: fresh("receiver"),
  companyadmin: fresh("companyadmin"),
  companybuyer: fresh("companybuyer"),
  founder: fresh("founder"),
  designer: fresh("designer"),
};

/** A persona's customer, for a mock acting on someone else's behalf (a company approver placing a buyer's order). */
export function customerByPersona(persona: CustomerPersona): MockCustomer {
  return customers[persona];
}

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
