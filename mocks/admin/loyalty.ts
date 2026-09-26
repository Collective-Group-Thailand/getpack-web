/**
 * A customer's points and consents, mocked (CONTRACT-REQUEST admin.customer-loyalty,
 * admin.customer-consents).
 *
 * The ledger is append-only and adds up to the balance the customer detail reports; baht values
 * use the point value in force (`loyalty.point_value`, D-131), and earnings wait for completion
 * plus the claim window before they are available (D-132). Consent purposes are packio-api's
 * seeded identities (`prisma/seed/data/reference.ts`).
 */

import type { z } from "zod";

import type { customerConsent, pointsEntry } from "@/lib/api/requests/admin-customers";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { customers } from "./commerce";
import { settingValue } from "./platform";

type Entry = z.output<typeof pointsEntry>;
type Consent = z.output<typeof customerConsent>;

const DAY = 24 * 60;
const CONSENT_PURPOSES = [
  { key: "terms_of_service", required: true },
  { key: "privacy_notice", required: true },
  { key: "marketing_email", required: false },
  { key: "marketing_line", required: false },
  { key: "marketing_sms", required: false },
  { key: "analytics_cookies", required: false },
  { key: "personalisation", required: false },
] as const;

const value = (points: number) => (points * Number(settingValue<string>("loyalty.point_value"))).toFixed(2);

/** The ledger of one customer, oldest first, summing to the customer's available points. */
function ledgerOf(index: number): Entry[] {
  const customer = customers[index]!;
  const available = customer.loyalty.availablePoints;
  const id = (n: number) => mockId("pts", index * 100 + n);
  const order = (n: number) => ({
    id: mockId("ord", 700 + index * 10 + n),
    orderCode: `PK2569${String(3000 + index * 10 + n).padStart(6, "0")}`,
  });
  const entries: Entry[] = [
    {
      id: id(1),
      entryType: "earn_signup",
      points: 20,
      bahtValue: value(20),
      status: "available",
      availableAt: customer.createdAt,
      expiresAt: bangkokIso(300 * DAY),
      order: null,
      note: null,
      createdAt: customer.createdAt,
    },
  ];
  if (available > 20) {
    const redeemed = index % 3 === 0 ? Math.min(40, Math.floor(available / 4)) : 0;
    const earned = available - 20 + redeemed;
    entries.push({
      id: id(2),
      entryType: "earn_order",
      points: earned,
      bahtValue: value(earned),
      status: "available",
      availableAt: bangkokIso(-20 * DAY),
      expiresAt: bangkokIso(20 * DAY),
      order: order(1),
      note: null,
      createdAt: bangkokIso(-30 * DAY),
    });
    if (redeemed > 0)
      entries.push({
        id: id(3),
        entryType: "redeem",
        points: -redeemed,
        bahtValue: value(-redeemed),
        status: "available",
        availableAt: null,
        expiresAt: null,
        order: order(2),
        note: null,
        createdAt: bangkokIso(-8 * DAY),
      });
  }
  // The latest order's points wait for completion and the claim window (D-132).
  entries.push({
    id: id(4),
    entryType: "earn_order",
    points: 12 + (index % 4) * 6,
    bahtValue: value(12 + (index % 4) * 6),
    status: "pending",
    availableAt: bangkokIso(9 * DAY),
    expiresAt: null,
    order: order(3),
    note: null,
    createdAt: bangkokIso(-2 * DAY),
  });
  return entries.reverse();
}

function consentsOf(index: number): Consent[] {
  const customer = customers[index]!;
  return CONSENT_PURPOSES.map((purpose, at) => {
    const asked = purpose.required || at % 2 === index % 2 || at === 3;
    return {
      purpose: purpose.key,
      required: purpose.required,
      granted: asked ? purpose.required || (index + at) % 3 !== 0 : null,
      versionNo: asked ? 1 : null,
      outdated: asked && purpose.key === "privacy_notice" && index % 4 === 2,
      source: asked ? (customer.createdVia === "cs" ? "cs" : "web") : null,
      recordedAt: asked ? customer.createdAt : null,
    };
  });
}

function customerIndex(request: Request, customerId: string | undefined): number | Response {
  const who = staffPersonaOf(request);
  if (!who || !can(who, "customers.read")) return problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
  const index = customers.findIndex((customer) => customer.id === customerId);
  return index < 0 ? problem(404, "http.not_found", "ไม่พบลูกค้านี้") : index;
}

export const loyaltyHandlers = [
  mockRequest("GET /v1/admin/customers/{customerId}/points", ({ params, query, request }) => {
    const index = customerIndex(request, params.customerId);
    if (index instanceof Response) return index;
    const entries = ledgerOf(index);
    const { reminderDaysBefore } = settingValue<{ reminderDaysBefore: number }>("loyalty.points_expiry");
    const soon = entries.filter(
      (entry) =>
        entry.status === "available" &&
        entry.points > 0 &&
        entry.expiresAt !== null &&
        Date.parse(entry.expiresAt) - Date.now() < reminderDaysBefore * DAY * 60_000,
    );
    const available = customers[index]!.loyalty.availablePoints;
    const pending = entries.filter((entry) => entry.status === "pending").reduce((sum, entry) => sum + entry.points, 0);
    const page = paginate(
      entries.filter((entry) => !query.entryType || entry.entryType === query.entryType),
      query,
    );
    return {
      ...page,
      balance: {
        available,
        pending,
        expiringSoon: Math.min(
          available,
          soon.reduce((sum, entry) => sum + entry.points, 0),
        ),
        expiringSoonAt: soon[0]?.expiresAt ?? null,
        availableBahtValue: value(available),
      },
    };
  }),
  mockRequest("GET /v1/admin/customers/{customerId}/consents", ({ params, request }) => {
    const index = customerIndex(request, params.customerId);
    return index instanceof Response ? index : consentsOf(index);
  }),
];
