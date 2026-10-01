/**
 * The order desk on the published contract (U-F0.3): the queues, the lean order, groups and their
 * payment schedule, the staff timeline and notes, cancel and manual start, CS recording a slip, and
 * each order's production jobs. Its artwork submissions and proofs are the prepress desk's
 * (`./artwork.ts`), the one stateful source of artwork.
 *
 * The rows are the fake commerce orders (`./commerce`), the same ones the storefront, finance and
 * logistics mocks read, so a change made here is one every screen sees. Each handler turns a row
 * into the contract's DTO on the way out (`../store/order-dto.ts` for the order itself).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { toOrderDto } from "../store/order-dto";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";
import {
  customers,
  FACTORY,
  find,
  logEvent,
  notes,
  orders,
  QUEUES,
  refreshOrder,
  slipUploadedBy,
  timelineOf,
} from "./commerce";
import type { MockOrder } from "./commerce";
import { inspections } from "./governance";

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const notFound = () => problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");

const pageOf = (url: URL) => ({
  page: Number(url.searchParams.get("page") ?? 1),
  perPage: Number(url.searchParams.get("perPage") ?? 25),
});

function allowed(request: Request, permission: string): StaffPersona | null {
  const who = staffPersonaOf(request);
  return who && can(who, permission) ? who : null;
}

/** The lean staff order: the storefront's `OrderDto` plus `internal`, masked by D-141. */
export function toAdminOrderDto(order: MockOrder, who: StaffPersona | null): Schemas["AdminOrderDto"] {
  const seesCost = Boolean(who && can(who, "factory_cost.read"));
  const seesMargin = Boolean(who && can(who, "margin.read"));
  return {
    ...toOrderDto(order),
    internal: {
      buyCostNet: seesCost ? (order.margin?.buyCostNet ?? null) : null,
      marginAmount: seesMargin ? (order.margin?.marginAmount ?? null) : null,
      marginPct: seesMargin ? (order.margin?.marginPct ?? null) : null,
      belowMarginFloor: order.margin?.belowMarginFloor ?? false,
      selectedFactoryId: order.factory?.id ?? null,
    },
  };
}

function membersOf(groupId: string) {
  return orders.filter((order) => order.groupId === groupId);
}

export function toGroupDto(groupId: string, who: StaffPersona | null): Schemas["AdminOrderGroupDto"] | null {
  const members = membersOf(groupId);
  const first = members[0];
  if (!first) return null;
  const dtos = members.map((order) => toAdminOrderDto(order, who));
  const cs = PERSONAS.find((persona) => persona.key === "cs")!;
  const placedBy =
    first.channel === "cs"
      ? { id: cs.id, displayName: cs.displayName }
      : { id: first.customer.id, displayName: first.customer.displayName };
  const sum = (pick: (dto: Schemas["AdminOrderDto"]) => string) =>
    (dtos.reduce((total, dto) => total + Math.round(Number(pick(dto)) * 100), 0) / 100).toFixed(2);
  return {
    id: first.groupId,
    groupCode: first.groupCode,
    status: first.group.status,
    channel: first.channel,
    customerId: first.customer.id,
    customer: { ...first.customer },
    placedById: placedBy.id,
    placedBy,
    hasSlipToReview: members.some((order) =>
      order.payments.some((payment) => payment.slips.some((slip) => slip.verificationStatus === "manual_review")),
    ),
    // The tax profile as the order row keeps it.
    taxProfile: first.taxProfile
      ? {
          name: first.taxProfile.name,
          taxId: first.taxProfile.taxId,
          branchCode: first.taxProfile.branch,
          address: first.taxProfile.address,
          withholdsTax: first.taxProfile.withholdsTax,
        }
      : null,
    placedAt: first.createdAt,
    poNumber: first.poNumber,
    ccEmails: first.ccEmails,
    csRemarks: first.csRemarks,
    expiresAt: first.expiresAt,
    cancelledAt: first.cancelledAt,
    utm: null,
    orders: dtos,
    totals: {
      netAmount: sum((dto) => dto.totals.netAmount),
      discountAmount: sum((dto) => dto.totals.discountAmount),
      shippingNetAmount: sum((dto) => dto.totals.shippingNetAmount),
      vatAmount: sum((dto) => dto.totals.vatAmount),
      grossAmount: sum((dto) => dto.totals.grossAmount),
      whtAmount: "0.00",
      cashAmount: sum((dto) => dto.totals.cashAmount),
      currency: "THB",
    },
  };
}

function toSchedule(order: MockOrder): Schemas["AdminPaymentScheduleDto"] {
  const open = order.instalments.filter((item) => item.status !== "paid" && item.status !== "cancelled");
  const openSatang = open.reduce(
    (sum, item) => sum + Math.round((Number(item.grossAmount) - Number(item.paidAmount)) * 100),
    0,
  );
  const paidBefore = (gate: "production" | "shipping") =>
    order.instalments.filter((item) => item.requiredBefore === gate).every((item) => item.status === "paid");
  return {
    id: mockId("sch", Number.parseInt(order.groupId.slice(-6), 16) % 0x10000),
    templateKey: order.instalments.length > 1 ? "deposit_50_before_shipping_50" : "full_upfront",
    templateNameTh: order.instalments.length > 1 ? "มัดจำ 50% ส่วนที่เหลือก่อนจัดส่ง" : "ชำระเต็มจำนวน",
    templateNameEn: order.instalments.length > 1 ? "50 % deposit, 50 % before shipping" : "Paid in full",
    isOverride: false,
    overrideReason: null,
    openAmount: (openSatang / 100).toFixed(2),
    productionGateOpen: paidBefore("production"),
    shippingGateOpen: paidBefore("shipping"),
    instalments: order.instalments.map((item) => ({
      id: item.id,
      seq: item.seq,
      labelTh: item.label,
      labelEn: item.label,
      pct: order.instalments.length > 1 ? "50.0000" : "100.0000",
      dueTrigger: item.dueTrigger,
      requiredBefore: item.requiredBefore,
      dueAt: item.dueAt,
      grossAmount: item.grossAmount,
      cashAmount: item.grossAmount,
      whtAmount: "0.00",
      paidAmount: item.paidAmount,
      openAmount: (Math.round((Number(item.grossAmount) - Number(item.paidAmount)) * 100) / 100).toFixed(2),
      paidAt: item.status === "paid" ? order.createdAt : null,
      status: item.status,
      allocations: [
        { orderId: order.id, orderCode: order.orderCode, grossAmount: item.grossAmount, cashAmount: item.grossAmount },
      ],
    })),
  };
}

function toTimelineEntry(entry: ReturnType<typeof timelineOf>[number]): Schemas["StaffTimelineEntryDto"] {
  return {
    id: entry.id,
    occurredAt: entry.at,
    type: entry.kind,
    messageKey: `timeline.${entry.kind}`,
    params: {},
    body: entry.detail,
    source: "order",
    visibility: entry.visibility === "customer" ? ["customer", "internal"] : [entry.visibility],
    actor: entry.actor ? { type: "user", displayName: entry.actor.displayName } : { type: "system", displayName: null },
    mentions: [],
    photoFileIds: [],
    shipment: null,
    // The mock keeps no factory plan dates (D-075).
    promisedAt: null,
  };
}

function toJobDto(order: MockOrder, job: MockOrder["jobs"][number]): Schemas["AdminJobDto"] {
  const factory = job.factory ?? FACTORY;
  const proof = order.artwork.proofs.find((candidate) => candidate.status === "approved");
  const inspection = inspections.find((candidate) => candidate.job.id === job.id);
  return {
    id: job.id,
    jobNo: job.jobNo,
    kind: job.kind,
    status: job.status,
    orderId: order.id,
    orderCode: order.orderCode,
    productTypeCode: order.productType.code,
    productTypeNameTh: order.productType.name,
    title: `${order.productType.name} · ${order.quantity.toLocaleString("th-TH")} ชิ้น`,
    tolerance: { ...order.tolerance },
    artwork: proof ? { proofId: proof.id, versionNo: proof.versionNo, approvedAt: proof.decidedAt } : null,
    inspection: inspection
      ? {
          status: inspection.status,
          sampleSize: inspection.sampleSize,
          scheduledAt: inspection.scheduledAt,
          resultAt: inspection.resultAt,
        }
      : null,
    currentMilestoneKey:
      job.milestones.find((step) => step.status !== "completed" && step.status !== "skipped")?.key ?? null,
    // At risk means the plan already ends after the promise (`predictedFinishOn` below).
    riskReason: job.atRisk ? "late_plan" : null,
    nextActions: [],
    factoryId: factory.id,
    factoryCode: factory.code,
    releaseMode: order.startMode ?? "auto",
    releaseReason: null,
    releasedAt: order.createdAt,
    acceptDueAt: job.acceptDueAt ?? bangkokIso(60 * 24),
    acceptedAt: job.status === "released" ? null : order.createdAt,
    rejectedAt: null,
    rejectReasonCode: null,
    rejectNote: null,
    escalatedAt: null,
    holdReason: null,
    atRisk: job.atRisk,
    promisedShipDate: job.promisedShipDate,
    plannedStartOn: null,
    plannedFinishOn: job.promisedShipDate,
    // The SLA engine's predicted finish, past the promise when the job is at risk (D-075).
    predictedFinishOn: job.atRisk ? bangkokIso(60 * 24 * 3).slice(0, 10) : null,
    quantityOrdered: order.quantity,
    quantityGood: null,
    quantityScrap: null,
    lotNo: null,
    buyCostNet: null,
    // Packio inspects by value (D-076); the mock's inspections are on these jobs (`./governance.ts`).
    inspectionRequired: Number(order.grossAmount) >= 100_000,
    inspectionReasons: Number(order.grossAmount) >= 100_000 ? ["value_band_sample"] : [],
    approvedFileId: null,
    dielineFileId: null,
    spec: { productTypeCode: order.productType.code, quantity: order.quantity },
    destinations: [],
    assignments: [],
    milestones: job.milestones.map((step) => ({
      id: mockId("mls", (Number.parseInt(job.id.slice(-6), 16) % 0x1000) * 16 + step.seq),
      seq: step.seq,
      key: step.key,
      nameTh: step.name,
      nameEn: step.name,
      status: step.status,
      dueAt: step.dueAt,
      startedAt: null,
      completedAt: step.completedAt,
      onTime: step.onTime,
      customerVisible: true,
      evidence: "none",
      note: null,
      photoFileIds: [],
      tracksQuantity: false,
      quantityIn: null,
      quantityOut: null,
      quantityScrap: null,
    })),
  };
}

export const orderHandlers = [
  http.get("*/v1/admin/order-queues/:queue", ({ params, request }) => {
    if (!allowed(request, "orders.read")) return forbidden();
    const inQueue = QUEUES[params.queue as string];
    if (!inQueue) return problem(422, "validation.failed", "ไม่รู้จักคิวนี้");
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const rows: Schemas["OrderQueueItemDto"][] = orders
      .filter(inQueue)
      .filter((order) => matchesQuery(q, order.orderCode, order.groupCode, order.customer.displayName))
      .map((order) => ({
        orderId: order.id,
        orderCode: order.orderCode,
        groupId: order.groupId,
        groupCode: order.groupCode,
        groupExpiresAt: order.expiresAt,
        customerName: order.customer.displayName,
        productTypeCode: order.productType.code,
        status: order.status,
        artworkStatus: order.artworkStatus,
        grossAmount: order.grossAmount,
        promisedShipDate: order.promisedShipDate,
        placedAt: order.createdAt,
      }));
    // waiting_payment is oldest first; the rest newest first unless the desk sorts.
    const sort = url.searchParams.get("sort") ?? "placedAt";
    const order =
      (url.searchParams.get("order") as "asc" | "desc" | null) ?? (params.queue === "waiting_payment" ? "asc" : "desc");
    return HttpResponse.json(paginate(sortBy(rows, sort, order), pageOf(url)));
  }),

  http.get("*/v1/admin/orders/:orderId", ({ params, request }) => {
    const who = allowed(request, "orders.read");
    if (!who) return forbidden();
    const order = find(params.orderId as string);
    return order ? HttpResponse.json(toAdminOrderDto(order, who)) : notFound();
  }),

  http.get("*/v1/admin/order-groups", ({ request }) => {
    const who = allowed(request, "orders.read");
    if (!who) return forbidden();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const status = url.searchParams.get("status");
    const ids = [...new Set(orders.map((order) => order.groupId))];
    const rows = ids
      .map((id) => toGroupDto(id, who)!)
      .filter((group) => !status || group.status === status)
      .filter((group) => {
        const customer = customers.find((candidate) => candidate.id === group.customerId);
        return matchesQuery(
          q,
          group.groupCode,
          customer?.customerCode,
          ...group.orders.map((order) => order.orderCode),
        );
      })
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),

  http.get("*/v1/admin/order-groups/:groupId", ({ params, request }) => {
    const who = allowed(request, "orders.read");
    if (!who) return forbidden();
    const group = toGroupDto(params.groupId as string, who);
    return group ? HttpResponse.json(group) : problem(404, "http.not_found", "ไม่พบกลุ่มคำสั่งซื้อนี้");
  }),

  http.get("*/v1/admin/order-groups/:groupId/payment-schedule", ({ params, request }) => {
    if (!allowed(request, "orders.read")) return forbidden();
    const first = membersOf(params.groupId as string)[0];
    return first ? HttpResponse.json(toSchedule(first)) : problem(404, "http.not_found", "ไม่พบกลุ่มคำสั่งซื้อนี้");
  }),

  http.get("*/v1/admin/orders/:orderId/timeline", ({ params, request }) => {
    if (!allowed(request, "orders.read")) return forbidden();
    const order = find(params.orderId as string);
    if (!order) return notFound();
    const url = new URL(request.url);
    const all = timelineOf(order).map(toTimelineEntry);
    const start = Number(url.searchParams.get("cursor") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    return HttpResponse.json({
      data: all.slice(start, start + limit),
      meta: { nextCursor: start + limit < all.length ? String(start + limit) : null },
    });
  }),

  http.get("*/v1/admin/orders/:orderId/notes", ({ params, request }) => {
    if (!allowed(request, "orders.read")) return forbidden();
    const rows: Schemas["OrderNoteDto"][] = [...(notes.get(params.orderId as string) ?? [])]
      .reverse()
      .map(({ id, author, body, mentions, createdAt }) => ({ id, author, body, mentions, createdAt }));
    return HttpResponse.json(paginate(rows, pageOf(new URL(request.url))));
  }),

  http.post("*/v1/admin/orders/:orderId/notes", async ({ params, request }) => {
    const who = allowed(request, "orders.manage");
    if (!who) return forbidden();
    const orderId = params.orderId as string;
    if (!find(orderId)) return notFound();
    const body = (await request.json().catch(() => null)) as Schemas["AddOrderNoteDto"] | null;
    if (!body?.body?.trim()) return problem(422, "validation.failed", "เขียนบันทึกก่อน");
    const note = {
      id: mockId("not", (notes.get(orderId)?.length ?? 0) + 1 + Math.floor(Math.random() * 1e5)),
      author: { id: who.id, displayName: who.displayName },
      body: body.body,
      mentions: (body.mentions ?? [])
        .map((id) => PERSONAS.find((persona) => persona.id === id))
        .filter((persona): persona is StaffPersona => Boolean(persona))
        .map((persona) => ({ id: persona.id, displayName: persona.displayName })),
      createdAt: bangkokIso(),
    };
    notes.set(orderId, [...(notes.get(orderId) ?? []), note]);
    const dto: Schemas["OrderNoteDto"] = {
      id: note.id,
      author: note.author,
      body: note.body,
      mentions: note.mentions,
      createdAt: note.createdAt,
    };
    return HttpResponse.json(dto, { status: 201 });
  }),

  http.post("*/v1/admin/orders/:orderId/actions/cancel", async ({ params, request }) => {
    const who = allowed(request, "orders.cancel");
    if (!who) return forbidden();
    const order = find(params.orderId as string);
    if (!order) return notFound();
    const body = (await request.json().catch(() => null)) as Schemas["CancelOrderDto"] | null;
    if (!body?.reasonCode) return problem(422, "validation.failed", "เลือกเหตุผลก่อน");
    if (!["waiting_payment", "paid_for_production", "artwork_approved"].includes(order.status))
      return problem(409, "order.invalid_transition", "ยกเลิกคำสั่งซื้อที่เริ่มผลิตแล้วไม่ได้");
    Object.assign(order, {
      status: "cancelled",
      cancelledAt: bangkokIso(),
      cancelReason: body.note ?? body.reasonCode,
      hasSlipToReview: false,
      slaDueAt: null,
    });
    order.group.status = "cancelled";
    logEvent(
      order,
      "order.cancelled",
      "ยกเลิกคำสั่งซื้อ",
      { id: who.id, displayName: who.displayName },
      body.note ?? body.reasonCode,
    );
    refreshOrder(order);
    return HttpResponse.json(toAdminOrderDto(order, who));
  }),

  http.post("*/v1/admin/orders/:orderId/actions/start-production", async ({ params, request }) => {
    const who = allowed(request, "production.start_manual");
    if (!who) return forbidden();
    const order = find(params.orderId as string);
    if (!order) return notFound();
    const body = (await request.json().catch(() => null)) as Schemas["StartProductionDto"] | null;
    if (!body?.reason || body.reason.trim().length < 3) return problem(422, "validation.failed", "ระบุเหตุผล");
    if (!["paid_for_production", "artwork_approved"].includes(order.status))
      return problem(409, "order.invalid_transition", "คำสั่งซื้อนี้เริ่มผลิตไม่ได้ในสถานะปัจจุบัน");
    order.status = "in_production";
    order.startMode = "manual_exception";
    order.confirmedProductionDate = bangkokIso().slice(0, 10);
    order.jobs = [
      {
        id: mockId("job", 900 + orders.indexOf(order)),
        jobNo: `J-2569-${String(900 + orders.indexOf(order))}`,
        kind: "production",
        factory: FACTORY,
        status: "released",
        acceptDueAt: bangkokIso(60 * 24),
        promisedShipDate: order.promisedShipDate,
        atRisk: false,
        milestones: [],
      },
    ];
    logEvent(
      order,
      "production.started_manually",
      "เริ่มผลิตด้วยมือ (กรณียกเว้น)",
      { id: who.id, displayName: who.displayName },
      body.reason,
    );
    refreshOrder(order);
    return HttpResponse.json(toJobDto(order, order.jobs[0]!));
  }),

  // CS records a slip (D-061): a bank-transfer payment for the instalments, then the slip on it.
  http.post("*/v1/admin/order-groups/:groupId/payments", async ({ params, request }) => {
    const who = allowed(request, "orders.manage");
    if (!who) return forbidden();
    if (!request.headers.get("Idempotency-Key"))
      return problem(428, "http.idempotency_key_required", "ต้องระบุ Idempotency-Key");
    const order = membersOf(params.groupId as string)[0];
    if (!order) return problem(404, "http.not_found", "ไม่พบกลุ่มคำสั่งซื้อนี้");
    const body = (await request.json().catch(() => null)) as Schemas["InitiatePaymentDto"] | null;
    const chosen = order.instalments.filter((item) => body?.instalmentIds?.includes(item.id));
    if (body?.method !== "bank_transfer_slip" || chosen.length === 0)
      return problem(422, "validation.failed", "เลือกงวดและวิธีชำระ");
    const amount = chosen.reduce((sum, item) => sum + Math.round(Number(item.grossAmount) * 100), 0);
    const payment = {
      id: mockId("pay", 700 + orders.indexOf(order) * 10 + order.payments.length),
      method: "bank_transfer_slip" as const,
      status: "awaiting_verification" as const,
      amount: (amount / 100).toFixed(2),
      feeAmount: "0.00",
      providerRef: null,
      paidAt: null,
      slips: [],
    };
    order.payments.push(payment);
    return HttpResponse.json(paymentDto(order, payment), { status: 201 });
  }),

  http.post("*/v1/admin/payments/:paymentId/slips", async ({ params, request }) => {
    const who = allowed(request, "orders.manage");
    if (!who) return forbidden();
    if (!request.headers.get("Idempotency-Key"))
      return problem(428, "http.idempotency_key_required", "ต้องระบุ Idempotency-Key");
    const order = orders.find((candidate) => candidate.payments.some((payment) => payment.id === params.paymentId));
    const payment = order?.payments.find((candidate) => candidate.id === params.paymentId);
    if (!order || !payment) return problem(404, "http.not_found", "ไม่พบการชำระเงินนี้");
    const body = (await request.json().catch(() => null)) as Schemas["UploadSlipDto"] | null;
    if (!body?.fileId || !/^\d+\.\d{2}$/.test(body.declaredAmount ?? "") || !body.transferredAt)
      return problem(422, "validation.failed", "กรอกข้อมูลสลิปให้ครบ");
    const slip = {
      id: mockId("slp", 500 + Math.floor(Math.random() * 1e5)),
      file: {
        id: body.fileId,
        originalName: "slip.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 120_000,
        thumbnailUrl: null,
        url: null,
      },
      declaredAmount: body.declaredAmount,
      declaredTransferredAt: body.transferredAt,
      verificationStatus: "manual_review" as const,
      checks: null,
      slaDueAt: bangkokIso(240),
      reviewedBy: null,
      reviewNote: null,
      uploadedAt: bangkokIso(),
    };
    payment.slips.push(slip);
    slipUploadedBy.set(slip.id, who.id);
    order.hasSlipToReview = true;
    logEvent(order, "slip.uploaded_by_cs", "CS อัปโหลดสลิปแทนลูกค้า", { id: who.id, displayName: who.displayName });
    refreshOrder(order);
    return HttpResponse.json(paymentDto(order, payment), { status: 201 });
  }),

  // admin.production.list: the order page's Production tab (`?orderId=`) and the production board
  // (`?queue=at_risk`), both from the commerce jobs.
  http.get("*/v1/admin/production-jobs", ({ request }) => {
    if (!allowed(request, "production.read")) return forbidden();
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");
    const status = url.searchParams.get("status");
    const queue = url.searchParams.get("queue");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = orders
      .filter((order) => !orderId || order.id === orderId)
      .flatMap((order) => order.jobs.map((job) => toJobDto(order, job)))
      .filter((job) => !status || job.status === status)
      .filter(
        (job) =>
          !queue ||
          (queue === "at_risk" && job.atRisk) ||
          (queue === "awaiting_acceptance" && job.status === "released") ||
          (queue === "escalated" && job.escalatedAt !== null),
      )
      .filter((job) => matchesQuery(q, job.jobNo, job.orderCode));
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),
  http.get("*/v1/admin/production-jobs/:jobId", ({ params, request }) => {
    if (!allowed(request, "production.read")) return forbidden();
    for (const order of orders) {
      const job = order.jobs.find((candidate) => candidate.id === params.jobId);
      if (job) return HttpResponse.json(toJobDto(order, job));
    }
    return problem(404, "http.not_found", "ไม่พบงานผลิตนี้");
  }),
];

/** The payment as `admin.payments.*` answers it — enough of `AdminPaymentDto` for the order desk. */
function paymentDto(order: MockOrder, payment: MockOrder["payments"][number]): Schemas["AdminPaymentDto"] {
  return {
    id: payment.id,
    groupId: order.groupId,
    method: payment.method as Schemas["PaymentMethod"],
    provider: "bank_transfer",
    providerRef: payment.providerRef,
    status: payment.status as Schemas["PaymentStatus"],
    amount: payment.amount,
    cashAmount: payment.amount,
    whtAmount: "0.00",
    feeAmount: payment.feeAmount,
    refundedAmount: "0.00",
    currency: "THB",
    referenceCode: `REF${order.orderCode.slice(-5)}${payment.id.slice(-2)}`,
    qrPayload: null,
    redirectUrl: null,
    expiresAt: null,
    failureReason: null,
    failureCode: null,
    paidAt: payment.paidAt,
    createdAt: payment.slips[0]?.uploadedAt ?? order.createdAt,
    receiverAccounts: [],
    slips: payment.slips.map((slip) => ({
      id: slip.id,
      fileId: slip.file.id,
      declaredAmount: slip.declaredAmount,
      declaredTransferredAt: slip.declaredTransferredAt,
      status: slip.verificationStatus as Schemas["SlipStatus"],
      lastCheck: null,
      slaDueAt: slip.slaDueAt,
      createdAt: slip.uploadedAt,
    })),
  };
}
