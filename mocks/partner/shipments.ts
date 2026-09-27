/**
 * CONTRACT-REQUEST partner.shipments — shipping from the factory (F5 5.2) over **the logistics
 * mock's own shipment rows**: a shipment the factory creates, dispatches or proves delivered here
 * is the one the logistics desk sees, and its POD waits in the desk's review queue (D-013).
 *
 * Rules the API states (B4.3): a shipment only for a finished job and a destination with quantity
 * left (split and multi-destination, D-110); a before-shipping instalment unpaid holds it (B3.2);
 * POD needs photos, the receiver's name, a signature and the delivered quantity, and the delivered
 * quantity against the shipment's is judged by the order's tolerance (D-021, D-080).
 */

import type { z } from "zod";

import type { partnerShipment, partnerShipmentDetail, shipPlanJob } from "@/lib/api/requests/partner-shipments";
import type { RequestKey } from "@/lib/api/requests/registry";

import { orders, type MockOrder } from "../admin/commerce";
import { inspections } from "../admin/governance";
import { shipments, type Shipment } from "../admin/logistics";
import { fileDataUrl, files } from "../admin/platform";
import { mockRequest, type MockContext } from "../route";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { destinationsOf, extraOf, factoryJobs, jobDone, setShippedCounter } from "./jobs";
import { own } from "./support";

type Row = z.output<typeof partnerShipment>;
type Detail = z.output<typeof partnerShipmentDetail>;
type PlanJob = z.output<typeof shipPlanJob>;

interface Meta {
  jobId: string;
  destinationId: string;
  carrierRequested: boolean;
  clientRefs: Set<string>;
}

/** What the partner zone knows about a shipment beyond the desk's row. */
const meta = new Map<string, Meta>();
let seq = 1;
const now = () => bangkokIso();

const destinationOf = (order: MockOrder, shipment: Shipment) =>
  order.destinations.find((item) => item.id === meta.get(shipment.id)?.destinationId) ?? order.destinations[0]!;

setShippedCounter((order, destinationId) =>
  shipments
    .filter((item) => item.order.id === order.id && item.status !== "cancelled")
    .filter((item) => destinationOf(order, item).id === destinationId)
    .reduce((total, item) => total + item.quantity, 0),
);

const fileRefOf = (id: string) => {
  const file = files.get(id);
  return {
    id,
    originalName: file?.originalName ?? "photo.jpg",
    mimeType: file?.mimeType ?? "image/jpeg",
    sizeBytes: file?.sizeBytes ?? 0,
    thumbnailUrl: fileDataUrl(id),
    url: fileDataUrl(id),
  };
};

const blockedByPayment = (order: MockOrder) =>
  order.instalments.some((item) => item.requiredBefore === "shipping" && item.status !== "paid");

function inspectionHold(jobId: string) {
  return inspections.some((item) => item.job.id === jobId && ["planned", "in_progress", "failed"].includes(item.status));
}

function rowOf(shipment: Shipment): Row | null {
  const order = orders.find((item) => item.id === shipment.order.id);
  const job = order?.jobs[0];
  if (!order || !job) return null;
  const destination = destinationOf(order, shipment);
  const shaped = destinationsOf(order).find((item) => item.id === destination.id)!;
  const { quantity: _quantity, shippedQuantity: _shipped, ...recipient } = shaped;
  return {
    id: shipment.id,
    shipmentNo: shipment.shipmentNo,
    status: shipment.status,
    carrier: shipment.carrier,
    carrierRequested: meta.get(shipment.id)?.carrierRequested ?? false,
    trackingNo: shipment.trackingNo,
    job: {
      id: job.id,
      jobNo: job.jobNo,
      title: `${order.productType.name} ${order.specs[0]?.value ?? ""}`.trim(),
      productType: order.productType,
    },
    destination: recipient,
    quantity: shipment.quantity,
    cartons: shipment.cartons,
    weightG: shipment.weightG,
    readyAt: shipment.readyAt,
    pickedUpAt: shipment.events.find((event) => ["picked_up", "in_transit"].includes(event.status))?.occurredAt ?? null,
    deliveredAt: shipment.events.find((event) => event.status === "delivered")?.occurredAt ?? null,
    promisedShipDate: shipment.promisedShipDate,
    podRequired: shipment.carrier === "factory_fleet",
    hasPod: shipment.pod !== null,
  };
}

function detailOf(shipment: Shipment): Detail | null {
  const row = rowOf(shipment);
  if (!row) return null;
  const actions: Detail["nextActions"] = [];
  if (shipment.status === "ready" || shipment.status === "draft") {
    actions.push("dispatch");
    if (!row.carrierRequested) actions.push("request_carrier");
  }
  if (["picked_up", "in_transit", "out_for_delivery"].includes(shipment.status) && !shipment.pod && row.podRequired)
    actions.push("capture_pod");
  return {
    ...row,
    cartonList: shipment.cartonList.map((carton) => ({
      ...carton,
      // What the carton label's QR encodes: the public tracking page (B4.4), never PII.
      trackingUrl: `https://packio.invalid/track/${carton.labelCode}`,
    })),
    packingList: shipment.items.map((item) => ({ label: `${row.job.title} · ${item.destinationLabel}`, quantity: item.quantity })),
    events: shipment.events.map((event) => ({ occurredAt: event.occurredAt, status: event.status, note: event.note })),
    pod: shipment.pod
      ? {
          receiverName: shipment.pod.receiverName,
          deliveredQuantity: shipment.pod.deliveredQuantity,
          capturedAt: shipment.pod.capturedAt,
          photos: shipment.pod.photos,
          signature: shipment.pod.signature,
          capturedBy: null,
          review: shipment.pod.review,
          reviewNote: shipment.pod.reviewNote,
        }
      : null,
    tolerance: shipment.tolerance,
    blockedByPayment: shipment.blockedByPayment,
    nextActions: actions,
  };
}

type Ctx = Pick<MockContext<RequestKey>, "request" | "params">;

function shipmentFor(context: Ctx, permission: string) {
  const ok = own(context.request, context.params.factoryId, permission);
  if (ok instanceof Response) return ok;
  const shipment = shipments.find((item) => item.id === context.params.shipmentId && item.factory.id === ok.store.factory.id);
  if (!shipment) return problem(404, "shipments.not_found", "ไม่พบการจัดส่งนี้");
  return { ...ok, shipment };
}

const touch = (shipment: Shipment) => {
  shipment.updatedAt = now();
};

const answer = (shipment: Shipment) => detailOf(shipment) ?? problem(404, "shipments.not_found", "ไม่พบการจัดส่งนี้");

/** A replay by the same device is the same report; another device's report on it lost the race. */
function replayed(shipment: Shipment, clientRef: string): boolean {
  return meta.get(shipment.id)?.clientRefs.has(clientRef) ?? false;
}

function remember(shipment: Shipment, clientRef: string) {
  meta.get(shipment.id)?.clientRefs.add(clientRef);
}

const perm = { read: "factory_shipments.read", manage: "factory_shipments.manage" };

export const shipmentRequestHandlers = [
  mockRequest("GET /v1/partner/factories/{factoryId}/ship-plan", (context) => {
    const ok = own(context.request, context.params.factoryId, perm.read);
    if (ok instanceof Response) return ok;
    return factoryJobs(ok.store.factory.id)
      .filter(({ job }) => jobDone(job) && job.status !== "rejected")
      .map(({ order, job }): PlanJob => {
        const last = [...extraOf(job).steps.values()].map((step) => step.quantityOut).filter((q) => q !== null).at(-1);
        return {
          id: job.id,
          jobNo: job.jobNo,
          title: `${order.productType.name} ${order.specs[0]?.value ?? ""}`.trim(),
          productType: order.productType,
          quantityGood: last ?? order.quantity,
          promisedShipDate: job.promisedShipDate ?? order.promisedShipDate ?? bangkokIso().slice(0, 10),
          destinations: destinationsOf(order),
          blockedReason: inspectionHold(job.id) ? "inspection_pending" : blockedByPayment(order) ? "payment_pending" : null,
        };
      })
      .filter((job) => job.destinations.some((destination) => destination.shippedQuantity < destination.quantity));
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/shipments", (context) => {
    const ok = own(context.request, context.params.factoryId, perm.read);
    if (ok instanceof Response) return ok;
    const view = context.query.view ?? "all";
    const rows = shipments
      .filter((item) => item.factory.id === ok.store.factory.id)
      .filter(
        (item) =>
          view === "all" ||
          (view === "open" && ["draft", "ready"].includes(item.status)) ||
          (view === "in_transit" && ["picked_up", "in_transit", "out_for_delivery", "failed"].includes(item.status)) ||
          (view === "delivered" && item.status === "delivered"),
      )
      .sort((a, b) => (b.readyAt ?? "").localeCompare(a.readyAt ?? ""))
      .map(rowOf)
      .filter((row): row is Row => row !== null);
    return paginate(rows, context.query);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/shipments", (context) => {
    const ok = own(context.request, context.params.factoryId, perm.manage);
    if (ok instanceof Response) return ok;
    const { body } = context;
    const existing = [...meta.entries()].find(([, value]) => value.clientRefs.has(body.clientRef));
    if (existing) return answer(shipments.find((item) => item.id === existing[0])!);
    const found = factoryJobs(ok.store.factory.id).find(({ job }) => job.id === body.jobId);
    if (!found) return problem(404, "jobs.not_found", "ไม่พบงานนี้");
    const { order, job } = found;
    if (!jobDone(job)) return problem(409, "shipments.job_not_finished", "งานยังผลิตไม่เสร็จ");
    if (inspectionHold(job.id)) return problem(409, "shipments.inspection_pending", "รอ Packio ตรวจคุณภาพก่อนส่ง");
    const destination = destinationsOf(order).find((item) => item.id === body.destinationId);
    if (!destination) return problem(422, "validation.failed", "ไม่พบที่อยู่ปลายทางนี้", [{ path: "destinationId", code: "ref", message: "ไม่พบ" }]);
    const left = destination.quantity - destination.shippedQuantity;
    if (body.quantity > left)
      return problem(422, "validation.failed", "จำนวนเกินที่ปลายทางนี้ยังต้องการ", [
        { path: "quantity", code: "max", message: `ส่งได้อีกไม่เกิน ${left.toLocaleString("th-TH")} ชิ้น` },
      ]);
    const snapshot = order.destinations.find((item) => item.id === destination.id)!;
    const n = seq++;
    const shipmentNo = `S-2569-${String(800 + n).padStart(5, "0")}`;
    const created: Shipment = {
      id: mockId("psh", n),
      shipmentNo,
      status: "ready",
      carrier: "factory_fleet",
      trackingNo: null,
      order: { id: order.id, orderCode: order.orderCode },
      factory: job.factory!,
      destination: {
        recipientName: snapshot.recipientName,
        phone: snapshot.phone,
        line1: snapshot.line1,
        line2: snapshot.line2,
        subdistrict: snapshot.subdistrict,
        district: snapshot.district,
        province: snapshot.province,
        postcode: snapshot.postcode,
      },
      quantity: body.quantity,
      cartons: body.cartons,
      lastEvent: { status: "ready", occurredAt: now(), location: null },
      exception: null,
      podReview: null,
      promisedShipDate: job.promisedShipDate ?? order.promisedShipDate,
      readyAt: now(),
      items: [
        {
          orderId: order.id,
          orderCode: order.orderCode,
          destinationLabel: `${snapshot.recipientName} · ${snapshot.province}`,
          quantity: body.quantity,
        },
      ],
      cartonList: Array.from({ length: body.cartons }, (_, index) => ({
        seq: index + 1,
        labelCode: `${shipmentNo}-${String(index + 1).padStart(2, "0")}`,
        weightG: body.weightG ? Math.round(body.weightG / body.cartons) : null,
      })),
      weightG: body.weightG ?? null,
      events: [{ occurredAt: now(), status: "ready", source: "factory", location: null, note: "โรงงานเตรียมของพร้อมส่ง" }],
      pod: null,
      tolerance: null,
      blockedByPayment: blockedByPayment(order),
      economics: null,
      allowedActions: ["split", "book-carrier"],
      updatedAt: now(),
    };
    shipments.unshift(created);
    meta.set(created.id, {
      jobId: job.id,
      destinationId: destination.id,
      carrierRequested: false,
      clientRefs: new Set([body.clientRef]),
    });
    extraOf(job).history.push({ at: now(), text: `สร้างการจัดส่ง ${shipmentNo}`, actor: { id: ok.who.id, displayName: ok.who.displayName } });
    return answer(created);
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/shipments/{shipmentId}", (context) => {
    const found = shipmentFor(context, perm.read);
    return found instanceof Response ? found : answer(found.shipment);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/actions/dispatch", (context) => {
    const found = shipmentFor(context, perm.manage);
    if (found instanceof Response) return found;
    const { shipment } = found;
    if (replayed(shipment, context.body.clientRef)) return answer(shipment);
    if (!["ready", "draft"].includes(shipment.status))
      return problem(409, "shipments.invalid_transition", "การจัดส่งนี้ออกไปแล้ว หน้านี้แสดงข้อมูลล่าสุด");
    if (shipment.blockedByPayment)
      return problem(409, "shipments.payment_pending", "ลูกค้ายังชำระงวดก่อนจัดส่งไม่ครบ Packio จะแจ้งเมื่อส่งได้");
    shipment.status = "in_transit";
    shipment.events.push(
      { occurredAt: now(), status: "picked_up", source: "factory", location: null, note: "รถของโรงงานรับของ" },
      { occurredAt: now(), status: "in_transit", source: "factory", location: null, note: null },
    );
    shipment.lastEvent = { status: "in_transit", occurredAt: now(), location: null };
    shipment.allowedActions = [];
    remember(shipment, context.body.clientRef);
    const order = orders.find((item) => item.id === shipment.order.id);
    if (order && order.status === "in_production") order.status = "shipping";
    touch(shipment);
    return answer(shipment);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/actions/request-carrier", (context) => {
    const found = shipmentFor(context, perm.manage);
    if (found instanceof Response) return found;
    const { shipment } = found;
    const info = meta.get(shipment.id);
    if (!["ready", "draft"].includes(shipment.status))
      return problem(409, "shipments.invalid_transition", "ขอขนส่งสำรองได้ก่อนของออกจากโรงงาน");
    if (info && !info.carrierRequested) {
      info.carrierRequested = true;
      // The logistics desk books the fallback carrier (D-114); the row lands in its exceptions queue.
      shipment.exception = `โรงงานขอขนส่งสำรอง: ${context.body.reason}`;
      touch(shipment);
    }
    remember(shipment, context.body.clientRef);
    return answer(shipment);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/pod", (context) => {
    const found = shipmentFor(context, perm.manage);
    if (found instanceof Response) return found;
    const { shipment } = found;
    const { body } = context;
    if (replayed(shipment, body.clientRef)) return answer(shipment);
    if (shipment.pod) return problem(409, "shipments.pod_exists", "บันทึกหลักฐานการส่งมอบไปแล้ว");
    if (!["picked_up", "in_transit", "out_for_delivery"].includes(shipment.status))
      return problem(409, "shipments.not_in_transit", "บันทึกการส่งมอบได้เมื่อของออกจากโรงงานแล้ว");
    const missing = [...body.photoFileIds, body.signatureFileId].filter((id) => !files.has(id));
    if (missing.length)
      return problem(422, "validation.failed", "ไม่พบไฟล์ที่อัปโหลด", [{ path: "photoFileIds", code: "ref", message: "ไม่พบ" }]);
    const order = orders.find((item) => item.id === shipment.order.id)!;
    const ratio = (body.deliveredQuantity - shipment.quantity) / shipment.quantity;
    const shortage = Number(order.tolerance.shortagePct);
    const overage = Number(order.tolerance.overagePct);
    shipment.pod = {
      kind: "factory_photo_signature",
      receiverName: body.receiverName,
      deliveredQuantity: body.deliveredQuantity,
      capturedAt: body.capturedAt,
      photos: body.photoFileIds.map(fileRefOf),
      signature: fileRefOf(body.signatureFileId),
      review: "pending",
      reviewedBy: null,
      reviewNote: null,
    };
    shipment.podReview = "pending";
    shipment.tolerance = {
      ordered: shipment.quantity,
      delivered: body.deliveredQuantity,
      shortagePct: order.tolerance.shortagePct,
      overagePct: order.tolerance.overagePct,
      outcome:
        ratio === 0
          ? "exact"
          : ratio < 0
            ? -ratio * 100 <= shortage
              ? "short_within"
              : "short_outside"
            : ratio * 100 <= overage
              ? "over_within"
              : "over_outside",
      claimId: null,
    };
    shipment.status = "delivered";
    shipment.events.push({ occurredAt: body.capturedAt, status: "delivered", source: "factory", location: null, note: `ผู้รับ: ${body.receiverName}` });
    shipment.lastEvent = { status: "delivered", occurredAt: body.capturedAt, location: null };
    remember(shipment, body.clientRef);
    touch(shipment);
    return answer(shipment);
  }),
];
