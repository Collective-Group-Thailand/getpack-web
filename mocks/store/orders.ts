/**
 * The customer's orders and account, mocked at the published paths: orders, notification
 * preferences (B1.3), loyalty, referral and store credit (U-F0.2), and the PDPA requests and
 * sign-in methods (`store.me.*PrivacyRequest*`, `store.me.unlinkIdentity`, U-B0.1).
 *
 * Orders are the back office's own rows (`../admin/commerce`) seen from the customer's side: no
 * factory, no cost or margin, no internal timeline entry, and the actions the customer can take
 * now as `nextActions`. A persona owns its fake commerce customer's orders (`ownerIndex`) — the
 * seeded ones in every state, and whatever it places at checkout.
 *
 * Points, referrals and store credit are obviously fake and deterministic.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { baht, customers as fakeCustomers, orders, satang, type MockOrder } from "../admin/commerce";
import { settingValue } from "../admin/platform";
import { deliveredAt, receipts, toOrderDto, toStoreOrderDto } from "./order-dto";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { provinceRefOf } from "./catalog";
import { customerMe, customerOf, type MockCustomer } from "./customers";
import { ownerIdOf } from "./owner";
import { MILESTONE_STATUS, SHIPMENT_STATUS } from "@/domain/status";
import { statusLabels } from "../status-labels";
import { createTranslator } from "next-intl";

import { timelineTitle } from "@/features/customer/orders/timeline";
import ordersEn from "@/i18n/messages/en/customer/my-orders.json";
import ordersTh from "@/i18n/messages/th/customer/my-orders.json";

type PrivacyRequest = Schemas["PrivacyRequestDto"];

const DAY = 24 * 60;
/** Where the mock pretends the storefront lives, for links the API builds (`STOREFRONT_BASE_URL`). */
const MOCK_STOREFRONT = "http://localhost:3000";
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");

export function ordersOf(customer: MockCustomer): MockOrder[] {
  const owner = ownerIdOf(customer);
  return orders.filter((order) => order.customer.id === owner).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function orderOf(customer: MockCustomer, orderId: string): MockOrder | undefined {
  return ordersOf(customer).find((order) => order.id === orderId);
}

export const trackingTokenOf = (order: MockOrder) => `trk${order.id.replace(/-/g, "").slice(-16)}`;

export { claimWindowEnd, deliveredAt, productOf, receipts } from "./order-dto";

/** The start of the Bangkok day `days` after `date` (`YYYY-MM-DD`), as an ISO timestamp. */
const bangkokDate = (date: string, days: number) =>
  `${new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)}T18:00:00+07:00`;

const STEPS = {
  ordered: ["สั่งซื้อ", "Ordered"],
  paid: ["ชำระเงิน", "Paid"],
  artwork: ["ไฟล์และแบบตัวอย่าง", "Artwork and proof"],
  production: ["ผลิต", "Production"],
  shipping: ["จัดส่ง", "Shipping"],
  completed: ["รับสินค้า", "Received"],
} as const;
type StepKey = keyof typeof STEPS;

const paidOf = (order: MockOrder) =>
  !["waiting_payment", "cancelled"].includes(order.status) ||
  order.payments.some((entry) => entry.status === "succeeded");

/** Where an order stands, step by step (`ProgressStepDto`) — the API's list; the mock reads the row. */
export function stepsOf(order: MockOrder): Schemas["ProgressStepDto"][] {
  const produced = ["shipping", "completed"].includes(order.status);
  const shipments = order.shipments;
  const allDelivered = shipments.length > 0 && shipments.every((shipment) => shipment.status === "delivered");
  const firstPaid = order.payments.find((entry) => entry.status === "succeeded" && entry.paidAt)?.paidAt ?? null;
  const done: Record<StepKey, boolean> = {
    ordered: true,
    paid: paidOf(order),
    artwork: order.artworkStatus === "approved",
    production: produced,
    shipping: allDelivered,
    completed: order.status === "completed" || receipts.has(order.id),
  };
  const at: Partial<Record<StepKey, string | null>> = {
    ordered: order.createdAt,
    paid: firstPaid ?? order.createdAt,
    artwork: order.artwork.proofs.find((proof) => proof.status === "approved")?.decidedAt ?? null,
    production: shipments[0] ? bangkokIso(-DAY * 9) : null,
    shipping: deliveredAt(order),
    completed: receipts.get(order.id)?.confirmedAt ?? deliveredAt(order),
  };
  const ship = order.promisedShipDate;
  const planned: Partial<Record<StepKey, string>> = ship
    ? {
        production: bangkokDate(ship, -1),
        shipping: bangkokDate(ship, 0),
        completed: bangkokDate(ship, 2),
      }
    : {};
  const keys = Object.keys(STEPS) as StepKey[];
  const current = order.status === "cancelled" ? null : (keys.find((key) => !done[key]) ?? null);
  const statusOf = (key: StepKey) =>
    done[key] ? "completed" : key === current ? "in_progress" : order.status === "cancelled" ? "skipped" : "pending";
  return keys.map((key) => ({
    key,
    labelTh: STEPS[key][0],
    labelEn: STEPS[key][1],
    status: statusOf(key),
    ...statusLabels("status", MILESTONE_STATUS, statusOf(key)),
    completedAt: done[key] ? (at[key] ?? null) : null,
    // The factory's plan (D-075), as far as the row has one: production finishes the day before the
    // promised ship date, delivery is the estimate.
    promisedAt: planned[key] ?? null,
  }));
}

/** `store.timeline.progress`: the dates an order reached, and its steps. */
export function toProgress(order: MockOrder): Schemas["OrderProgressDto"] {
  const steps = stepsOf(order);
  const when = (key: StepKey) => steps.find((step) => step.key === key)?.completedAt ?? null;
  const shippedAt = order.shipments.length ? bangkokIso(-DAY * 9) : null;
  return {
    orderId: order.id,
    status: order.status,
    promisedShipDate: order.promisedShipDate,
    estimatedDeliveryDate: toOrderDto(order).estimatedDeliveryDate,
    paidForProductionAt: paidOf(order) ? when("paid") : null,
    artworkApprovedAt: when("artwork"),
    productionStartedAt: when("artwork"),
    shippedAt,
    shippedOnTime: shippedAt && order.promisedShipDate ? shippedAt.slice(0, 10) <= order.promisedShipDate : null,
    deliveredAt: when("shipping"),
    completedAt: when("completed"),
    steps,
  };
}

const CARRIER: Record<MockOrder["shipments"][number]["carrier"], Schemas["StoreCarrier"]> = {
  factory_fleet: "packio",
  flash_express: "flash_express",
  deliveree: "deliveree",
};

const shipmentRef = (shipment: MockOrder["shipments"][number]): Schemas["TimelineShipmentRefDto"] => ({
  id: shipment.id,
  shipmentNo: shipment.shipmentNo,
  carrier: CARRIER[shipment.carrier],
  trackingNo: shipment.trackingNo,
});

/** `store.timeline.get`: what happened, newest first, as an activity type and an i18n key. */
export function toTimeline(order: MockOrder): Schemas["TimelineEntryDto"][] {
  const entries: Schemas["TimelineEntryDto"][] = [];
  const add = (
    id: string,
    occurredAt: string,
    type: string,
    extra: Partial<Pick<Schemas["TimelineEntryDto"], "params" | "photoFileIds" | "shipment">> = {},
  ) => {
    const entry = {
      id,
      occurredAt,
      type,
      messageKey: `activity.${type}`,
      params: extra.params ?? {},
      photoFileIds: extra.photoFileIds ?? [],
      shipment: extra.shipment ?? null,
      count: 1,
    };
    // D-313: the API words each entry; the mock borrows the storefront's sentence for its type.
    const words = (locale: "th" | "en") =>
      timelineTitle(
        createTranslator({
          locale,
          messages: { orders: locale === "th" ? ordersTh : ordersEn },
          namespace: "orders",
        }) as (key: string, values?: Record<string, string>) => string,
        locale,
        { ...entry, messageTh: "", messageEn: "" },
      ) ?? type;
    entries.push({ ...entry, messageTh: words("th"), messageEn: words("en") });
  };
  add(`${order.id}:placed`, order.createdAt, "order.placed", { params: { orderCode: order.orderCode } });
  for (const payment of order.payments.filter((entry) => entry.status === "succeeded" && entry.paidAt))
    add(`${payment.id}:paid`, payment.paidAt!, "payment.received");
  for (const submission of order.artwork.submissions)
    add(`${submission.id}:sub`, submission.submittedAt, "artwork.submitted", {
      params: { versionNo: submission.versionNo },
    });
  for (const proof of order.artwork.proofs) {
    add(`${proof.id}:sent`, proof.sentAt, "proof.sent", { params: { versionNo: proof.versionNo } });
    if (proof.decidedAt)
      add(
        `${proof.id}:decided`,
        proof.decidedAt,
        proof.status === "approved" ? "proof.approved" : "proof.changes_requested",
        { params: { versionNo: proof.versionNo } },
      );
  }
  for (const job of order.jobs)
    for (const milestone of job.milestones.filter((entry) => entry.completedAt))
      add(`${job.id}:${milestone.key}`, milestone.completedAt!, "production.milestone_reached", {
        params: { stepKey: milestone.key, labelTh: milestone.name, labelEn: milestone.name },
      });
  for (const shipment of order.shipments) {
    add(`${shipment.id}:out`, bangkokIso(-DAY * 9), "shipment.picked_up", { shipment: shipmentRef(shipment) });
    if (shipment.deliveredAt)
      add(`${shipment.id}:pod`, shipment.deliveredAt, "shipment.delivered", {
        shipment: shipmentRef(shipment),
        photoFileIds: (shipment.pod?.photos ?? []).map((photo) => photo.id),
      });
  }
  const confirmed = receipts.get(order.id);
  if (confirmed) add(`${order.id}:received`, confirmed.confirmedAt, "order.receipt_confirmed");
  if (order.cancelledAt) add(`${order.id}:cancel`, order.cancelledAt, "order.cancelled");
  return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** `store.timeline.shipments`: the order's deliveries, with the recipient the customer entered. */
export function toShipments(order: MockOrder): Schemas["StoreShipmentDto"][] {
  return order.shipments.map((shipment) => ({
    id: shipment.id,
    shipmentNo: shipment.shipmentNo,
    status: shipment.status,
    ...statusLabels("status", SHIPMENT_STATUS, shipment.status),
    carrier: CARRIER[shipment.carrier],
    trackingNo: shipment.trackingNo,
    trackingUrl: null,
    destination: {
      recipientName: shipment.destination.recipientName,
      phone: shipment.destination.phone,
      line1: shipment.destination.line1,
      line2: shipment.destination.line2,
      postcode: shipment.destination.postcode,
      province: provinceRefOf(shipment.destination.postcode, shipment.destination.province),
    },
    cartonsCount: shipment.cartons,
    pickedUpAt: bangkokIso(-DAY * 9),
    deliveredAt: shipment.deliveredAt,
    items: [
      {
        orderCode: order.orderCode,
        quantity: shipment.quantity,
        deliveredQuantity: shipment.pod?.deliveredQuantity ?? null,
      },
    ],
    events: (
      [
        { occurredAt: bangkokIso(-DAY * 9), status: "picked_up", location: "โรงงานพาร์ตเนอร์" },
        { occurredAt: bangkokIso(-DAY * 9 + 180), status: "in_transit", location: null },
        ...(shipment.deliveredAt
          ? [
              {
                occurredAt: shipment.deliveredAt,
                status: "delivered",
                location: shipment.destination.province,
              } as const,
            ]
          : []),
      ] as const
    ).map((event) => ({ ...event, ...statusLabels("status", SHIPMENT_STATUS, event.status) })),
    proofOfDelivery: shipment.pod
      ? {
          receiverName: shipment.pod.receiverName,
          capturedAt: shipment.pod.capturedAt,
          photoFileIds: shipment.pod.photos.map((photo) => photo.id),
        }
      : null,
  }));
}

const DOC_KIND: Record<string, Schemas["CustomerDocumentKind"]> = {
  iv: "instalment",
  tr: "instalment",
  rc: "collection",
  cn: "credit_note",
  dn: "debit_note",
};

const SELLER: Schemas["DocumentPartyDto"] = {
  name: "บริษัท คอลเลกทีฟ กรุ๊ป (ประเทศไทย) จำกัด (ข้อมูลจำลอง)",
  taxId: "0000000000000",
  branchCode: "00000",
  address: "ที่อยู่จำลอง กรุงเทพมหานคร 10000",
};

/** `store.documents.list`: the customer's documents, each naming its order (a quotation is not one). */
export function toDocuments(order: MockOrder): Schemas["CustomerDocumentDto"][] {
  return order.documents
    .filter((document) => document.type !== "qt")
    .map((document) => {
      const gross = satang(document.grossAmount);
      const net = Math.round(gross / 1.07);
      return {
        id: document.id,
        docType: document.type as Schemas["CustomerDocumentType"],
        docKind: DOC_KIND[document.type] ?? "instalment",
        docNumber: document.number,
        status: document.status,
        nextActions: [],
        documentDate: document.issuedAt.slice(0, 10),
        dueDate: null,
        isTaxInvoice: document.type === "tr" || document.type === "iv",
        isFullForm: Boolean(order.taxProfile),
        buyer: {
          name: order.taxProfile?.name ?? order.customer.displayName,
          taxId: order.taxProfile?.taxId ?? null,
          branchCode: order.taxProfile?.branch ?? null,
          address: null,
        },
        seller: SELLER,
        orderGroupId: order.group.id,
        groupCode: order.group.groupCode,
        orderId: order.id,
        orderCode: order.orderCode,
        paymentId: null,
        originalDocument: null,
        reason: null,
        cnKind: null,
        receiptVia: null,
        taxNature: "hire_of_work",
        netAmount: baht(net),
        discountAmount: "0.00",
        vatRatePct: "7.0000",
        vatAmount: baht(gross - net),
        grossAmount: document.grossAmount,
        whtAmount: "0.00",
        cashAmount: document.grossAmount,
        deductedPriorAmount: "0.00",
        amountDue: "0.00",
        currency: "THB",
        lines: [
          {
            lineNo: 1,
            description: `${document.number} — ${order.orderCode}`,
            quantity: "1.000",
            netAmount: baht(net),
            discountAmount: "0.00",
            vatAmount: baht(gross - net),
            grossAmount: document.grossAmount,
            whtAmount: "0.00",
          },
        ],
        receivable: null,
        pdfReady: true,
        voidReason: null,
        issuedAt: document.issuedAt,
      };
    });
}

/* ------------------------------------------------------------------------------ the account */

const TIERS = [
  { tier: "member" as const, from: 0, multiplier: "1.00" },
  { tier: "silver" as const, from: 5_000_000, multiplier: "1.25" },
  { tier: "gold" as const, from: 20_000_000, multiplier: "1.50" },
];

function spendOf(customer: MockCustomer): number {
  return ordersOf(customer)
    .filter((order) => order.status !== "cancelled" && order.status !== "waiting_payment")
    .reduce((sum, order) => sum + satang(order.grossAmount) - Math.round((satang(order.grossAmount) * 7) / 107), 0);
}

const privacy = new Map<string, PrivacyRequest[]>();
type Preference = Schemas["NotificationPreferenceDto"];
const preferences = new Map<string, Preference[]>();
const CHANNELS: Preference["channel"][] = ["email", "sms", "line", "web_push"];

function preferencesOf(customer: MockCustomer): Preference[] {
  if (!preferences.has(customer.persona)) {
    preferences.set(
      customer.persona,
      CHANNELS.flatMap((channel) =>
        (["transactional", "marketing"] as const).map((category) => ({
          channel,
          category,
          enabled: category === "transactional" ? channel !== "web_push" : channel === "email",
        })),
      ),
    );
  }
  return preferences.get(customer.persona)!;
}

export const storeOrderHandlers = [
  // store.orders.get (published, U-F0.2): the lean order; its sub-resources are their own reads.
  http.get("*/v1/store/orders/:orderId", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const order = orderOf(customer, String(params.orderId));
    return order ? HttpResponse.json(toStoreOrderDto(order)) : notFound();
  }),

  // store.orders.getSpecSheet (U2.F2, D-287): once the artwork is approved; a fake PDF behind a data URL.
  http.get("*/v1/store/orders/:orderId/spec-sheet", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const order = orderOf(customer, String(params.orderId));
    if (!order) return notFound();
    if (order.artwork.status !== "approved")
      return problem(409, "orders.spec_sheet_unavailable", "เอกสารสเปกพร้อมเมื่ออนุมัติงานพิมพ์แล้ว");
    const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "th";
    const pdf = `%PDF-1.4\n% mock spec sheet ${order.orderCode} ${lang}\n%%EOF\n`;
    return HttpResponse.json({
      fileName: `${order.orderCode}-spec-${lang}.pdf`,
      url: `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`,
      expiresAt: bangkokIso(5),
    } satisfies Schemas["SpecSheetDto"]);
  }),

  // store.timeline.get / progress / shipments (published, U-F0.2).
  http.get("*/v1/store/orders/:orderId/timeline", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const order = orderOf(customer, String(params.orderId));
    return order ? HttpResponse.json({ data: toTimeline(order) }) : notFound();
  }),
  http.get("*/v1/store/orders/:orderId/progress", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const order = orderOf(customer, String(params.orderId));
    return order ? HttpResponse.json(toProgress(order)) : notFound();
  }),
  http.get("*/v1/store/orders/:orderId/shipments", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const order = orderOf(customer, String(params.orderId));
    return order ? HttpResponse.json(toShipments(order)) : notFound();
  }),

  // store.timeline.createTrackingLink (published, U-F0.2): a link anyone holding it may open.
  http.post("*/v1/store/orders/:orderId/tracking-links", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const order = orderOf(customer, String(params.orderId));
    if (!order) return notFound();
    const token = trackingTokenOf(order);
    return HttpResponse.json({ token, url: `${MOCK_STOREFRONT}/track/${token}` } satisfies Schemas["TrackingLinkDto"], {
      status: 201,
    });
  }),

  // store.documents.list / pdf (published, U-F0.2): every document of the customer's orders.
  http.get("*/v1/store/documents", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const rows = ordersOf(customer).flatMap(toDocuments);
    return HttpResponse.json(paginate(rows, { page: Number(query.page ?? 1), perPage: Number(query.perPage ?? 20) }));
  }),
  http.get("*/v1/store/documents/:documentId/pdf", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    for (const order of ordersOf(customer)) {
      const document = toDocuments(order).find((candidate) => candidate.id === params.documentId);
      if (document)
        return HttpResponse.json({
          url: `data:text/plain;charset=utf-8,${encodeURIComponent(`${document.docNumber} — ${order.orderCode} (ข้อมูลจำลอง) · Collective Group (Thailand)`)}`,
          expiresAt: bangkokIso(5),
        } satisfies Schemas["DownloadUrlDto"]);
    }
    return problem(404, "http.not_found", "ไม่พบเอกสารนี้");
  }),

  // store.loyalty.get (published, U-F0.2): the balance, what expires soon, the tier.
  http.get("*/v1/store/loyalty", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const at = TIERS.findLastIndex((tier) => spendOf(customer) >= tier.from);
    const current = TIERS[at]!;
    const next = TIERS[at + 1] ?? null;
    const summary: Schemas["LoyaltySummaryDto"] = {
      availablePoints: customer.points,
      availableValue: baht(customer.points * 250),
      currency: "THB",
      expiringSoon: customer.points > 0 ? [{ points: 120, expiresAt: bangkokIso(21 * DAY) }] : [],
      multiplier: current.multiplier,
      pendingPoints: customer.ownerIndex === null ? 0 : 42,
      pointValue: "2.50",
      spend12m: baht(spendOf(customer)),
      tier: current.tier,
      // The next tier up (D-134) and the 12-month spend as a share of it; 100 at the top.
      nextTier: next?.tier ?? null,
      nextTierMinSpend12m: next ? baht(next.from) : null,
      nextTierProgressPct: next ? Math.min(100, (spendOf(customer) / next.from) * 100).toFixed(2) : "100.00",
    };
    return HttpResponse.json(summary);
  }),

  // store.loyalty.ledger (published, U-F0.2), newest first.
  http.get("*/v1/store/loyalty/ledger", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const entry = (
      id: string,
      entryType: Schemas["PointsEntryType"],
      points: number,
      createdMinutesAgo: number,
      extra: Partial<Schemas["PointsEntryDto"]> = {},
    ): Schemas["PointsEntryDto"] => ({
      id,
      entryType,
      points,
      bahtValue: baht(points * 250),
      status: "available",
      availableAt: bangkokIso(-createdMinutesAgo + DAY),
      expiresAt: bangkokIso(365 * DAY - createdMinutesAgo),
      orderId: null,
      orderCode: null,
      groupCode: null,
      reason: null,
      createdAt: bangkokIso(-createdMinutesAgo),
      ...extra,
    });
    const earned = ordersOf(customer)
      .filter((order) => order.status === "completed")
      .map((order, index) =>
        entry(mockId("pte", index + 1), "earn_order", Math.floor(satang(order.netAmount) / 50_000), 2 * DAY, {
          orderId: order.id,
          orderCode: order.orderCode,
        }),
      );
    const signup = entry(mockId("pte", 900), "earn_signup", 20, 60 * DAY, { reason: "ของขวัญต้อนรับสมาชิกใหม่" });
    const counted = [...earned, signup].reduce((sum, row) => sum + row.points, 0);
    const opening =
      customer.points - counted !== 0
        ? [
            entry(mockId("pte", 901), "adjust", customer.points - counted, 90 * DAY, {
              reason: "ยอดยกมา (ข้อมูลจำลอง)",
            }),
          ]
        : [];
    const url = new URL(request.url);
    return HttpResponse.json(
      paginate(
        [...earned, signup, ...opening].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        { page: Number(url.searchParams.get("page") ?? 1), perPage: Number(url.searchParams.get("perPage") ?? 25) },
      ),
    );
  }),

  // store.referral.get: the code, its link, the rules, the monthly cap and the recent friends.
  http.get("*/v1/store/referral", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = customer.ownerIndex === null ? null : fakeCustomers[customer.ownerIndex]!;
    const code = owner?.referralCode ?? `PKNEW${customer.phone.slice(-4)}`;
    // The rules are the `referral.rules` setting (D-136); the reward in points at the point value,
    // rounded down (D-131).
    const rules = settingValue<{
      refereeDiscountPct: string;
      refereeDiscountMaxBaht: string;
      referrerRewardBaht: string;
      maxRewardedReferralsPerMonth: number;
    }>("referral.rules");
    const referral: Schemas["MyReferralDto"] = {
      code,
      link: `${MOCK_STOREFRONT}/r/${code}`,
      referrals: owner
        ? { pending: 1, underReview: 0, qualified: 0, rewarded: 1, rejected: 0 }
        : { pending: 0, underReview: 0, qualified: 0, rewarded: 0, rejected: 0 },
      // The friends behind those counts, by the masked name the API gives (PDPA), newest first.
      recent: owner
        ? [
            {
              id: mockId("ref", 2),
              refereeName: "ส***ย ก.",
              status: "pending",
              rewardPoints: 0,
              joinedAt: bangkokIso(-3 * DAY),
            },
            {
              id: mockId("ref", 1),
              refereeName: "ม***า ร.",
              status: "rewarded",
              rewardPoints: 40,
              joinedAt: bangkokIso(-45 * DAY),
            },
          ]
        : [],
      rewardedThisMonth: 0,
      rules: {
        refereeDiscountPct: rules.refereeDiscountPct,
        refereeDiscountMaxAmount: rules.refereeDiscountMaxBaht,
        referrerRewardAmount: rules.referrerRewardBaht,
        referrerRewardPoints: Math.floor(
          Number(rules.referrerRewardBaht) / Number(settingValue<string>("loyalty.point_value")),
        ),
        maxRewardedPerMonth: rules.maxRewardedReferralsPerMonth,
      },
    };
    return HttpResponse.json(referral);
  }),

  // store.documents.storeCredit (published, U-F0.2).
  http.get("*/v1/store/store-credit", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owned = customer.ownerIndex !== null;
    const done = ordersOf(customer).find((order) => order.status === "completed");
    const credit: Schemas["StoreCreditDto"] = {
      balance: owned ? "350.00" : "0.00",
      currency: "THB",
      entries: owned
        ? [
            {
              id: mockId("scr", 1),
              source: "shortage_credit",
              amount: "350.00",
              orderCode: done?.orderCode ?? null,
              docNumber: "CN-2569-00007",
              createdAt: bangkokIso(-7 * DAY),
            },
          ]
        : [],
    };
    return HttpResponse.json(credit);
  }),

  // store.me.listPrivacyRequests (D-222): newest first.
  http.get("*/v1/store/me/privacy-requests", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return HttpResponse.json(privacy.get(customer.persona) ?? []);
  }),

  // store.me.createPrivacyRequest: one open request per kind; answered by the DPO within 30 days.
  http.post("*/v1/store/me/privacy-requests", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (!request.headers.get("idempotency-key"))
      return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้");
    const body = (await request.json().catch(() => null)) as Schemas["CreatePrivacyRequestDto"] | null;
    if (!body || !["export", "deletion"].includes(body.kind))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path: "kind", code: "enum", message: "kind" }]);
    const list = privacy.get(customer.persona) ?? [];
    if (list.some((entry) => entry.kind === body.kind && entry.status === "submitted"))
      return problem(409, "privacy.request_open", "มีคำขอประเภทนี้ที่กำลังดำเนินการอยู่แล้ว");
    const created: PrivacyRequest = {
      id: mockId("prv", list.length + 1 + (customer.ownerIndex ?? 7) * 10),
      kind: body.kind,
      status: "submitted",
      note: body.note ?? null,
      answer: null,
      decidedAt: null,
      export: null,
      requestedAt: bangkokIso(),
      // `privacy.response_days` (30).
      dueAt: bangkokIso(30 * DAY),
    };
    privacy.set(customer.persona, [created, ...list]);
    return HttpResponse.json(created, { status: 201 });
  }),

  // store.me.unlinkIdentity: never the account phone, never the last method; answers `/me`.
  http.delete("*/v1/store/me/identities/:provider", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (params.provider === "phone_otp")
      return problem(409, "auth.identity_not_unlinkable", "เลิกเชื่อมเบอร์มือถือของบัญชีไม่ได้");
    if (customer.identities.length <= 1)
      return problem(409, "auth.identity_last_method", "ต้องเหลือวิธีเข้าสู่ระบบอย่างน้อยหนึ่งวิธี");
    const before = customer.identities.length;
    customer.identities = customer.identities.filter((identity) => identity.provider !== params.provider);
    if (customer.identities.length === before) return problem(404, "http.not_found", "ไม่ได้เชื่อมต่อบัญชีนี้");
    return HttpResponse.json(customerMe(customer));
  }),

  // Published (B1.3): notification preferences per channel and category, stateful per persona.
  http.get("*/v1/store/me/notification-preferences", ({ request }) => {
    const customer = customerOf(request);
    return customer ? HttpResponse.json(preferencesOf(customer)) : unauthenticated();
  }),
  http.put("*/v1/store/me/notification-preferences", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = (await request.json().catch(() => null)) as Schemas["SetPreferencesDto"] | null;
    if (!body?.items) return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง");
    // D-144: order and finance messages cannot be switched off on e-mail.
    if (body.items.some((item) => item.category === "transactional" && item.channel === "email" && !item.enabled))
      return problem(422, "notification.transactional_required", "ปิดการแจ้งเตือนคำสั่งซื้อทางอีเมลไม่ได้", [
        { path: "items", code: "transactional_email", message: "required" },
      ]);
    const current = preferencesOf(customer);
    for (const item of body.items) {
      const existing = current.find((entry) => entry.channel === item.channel && entry.category === item.category);
      if (existing) existing.enabled = item.enabled;
      else current.push(item);
    }
    return HttpResponse.json(current);
  }),
];
