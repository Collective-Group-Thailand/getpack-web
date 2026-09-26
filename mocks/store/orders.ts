/**
 * The customer's orders and account, mocked (CONTRACT-REQUEST store.orders, store.loyalty,
 * store.wallet, store.privacy, store.identities; published notification preferences, B1.3).
 *
 * Orders are the back office's own rows (`../admin/commerce`) seen from the customer's side: no
 * factory, no cost or margin, no internal timeline entry, and the actions the customer can take
 * now as `nextActions`. A persona owns its fake commerce customer's orders (`ownerIndex`) — the
 * seeded ones in every state, and whatever it places at checkout.
 *
 * Points, referrals and store credit are obviously fake and deterministic.
 */

import { http, HttpResponse } from "msw";
import type { z } from "zod";

import type { storeOrderDetail, storeOrderSummary, privacyRequest } from "@/lib/api/requests/store-orders";
import type { Schemas } from "@/lib/api/types";

import { baht, customers as fakeCustomers, orders, satang, type MockOrder } from "../admin/commerce";
import { mockRequest } from "../route";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { catalogProducts, imageUrl } from "./catalog";
import { prepressIfAny } from "../admin/prepress";
import { groupForOrder, paymentsOfInstalment } from "./checkout";
import { customerOf, type MockCustomer } from "./customers";
import { ownerIdOf } from "./owner";

type Summary = z.output<typeof storeOrderSummary>;
type Detail = z.output<typeof storeOrderDetail>;
type PrivacyRequest = z.output<typeof privacyRequest>;

const DAY = 24 * 60;
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");

export function ordersOf(customer: MockCustomer): MockOrder[] {
  const owner = ownerIdOf(customer);
  return orders.filter((order) => order.customer.id === owner).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function orderOf(customer: MockCustomer, orderId: string): MockOrder | undefined {
  return ordersOf(customer).find((order) => order.id === orderId);
}

/** Receipt confirmed by the customer (D-081) — the fulfilment mock (3.6) writes here too. */
export const receipts = new Map<string, { confirmedAt: string }>();

export const trackingTokenOf = (order: MockOrder) => `trk${order.id.replace(/-/g, "").slice(-16)}`;

function deliveredAt(order: MockOrder): string | null {
  return order.shipments.map((shipment) => shipment.deliveredAt).find(Boolean) ?? null;
}

function claimWindowEnd(order: MockOrder): string | null {
  const confirmed = receipts.get(order.id)?.confirmedAt;
  const base = confirmed ?? deliveredAt(order);
  return base ? new Date(Date.parse(base) + 7 * 86_400_000).toISOString().replace("Z", "+00:00") : null;
}

/** What the customer can do on this order now (entity.next-actions, customer side). */
export function customerActions(order: MockOrder): Summary["nextActions"] {
  const actions: Summary["nextActions"] = [];
  const group = groupForOrder(order);
  const due = group.instalments.find((entry) => !entry.paid && entry.dueTrigger === "at_checkout");
  if (order.status !== "cancelled" && due) actions.push({ key: "order.pay_instalment" });
  const balanceDue = group.instalments.find((entry) => !entry.paid && entry.dueTrigger === "before_shipping");
  if (balanceDue && ["in_production", "artwork_approved"].includes(order.status))
    actions.push({ key: "order.pay_instalment" });
  const prepress = prepressIfAny(order.id);
  const service = prepress?.designService;
  const blocked = prepress?.submissions[0]?.preflightStatus === "blocked";
  if (
    order.status !== "cancelled" &&
    order.designOption !== "hired_design" &&
    (["awaiting_upload", "changes_requested"].includes(order.artworkStatus) || blocked)
  )
    actions.push({ key: "order.upload_artwork" });
  if (service?.status === "brief_pending") actions.push({ key: "order.design_brief" });
  if (service?.status === "delivered") actions.push({ key: "order.review_design" });
  if (order.artworkStatus === "proof_sent") actions.push({ key: "order.approve_proof" });
  const delivered = order.shipments.some((shipment) => shipment.status === "delivered");
  if (delivered && !receipts.has(order.id) && order.status !== "completed")
    actions.push({ key: "order.confirm_receipt" });
  const window = claimWindowEnd(order);
  if (
    delivered &&
    window &&
    Date.parse(window) > Date.now() &&
    order.claims.every((claim) => claim.status === "closed")
  )
    actions.push({ key: "order.open_claim" });
  if (order.status === "completed" || delivered) actions.push({ key: "order.reorder" });
  return actions;
}

function productOf(order: MockOrder): Summary["product"] {
  // Web orders carry their quotation's product in the first line; seeded ones only a type.
  const slug = catalogProducts().find((row) => order.lines[0]?.description.startsWith(String(row.nameTh)))?.slug;
  const row = catalogProducts().find((candidate) => candidate.slug === slug);
  return {
    slug: slug ? String(slug) : null,
    name: row ? String(row.nameTh) : order.productType.name,
    imageUrl: row ? imageUrl(((row.images as { fileId: string }[] | undefined) ?? [])[0]?.fileId) : null,
  };
}

export function toSummary(order: MockOrder): Summary {
  return {
    id: order.id,
    orderCode: order.orderCode,
    groupCode: order.groupCode,
    status: order.status,
    artworkStatus: order.artworkStatus,
    productType: order.productType,
    product: productOf(order),
    quantity: order.quantity,
    unit: order.unit,
    grossAmount: order.grossAmount,
    currency: "THB",
    promisedShipDate: order.promisedShipDate,
    nextActions: customerActions(order),
    createdAt: order.createdAt,
  };
}

function timelineOf(order: MockOrder): Detail["timeline"] {
  const entries: Detail["timeline"] = [
    {
      id: `${order.id}:placed`,
      at: order.createdAt,
      kind: "order.placed",
      title: "สั่งซื้อแล้ว",
      detail: order.orderCode,
      promisedAt: null,
      photos: [],
    },
  ];
  for (const payment of order.payments.filter((entry) => entry.status === "succeeded" && entry.paidAt))
    entries.push({
      id: `${payment.id}:paid`,
      at: payment.paidAt!,
      kind: "payment.received",
      title: "รับชำระเงินแล้ว",
      detail: null,
      promisedAt: null,
      photos: [],
    });
  for (const submission of order.artwork.submissions)
    entries.push({
      id: `${submission.id}:sub`,
      at: submission.submittedAt,
      kind: "artwork.submitted",
      title: `ส่งไฟล์งาน ครั้งที่ ${submission.versionNo}`,
      detail: null,
      promisedAt: null,
      photos: [],
    });
  for (const proof of order.artwork.proofs) {
    entries.push({
      id: `${proof.id}:sent`,
      at: proof.sentAt,
      kind: "proof.sent",
      title: `ได้รับปรู๊ฟ ฉบับที่ ${proof.versionNo}`,
      detail: null,
      promisedAt: null,
      photos: [],
    });
    if (proof.decidedAt)
      entries.push({
        id: `${proof.id}:decided`,
        at: proof.decidedAt,
        kind: proof.status === "approved" ? "proof.approved" : "proof.changes_requested",
        title: proof.status === "approved" ? "อนุมัติปรู๊ฟแล้ว" : "ขอแก้ไขปรู๊ฟ",
        detail: null,
        promisedAt: null,
        photos: [],
      });
  }
  for (const job of order.jobs)
    for (const milestone of job.milestones.filter((entry) => entry.completedAt))
      entries.push({
        id: `${job.id}:${milestone.key}`,
        at: milestone.completedAt!,
        kind: "milestone.completed",
        title: milestone.name,
        detail: null,
        promisedAt: milestone.dueAt,
        photos: [],
      });
  for (const shipment of order.shipments) {
    entries.push({
      id: `${shipment.id}:out`,
      at: bangkokIso(-60 * 24 * 9),
      kind: "shipment.picked_up",
      title: "ส่งออกจากโรงงานแล้ว",
      detail: shipment.shipmentNo,
      promisedAt: order.promisedShipDate ? `${order.promisedShipDate}T17:00:00+07:00` : null,
      photos: [],
    });
    if (shipment.deliveredAt)
      entries.push({
        id: `${shipment.id}:pod`,
        at: shipment.deliveredAt,
        kind: "shipment.delivered",
        title: "ส่งถึงแล้ว",
        detail: shipment.pod?.receiverName ?? null,
        promisedAt: null,
        photos: shipment.pod?.photos ?? [],
      });
  }
  const confirmed = receipts.get(order.id);
  if (confirmed)
    entries.push({
      id: `${order.id}:received`,
      at: confirmed.confirmedAt,
      kind: "order.receipt_confirmed",
      title: "ยืนยันรับสินค้าแล้ว",
      detail: null,
      promisedAt: null,
      photos: [],
    });
  if (order.cancelledAt)
    entries.push({
      id: `${order.id}:cancel`,
      at: order.cancelledAt,
      kind: "order.cancelled",
      title: "ยกเลิกคำสั่งซื้อ",
      detail: order.cancelReason,
      promisedAt: null,
      photos: [],
    });
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

export function toDetail(order: MockOrder): Detail {
  const group = groupForOrder(order);
  const share = (seq: number) => order.instalments.find((entry) => entry.seq === seq);
  const delivered = deliveredAt(order);
  const latestSubmission = order.artwork.submissions.at(-1) ?? null;
  const latestProof = order.artwork.proofs.at(-1) ?? null;
  return {
    ...toSummary(order),
    group: { id: order.group.id, groupCode: order.group.groupCode, orderCount: order.group.orderCount },
    specs: order.specs,
    lines: order.lines.map(({ lineNo: _no, ...line }) => line),
    netAmount: order.netAmount,
    discountAmount: order.discountAmount,
    shippingAmount: order.shippingAmount,
    vatAmount: order.vatAmount,
    designOption: order.designOption,
    mockupOption: order.mockupOption,
    tolerance: order.tolerance,
    leadTimeDays: order.leadTimeDays,
    estimatedDeliveryDate: order.promisedShipDate,
    destinations: order.destinations,
    taxInvoice: order.taxProfile
      ? { name: order.taxProfile.name, taxId: order.taxProfile.taxId, branch: order.taxProfile.branch }
      : null,
    poNumber: order.poNumber,
    instalments: group.instalments.map((entry) => {
      const mine = share(entry.seq);
      const active = paymentsOfInstalment(entry.id).find((payment) =>
        ["pending", "initiated", "awaiting_verification"].includes(payment.status),
      );
      const status = entry.paid
        ? "paid"
        : mine?.status === "cancelled" || order.status === "cancelled"
          ? "cancelled"
          : (mine?.status ?? "pending");
      return {
        id: entry.id,
        seq: entry.seq,
        label: entry.label,
        dueTrigger: entry.dueTrigger as never,
        requiredBefore: entry.requiredBefore as never,
        dueAt: entry.dueAt,
        grossAmount: mine?.grossAmount ?? baht(entry.gross),
        paidAmount: entry.paid ? (mine?.grossAmount ?? baht(entry.gross)) : "0.00",
        status: status as never,
        payable: !entry.paid && order.status !== "cancelled" && (status === "due" || status === "overdue"),
        activePaymentId: active?.id ?? null,
      };
    }),
    documents: order.documents.map((document, index) => ({
      id: document.id,
      type: document.type,
      number: document.number,
      status: document.status,
      issuedAt: document.issuedAt,
      grossAmount: document.grossAmount,
      instalmentSeq: document.type === "rc" || document.type === "iv" || document.type === "tr" ? index + 1 : null,
      final: false,
    })),
    artwork: {
      status: order.artworkStatus,
      latestSubmission: latestSubmission
        ? {
            id: latestSubmission.id,
            versionNo: latestSubmission.versionNo,
            preflightStatus: latestSubmission.preflightStatus,
            submittedAt: latestSubmission.submittedAt,
          }
        : null,
      latestProof: latestProof
        ? {
            id: latestProof.id,
            versionNo: latestProof.versionNo,
            status: latestProof.status,
            sentAt: latestProof.sentAt,
          }
        : null,
      designService:
        order.designOption === "hired_design" ? { status: "in_progress", roundNo: 1, freeRounds: 3 } : null,
    },
    shipments: order.shipments.map((shipment) => ({
      id: shipment.id,
      shipmentNo: shipment.shipmentNo,
      status: shipment.status,
      carrier: shipment.carrier,
      trackingNo: shipment.trackingNo,
      trackingUrl: null,
      destination: shipment.destination,
      quantity: shipment.quantity,
      cartons: shipment.cartons,
      shippedAt: bangkokIso(-60 * 24 * 9),
      deliveredAt: shipment.deliveredAt,
      events: [
        { at: bangkokIso(-60 * 24 * 9), status: "picked_up" as const, location: "โรงงานพาร์ตเนอร์", note: null },
        { at: bangkokIso(-60 * 24 * 9 + 180), status: "in_transit" as const, location: null, note: null },
        ...(shipment.deliveredAt
          ? [
              {
                at: shipment.deliveredAt,
                status: "delivered" as const,
                location: shipment.destination.province,
                note: null,
              },
            ]
          : []),
      ],
      pod: shipment.pod,
    })),
    toleranceOutcome: delivered
      ? {
          orderedQuantity: order.quantity,
          deliveredQuantity: order.shipments.reduce((sum, shipment) => sum + (shipment.pod?.deliveredQuantity ?? 0), 0),
          shortagePct: order.tolerance.shortagePct,
          overagePct: order.tolerance.overagePct,
          outcome: "exact",
          creditAmount: null,
          claimId: null,
        }
      : null,
    claims: order.claims,
    timeline: timelineOf(order),
    trackingToken: order.status === "cancelled" ? null : trackingTokenOf(order),
    receipt: delivered
      ? {
          confirmedAt: receipts.get(order.id)?.confirmedAt ?? null,
          autoCompleteAt: new Date(Date.parse(delivered) + 7 * 86_400_000).toISOString().replace("Z", "+00:00"),
          claimWindowEndsAt: claimWindowEnd(order),
        }
      : null,
    expiresAt: order.expiresAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
  };
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
  mockRequest("GET /v1/store/orders", ({ query, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const view = query.view;
    const rows = ordersOf(customer).filter((order) =>
      !view
        ? true
        : view === "completed"
          ? order.status === "completed"
          : view === "cancelled"
            ? order.status === "cancelled"
            : !["completed", "cancelled"].includes(order.status),
    );
    return paginate(rows.map(toSummary), query);
  }),

  mockRequest("GET /v1/store/orders/{orderId}", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const order = orderOf(customer, params.orderId);
    return order ? toDetail(order) : notFound();
  }),

  mockRequest("POST /v1/store/orders/{orderId}/documents/{documentId}/actions/download", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const order = orderOf(customer, params.orderId);
    const document = order?.documents.find((candidate) => candidate.id === params.documentId);
    if (!order || !document) return notFound();
    return {
      url: `data:text/plain;charset=utf-8,${encodeURIComponent(`${document.number} — ${order.orderCode} (ข้อมูลจำลอง) · Collective Group (Thailand)`)}`,
      expiresAt: bangkokIso(5),
    };
  }),

  mockRequest("GET /v1/store/me/points", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const spend = spendOf(customer);
    const index = TIERS.findLastIndex((tier) => spend >= tier.from);
    const current = TIERS[index]!;
    const next = TIERS[index + 1] ?? null;
    return {
      balance: {
        available: customer.points,
        pending: customer.ownerIndex === null ? 0 : 42,
        expiringSoon: customer.points > 0 ? 120 : 0,
        expiringSoonAt: customer.points > 0 ? bangkokIso(21 * DAY) : null,
        availableBahtValue: baht(customer.points * 250),
      },
      tier: {
        current: current.tier,
        multiplier: current.multiplier,
        spend12m: baht(spend),
        next: next?.tier ?? null,
        nextThreshold: next ? baht(next.from) : null,
        progressPct: next
          ? Math.min(100, Math.round(((spend - current.from) / (next.from - current.from)) * 100))
          : 100,
      },
      pointValue: "2.50",
    };
  }),

  mockRequest("GET /v1/store/me/points/entries", ({ query, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const earned = ordersOf(customer)
      .filter((order) => order.status === "completed")
      .map((order, index) => ({
        id: mockId("pte", index + 1),
        entryType: "earn_order" as const,
        points: Math.floor(satang(order.netAmount) / 50_000),
        bahtValue: baht(Math.floor(satang(order.netAmount) / 50_000) * 250),
        status: "available" as const,
        availableAt: bangkokIso(-60 * 24),
        expiresAt: bangkokIso(60 * 24 * 330),
        order: { id: order.id, orderCode: order.orderCode },
        note: null,
        createdAt: bangkokIso(-60 * 24 * 2),
      }));
    const signup = {
      id: mockId("pte", 900),
      entryType: "earn_signup" as const,
      points: 20,
      bahtValue: "50.00",
      status: "available" as const,
      availableAt: bangkokIso(-60 * 24 * 60),
      expiresAt: bangkokIso(60 * 24 * 21),
      order: null,
      note: "ของขวัญต้อนรับสมาชิกใหม่",
      createdAt: bangkokIso(-60 * 24 * 60),
    };
    const counted = [...earned, signup].reduce((sum, entry) => sum + entry.points, 0);
    const opening =
      customer.points - counted !== 0
        ? [
            {
              id: mockId("pte", 901),
              entryType: "adjust" as const,
              points: customer.points - counted,
              bahtValue: baht((customer.points - counted) * 250),
              status: "available" as const,
              availableAt: bangkokIso(-60 * 24 * 90),
              expiresAt: bangkokIso(60 * 24 * 270),
              order: null,
              note: "ยอดยกมา (ข้อมูลจำลอง)",
              createdAt: bangkokIso(-60 * 24 * 90),
            },
          ]
        : [];
    return paginate(
      [...earned, signup, ...opening].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      query,
    );
  }),

  mockRequest("GET /v1/store/me/referral", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = customer.ownerIndex === null ? null : fakeCustomers[customer.ownerIndex]!;
    return {
      code: owner?.referralCode ?? `PKNEW${customer.phone.slice(-4)}`,
      referrerReward: "รับ 200 คะแนน (มูลค่า ฿500) เมื่อเพื่อนสั่งซื้อครั้งแรกและพ้นช่วงเคลม",
      refereeReward: "เพื่อนได้ส่วนลด 5% สำหรับคำสั่งซื้อแรก (สูงสุด ฿500)",
      monthlyLimit: 10,
      rewardedThisMonth: owner ? 1 : 0,
      referrals: owner
        ? [
            {
              id: mockId("srf", 1),
              refereeName: "ส*** ต***",
              status: "rewarded",
              joinedAt: bangkokIso(-60 * 24 * 40),
              rewardPoints: 200,
            },
            {
              id: mockId("srf", 2),
              refereeName: "ว*** ต***",
              status: "pending",
              joinedAt: bangkokIso(-60 * 24 * 3),
              rewardPoints: null,
            },
          ]
        : [],
    };
  }),

  mockRequest("GET /v1/store/me/wallet", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owned = customer.ownerIndex !== null;
    return {
      promotions: [
        {
          code: "PACKIO10",
          title: "ลด 10% ค่าสินค้า",
          benefit: "ลด 10% จากค่าสินค้า",
          conditions: "ใช้ได้กับทุกสินค้า 1 ครั้ง",
          validUntil: bangkokIso(60 * 24 * 30),
          status: "available",
        },
        ...(owned
          ? [
              {
                code: "FIRSTBOX",
                title: "ลูกค้าใหม่ ลด 15%",
                benefit: "ลด 15% สูงสุด ฿500",
                conditions: "คำสั่งซื้อแรกเท่านั้น",
                validUntil: null,
                status: "used" as const,
              },
            ]
          : []),
      ],
      storeCredit: {
        balance: owned ? "350.00" : "0.00",
        currency: "THB",
        entries: owned
          ? [
              {
                id: mockId("scr", 1),
                kind: "shortage_credit",
                amount: "350.00",
                order: (() => {
                  const done = ordersOf(customer).find((order) => order.status === "completed");
                  return done ? { id: done.id, orderCode: done.orderCode } : null;
                })(),
                note: "สินค้าขาด 1.2% อยู่ในเกณฑ์ที่ตกลง คืนเป็นเครดิต (D-080)",
                createdAt: bangkokIso(-60 * 24 * 7),
              },
            ]
          : [],
      },
    };
  }),

  mockRequest("GET /v1/store/me/privacy-requests", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return { data: privacy.get(customer.persona) ?? [] };
  }),

  mockRequest("POST /v1/store/me/privacy-requests", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const list = privacy.get(customer.persona) ?? [];
    if (list.some((entry) => entry.kind === body.kind && ["received", "in_progress"].includes(entry.status)))
      return problem(409, "privacy.request_open", "มีคำขอประเภทนี้ที่กำลังดำเนินการอยู่แล้ว");
    const created: PrivacyRequest = {
      id: mockId("prv", list.length + 1 + (customer.ownerIndex ?? 7) * 10),
      kind: body.kind,
      status: "received",
      note:
        body.kind === "delete" && ordersOf(customer).some((order) => !["completed", "cancelled"].includes(order.status))
          ? "มีคำสั่งซื้อที่ยังไม่เสร็จสิ้น ข้อมูลที่เกี่ยวข้องจะถูกลบหลังคำสั่งซื้อเสร็จ และเอกสารภาษีต้องเก็บตามกฎหมาย"
          : null,
      download: null,
      requestedAt: bangkokIso(),
      dueAt: bangkokIso(30 * DAY),
    };
    privacy.set(customer.persona, [created, ...list]);
    return created;
  }),

  mockRequest("DELETE /v1/store/me/identities/{provider}", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (customer.identities.length <= 1)
      return problem(409, "identity.last_method", "ต้องเหลือวิธีเข้าสู่ระบบอย่างน้อยหนึ่งวิธี");
    const before = customer.identities.length;
    customer.identities = customer.identities.filter((identity) => identity.provider !== params.provider);
    if (customer.identities.length === before) return problem(404, "http.not_found", "ไม่ได้เชื่อมต่อบัญชีนี้");
    return undefined;
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
