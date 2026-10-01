/**
 * Shipments on the published contract (U-F0.4): the logistics desk's `admin.shipments.*` — the
 * queues, carrier and factory filters, the trip's cartons, the before-shipping payment hold, the
 * failed or returned trip and its resolution (D-230), the POD review (D-229), splitting a draft,
 * the fallback carriers' quotes and booking (D-013, D-114) — and the rows the partner zone's
 * shipping mock (`../partner/shipments.ts`) reads and writes, so what a factory ships here is what
 * the desk sees.
 *
 * Shipments are the commerce mock's own (orders being shipped or delivered) plus the ones a
 * logistics desk sees on a normal day: a draft to split, ready at a factory that cannot serve the
 * area and needs a fallback carrier, held by an unpaid before-shipping instalment (B3.2), a failed
 * delivery attempt, a POD to review with a shortage within tolerance. Rows keep a mock-only model
 * (`Shipment`) and are turned into `AdminShipmentDto` / `PartnerShipmentDto` on the way out, with
 * `nextActions` from packio-api's rule tables (`./floor-actions.ts`).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, type StaffPersona } from "../personas";
import { provinceRefOf } from "../store/catalog";
import { bangkokIso, matchesQuery, mockId, paginate, problem, versionTag } from "../support";
import { baht, FACTORY, orders, type MockOrder } from "./commerce";
import { registerQueue } from "./console";
import { adminShipmentActions, partnerShipmentActions, type ShipmentFacts } from "./floor-actions";

type UserRef = Schemas["UserRefDto"];

export interface ShipmentItem {
  orderId: string;
  orderCode: string;
  jobId: string;
  jobNo: string;
  destinationId: string;
  quantity: number;
  deliveredQuantity: number | null;
}

/** A shipment as the mock keeps it (mock-only; the contract's shapes are built from it). */
export interface Shipment {
  id: string;
  shipmentNo: string;
  status: Schemas["ShipmentStatus"];
  carrier: Schemas["CarrierCode"];
  trackingNo: string | null;
  /** The first item's order — every item of a trip goes to one address, usually of one order. */
  order: { id: string; orderCode: string };
  factory: { id: string; code: string; name: string };
  destination: {
    recipientName: string;
    phone: string;
    line1: string;
    line2: string | null;
    subdistrict: string | null;
    district: string | null;
    province: string;
    postcode: string;
  };
  /** Pieces and cartons on the trip (totals of `items` and `cartonList`). */
  quantity: number;
  cartons: number;
  lastEvent: { status: Schemas["ShipmentStatus"]; occurredAt: string; location: string | null } | null;
  /** The trip's note: why it is on the exceptions queue, a factory's request. */
  exception: string | null;
  promisedShipDate: string | null;
  readyAt: string | null;
  items: ShipmentItem[];
  cartonList: { seq: number; labelCode: string; weightG: number | null }[];
  weightG: number;
  volumeCm3: number | null;
  events: Schemas["ShipmentEventDto"][];
  pod: {
    kind: Schemas["PodKind"];
    receiverName: string;
    deliveredQuantity: number;
    capturedAt: string;
    photoIds: string[];
    signatureId: string | null;
    review: Schemas["PodReviewState"];
    reviewedBy: UserRef | null;
    reviewedAt: string | null;
    reviewNote: string | null;
  } | null;
  /** A before-shipping instalment was unpaid when the trip was made (the shipping gate, B3.2). */
  blockedByPayment: boolean;
  /** What Packio pays the factory or a fallback carrier (D-141: `factory_cost.read` only). */
  economics: { factoryPayout: string | null; carrierCost: string | null } | null;
  carrierRequest: Schemas["CarrierRequestDto"] | null;
  splitFrom: Schemas["ShipmentRefDto"] | null;
  resolution: { resolution: Schemas["ShipmentExceptionResolution"]; note: string; at: string; by: UserRef } | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  version: number;
  updatedAt: string;
}

const DAY = 24 * 60;
const now = () => bangkokIso();
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const noShipment = () => problem(404, "http.not_found", "ไม่พบการจัดส่งนี้");
const factoryOf = (order: MockOrder) => order.jobs[0]?.factory ?? FACTORY;

/** The files the mock "generated" or seeded for shipments (labels, packing lists, POD photos). */
const shipmentFiles = new Map<string, { name: string; url: string }>();
function seededPhoto(n: number, name: string): string {
  const id = mockId("fil", 8000 + n);
  shipmentFiles.set(id, { name, url: `https://files.example.invalid/${name}` });
  return id;
}

/** Bumps the row's version (its ETag) after a change. */
export function touch(item: Shipment) {
  item.version += 1;
  item.updatedAt = now();
}
export const etagOfShipment = (item: Shipment) => versionTag(item.id, item.version);

export function addEvent(
  item: Shipment,
  status: Schemas["ShipmentStatus"],
  source: Schemas["ShipmentEventSource"],
  note: string | null = null,
  location: string | null = null,
) {
  const at = now();
  item.events.push({ occurredAt: at, status, source, location, note });
  item.lastEvent = { status, occurredAt: at, location };
}

/** One label per carton, its code printed on the carton (the scanner resolves it to the job). */
export function labelCartons(item: Shipment) {
  item.cartonList = Array.from({ length: item.cartons }, (_, seq) => ({
    seq: seq + 1,
    labelCode: `${item.shipmentNo}-${String(seq + 1).padStart(2, "0")}`,
    weightG: Math.round(item.weightG / item.cartons),
  }));
}

/* -------------------------------------------------------------------------------- seeding */

function build(n: number, order: MockOrder, patch: Partial<Shipment> & { status: Shipment["status"] }): Shipment {
  const destination = order.destinations[0] ?? order.shipments[0]?.destination;
  const quantity = patch.quantity ?? order.quantity;
  const factory = factoryOf(order);
  const job = order.jobs[0];
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
    },
    quantity,
    cartons: Math.max(1, Math.ceil(quantity / 250)),
    lastEvent: null,
    exception: null,
    promisedShipDate: order.promisedShipDate,
    readyAt: null,
    items: [
      {
        orderId: order.id,
        orderCode: order.orderCode,
        jobId: job?.id ?? mockId("job", 700 + n),
        jobNo: job?.jobNo ?? `JOB-${order.orderCode.slice(-6)}`,
        destinationId: order.destinations[0]?.id ?? mockId("dst", 700 + n),
        quantity,
        deliveredQuantity: null,
      },
    ],
    cartonList: [],
    weightG: quantity * 40,
    volumeCm3: null,
    events: [],
    pod: null,
    blockedByPayment: false,
    economics: { factoryPayout: baht(22400 + n * 1200), carrierCost: null },
    carrierRequest: null,
    splitFrom: null,
    resolution: null,
    cancelReason: null,
    cancelledAt: null,
    version: 1,
    updatedAt: bangkokIso(-DAY),
    ...patch,
  };
  if (base.status !== "draft") labelCartons(base);
  if (base.events.length === 0 && base.status !== "draft") {
    const at = (minutes: number, status: Shipment["status"], location: string | null, note: string | null = null) => ({
      occurredAt: bangkokIso(minutes),
      status,
      source: "factory" as const,
      location,
      note,
    });
    base.events = [
      at(-3 * DAY, "ready", factory.name),
      ...(["picked_up", "in_transit", "out_for_delivery", "delivered", "failed"].includes(base.status)
        ? [at(-2 * DAY, "picked_up", factory.name)]
        : []),
      ...(["in_transit", "out_for_delivery", "delivered", "failed"].includes(base.status)
        ? [at(-DAY, "in_transit", base.destination.province)]
        : []),
      ...(["delivered", "failed"].includes(base.status)
        ? [
            at(
              -60 * 5,
              base.status,
              base.destination.province,
              base.status === "failed" ? "ไม่มีผู้รับสินค้า โทรไม่ติด" : null,
            ),
          ]
        : []),
    ];
  }
  const last = base.events.at(-1);
  base.lastEvent = last ? { status: last.status, occurredAt: last.occurredAt, location: last.location } : null;
  base.readyAt = base.events.find((event) => event.status === "ready")?.occurredAt ?? null;
  return base;
}

const delivered = (n: number, order: MockOrder, deliveredQuantity: number, review: "pending" | "accepted") => {
  const shipment = build(n, order, { status: "delivered" });
  shipment.pod = {
    kind: "factory_photo_signature",
    receiverName: "คุณผู้รับ ตัวอย่าง (ข้อมูลจำลอง)",
    deliveredQuantity,
    capturedAt: bangkokIso(-DAY * 2),
    photoIds: [seededPhoto(n * 3, `pod-${n}-1.jpg`), seededPhoto(n * 3 + 1, `pod-${n}-2.jpg`)],
    signatureId: seededPhoto(n * 3 + 2, `signature-${n}.png`),
    review,
    reviewedBy: null,
    reviewedAt: review === "accepted" ? bangkokIso(-DAY) : null,
    reviewNote: null,
  };
  shipment.items[0]!.deliveredQuantity = deliveredQuantity;
  return shipment;
};

const shipped = orders.map((order, index) => ({ order, index })).filter(({ order }) => order.shipments.length > 0);
const waiting = orders.filter((order) => ["in_production", "artwork_approved"].includes(order.status));

/** Every shipment; the partner zone (`../partner/shipments.ts`) adds the ones a factory creates. */
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
      // A draft the desk may still split (D-230); a ready trip the fleet cannot serve; one on hold.
      status: at === 0 ? "draft" : "ready",
      exception: at === 1 ? "โรงงานไม่ส่งในพื้นที่นี้ ต้องจองขนส่งสำรอง" : null,
      blockedByPayment: at === 2,
    }),
  ),
];
// A short delivery within tolerance waits for review (credit pro rata, D-080).
const shortWithin = shipments.find((item) => item.status === "delivered" && item.pod?.review === "pending");
if (shortWithin?.pod) {
  const order = orders.find((candidate) => candidate.id === shortWithin.order.id)!;
  const quantity = Math.floor(order.quantity * (1 - Number(order.tolerance.shortagePct) / 200));
  shortWithin.pod.deliveredQuantity = quantity;
  shortWithin.items[0]!.deliveredQuantity = quantity;
}

/* -------------------------------------------------------------------------- the published shapes */

/** `admin.shipments.list?queue` (D-229, D-230). */
const QUEUES: Record<Schemas["ShipmentQueue"], (item: Shipment) => boolean> = {
  awaiting_pickup: (item) => item.status === "ready" || item.status === "draft",
  in_transit: (item) => ["picked_up", "in_transit", "out_for_delivery"].includes(item.status),
  exceptions: (item) =>
    item.status === "failed" ||
    (item.status === "returned" && !item.resolution) ||
    (item.carrierRequest !== null && item.status === "ready"),
  pod_review: (item) => item.pod?.review === "pending",
};

registerQueue("shipments.read", () => ({
  key: "shipments.exceptions",
  path: "/admin/shipments?queue=exceptions",
  count: shipments.filter(QUEUES.exceptions).length,
  overdueCount: shipments.filter((item) => item.status === "failed").length,
  nextDueAt: null,
}));
registerQueue("shipments.read", () => ({
  key: "shipments.pod_review",
  path: "/admin/shipments?queue=pod_review",
  count: shipments.filter(QUEUES.pod_review).length,
  overdueCount: 0,
  nextDueAt: null,
}));

/** The carton labels and packing list, generated once a shipment is ready (null before). */
const documents = new Map<string, { shipment: Shipment; kind: "labels" | "packing_list" }>();
const documentSeq = new Map<string, number>();
function documentId(item: Shipment, kind: "labels" | "packing_list"): string | null {
  if (item.status === "draft" || item.cartonList.length === 0) return null;
  if (!documentSeq.has(item.id)) documentSeq.set(item.id, documentSeq.size + 1);
  const id = mockId(kind === "labels" ? "lbl" : "pkl", documentSeq.get(item.id)!);
  documents.set(id, { shipment: item, kind });
  return id;
}

/** A signed URL for a file the shipments own (documents, seeded POD photos), or `null`. */
export function shipmentFileUrl(fileId: string): string | null {
  const document = documents.get(fileId);
  if (document)
    return `data:text/plain;charset=utf-8,${encodeURIComponent(`${document.shipment.shipmentNo} ${document.kind} (ข้อมูลจำลอง)`)}`;
  return shipmentFiles.get(fileId)?.url ?? null;
}

/** The order's delivered-vs-ordered result once every live shipment of it is delivered (D-021, D-080). */
export function reconciliationOf(orderId: string): Schemas["DeliveryReconciliationDto"] | null {
  const order = orders.find((candidate) => candidate.id === orderId);
  const trips = shipments.filter(
    (item) => item.items.some((line) => line.orderId === orderId) && item.status !== "cancelled",
  );
  if (!order || trips.length === 0 || trips.some((item) => item.status !== "delivered")) return null;
  const deliveredQuantity = trips
    .flatMap((item) => item.items.filter((line) => line.orderId === orderId))
    .reduce((total, line) => total + (line.deliveredQuantity ?? line.quantity), 0);
  const ordered = order.quantity;
  const deviation = ((deliveredQuantity - ordered) / ordered) * 100;
  const shortage = Number(order.tolerance.shortagePct);
  const overage = Number(order.tolerance.overagePct);
  const outcome: Schemas["ToleranceOutcome"] =
    deviation === 0
      ? "exact"
      : deviation < 0
        ? -deviation <= shortage
          ? "shortage_within"
          : "shortage_outside"
        : deviation <= overage
          ? "overage_within"
          : "overage_outside";
  return {
    orderedQuantity: ordered,
    deliveredQuantity,
    payableQuantity: Math.min(deliveredQuantity, ordered),
    deviationPct: deviation.toFixed(4),
    toleranceShortagePct: order.tolerance.shortagePct,
    toleranceOveragePct: order.tolerance.overagePct,
    outcome,
    // The credit is the API's to work out (D-080); the mock leaves it to the finance mock.
    creditAmount: null,
    creditNetAmount: null,
    creditVatAmount: null,
    evaluatedAt: trips
      .map((item) => item.pod?.capturedAt ?? item.updatedAt)
      .sort()
      .at(-1)!,
  };
}

export const factsOf = (item: Shipment): ShipmentFacts => ({
  status: item.status,
  carrier: item.carrier,
  carrierRequested: item.carrierRequest !== null,
  blockedByPayment:
    item.blockedByPayment && !["picked_up", "in_transit", "out_for_delivery", "delivered"].includes(item.status),
  podReview: item.pod?.review ?? null,
  exceptionResolved: item.resolution !== null,
});

/** What the factory and the desk both read the same way. */
function common(item: Shipment) {
  const facts = factsOf(item);
  return {
    id: item.id,
    shipmentNo: item.shipmentNo,
    status: item.status,
    carrier: item.carrier,
    trackingNo: item.trackingNo,
    destination: {
      recipientName: item.destination.recipientName,
      phone: item.destination.phone,
      line1: [item.destination.line1, item.destination.subdistrict, item.destination.district]
        .filter(Boolean)
        .join(" "),
      line2: item.destination.line2,
      postcode: item.destination.postcode,
      province: provinceRefOf(item.destination.postcode, item.destination.province),
    },
    items: item.items.map((line) => ({
      jobId: line.jobId,
      jobNo: line.jobNo,
      orderCode: line.orderCode,
      destinationId: line.destinationId,
      quantity: line.quantity,
      deliveredQuantity: line.deliveredQuantity,
      toleranceOutcome: reconciliationOf(line.orderId)?.outcome ?? null,
    })),
    cartonsCount: item.cartons,
    cartons: item.cartonList.map((carton) => ({ ...carton })),
    weightG: item.weightG,
    volumeCm3: item.volumeCm3,
    events: item.events.map((event) => ({ ...event })),
    proofOfDelivery: item.pod
      ? {
          kind: item.pod.kind,
          receiverName: item.pod.receiverName,
          deliveredQuantity: item.pod.deliveredQuantity,
          capturedAt: item.pod.capturedAt,
          photoFileIds: [...item.pod.photoIds],
          signatureFileId: item.pod.signatureId,
          carrierPodRef: null,
        }
      : null,
    labelFileId: documentId(item, "labels"),
    packingListFileId: documentId(item, "packing_list"),
    note: item.exception,
    plannedShipOn: item.promisedShipDate,
    readyAt: item.readyAt,
    pickedUpAt: item.events.find((event) => event.status === "picked_up")?.occurredAt ?? null,
    deliveredAt: item.status === "delivered" ? (item.pod?.capturedAt ?? item.lastEvent?.occurredAt ?? null) : null,
    blockedByPayment: facts.blockedByPayment,
    carrierRequest: item.carrierRequest ? { ...item.carrierRequest } : null,
  };
}

/** A shipment as `admin.shipments.*` answers it, masked by D-141 and with the reader's actions. */
export function toAdminShipmentDto(item: Shipment, who: StaffPersona | null): Schemas["AdminShipmentDto"] {
  const seesCost = Boolean(who && can(who, "factory_cost.read"));
  const failedOrReturned = item.status === "failed" || item.status === "returned" || item.resolution !== null;
  const exceptionEvent = item.events.findLast((event) => event.status === "failed" || event.status === "returned");
  return {
    ...common(item),
    carrierBookingRef: item.carrier === "factory_fleet" ? null : item.trackingNo,
    carrierCostAmount: seesCost ? (item.economics?.carrierCost ?? null) : null,
    payoutAmount: seesCost ? (item.economics?.factoryPayout ?? null) : null,
    trackingUrl: null,
    factoryId: item.factory.id,
    factoryCode: item.factory.code,
    cancelledAt: item.cancelledAt,
    cancelReason: item.cancelReason,
    // A failed or returned trip, and how the desk resolved it (D-230).
    exception:
      failedOrReturned && exceptionEvent
        ? {
            status: exceptionEvent.status === "returned" ? "returned" : "failed",
            note: exceptionEvent.note ?? item.exception,
            occurredAt: exceptionEvent.occurredAt,
            resolution: item.resolution?.resolution ?? null,
            resolutionNote: item.resolution?.note ?? null,
            resolvedAt: item.resolution?.at ?? null,
            resolvedBy: item.resolution?.by ?? null,
          }
        : null,
    podReview: item.pod
      ? {
          state: item.pod.review,
          reviewedBy: item.pod.reviewedBy,
          reviewedAt: item.pod.reviewedAt,
          note: item.pod.reviewNote,
        }
      : null,
    splitFrom: item.splitFrom,
    nextActions: adminShipmentActions(factsOf(item), new Set(who?.permissions ?? [])),
  };
}

/** A shipment as `partner.shipments.*` answers it: the factory's trip, never Packio's costs. */
export function toPartnerShipmentDto(item: Shipment, permissions: readonly string[]): Schemas["PartnerShipmentDto"] {
  return { ...common(item), nextActions: partnerShipmentActions(factsOf(item), new Set(permissions)) };
}

/* --------------------------------------------------------------------------------- handlers */

function access(request: Request, permission: string) {
  const who = staffPersonaOf(request);
  return who && can(who, permission) ? who : null;
}

const replays = new Map<string, { status: number; body: unknown; etag: string | null }>();
/** `Idempotency-Key` (api-conventions §3): a replay of a key answers what the first call did. */
async function idempotent(
  request: Request,
  required: boolean,
  run: () => Promise<Response> | Response,
): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  if (!key) return required ? problem(400, "idempotency.key_required", "ต้องระบุ Idempotency-Key") : run();
  const scoped = `${new URL(request.url).pathname} ${key}`;
  const seen = replays.get(scoped);
  if (seen)
    return HttpResponse.json(seen.body as never, {
      status: seen.status,
      headers: { "Idempotent-Replayed": "true", ...(seen.etag ? { ETag: seen.etag } : {}) },
    });
  const response = await run();
  if (response.ok)
    replays.set(scoped, {
      status: response.status,
      body: await response.clone().json(),
      etag: response.headers.get("ETag"),
    });
  return response;
}

/** `If-Match` is optional on the desk's actions (v0.5.0): one sent is checked, none is let through. */
function stale(request: Request, item: Shipment): Response | null {
  const match = request.headers.get("if-match");
  return match && match !== etagOfShipment(item)
    ? problem(412, "concurrency.stale", "การจัดส่งนี้ถูกแก้ไขไปแล้ว กรุณาโหลดใหม่")
    : null;
}

const shipmentOf = (id: unknown) => shipments.find((candidate) => candidate.id === id);
const answer = (item: Shipment, who: StaffPersona, status = 200) =>
  HttpResponse.json(toAdminShipmentDto(item, who), { status, headers: { ETag: etagOfShipment(item) } });
const invalidStatus = (detail: string) => problem(409, "shipments.invalid_status", detail);

const pageOf = (url: URL) => ({
  page: Number(url.searchParams.get("page") ?? 1),
  perPage: Number(url.searchParams.get("perPage") ?? 25),
});

let splits = 0;

export const shipmentHandlers = [
  http.get("*/v1/admin/shipments", ({ request }) => {
    const who = access(request, "shipments.read");
    if (!who) return forbidden();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const orderId = url.searchParams.get("orderId");
    const queue = url.searchParams.get("queue") as Schemas["ShipmentQueue"] | null;
    const carrier = url.searchParams.get("carrier");
    const factoryId = url.searchParams.get("factoryId");
    const q = url.searchParams.get("q") ?? undefined;
    if (queue && !QUEUES[queue]) return problem(422, "validation.failed", "ไม่รู้จักคิวนี้");
    const rows = shipments
      .filter((item) => !status || item.status === status)
      .filter((item) => !orderId || item.items.some((line) => line.orderId === orderId))
      .filter((item) => !queue || QUEUES[queue](item))
      .filter((item) => !carrier || item.carrier === carrier)
      .filter((item) => !factoryId || item.factory.id === factoryId)
      .filter((item) =>
        matchesQuery(q, item.shipmentNo, item.order.orderCode, item.trackingNo, item.destination.recipientName),
      )
      .map((item) => toAdminShipmentDto(item, who));
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),
  http.get("*/v1/admin/shipments/:shipmentId", ({ params, request }) => {
    const who = access(request, "shipments.read");
    if (!who) return forbidden();
    const item = shipmentOf(params.shipmentId);
    return item ? answer(item, who) : noShipment();
  }),

  // admin.shipments.carrierQuotes: the enabled fallback carriers for this trip (D-114); costs are Packio's (D-141).
  http.post("*/v1/admin/shipments/:shipmentId/carrier-quotes", ({ params, request }) => {
    const who = access(request, "shipments.manage");
    if (!who) return forbidden();
    const item = shipmentOf(params.shipmentId);
    if (!item) return noShipment();
    if (item.status !== "ready") return invalidStatus("ขอราคาขนส่งได้เมื่อการจัดส่งพร้อมส่งเท่านั้น");
    const seesCost = can(who, "factory_cost.read");
    const remote = item.destination.postcode.startsWith("9");
    return HttpResponse.json([
      {
        carrier: "flash_express",
        available: true,
        amount: seesCost ? baht(item.cartons * 18500) : null,
        currency: "THB",
        transitDays: 2,
        reason: null,
      },
      {
        carrier: "deliveree",
        available: !remote,
        amount: seesCost && !remote ? baht(240000) : null,
        currency: "THB",
        transitDays: remote ? null : 1,
        reason: remote ? "ไม่ให้บริการในพื้นที่นี้" : null,
      },
    ] satisfies Schemas["ShipmentCarrierQuoteDto"][]);
  }),

  // admin.shipments.bookCarrier: only where the fleet cannot serve; the shipping gate applies (B3.2).
  http.post("*/v1/admin/shipments/:shipmentId/actions/book-carrier", ({ params, request }) =>
    idempotent(request, true, async () => {
      const who = access(request, "shipments.manage");
      if (!who) return forbidden();
      const item = shipmentOf(params.shipmentId);
      if (!item) return noShipment();
      const refused = stale(request, item);
      if (refused) return refused;
      if (item.status !== "ready" || item.carrier !== "factory_fleet")
        return invalidStatus("จองขนส่งได้เมื่อการจัดส่งพร้อมส่งเท่านั้น");
      if (factsOf(item).blockedByPayment)
        return problem(409, "shipments.payment_pending", "ยังมียอดที่ต้องชำระก่อนจัดส่ง ส่งของไม่ได้");
      const body = (await request.json()) as Schemas["BookCarrierDto"];
      if (body.carrier !== "flash_express" && body.carrier !== "deliveree")
        return problem(422, "validation.failed", "เลือกขนส่งสำรอง", [
          { path: "carrier", code: "invalid", message: "flash_express หรือ deliveree" },
        ]);
      Object.assign(item, {
        carrier: body.carrier,
        trackingNo: `${body.carrier === "flash_express" ? "TH" : "DLV"}${String(Date.now()).slice(-9)}`,
        exception: null,
        // The carrier's price at booking is Packio's cost (D-114, D-141); no fleet payout.
        economics: {
          factoryPayout: null,
          carrierCost: body.carrier === "flash_express" ? baht(item.cartons * 18500) : baht(240000),
        },
      });
      addEvent(item, "ready", "staff", body.reason?.trim() || null);
      touch(item);
      return answer(item, who);
    }),
  ),

  // admin.shipments.split (D-230): only a draft splits; the new shipment takes the quantities moved.
  http.post("*/v1/admin/shipments/:shipmentId/actions/split", ({ params, request }) =>
    idempotent(request, false, async () => {
      const who = access(request, "shipments.manage");
      if (!who) return forbidden();
      const item = shipmentOf(params.shipmentId);
      if (!item) return noShipment();
      const refused = stale(request, item);
      if (refused) return refused;
      if (item.status !== "draft") return invalidStatus("แยกได้เฉพาะการจัดส่งที่ยังเป็นร่าง");
      const body = (await request.json().catch(() => null)) as Schemas["SplitShipmentDto"] | null;
      if (!body?.reason || body.reason.trim().length < 3)
        return problem(422, "validation.failed", "ระบุเหตุผล", [
          { path: "reason", code: "too_small", message: "อย่างน้อย 3 ตัวอักษร" },
        ]);
      const moves = body.items ?? [];
      const bad = moves.find((move) => {
        const line = item.items.find((candidate) => candidate.destinationId === move.destinationId);
        return !line || move.quantity < 1 || move.quantity >= line.quantity;
      });
      if (moves.length === 0 || bad)
        return problem(422, "validation.failed", "จำนวนที่แยกต้องน้อยกว่าจำนวนในการจัดส่ง", [
          { path: "items", code: "max", message: "น้อยกว่าจำนวนทั้งหมด" },
        ]);
      if (!Number.isInteger(body.cartonsCount) || body.cartonsCount < 1 || !(body.weightG > 0))
        return problem(422, "validation.failed", "ระบุกล่องและน้ำหนัก", [
          { path: "cartonsCount", code: "min", message: "อย่างน้อย 1" },
        ]);
      splits += 1;
      const moved = moves.reduce((total, move) => total + move.quantity, 0);
      const created: Shipment = {
        ...item,
        id: mockId("shs", splits),
        shipmentNo: `S-2569-${String(900 + splits).padStart(5, "0")}`,
        items: item.items.flatMap((line) => {
          const move = moves.find((candidate) => candidate.destinationId === line.destinationId);
          return move ? [{ ...line, quantity: move.quantity, deliveredQuantity: null }] : [];
        }),
        quantity: moved,
        cartons: body.cartonsCount,
        weightG: body.weightG,
        volumeCm3: body.volumeCm3 ?? null,
        cartonList: [],
        events: [],
        lastEvent: null,
        pod: null,
        splitFrom: { id: item.id, shipmentNo: item.shipmentNo },
        resolution: null,
        version: 1,
        updatedAt: now(),
      };
      shipments.push(created);
      item.items = item.items.map((line) => {
        const move = moves.find((candidate) => candidate.destinationId === line.destinationId);
        return move ? { ...line, quantity: line.quantity - move.quantity } : line;
      });
      item.quantity -= moved;
      item.cartons = Math.max(1, item.cartons - body.cartonsCount);
      item.weightG = Math.max(1, item.weightG - body.weightG);
      item.exception = body.reason.trim();
      touch(item);
      return HttpResponse.json(
        {
          shipment: toAdminShipmentDto(item, who),
          created: toAdminShipmentDto(created, who),
        } satisfies Schemas["SplitShipmentResultDto"],
        { status: 201, headers: { ETag: etagOfShipment(item) } },
      );
    }),
  ),

  // admin.shipments.resolveException (D-230): failed → retry | return; returned → retry | cancel.
  http.post("*/v1/admin/shipments/:shipmentId/actions/resolve-exception", ({ params, request }) =>
    idempotent(request, false, async () => {
      const who = access(request, "shipments.manage");
      if (!who) return forbidden();
      const item = shipmentOf(params.shipmentId);
      if (!item) return noShipment();
      const refused = stale(request, item);
      if (refused) return refused;
      const body = (await request.json().catch(() => null)) as Schemas["ResolveShipmentExceptionDto"] | null;
      if (!body?.reason || body.reason.trim().length < 3)
        return problem(422, "validation.failed", "ระบุเหตุผล", [
          { path: "reason", code: "too_small", message: "อย่างน้อย 3 ตัวอักษร" },
        ]);
      const allowed =
        item.status === "failed"
          ? ["retry", "return"]
          : item.status === "returned" && !item.resolution
            ? ["retry", "cancel"]
            : [];
      if (!allowed.includes(body.resolution))
        return invalidStatus(allowed.length ? "เลือกวิธีแก้ที่ใช้กับสถานะนี้ได้" : "ไม่มีปัญหาการจัดส่งให้แก้");
      const status: Shipment["status"] =
        body.resolution === "retry" ? "out_for_delivery" : body.resolution === "return" ? "returned" : "cancelled";
      addEvent(item, status, "staff", body.reason.trim());
      item.status = status;
      if (status === "cancelled") Object.assign(item, { cancelledAt: now(), cancelReason: body.reason.trim() });
      item.resolution = {
        resolution: body.resolution,
        note: body.reason.trim(),
        at: now(),
        by: { id: who.id, displayName: who.displayName },
      };
      item.exception = null;
      touch(item);
      return answer(item, who);
    }),
  ),

  // admin.shipments.reviewPod (D-229): accept, or reject with a note; an accepted factory POD makes the payout eligible.
  http.post("*/v1/admin/shipments/:shipmentId/pod/actions/:decision", async ({ params, request }) => {
    const who = access(request, "shipments.manage");
    if (!who) return forbidden();
    const item = shipmentOf(params.shipmentId);
    if (!item) return noShipment();
    const refused = stale(request, item);
    if (refused) return refused;
    if (params.decision !== "accept" && params.decision !== "reject")
      return problem(400, "http.bad_request", "accept หรือ reject");
    if (!item.pod || item.pod.review !== "pending") return invalidStatus("ไม่มีหลักฐานการส่งมอบรอตรวจ");
    const body = ((await request.json().catch(() => ({}))) ?? {}) as Schemas["ReviewPodDto"];
    if (params.decision === "reject" && !body.note?.trim())
      return problem(422, "validation.failed", "กรุณาระบุเหตุผล", [
        { path: "note", code: "required", message: "จำเป็น" },
      ]);
    Object.assign(item.pod, {
      review: params.decision === "accept" ? "accepted" : "rejected",
      reviewedBy: { id: who.id, displayName: who.displayName },
      reviewedAt: now(),
      reviewNote: body.note?.trim() || null,
    });
    touch(item);
    return answer(item, who);
  }),

  // admin.shipments.cancel: a trip that has not left (draft or ready), with a reason.
  http.post("*/v1/admin/shipments/:shipmentId/actions/cancel", ({ params, request }) =>
    idempotent(request, true, async () => {
      const who = access(request, "shipments.manage");
      if (!who) return forbidden();
      const item = shipmentOf(params.shipmentId);
      if (!item) return noShipment();
      const body = (await request.json().catch(() => null)) as Schemas["CancelShipmentDto"] | null;
      if (!body?.reason || body.reason.trim().length < 3)
        return problem(422, "validation.failed", "ระบุเหตุผล", [
          { path: "reason", code: "too_small", message: "อย่างน้อย 3 ตัวอักษร" },
        ]);
      if (item.status !== "draft" && item.status !== "ready") return invalidStatus("ยกเลิกได้ก่อนของออกจากโรงงาน");
      addEvent(item, "cancelled", "staff", body.reason.trim());
      Object.assign(item, { status: "cancelled", cancelledAt: now(), cancelReason: body.reason.trim() });
      touch(item);
      return answer(item, who);
    }),
  ),

  // admin.shipments.reconciliation: per order, 404 until every shipment of it is delivered.
  http.get("*/v1/admin/orders/:orderId/delivery-reconciliation", ({ params, request }) => {
    if (!access(request, "shipments.read")) return forbidden();
    const result = reconciliationOf(String(params.orderId));
    return result ? HttpResponse.json(result) : problem(404, "http.not_found", "ยังไม่ได้ส่งมอบคำสั่งซื้อนี้");
  }),

  // admin.files.download for the labels, packing lists and seeded POD photos; anything else falls through.
  http.get("*/v1/admin/files/:fileId/download", ({ params, request }) => {
    const url = shipmentFileUrl(String(params.fileId));
    if (!url) return undefined;
    if (!staffPersonaOf(request)) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    return HttpResponse.json({ url, expiresAt: bangkokIso(5) } satisfies Schemas["DownloadUrlDto"]);
  }),
];
