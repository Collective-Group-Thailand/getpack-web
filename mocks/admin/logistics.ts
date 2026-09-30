/**
 * Logistics and claims, mocked (CONTRACT-REQUEST admin.shipments, admin.claims).
 *
 * Shipments are the commerce mock's own (orders being shipped or delivered) plus the ones a
 * logistics desk sees on a normal day: ready at a factory that cannot serve the area and needs
 * a fallback carrier (D-013, D-114), held by an unpaid before-shipping instalment (B3.2), a failed
 * delivery attempt, a POD to review with a shortage within tolerance and one outside it that
 * opened a claim automatically (D-080). Claims follow the D-082 window and D-083 rules.
 */

import { http, HttpResponse } from "msw";
import type { z } from "zod";

import type { carrierQuote, claimDetail, shipmentDetail } from "@/lib/api/requests/admin-logistics";
import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, type StaffPersona } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { baht, FACTORY, orders } from "./commerce";
import { registerQueue } from "./console";
import { etagOf } from "./tables";

export type Shipment = z.output<typeof shipmentDetail> & { updatedAt: string };
export type Claim = z.output<typeof claimDetail> & { updatedAt: string };
type Quote = z.output<typeof carrierQuote>;

const DAY = 24 * 60;
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const photo = (n: number, name: string) => ({
  id: mockId("fil", 8000 + n),
  originalName: name,
  mimeType: "image/jpeg",
  sizeBytes: 240_000,
  thumbnailUrl: `https://files.example.invalid/thumb/${name}`,
  url: `https://files.example.invalid/${name}`,
});
const ref = (who: StaffPersona) => ({ id: who.id, displayName: who.displayName });
const orderOf = (index: number) => orders[index % orders.length]!;
const factoryOf = (order: (typeof orders)[number]) => order.jobs[0]?.factory ?? FACTORY;

/* -------------------------------------------------------------------------------- shipments */

const ACTIONS: Record<Shipment["status"], Shipment["allowedActions"]> = {
  draft: ["split"],
  ready: ["split", "book-carrier"],
  picked_up: [],
  in_transit: [],
  out_for_delivery: [],
  delivered: [],
  failed: ["resolve-exception"],
  returned: ["resolve-exception"],
  cancelled: [],
};

function build(
  n: number,
  order: (typeof orders)[number],
  patch: Partial<Shipment> & { status: Shipment["status"] },
): Shipment {
  const destination = order.destinations[0] ?? order.shipments[0]?.destination;
  const quantity = patch.quantity ?? order.quantity;
  const factory = factoryOf(order);
  const base: Shipment = {
    id: mockId("shp", n),
    shipmentNo: `S-2569-${String(500 + n).padStart(5, "0")}`,
    carrier: "factory_fleet",
    trackingNo: null,
    order: { id: order.id, orderCode: order.orderCode },
    factory,
    destination: {
      recipientName: destination?.recipientName ?? "ผู้รับ (ข้อมูลจำลอง)",
      phone: destination?.phone ?? "0800000000",
      line1: destination?.line1 ?? "–",
      line2: destination?.line2 ?? null,
      subdistrict: destination?.subdistrict ?? null,
      district: destination?.district ?? null,
      province: destination?.province ?? "กรุงเทพมหานคร",
      postcode: destination?.postcode ?? "10110",
    } as Shipment["destination"],
    quantity,
    cartons: Math.max(1, Math.ceil(quantity / 250)),
    lastEvent: null,
    exception: null,
    podReview: null,
    promisedShipDate: order.promisedShipDate,
    readyAt: null,
    items: [{ orderId: order.id, orderCode: order.orderCode, destinationLabel: "ที่อยู่หลัก", quantity }],
    cartonList: [],
    weightG: quantity * 40,
    events: [],
    pod: null,
    tolerance: null,
    blockedByPayment: false,
    economics: {
      customerCharge: baht(28000 + n * 1500),
      factoryPayout: baht(22400 + n * 1200),
      carrierCost: null,
    },
    allowedActions: [],
    updatedAt: bangkokIso(-DAY),
    ...patch,
  };
  base.cartonList = Array.from({ length: base.cartons }, (_, seq) => ({
    seq: seq + 1,
    labelCode: `${base.shipmentNo}-${String(seq + 1).padStart(2, "0")}`,
    weightG: Math.round((base.weightG ?? 0) / base.cartons),
  }));
  if (base.events.length === 0)
    base.events = [
      { occurredAt: bangkokIso(-3 * DAY), status: "ready", source: "factory", location: factory.name, note: null },
      ...(["picked_up", "in_transit", "out_for_delivery", "delivered", "failed"].includes(base.status)
        ? [
            {
              occurredAt: bangkokIso(-2 * DAY),
              status: "picked_up" as const,
              source: "factory" as const,
              location: factory.name,
              note: null,
            },
          ]
        : []),
      ...(["in_transit", "out_for_delivery", "delivered", "failed"].includes(base.status)
        ? [
            {
              occurredAt: bangkokIso(-DAY),
              status: "in_transit" as const,
              source: "factory" as const,
              location: base.destination.province,
              note: null,
            },
          ]
        : []),
      ...(["delivered", "failed"].includes(base.status)
        ? [
            {
              occurredAt: bangkokIso(-60 * 5),
              status: base.status,
              source: "factory" as const,
              location: base.destination.province,
              note: base.status === "failed" ? "ไม่มีผู้รับสินค้า โทรไม่ติด" : null,
            },
          ]
        : []),
    ];
  const last = base.events.at(-1)!;
  base.lastEvent = { status: last.status, occurredAt: last.occurredAt, location: last.location };
  base.readyAt = base.events[0]!.occurredAt;
  return base;
}

const shipped = orders.map((order, index) => ({ order, index })).filter(({ order }) => order.shipments.length > 0);
const waiting = orders.filter((order) => ["in_production", "artwork_approved"].includes(order.status));

const delivered = (
  n: number,
  order: (typeof orders)[number],
  deliveredQuantity: number,
  review: "pending" | "accepted",
) => {
  const shipment = build(n, order, { status: "delivered" });
  const shortagePct = order.tolerance.shortagePct;
  const overagePct = order.tolerance.overagePct;
  const ratio = (deliveredQuantity - order.quantity) / order.quantity;
  shipment.pod = {
    kind: "factory_photo_signature",
    receiverName: "คุณผู้รับ ตัวอย่าง (ข้อมูลจำลอง)",
    deliveredQuantity,
    capturedAt: bangkokIso(-DAY * 2),
    photos: [photo(n * 3, `pod-${n}-1.jpg`), photo(n * 3 + 1, `pod-${n}-2.jpg`)],
    signature: photo(n * 3 + 2, `signature-${n}.png`),
    review,
    reviewedBy: null,
    reviewNote: null,
  };
  shipment.podReview = review;
  shipment.tolerance = {
    ordered: order.quantity,
    delivered: deliveredQuantity,
    shortagePct,
    overagePct,
    outcome:
      ratio === 0
        ? "exact"
        : ratio < 0
          ? -ratio * 100 <= Number(shortagePct)
            ? "short_within"
            : "short_outside"
          : ratio * 100 <= Number(overagePct)
            ? "over_within"
            : "over_outside",
    claimId: null,
  };
  return shipment;
};

/** Every shipment; the partner zone (`mocks/partner/shipments.ts`) adds the ones a factory creates. */
export const shipments: Shipment[] = [
  ...shipped.map(({ order, index }, at) =>
    order.shipments[0]!.status === "delivered"
      ? delivered(
          index + 1,
          order,
          order.shipments[0]!.pod?.deliveredQuantity ?? order.quantity,
          at % 2 === 0 ? "accepted" : "pending",
        )
      : build(index + 1, order, {
          status: at === 0 ? "failed" : "in_transit",
          exception: at === 0 ? "ไม่มีผู้รับสินค้า โทรไม่ติด" : null,
        }),
  ),
  ...waiting.slice(0, 3).map((order, at) =>
    build(60 + at, order, {
      status: "ready",
      // The factory does not serve this province: a fallback carrier is needed (D-013).
      exception: at === 1 ? "โรงงานไม่ส่งในพื้นที่นี้ ต้องจองขนส่งสำรอง" : null,
      blockedByPayment: at === 2,
    }),
  ),
];
// A short delivery within tolerance (credit pro rata) and one outside it (automatic claim).
const shortWithin = shipments.find((item) => item.status === "delivered" && item.podReview === "pending");
if (shortWithin?.pod && shortWithin.tolerance) {
  const order = orders.find((candidate) => candidate.id === shortWithin.order.id)!;
  const quantity = Math.floor(order.quantity * (1 - Number(order.tolerance.shortagePct) / 200));
  shortWithin.pod.deliveredQuantity = quantity;
  shortWithin.tolerance = { ...shortWithin.tolerance, delivered: quantity, outcome: "short_within" };
}

for (const shipment of shipments) shipment.allowedActions = ACTIONS[shipment.status];

const queueOf: Record<string, (item: Shipment) => boolean> = {
  awaiting_pickup: (item) => item.status === "ready" || item.status === "draft",
  in_transit: (item) => ["picked_up", "in_transit", "out_for_delivery"].includes(item.status),
  exceptions: (item) => item.exception !== null || ["failed", "returned"].includes(item.status),
  pod_review: (item) => item.podReview === "pending",
};

registerQueue("shipments.read", () => ({
  key: "logistics.exceptions",
  path: "/admin/shipments?queue=exceptions",
  count: shipments.filter(queueOf.exceptions!).length,
  overdueCount: shipments.filter((item) => item.status === "failed").length,
  nextDueAt: null,
}));
registerQueue("shipments.read", () => ({
  key: "logistics.pod_review",
  path: "/admin/shipments?queue=pod_review",
  count: shipments.filter(queueOf.pod_review!).length,
  overdueCount: 0,
  nextDueAt: null,
}));

const quotes = new Map<string, Quote[]>();

/* ----------------------------------------------------------------------------------- claims */

const RULES: Record<Claim["type"], [Claim["liability"], string]> = {
  damaged: ["factory", "สินค้าเสียหายระหว่างขนส่ง โรงงานเป็นผู้ส่ง (D-083)"],
  wrong_spec: ["factory", "ผลิตผิดสเปก (D-083)"],
  print_defect: ["factory", "ข้อบกพร่องงานพิมพ์ (D-083)"],
  quantity_short: ["factory", "จำนวนขาดเกินค่าเผื่อ (D-080)"],
  late: ["undetermined", "ส่งล่าช้า ต้องพิจารณาสาเหตุ"],
  other: ["undetermined", "ต้องพิจารณาเป็นกรณี"],
};

function claim(
  n: number,
  order: (typeof orders)[number],
  type: Claim["type"],
  status: Claim["status"],
  origin: Claim["origin"] = "customer",
  extra: Partial<Claim> = {},
): Claim {
  const [liability, rule] = RULES[type];
  return {
    id: mockId("clm", n),
    claimNo: `CL-2569-${String(40 + n).padStart(5, "0")}`,
    type,
    origin,
    status,
    order: { id: order.id, orderCode: order.orderCode },
    customer: order.customer,
    factory: factoryOf(order),
    requestedResolution: type === "quantity_short" ? "partial_refund" : type === "late" ? "credit" : "reprint",
    claimedAmount: type === "quantity_short" ? baht(420000) : null,
    liability,
    submittedAt: bangkokIso(-DAY * 2 + n * 60),
    slaDueAt: ["submitted", "under_review", "need_info", "factory_review"].includes(status)
      ? bangkokIso(DAY - n * 90)
      : null,
    shipment: order.shipments[0] ? { id: order.shipments[0].id, shipmentNo: order.shipments[0].shipmentNo } : null,
    description:
      type === "damaged"
        ? "กล่องบุบหลายใบ ฝากล่องฉีก (ข้อมูลจำลอง)"
        : type === "print_defect"
          ? "สีโลโก้เพี้ยนจากปรู๊ฟที่อนุมัติ (ข้อมูลจำลอง)"
          : type === "quantity_short"
            ? "นับได้น้อยกว่าที่สั่ง (ข้อมูลจำลอง)"
            : "ส่งช้ากว่ากำหนด 3 วัน (ข้อมูลจำลอง)",
    receivedAt: bangkokIso(-DAY * 4),
    windowEndsAt: bangkokIso(DAY * 3),
    claimedQuantity: type === "quantity_short" ? Math.round(order.quantity * 0.08) : null,
    evidence: {
      productPhotos: origin === "customer" ? [photo(500 + n * 2, `product-${n}.jpg`)] : [],
      cartonPhotos: origin === "customer" ? [photo(501 + n * 2, `carton-${n}.jpg`)] : [],
    },
    liabilityByRule: liability,
    liabilityRule: rule,
    liabilityOverride: null,
    approvedProof:
      type === "print_defect" ? { id: mockId("prf", n), versionNo: 2, approvedAt: bangkokIso(-DAY * 20) } : null,
    factoryResponse: status === "factory_review" ? null : null,
    decision: null,
    resolutions: [],
    messages: [
      {
        at: bangkokIso(-DAY * 2),
        author: order.customer.displayName,
        audience: "customer",
        body: "ขอให้ช่วยตรวจสอบด้วยครับ",
      },
    ],
    allowedActions: [],
    allowedResolutions: [],
    updatedAt: bangkokIso(-DAY),
    ...extra,
  };
}

const completed = orders.filter((order) => order.status === "completed");
/** Every claim; the partner zone shows a factory the ones that name it (`mocks/partner/billing.ts`). */
export const claims: Claim[] = [
  claim(1, completed[0] ?? orderOf(0), "damaged", "under_review"),
  claim(2, completed[1] ?? orderOf(1), "print_defect", "submitted"),
  claim(3, completed[2] ?? orderOf(2), "quantity_short", "under_review", "tolerance_auto"),
  claim(4, completed[3] ?? orderOf(3), "late", "need_info"),
  claim(5, completed[4] ?? orderOf(4), "wrong_spec", "approved"),
  claim(6, completed[0] ?? orderOf(5), "damaged", "factory_review"),
];

const CLAIM_ACTIONS: Record<Claim["status"], Claim["allowedActions"]> = {
  submitted: ["start-review", "reject"],
  under_review: ["request-info", "send-to-factory", "approve", "reject"],
  need_info: ["start-review", "reject"],
  factory_review: ["approve", "reject"],
  approved: ["close"],
  rejected: ["close"],
  resolved: ["close"],
  closed: [],
};
const NEXT: Record<Claim["allowedActions"][number], Claim["status"]> = {
  "start-review": "under_review",
  "request-info": "need_info",
  "send-to-factory": "factory_review",
  approve: "approved",
  reject: "rejected",
  close: "closed",
};

function presentClaim(item: Claim, who: StaffPersona | null): Claim {
  const decide = who ? can(who, "claims.manage") : false;
  return {
    ...item,
    allowedActions: decide ? CLAIM_ACTIONS[item.status] : [],
    allowedResolutions:
      decide && item.status === "approved"
        ? item.liability === "factory"
          ? ["reproduction_job", "refund", "credit_note", "factory_deduction"]
          : item.liability === "carrier"
            ? ["refund", "credit_note", "carrier_recovery"]
            : ["refund", "credit_note", "store_credit"]
        : [],
  };
}

registerQueue("claims.read", () => {
  const open = claims.filter((item) =>
    ["submitted", "under_review", "need_info", "factory_review"].includes(item.status),
  );
  return {
    key: "claims.open",
    path: "/admin/claims",
    count: open.length,
    overdueCount: open.filter((item) => item.slaDueAt && Date.parse(item.slaDueAt) < Date.now()).length,
    nextDueAt:
      open
        .map((item) => item.slaDueAt)
        .filter(Boolean)
        .sort()[0] ?? null,
  };
});

/* ------------------------------------------------------------------ the storefront's side */

export type LogisticsClaim = Claim;
type FileRef = Claim["evidence"]["productPhotos"][number];

/** One claim row, as the storefront's claims mock (F3 3.6) reads it. */
export function claimRow(claimId: string): Claim | undefined {
  return claims.find((candidate) => candidate.id === claimId);
}

/** A claim the commerce seed lists on an order but the desk never built — built on first read. */
export function adoptClaim(
  order: (typeof orders)[number],
  summary: { id: string; claimNo: string; type: Claim["type"]; status: Claim["status"]; submittedAt: string },
): Claim {
  const existing = claimRow(summary.id);
  if (existing) return existing;
  const row = claim(40 + claims.length, order, summary.type, summary.status, "customer", {
    id: summary.id,
    claimNo: summary.claimNo,
    submittedAt: summary.submittedAt,
  });
  claims.push(row);
  return row;
}

let filed = 0;

/** A claim filed from the storefront: submitted, liability by rule (D-083), on the desk's queue. */
export function fileCustomerClaim(
  order: (typeof orders)[number],
  input: {
    type: Claim["type"];
    shipmentId: string | null;
    affectedQuantity: number | null;
    description: string;
    requestedResolution: Claim["requestedResolution"];
    productPhotos: FileRef[];
    cartonPhotos: FileRef[];
    receivedAt: string;
    windowEndsAt: string;
  },
): Claim {
  filed += 1;
  const shipment = order.shipments.find((candidate) => candidate.id === input.shipmentId) ?? order.shipments[0];
  const row = claim(100 + filed, order, input.type, "submitted", "customer", {
    id: mockId("clm", 700 + filed),
    claimNo: `CL-2569-W${String(filed).padStart(4, "0")}`,
    requestedResolution: input.requestedResolution,
    claimedAmount: null,
    submittedAt: bangkokIso(),
    slaDueAt: bangkokIso(DAY),
    shipment: shipment ? { id: shipment.id, shipmentNo: shipment.shipmentNo } : null,
    description: input.description,
    receivedAt: input.receivedAt,
    windowEndsAt: input.windowEndsAt,
    claimedQuantity: input.affectedQuantity,
    evidence: { productPhotos: input.productPhotos, cartonPhotos: input.cartonPhotos },
    approvedProof: null,
    messages: [{ at: bangkokIso(), author: order.customer.displayName, audience: "customer", body: input.description }],
    updatedAt: bangkokIso(),
  });
  claims.push(row);
  order.claims.push({
    id: row.id,
    claimNo: row.claimNo,
    type: row.type,
    status: row.status,
    submittedAt: row.submittedAt,
  });
  return row;
}

/** The customer answers in the thread; a claim waiting for information goes back to review. */
export function customerClaimReply(item: Claim, author: string, body: string): Claim {
  item.messages.push({ at: bangkokIso(), author, audience: "customer", body });
  if (item.status === "need_info") {
    item.status = "under_review";
    item.slaDueAt = bangkokIso(DAY);
  }
  item.updatedAt = bangkokIso();
  return item;
}

/* --------------------------------------------------------------------------------- handlers */

const withEtag = <T extends { id: string; updatedAt: string }>(row: T, body: object) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", ETag: etagOf(row as never) } });

function guard(request: Request, row: { id: string; updatedAt: string }): Response | null {
  const match = request.headers.get("if-match");
  if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
  if (match !== etagOf(row as never))
    return problem(412, "http.precondition_failed", "ข้อมูลถูกแก้ไขไปแล้ว กรุณาโหลดใหม่");
  return null;
}

function access(request: Request, permission: string) {
  const who = staffPersonaOf(request);
  return who && can(who, permission) ? who : null;
}

const presentShipment = (item: Shipment, who: StaffPersona): Shipment => ({
  ...item,
  allowedActions: can(who, "shipments.manage") ? ACTIONS[item.status] : [],
  economics: can(who, "margin.read") ? item.economics : undefined,
});
const rowOf = (item: Shipment) => {
  const {
    items,
    cartonList,
    weightG,
    events,
    pod,
    tolerance,
    blockedByPayment,
    economics,
    allowedActions,
    updatedAt,
    ...row
  } = item;
  void [items, cartonList, weightG, events, pod, tolerance, blockedByPayment, economics, allowedActions, updatedAt];
  return {
    ...row,
    destination: {
      recipientName: row.destination.recipientName,
      province: row.destination.province,
      postcode: row.destination.postcode,
    },
  };
};
const claimRowOf = (item: Claim) => {
  const {
    shipment,
    description,
    receivedAt,
    windowEndsAt,
    claimedQuantity,
    evidence,
    liabilityByRule,
    liabilityRule,
    liabilityOverride,
    approvedProof,
    factoryResponse,
    decision,
    resolutions,
    messages,
    allowedActions,
    allowedResolutions,
    updatedAt,
    ...row
  } = item;
  void [
    shipment,
    description,
    receivedAt,
    windowEndsAt,
    claimedQuantity,
    evidence,
    liabilityByRule,
    liabilityRule,
    liabilityOverride,
    approvedProof,
    factoryResponse,
    decision,
    resolutions,
    messages,
    allowedActions,
    allowedResolutions,
    updatedAt,
  ];
  return row;
};

/* ------------------------------------------------------------------ the published shapes */

/** A shipment as `admin.shipments.*` answers it (U-F0.3): the fixture's names become codes and ids. */
export function toAdminShipmentDto(item: Shipment, who: StaffPersona | null): Schemas["AdminShipmentDto"] {
  const seesCost = Boolean(who && can(who, "factory_cost.read"));
  return {
    id: item.id,
    shipmentNo: item.shipmentNo,
    status: item.status,
    carrier: item.carrier,
    carrierBookingRef: null,
    carrierCostAmount: seesCost && item.carrier !== "factory_fleet" ? "0.00" : null,
    payoutAmount: seesCost ? "0.00" : null,
    trackingNo: item.trackingNo,
    trackingUrl: null,
    factoryId: item.factory.id,
    factoryCode: item.factory.code,
    destination: {
      recipientName: item.destination.recipientName,
      phone: item.destination.phone,
      line1: item.destination.line1,
      line2: item.destination.line2,
      postcode: item.destination.postcode,
    },
    items: item.items.map((line, index) => ({
      jobId: mockId("job", 700 + index),
      jobNo: `JOB-${line.orderCode.slice(-6)}`,
      orderCode: line.orderCode,
      destinationId: mockId("dst", 700 + index),
      quantity: line.quantity,
      deliveredQuantity: item.pod?.deliveredQuantity ?? null,
    })),
    cartonsCount: item.cartons,
    weightG: item.weightG ?? 0,
    volumeCm3: null,
    events: item.events.map((event) => ({ ...event })),
    proofOfDelivery: item.pod
      ? {
          kind: item.pod.kind,
          receiverName: item.pod.receiverName,
          deliveredQuantity: item.pod.deliveredQuantity,
          capturedAt: item.pod.capturedAt,
          photoFileIds: item.pod.photos.map((photo) => photo.id),
          signatureFileId: item.pod.signature?.id ?? null,
          carrierPodRef: null,
        }
      : null,
    labelFileId: null,
    packingListFileId: null,
    note: item.exception,
    plannedShipOn: item.promisedShipDate,
    readyAt: item.readyAt,
    pickedUpAt: item.events.find((event) => event.status === "picked_up")?.occurredAt ?? null,
    deliveredAt: item.status === "delivered" ? (item.pod?.capturedAt ?? item.lastEvent?.occurredAt ?? null) : null,
    cancelledAt: null,
    cancelReason: null,
  };
}

/** A claim as `admin.claims.*` answers it (U-F0.3). */
export function toAdminClaimDto(item: Claim): Schemas["AdminClaimDto"] {
  return {
    id: item.id,
    claimNo: item.claimNo,
    type: item.type,
    origin: item.origin,
    status: item.status,
    orderId: item.order.id,
    orderCode: item.order.orderCode,
    jobId: null,
    jobNo: null,
    shipmentId: item.shipment?.id ?? null,
    factoryId: item.factory?.id ?? null,
    factoryCode: item.factory?.code ?? null,
    description: item.description,
    requestedResolution: item.requestedResolution,
    claimedAmount: item.claimedAmount,
    claimedQuantity: item.claimedQuantity,
    liability: item.liability,
    liabilityByRule: item.liabilityByRule,
    overrideReason: item.liabilityOverride?.reason ?? null,
    photos: {
      product: item.evidence.productPhotos.map((photo) => photo.id),
      carton: item.evidence.cartonPhotos.map((photo) => photo.id),
    },
    infoRequest: null,
    infoResponse: null,
    factoryResponse: item.factoryResponse?.response ?? null,
    factoryResponseNote: item.factoryResponse?.note ?? null,
    decidedAt: item.decision?.at ?? null,
    decisionNote: item.decision?.reason ?? null,
    resolutions: item.resolutions.map((resolution) => ({
      action: resolution.action,
      amount: resolution.amount,
      executedAt: resolution.executedAt,
      jobNo: null,
      quantity: null,
      refundId: null,
    })),
    submittedAt: item.submittedAt,
    receivedAt: item.receivedAt,
    windowEndsAt: item.windowEndsAt,
  };
}

const pageOf = (url: URL) => ({
  page: Number(url.searchParams.get("page") ?? 1),
  perPage: Number(url.searchParams.get("perPage") ?? 25),
});

/**
 * The order screen's shipments and claims (`?orderId=`, U-F0.3). The logistics desk itself still
 * reads the requests below until its own migration; without `orderId` these fall through to them.
 */
export const logisticsContractHandlers = [
  http.get("*/v1/admin/shipments", ({ request }) => {
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");
    if (!orderId) return undefined;
    const who = staffPersonaOf(request) ?? null;
    if (!who || !can(who, "shipments.read")) return forbidden();
    const rows = shipments.filter((item) => item.order.id === orderId).map((item) => toAdminShipmentDto(item, who));
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),
  http.get("*/v1/admin/claims", ({ request }) => {
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");
    if (!orderId) return undefined;
    const who = staffPersonaOf(request) ?? null;
    if (!who || !can(who, "claims.read")) return forbidden();
    const rows = claims.filter((item) => item.order.id === orderId).map(toAdminClaimDto);
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),
];

export const logisticsHandlers = [
  mockRequest("GET /v1/admin/shipments", ({ query, request }) => {
    if (!access(request, "shipments.read")) return forbidden();
    const rows = shipments
      .filter((item) => !query.queue || queueOf[query.queue]!(item))
      .filter((item) => !query.status || item.status === query.status)
      .filter((item) => !query.carrier || item.carrier === query.carrier)
      .filter((item) => !query.factoryId || item.factory.id === query.factoryId)
      .filter((item) =>
        matchesQuery(query.q, item.shipmentNo, item.order.orderCode, item.trackingNo, item.destination.recipientName),
      )
      .map(rowOf);
    return paginate(rows, query);
  }),
  mockRequest("GET /v1/admin/shipments/{shipmentId}", ({ params, request }) => {
    const who = access(request, "shipments.read");
    if (!who) return forbidden();
    const item = shipments.find((candidate) => candidate.id === params.shipmentId);
    return item ? withEtag(item, presentShipment(item, who)) : problem(404, "http.not_found", "ไม่พบการจัดส่งนี้");
  }),
  mockRequest("POST /v1/admin/shipments/{shipmentId}/actions/split", ({ params, body, request }) => {
    const who = access(request, "shipments.manage");
    if (!who) return forbidden();
    const item = shipments.find((candidate) => candidate.id === params.shipmentId);
    if (!item) return problem(404, "http.not_found", "ไม่พบการจัดส่งนี้");
    const refused = guard(request, item);
    if (refused) return refused;
    if (!ACTIONS[item.status].includes("split"))
      return problem(409, "shipment.invalid_transition", "แยกการจัดส่งนี้ไม่ได้แล้ว");
    if (body.quantity >= item.quantity)
      return problem(422, "validation.failed", "จำนวนที่แยกต้องน้อยกว่าจำนวนทั้งหมด", [
        { path: "quantity", code: "max", message: `น้อยกว่า ${item.quantity}` },
      ]);
    const order = orders.find((candidate) => candidate.id === item.order.id)!;
    const created = build(100 + shipments.length, order, { status: item.status, quantity: body.quantity });
    created.allowedActions = ACTIONS[created.status];
    shipments.push(created);
    Object.assign(item, {
      quantity: item.quantity - body.quantity,
      cartons: Math.max(1, Math.ceil((item.quantity - body.quantity) / 250)),
      updatedAt: bangkokIso(),
    });
    item.items = item.items.map((line) => ({ ...line, quantity: item.quantity }));
    item.cartonList = item.cartonList.slice(0, item.cartons);
    return { shipment: presentShipment(item, who), created: { id: created.id, shipmentNo: created.shipmentNo } };
  }),
  mockRequest("POST /v1/admin/shipments/{shipmentId}/carrier-quotes", ({ params, request }) => {
    if (!access(request, "shipments.manage")) return forbidden();
    const item = shipments.find((candidate) => candidate.id === params.shipmentId);
    if (!item) return problem(404, "http.not_found", "ไม่พบการจัดส่งนี้");
    const list: Quote[] = [
      {
        quoteId: `q-${item.id}-flash`,
        carrier: "flash_express",
        service: "พัสดุด่วน",
        amount: baht(item.cartons * 18500),
        etaDays: 2,
        validUntil: bangkokIso(60 * 2),
      },
      {
        quoteId: `q-${item.id}-deliveree`,
        carrier: "deliveree",
        service: "รถกระบะ 4 ล้อ",
        amount: baht(240000),
        etaDays: 1,
        validUntil: bangkokIso(60 * 2),
      },
    ];
    quotes.set(item.id, list);
    return list;
  }),
  mockRequest("POST /v1/admin/shipments/{shipmentId}/actions/book-carrier", ({ params, body, request }) => {
    const who = access(request, "shipments.manage");
    if (!who) return forbidden();
    const item = shipments.find((candidate) => candidate.id === params.shipmentId);
    if (!item) return problem(404, "http.not_found", "ไม่พบการจัดส่งนี้");
    const refused = guard(request, item);
    if (refused) return refused;
    if (item.blockedByPayment)
      return problem(409, "shipment.payment_required", "ยังมียอดที่ต้องชำระก่อนจัดส่ง ส่งของไม่ได้");
    const quote = quotes.get(item.id)?.find((candidate) => candidate.quoteId === body.quoteId);
    if (!quote) return problem(409, "carrier.quote_expired", "ใบเสนอราคาขนส่งหมดอายุ กรุณาขอใหม่");
    Object.assign(item, {
      carrier: quote.carrier,
      trackingNo: `${quote.carrier === "flash_express" ? "TH" : "DLV"}${String(Date.now()).slice(-9)}`,
      exception: null,
      economics: item.economics
        ? { ...item.economics, factoryPayout: null, carrierCost: quote.amount }
        : item.economics,
      updatedAt: bangkokIso(),
    });
    item.events.push({
      occurredAt: bangkokIso(),
      status: "ready",
      source: "staff",
      location: null,
      note: `จอง ${quote.service}: ${body.reason}`,
    });
    return presentShipment(item, who);
  }),
  mockRequest("POST /v1/admin/shipments/{shipmentId}/actions/resolve-exception", ({ params, body, request }) => {
    const who = access(request, "shipments.manage");
    if (!who) return forbidden();
    const item = shipments.find((candidate) => candidate.id === params.shipmentId);
    if (!item) return problem(404, "http.not_found", "ไม่พบการจัดส่งนี้");
    const refused = guard(request, item);
    if (refused) return refused;
    if (!ACTIONS[item.status].includes("resolve-exception"))
      return problem(409, "shipment.invalid_transition", "ไม่มีปัญหาการจัดส่งให้แก้");
    const status =
      body.resolution === "retry" ? "out_for_delivery" : body.resolution === "return" ? "returned" : "cancelled";
    item.events.push({ occurredAt: bangkokIso(), status, source: "staff", location: null, note: body.reason });
    Object.assign(item, {
      status,
      exception: null,
      lastEvent: { status, occurredAt: bangkokIso(), location: null },
      updatedAt: bangkokIso(),
    });
    return presentShipment(item, who);
  }),
  mockRequest("POST /v1/admin/shipments/{shipmentId}/documents", ({ params, body, request }) => {
    if (!access(request, "shipments.read")) return forbidden();
    const item = shipments.find((candidate) => candidate.id === params.shipmentId);
    if (!item) return problem(404, "http.not_found", "ไม่พบการจัดส่งนี้");
    return { url: `https://files.example.invalid/${item.shipmentNo}-${body.kind}.pdf`, expiresAt: bangkokIso(15) };
  }),
  mockRequest("POST /v1/admin/shipments/{shipmentId}/pod/actions/{decision}", ({ params, body, request }) => {
    const who = access(request, "shipments.manage");
    if (!who) return forbidden();
    const item = shipments.find((candidate) => candidate.id === params.shipmentId);
    if (!item?.pod) return problem(404, "http.not_found", "ไม่พบหลักฐานการส่งมอบ");
    if (item.pod.review !== "pending") return problem(409, "pod.already_reviewed", "ตรวจหลักฐานนี้ไปแล้ว");
    if (params.decision === "reject" && !body.note?.trim())
      return problem(422, "validation.failed", "กรุณาระบุเหตุผล", [
        { path: "note", code: "required", message: "จำเป็น" },
      ]);
    const review = params.decision === "accept" ? "accepted" : "rejected";
    Object.assign(item.pod, { review, reviewedBy: ref(who), reviewNote: body.note ?? null });
    item.podReview = review;
    item.updatedAt = bangkokIso();
    return presentShipment(item, who);
  }),

  mockRequest("GET /v1/admin/claims", ({ query, request }) => {
    if (!access(request, "claims.read")) return forbidden();
    const rows = claims
      .filter((item) => !query.status || item.status === query.status)
      .filter((item) => !query.type || item.type === query.type)
      .filter((item) => !query.origin || item.origin === query.origin)
      .filter((item) => matchesQuery(query.q, item.claimNo, item.order.orderCode, item.customer.displayName))
      .map(claimRowOf);
    return paginate(rows, query);
  }),
  mockRequest("GET /v1/admin/claims/{claimId}", ({ params, request }) => {
    const who = access(request, "claims.read");
    if (!who) return forbidden();
    const item = claims.find((candidate) => candidate.id === params.claimId);
    return item ? withEtag(item, presentClaim(item, who)) : problem(404, "http.not_found", "ไม่พบเคลมนี้");
  }),
  mockRequest("POST /v1/admin/claims/{claimId}/actions/{action}", ({ params, body, request }) => {
    const who = access(request, "claims.manage");
    if (!who) return forbidden();
    const item = claims.find((candidate) => candidate.id === params.claimId);
    if (!item) return problem(404, "http.not_found", "ไม่พบเคลมนี้");
    const refused = guard(request, item);
    if (refused) return refused;
    const action = params.action as Claim["allowedActions"][number];
    if (!CLAIM_ACTIONS[item.status].includes(action))
      return problem(409, "claim.invalid_transition", "ทำรายการนี้กับเคลมในสถานะนี้ไม่ได้");
    if (action === "approve" && item.liability === "undetermined")
      return problem(409, "claim.liability_undetermined", "ต้องระบุผู้รับผิดชอบก่อนอนุมัติ (D-083)");
    item.status = NEXT[action];
    if (action === "approve" || action === "reject")
      item.decision = { by: ref(who), at: bangkokIso(), reason: body.reason };
    item.messages.push({
      at: bangkokIso(),
      author: who.displayName,
      audience: action === "send-to-factory" ? "factory" : action === "request-info" ? "customer" : "internal",
      body: body.reason,
    });
    item.slaDueAt = ["under_review", "need_info", "factory_review"].includes(item.status) ? bangkokIso(DAY) : null;
    item.updatedAt = bangkokIso();
    return presentClaim(item, who);
  }),
  mockRequest("POST /v1/admin/claims/{claimId}/liability", ({ params, body, request }) => {
    const who = access(request, "claims.override_liability");
    if (!who) return forbidden();
    const item = claims.find((candidate) => candidate.id === params.claimId);
    if (!item) return problem(404, "http.not_found", "ไม่พบเคลมนี้");
    const refused = guard(request, item);
    if (refused) return refused;
    item.liability = body.liability;
    item.liabilityOverride =
      body.liability === item.liabilityByRule ? null : { by: ref(who), reason: body.reason, at: bangkokIso() };
    item.updatedAt = bangkokIso();
    return presentClaim(item, who);
  }),
  mockRequest("POST /v1/admin/claims/{claimId}/resolutions", ({ params, body, request }) => {
    const who = access(request, "claims.manage");
    if (!who) return forbidden();
    const item = claims.find((candidate) => candidate.id === params.claimId);
    if (!item) return problem(404, "http.not_found", "ไม่พบเคลมนี้");
    if (!presentClaim(item, who).allowedResolutions.includes(body.action))
      return problem(409, "claim.resolution_not_allowed", "ใช้วิธีนี้กับเคลมนี้ไม่ได้");
    if (
      ["refund", "credit_note", "store_credit", "factory_deduction", "carrier_recovery"].includes(body.action) &&
      !body.amount
    )
      return problem(422, "validation.failed", "กรุณาระบุจำนวนเงิน", [
        { path: "amount", code: "required", message: "จำเป็น" },
      ]);
    const reference = {
      reproduction_job: `J-2569-${900 + item.resolutions.length}`,
      refund: `RF-2569-${String(300 + item.resolutions.length).padStart(5, "0")}`,
      credit_note: `CN-2569-${String(120 + item.resolutions.length).padStart(5, "0")}`,
      store_credit: null,
      factory_deduction: `VD-2569-${String(60 + item.resolutions.length).padStart(5, "0")}`,
      carrier_recovery: null,
    }[body.action];
    item.resolutions.push({
      action: body.action,
      amount: body.amount,
      reference,
      executedAt: bangkokIso(),
      executedBy: ref(who),
    });
    item.status = "resolved";
    item.messages.push({ at: bangkokIso(), author: who.displayName, audience: "internal", body: body.note });
    item.updatedAt = bangkokIso();
    return presentClaim(item, who);
  }),
];
