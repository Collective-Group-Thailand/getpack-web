/**
 * A customer's points (`admin.loyalty.get`, `admin.loyalty.ledger`) and consents
 * (`admin.consentPurposes.customerConsents`, v0.5.0) on the published contract.
 *
 * The ledger is append-only and adds up to the balance the customer detail reports; baht values
 * use the point value in force (`loyalty.point_value`, D-131), and earnings wait for completion
 * plus the claim window before they are available (D-132). Consent purposes are getpack-api's
 * seeded identities (`prisma/seed/data/reference.ts`).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { customers, orders } from "./commerce";
import { settingValue } from "./platform";

/** A ledger line as the fixture keeps it (with the order it came from); served as `PointsEntryDto`. */
type Entry = Omit<Schemas["PointsEntryDto"], "orderId" | "orderCode" | "groupCode" | "reason"> & {
  order: { id: string; orderCode: string; groupCode: string } | null;
  note: string | null;
};
type Consent = Schemas["AdminConsentDto"];

const DAY = 24 * 60;
const CONSENT_PURPOSES = [
  { key: "terms_of_service", labelTh: "ข้อกำหนดการใช้บริการ", labelEn: "Terms of service", required: true },
  { key: "privacy_notice", labelTh: "ประกาศความเป็นส่วนตัว", labelEn: "Privacy notice", required: true },
  { key: "marketing_email", labelTh: "ข่าวสารทางอีเมล", labelEn: "Marketing by email", required: false },
  { key: "marketing_line", labelTh: "ข่าวสารทาง LINE", labelEn: "Marketing on LINE", required: false },
  { key: "marketing_sms", labelTh: "ข่าวสารทาง SMS", labelEn: "Marketing by SMS", required: false },
  { key: "analytics_cookies", labelTh: "คุกกี้วิเคราะห์", labelEn: "Analytics cookies", required: false },
  { key: "personalisation", labelTh: "การแนะนำเฉพาะคุณ", labelEn: "Personalisation", required: false },
] as const;

const value = (points: number) => (points * Number(settingValue<string>("loyalty.point_value"))).toFixed(2);

/** The ledger of one customer, oldest first, summing to the customer's available points. */
function ledgerOf(index: number): Entry[] {
  const customer = customers[index]!;
  const available = customer.loyalty.availablePoints;
  const id = (n: number) => mockId("pts", index * 100 + n);
  // The customer's own orders, oldest first, so a ledger line opens the order it came from.
  const own = orders
    .filter((candidate) => candidate.customer.id === customer.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const order = (n: number) => {
    const found = own[(n - 1) % Math.max(own.length, 1)];
    return found ? { id: found.id, orderCode: found.orderCode, groupCode: found.groupCode } : null;
  };
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
      labelTh: purpose.labelTh,
      labelEn: purpose.labelEn,
      required: purpose.required,
      granted: asked ? purpose.required || (index + at) % 3 !== 0 : null,
      // The text in force; privacy notice v2 is newer than what some customers decided on.
      versionNo: purpose.key === "privacy_notice" ? 2 : 1,
      decidedVersionNo: asked
        ? purpose.key === "privacy_notice" && index % 4 === 2
          ? 1
          : purpose.key === "privacy_notice"
            ? 2
            : 1
        : null,
      outdated: asked && purpose.key === "privacy_notice" && index % 4 === 2,
      source: asked ? (customer.createdVia === "cs" ? "cs" : "web") : null,
      recordedAt: asked ? customer.createdAt : null,
    };
  });
}

function customerIndex(
  request: Request,
  customerId: string | undefined,
  permission = "customers.read",
): number | Response {
  const who = staffPersonaOf(request);
  if (!who || !can(who, permission)) return problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
  const index = customers.findIndex((customer) => customer.id === customerId);
  return index < 0 ? problem(404, "http.not_found", "ไม่พบลูกค้านี้") : index;
}

export const loyaltyHandlers = [
  http.get("*/v1/admin/customers/:customerId/loyalty", ({ params, request }) => {
    const index = customerIndex(request, params.customerId as string, "loyalty.read");
    if (index instanceof Response) return index;
    const customer = customers[index]!;
    const entries = ledgerOf(index);
    const { reminderDaysBefore } = settingValue<{ reminderDaysBefore: number }>("loyalty.points_expiry");
    const soon = entries.filter(
      (entry) =>
        entry.status === "available" &&
        entry.points > 0 &&
        entry.expiresAt !== null &&
        Date.parse(entry.expiresAt) - Date.now() < reminderDaysBefore * DAY * 60_000,
    );
    const pending = entries.filter((entry) => entry.status === "pending").reduce((sum, entry) => sum + entry.points, 0);
    // The next tier up from `loyalty.tiers` (D-134), and the 12-month spend as a share of it.
    const tiers = settingValue<{ tier: Schemas["LoyaltyTier"]; minSpend12m: string }[]>("loyalty.tiers");
    const next = tiers[tiers.findIndex((tier) => tier.tier === customer.loyalty.tier) + 1] ?? null;
    const body: Schemas["LoyaltySummaryDto"] = {
      tier: customer.loyalty.tier,
      availablePoints: customer.loyalty.availablePoints,
      availableValue: value(customer.loyalty.availablePoints),
      pendingPoints: pending,
      expiringSoon: soon.map((entry) => ({ points: entry.points, expiresAt: entry.expiresAt! })),
      spend12m: customer.loyalty.spend12m,
      spendBasisTh:
        "นับยอดเมื่อคำสั่งซื้อเสร็จสิ้นหลังได้รับของ · ยอดก่อน VAT ไม่รวมค่าส่ง · ย้อนหลัง 12 เดือน · อัปเดตวันละครั้ง",
      spendBasisEn:
        "Counts orders once completed after delivery · before VAT, without shipping · last 12 months · updated daily",
      // The mock keeps no paid-but-not-completed spend.
      spendNotYetCounted: "0.00",
      pointValue: settingValue<string>("loyalty.point_value"),
      multiplier: customer.loyalty.tier === "silver" ? "1.25" : customer.loyalty.tier === "gold" ? "1.50" : "1.00",
      currency: "THB",
      nextTier: next?.tier ?? null,
      nextTierMinSpend12m: next?.minSpend12m ?? null,
      nextTierProgressPct: next
        ? Math.min(100, (Number(customer.loyalty.spend12m) / Number(next.minSpend12m)) * 100).toFixed(2)
        : "100.00",
    };
    return HttpResponse.json(body);
  }),
  http.get("*/v1/admin/customers/:customerId/loyalty/ledger", ({ params, request }) => {
    const index = customerIndex(request, params.customerId as string, "loyalty.read");
    if (index instanceof Response) return index;
    const url = new URL(request.url);
    const rows: Schemas["PointsEntryDto"][] = ledgerOf(index)
      .map(({ order, note, ...entry }) => ({
        ...entry,
        orderId: order?.id ?? null,
        orderCode: order?.orderCode ?? null,
        groupCode: order?.groupCode ?? null,
        reason: note,
      }))
      // `?entryType` (v0.5.0).
      .filter((entry) => !url.searchParams.get("entryType") || entry.entryType === url.searchParams.get("entryType"));
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),
  http.get("*/v1/admin/customers/:customerId/consents", ({ params, request }) => {
    const index = customerIndex(request, params.customerId as string);
    return index instanceof Response ? index : HttpResponse.json(consentsOf(index));
  }),
];
