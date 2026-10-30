/**
 * Shipping from the factory on the published contract (U-F0.4): `partner.shipments.*` over **the
 * logistics desk's own shipment rows** (`../admin/shipments.ts`) — a trip the factory creates,
 * readies, dispatches or proves delivered here is the one the desk sees, and its POD waits in the
 * desk's review queue (D-013, D-229).
 *
 * The flow (getpack-api `shipments.service.ts` at v0.6.0): a **draft** for one address (`items[]`,
 * a split when several trips serve one destination, D-110) → **ready**, which makes the carton
 * labels and the packing list → dispatched by the factory's own fleet, or a request for getpack's
 * carrier fallback (D-114; the factory never books) → the POD (`items[]` with the delivered
 * quantity per destination). An unpaid before-shipping instalment or a pending inspection holds
 * the trip at the gate (B3.2, D-076). Token-scoped: other factories' trips are 404 (D-044).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { orders, type MockOrder } from "../admin/commerce";
import { inspections } from "../admin/governance";
import { files } from "../admin/platform";
import {
  addEvent,
  factsOf,
  labelCartons,
  shipmentFileUrl,
  shipments,
  toPartnerShipmentDto,
  touch,
  type Shipment,
} from "../admin/shipments";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { destinationsOf, factoryJobs, jobDone, mine, quantitiesOf, setCartonLookup, setShippedCounter } from "./jobs";
import { permissionsOf } from "./personas";
import { once, own } from "./support";

const now = () => bangkokIso();
let seq = 1;

const live = (item: Shipment) => item.status !== "cancelled";

setShippedCounter((order, destinationId) =>
  shipments
    .filter(live)
    .flatMap((item) => item.items)
    .filter((line) => line.orderId === order.id && line.destinationId === destinationId)
    .reduce((total, line) => total + line.quantity, 0),
);

setCartonLookup(
  (code) =>
    shipments.find((item) => item.cartonList.some((carton) => carton.labelCode.toUpperCase() === code))?.items[0]
      ?.jobId ?? null,
);

const owesBeforeShipping = (order: MockOrder) =>
  order.instalments.some((item) => item.requiredBefore === "shipping" && item.status !== "paid");

const inspectionHold = (jobId: string) =>
  inspections.some((item) => item.job.id === jobId && ["planned", "in_progress", "failed"].includes(item.status));

const MOVING = ["picked_up", "in_transit", "out_for_delivery", "failed"];
const invalidStatus = (detail: string) => problem(409, "shipments.invalid_status", detail);
const invalid = (path: string, message: string, detail = "ข้อมูลไม่ถูกต้อง") =>
  problem(422, "validation.failed", detail, [{ path, code: "invalid", message }]);

function tripFor(request: Request, shipmentId: unknown, permission: string) {
  const ok = mine(request, permission);
  if (ok instanceof Response) return ok;
  const item = shipments.find(
    (candidate) => candidate.id === shipmentId && candidate.factory.id === ok.store.factory.id,
  );
  if (!item) return problem(404, "http.not_found", "ไม่พบการจัดส่งนี้");
  return { ...ok, item, permissions: permissionsOf(ok.who) };
}

/** The gate at pick-up (B3.2, D-076): an inspection still open, or a before-shipping instalment unpaid. */
function gate(item: Shipment): Response | null {
  if (item.items.some((line) => inspectionHold(line.jobId)))
    return problem(409, "shipments.inspection_pending", "รอ getpack ตรวจคุณภาพก่อนส่ง");
  if (factsOf(item).blockedByPayment)
    return problem(409, "shipments.payment_pending", "ลูกค้ายังชำระงวดก่อนจัดส่งไม่ครบ getpack จะแจ้งเมื่อส่งได้");
  return null;
}

const perm = { read: "factory_shipments.read", manage: "factory_shipments.manage" };

/** `?view` (partner): open = draft or ready, in transit, delivered, exceptions = failed or returned. */
const VIEWS: Record<Schemas["PartnerShipmentView"], (item: Shipment) => boolean> = {
  open: (item) => item.status === "draft" || item.status === "ready",
  in_transit: (item) => ["picked_up", "in_transit", "out_for_delivery"].includes(item.status),
  delivered: (item) => item.status === "delivered",
  exceptions: (item) => item.status === "failed" || item.status === "returned",
};

export const shipmentHandlers = [
  // partner.shipments.shipPlan: finished jobs with what each destination still needs, and why pick-up would be refused today.
  http.get("*/v1/partner/factories/:factoryId/ship-plan", ({ request, params }) => {
    const ok = own(request, params.factoryId, perm.read);
    if (ok instanceof Response) return ok;
    const plan = factoryJobs(ok.store.factory.id)
      .filter(({ job }) => jobDone(job) && job.kind !== "mockup")
      .map(({ order, job }): Schemas["ShipPlanJobDto"] => ({
        jobId: job.id,
        jobNo: job.jobNo,
        orderCode: order.orderCode,
        quantityOrdered: order.quantity,
        quantityGood: quantitiesOf(job).good,
        destinations: destinationsOf(order).map((destination) => ({
          destinationId: destination.id,
          code: destination.code,
          provinceNameTh: destination.provinceNameTh,
          postcodePrefix: destination.postcodePrefix,
          quantity: destination.quantity,
          shippedQuantity: destination.shippedQuantity,
          remainingQuantity: Math.max(0, destination.quantity - destination.shippedQuantity),
        })),
        blockedReason: inspectionHold(job.id)
          ? "inspection_pending"
          : owesBeforeShipping(order)
            ? "payment_pending"
            : null,
      }))
      .filter((job) => job.destinations.some((destination) => destination.remainingQuantity > 0));
    return HttpResponse.json(plan);
  }),

  http.get("*/v1/partner/shipments", ({ request }) => {
    const ok = mine(request, perm.read);
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const view = url.searchParams.get("view") as Schemas["PartnerShipmentView"] | null;
    if (view && !VIEWS[view]) return invalid("view", "ไม่รู้จักมุมมองนี้");
    const status = url.searchParams.get("status");
    const orderId = url.searchParams.get("orderId");
    const q = url.searchParams.get("q") ?? undefined;
    const permissions = permissionsOf(ok.who);
    const rows = shipments
      .filter((item) => item.factory.id === ok.store.factory.id)
      .filter((item) => !view || VIEWS[view](item))
      .filter((item) => !status || item.status === status)
      .filter((item) => !orderId || item.items.some((line) => line.orderId === orderId))
      .filter((item) => matchesQuery(q, item.shipmentNo, ...item.items.map((l) => l.jobNo)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((item) => toPartnerShipmentDto(item, permissions));
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  // partner.shipments.create: a draft trip to one address (D-110); labels come with `markReady`.
  http.post("*/v1/partner/shipments", ({ request }) =>
    once(request, "shipment-create", async () => {
      const ok = mine(request, perm.manage);
      if (ok instanceof Response) return ok;
      const body = (await request.json().catch(() => null)) as Schemas["CreateShipmentDto"] | null;
      if (!body?.items?.length) return invalid("items", "อย่างน้อยหนึ่งรายการ");
      if (!Number.isInteger(body.cartonsCount) || body.cartonsCount < 1)
        return invalid("cartonsCount", "อย่างน้อยหนึ่งกล่อง");
      if (!Number.isInteger(body.weightG) || body.weightG < 1) return invalid("weightG", "ระบุน้ำหนัก");
      const jobs = factoryJobs(ok.store.factory.id);
      const lines: {
        order: MockOrder;
        job: ReturnType<typeof factoryJobs>[number]["job"];
        input: Schemas["ShipmentItemInputDto"];
        snapshot: MockOrder["destinations"][number];
      }[] = [];
      for (const input of body.items) {
        const found = jobs.find(({ job }) => job.id === input.jobId);
        if (!found) return problem(404, "http.not_found", "ไม่พบงานนี้");
        if (!jobDone(found.job)) return problem(409, "shipments.job_not_shippable", "งานยังผลิตไม่เสร็จ");
        const destination = destinationsOf(found.order).find((item) => item.id === input.destinationId);
        const snapshot = found.order.destinations.find((item) => item.id === input.destinationId);
        if (!destination || !snapshot) return invalid("items", "ไม่พบที่อยู่ปลายทางนี้");
        const left = destination.quantity - destination.shippedQuantity;
        if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > left)
          return problem(
            422,
            "shipments.quantity_exceeds",
            `ปลายทางนี้ยังต้องการอีกไม่เกิน ${left.toLocaleString("th-TH")} ชิ้น`,
          );
        lines.push({ ...found, input, snapshot });
      }
      const address = (line: (typeof lines)[number]) =>
        [line.snapshot.recipientName, line.snapshot.line1, line.snapshot.postcode].join("|");
      if (new Set(lines.map(address)).size > 1)
        return problem(422, "shipments.destinations_differ", "หนึ่งเที่ยวส่งได้ที่อยู่เดียว");
      const [first] = lines;
      const n = seq++;
      const created: Shipment = {
        id: mockId("psh", n),
        shipmentNo: `S-2569-${String(800 + n).padStart(5, "0")}`,
        status: "draft",
        carrier: "factory_fleet",
        trackingNo: null,
        order: { id: first!.order.id, orderCode: first!.order.orderCode },
        factory: first!.job.factory!,
        destination: {
          recipientName: first!.snapshot.recipientName,
          phone: first!.snapshot.phone,
          line1: first!.snapshot.line1,
          line2: first!.snapshot.line2,
          subdistrict: first!.snapshot.subdistrict,
          district: first!.snapshot.district,
          province: first!.snapshot.province,
          postcode: first!.snapshot.postcode,
        },
        quantity: lines.reduce((total, line) => total + line.input.quantity, 0),
        cartons: body.cartonsCount,
        lastEvent: null,
        exception: body.note?.trim() || null,
        promisedShipDate: body.plannedShipOn ?? first!.job.promisedShipDate ?? first!.order.promisedShipDate,
        readyAt: null,
        items: lines.map((line) => ({
          orderId: line.order.id,
          orderCode: line.order.orderCode,
          jobId: line.job.id,
          jobNo: line.job.jobNo,
          destinationId: line.input.destinationId,
          quantity: line.input.quantity,
          deliveredQuantity: null,
        })),
        cartonList: [],
        weightG: body.weightG,
        volumeCm3: body.volumeCm3 ?? null,
        events: [],
        pod: null,
        blockedByPayment: lines.some((line) => owesBeforeShipping(line.order)),
        economics: null,
        carrierRequest: null,
        splitFrom: null,
        resolution: null,
        cancelReason: null,
        cancelledAt: null,
        version: 1,
        updatedAt: now(),
      };
      shipments.unshift(created);
      return HttpResponse.json(toPartnerShipmentDto(created, permissionsOf(ok.who)), { status: 201 });
    }),
  ),

  http.get("*/v1/partner/shipments/:shipmentId", ({ request, params }) => {
    const found = tripFor(request, params.shipmentId, perm.read);
    return found instanceof Response ? found : HttpResponse.json(toPartnerShipmentDto(found.item, found.permissions));
  }),

  // partner.shipments.markReady: packed — the carton labels (one PDF) and the packing list are made.
  http.post("*/v1/partner/shipments/:shipmentId/actions/ready", ({ request, params }) =>
    once(request, `shipment-ready:${String(params.shipmentId)}`, () => {
      const found = tripFor(request, params.shipmentId, perm.manage);
      if (found instanceof Response) return found;
      const { item } = found;
      if (item.status !== "draft") return invalidStatus("การจัดส่งนี้พร้อมส่งแล้ว");
      item.status = "ready";
      labelCartons(item);
      item.readyAt = now();
      addEvent(item, "ready", "factory", "โรงงานแพ็กของพร้อมส่ง");
      touch(item);
      return HttpResponse.json(toPartnerShipmentDto(item, found.permissions));
    }),
  ),

  // partner.shipments.dispatch: the factory's own fleet leaves with it (D-013), past the gate.
  http.post("*/v1/partner/shipments/:shipmentId/actions/dispatch", ({ request, params }) =>
    once(request, `shipment-dispatch:${String(params.shipmentId)}`, () => {
      const found = tripFor(request, params.shipmentId, perm.manage);
      if (found instanceof Response) return found;
      const { item } = found;
      if (item.status !== "ready" || item.carrier !== "factory_fleet")
        return invalidStatus("การจัดส่งนี้ออกไปแล้ว หน้านี้แสดงข้อมูลล่าสุด");
      const held = gate(item);
      if (held) return held;
      addEvent(item, "picked_up", "factory", "รถของโรงงานรับของ");
      addEvent(item, "in_transit", "factory");
      item.status = "in_transit";
      for (const line of item.items) {
        const order = orders.find((candidate) => candidate.id === line.orderId);
        if (order?.status === "in_production") order.status = "shipping";
      }
      touch(item);
      return HttpResponse.json(toPartnerShipmentDto(item, found.permissions));
    }),
  ),

  // partner.shipments.requestCarrier: ask getpack for its fallback carrier (D-114); the desk books it.
  http.post("*/v1/partner/shipments/:shipmentId/actions/request-carrier", ({ request, params }) =>
    once(request, `shipment-carrier:${String(params.shipmentId)}`, async () => {
      const found = tripFor(request, params.shipmentId, perm.manage);
      if (found instanceof Response) return found;
      const { item } = found;
      const body = (await request.json().catch(() => null)) as Schemas["CancelShipmentDto"] | null;
      if (!body?.reason || body.reason.trim().length < 3) return invalid("reason", "อย่างน้อย 3 ตัวอักษร");
      if (item.status !== "ready" || item.carrier !== "factory_fleet" || item.carrierRequest)
        return invalidStatus("ขอขนส่งสำรองได้ก่อนของออกจากโรงงาน ครั้งเดียว");
      item.carrierRequest = { reason: body.reason.trim(), requestedAt: now() };
      // The desk books the fallback carrier (D-114); the trip lands on its exceptions queue.
      item.exception = `โรงงานขอขนส่งสำรอง: ${body.reason.trim()}`;
      touch(item);
      return HttpResponse.json(toPartnerShipmentDto(item, found.permissions));
    }),
  ),

  // partner.shipments.cancel: a trip that has not left (draft or ready), with a reason.
  http.post("*/v1/partner/shipments/:shipmentId/actions/cancel", ({ request, params }) =>
    once(request, `shipment-cancel:${String(params.shipmentId)}`, async () => {
      const found = tripFor(request, params.shipmentId, perm.manage);
      if (found instanceof Response) return found;
      const { item } = found;
      const body = (await request.json().catch(() => null)) as Schemas["CancelShipmentDto"] | null;
      if (!body?.reason || body.reason.trim().length < 3) return invalid("reason", "อย่างน้อย 3 ตัวอักษร");
      if (item.status !== "draft" && item.status !== "ready") return invalidStatus("ยกเลิกได้ก่อนของออกจากโรงงาน");
      addEvent(item, "cancelled", "factory", body.reason.trim());
      Object.assign(item, { status: "cancelled", cancelledAt: now(), cancelReason: body.reason.trim() });
      touch(item);
      return HttpResponse.json(toPartnerShipmentDto(item, found.permissions));
    }),
  ),

  // partner.shipments.updateStatus: the fleet's own transit steps.
  http.post("*/v1/partner/shipments/:shipmentId/events", ({ request, params }) =>
    once(request, `shipment-event:${String(params.shipmentId)}`, async () => {
      const found = tripFor(request, params.shipmentId, perm.manage);
      if (found instanceof Response) return found;
      const { item } = found;
      const body = (await request.json().catch(() => null)) as Schemas["ShipmentStatusUpdateDto"] | null;
      if (!body || !["in_transit", "out_for_delivery", "failed", "returned"].includes(body.status))
        return invalid("status", "เลือกสถานะ");
      if (item.carrier !== "factory_fleet" || !MOVING.includes(item.status))
        return invalidStatus("แจ้งสถานะได้ระหว่างที่รถของโรงงานกำลังส่ง");
      addEvent(item, body.status, "factory", body.note?.trim() || null, body.location?.trim() || null);
      item.status = body.status;
      if (body.status === "failed" || body.status === "returned") item.exception = body.note?.trim() || null;
      touch(item);
      return HttpResponse.json(toPartnerShipmentDto(item, found.permissions));
    }),
  ),

  // partner.shipments.recordPod: photos, receiver, signature and the delivered pieces per destination (D-013, D-021).
  http.post("*/v1/partner/shipments/:shipmentId/proof-of-delivery", ({ request, params }) =>
    once(request, `shipment-pod:${String(params.shipmentId)}`, async () => {
      const found = tripFor(request, params.shipmentId, perm.manage);
      if (found instanceof Response) return found;
      const { item } = found;
      const body = (await request.json().catch(() => null)) as Schemas["RecordPodDto"] | null;
      if (!body?.receiverName?.trim()) return invalid("receiverName", "ระบุชื่อผู้รับ");
      if (item.pod) return invalidStatus("บันทึกหลักฐานการส่งมอบไปแล้ว");
      if (!(MOVING.includes(item.status) || item.status === "ready"))
        return invalidStatus("บันทึกการส่งมอบได้เมื่อของพร้อมส่งหรือออกจากโรงงานแล้ว");
      if (item.status === "ready") {
        const held = gate(item);
        if (held) return held;
      }
      // A factory delivery needs at least one photo and the receiver's signature (D-013).
      if (!body.photoFileIds?.length || !body.signatureFileId)
        return problem(409, "shipments.pod_required", "ต้องมีรูปการส่งมอบและลายเซ็นผู้รับ");
      if (![...body.photoFileIds, body.signatureFileId].every((id) => files.has(id)))
        return problem(422, "artwork.file_not_usable", "ไม่พบไฟล์ที่อัปโหลด");
      const delivered = new Map((body.items ?? []).map((line) => [line.destinationId, line.deliveredQuantity]));
      if (
        item.items.some((line) => {
          const quantity = delivered.get(line.destinationId);
          return quantity === undefined || !Number.isInteger(quantity) || quantity < 0;
        })
      )
        return problem(422, "shipments.delivered_quantity_invalid", "ระบุจำนวนที่ส่งมอบของทุกปลายทาง");
      const capturedAt = body.capturedAt ?? now();
      for (const line of item.items) line.deliveredQuantity = delivered.get(line.destinationId)!;
      item.pod = {
        kind: "factory_photo_signature",
        receiverName: body.receiverName.trim(),
        deliveredQuantity: item.items.reduce((total, line) => total + (line.deliveredQuantity ?? 0), 0),
        capturedAt,
        photoIds: [...body.photoFileIds],
        signatureId: body.signatureFileId,
        review: "pending",
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
      };
      addEvent(item, "delivered", "factory", `ผู้รับ: ${body.receiverName.trim()}`);
      item.status = "delivered";
      touch(item);
      return HttpResponse.json(toPartnerShipmentDto(item, found.permissions), { status: 201 });
    }),
  ),

  // partner.files.download for the trip's labels, packing list and seeded POD photos; anything else falls through.
  http.get("*/v1/partner/files/:fileId/download", ({ request, params }) => {
    const url = shipmentFileUrl(String(params.fileId));
    if (!url || mine(request) instanceof Response) return undefined;
    return HttpResponse.json({ url, expiresAt: bangkokIso(5) } satisfies Schemas["DownloadUrlDto"]);
  }),
];
