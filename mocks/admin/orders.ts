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
import { companyStores } from "./companies";
import { lineSummaryOf } from "./catalog";
import { toAdminJobDto } from "./production";
import {
  ARTWORK_STATUS,
  INSTALMENT_STATUS,
  ORDER_GROUP_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  SLIP_STATUS,
} from "@/domain/status";
import { statusLabels } from "../status-labels";

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

/* ------------------------------------------------------------------------------ next actions */

const PRE_PRODUCTION = ["waiting_payment", "paid_for_production", "artwork_approved"];

/** The facts packio-api's order action guards read (`OrderFacts`, `src/modules/orders/order-actions.ts`). */
function factsOf(order: MockOrder) {
  return {
    status: order.status,
    artworkStatus: order.artwork.status,
    productionStarted: order.jobs.length > 0 || ["in_production", "shipping", "completed"].includes(order.status),
    paidForProduction: order.status !== "waiting_payment" && order.payments.some((p) => p.status === "succeeded"),
    cancelled: order.cancelledAt !== null || order.status === "cancelled",
    completed: order.status === "completed",
    hasAddOns: order.lines.some((line) => line.lineType === "extra_revision" || line.lineType === "mockup"),
    hasMockup: order.mockupOption !== "none" || order.lines.some((line) => line.lineType === "mockup"),
    discounted: order.discountAmount !== "0.00",
  };
}

type ActionRule = {
  key: string;
  permissions: string[];
  irreversible?: boolean;
  /** `true` offers it, `false` hides it, a string offers it disabled with that reason (a message key). */
  when: (facts: ReturnType<typeof factsOf>) => boolean | string;
};

/** packio-api's `ADMIN_ORDER_ACTIONS` at v0.6.0, in its order (D-051, D-060, D-073, D-074). */
const ADMIN_ORDER_ACTIONS: ActionRule[] = [
  {
    key: "order.start_production",
    permissions: ["production.start_manual"],
    irreversible: true,
    when: (o) => !o.productionStarted && !o.cancelled && o.paidForProduction,
  },
  {
    key: "order.submit_artwork",
    permissions: ["artwork.submit_on_behalf"],
    when: (o) => PRE_PRODUCTION.includes(o.status) && o.artworkStatus !== "approved",
  },
  { key: "order.add_mockup", permissions: ["mockups.manage"], when: (o) => !o.hasMockup },
  {
    key: "order.reprice",
    permissions: ["orders.reprice"],
    when: (o) =>
      PRE_PRODUCTION.includes(o.status) &&
      !o.productionStarted &&
      (o.hasAddOns ? "order.reprice_has_add_ons" : o.discounted ? "order.reprice_has_discounts" : true),
  },
  {
    key: "order.cancel",
    permissions: ["orders.cancel"],
    irreversible: true,
    when: (o) => !o.cancelled && !o.completed && !o.productionStarted,
  },
];

/** What packio-api offers this reader on this order: the rule's own state check and its permissions. */
export function adminOrderActionsOf(order: MockOrder, who: StaffPersona | null): Schemas["NextActionDto"][] {
  const facts = factsOf(order);
  return ADMIN_ORDER_ACTIONS.flatMap((rule) => {
    if (!who || !rule.permissions.every((permission) => can(who, permission))) return [];
    const verdict = rule.when(facts);
    if (verdict === false) return [];
    return [
      {
        key: rule.key,
        irreversible: rule.irreversible ?? false,
        disabledReason: typeof verdict === "string" ? verdict : null,
      },
    ];
  });
}

/** The rule a write is guarded by: the same check the offered action came from. */
const offered = (order: MockOrder, who: StaffPersona, key: string) =>
  adminOrderActionsOf(order, who).some((action) => action.key === key && !action.disabledReason);

/**
 * An optional `Idempotency-Key` (the order desk's writes, v0.5.0): a replay of the same key answers
 * what the first call did, with `Idempotent-Replayed`.
 */
const replays = new Map<string, { status: number; body: unknown }>();
async function replayable(request: Request, run: () => Promise<Response> | Response): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  const scoped = key ? `${new URL(request.url).pathname} ${key}` : null;
  const seen = scoped ? replays.get(scoped) : undefined;
  if (seen)
    return seen.status === 204
      ? new HttpResponse(null, { status: 204, headers: { "Idempotent-Replayed": "true" } })
      : HttpResponse.json(seen.body as never, { status: seen.status, headers: { "Idempotent-Replayed": "true" } });
  const response = await run();
  if (scoped && response.ok)
    replays.set(scoped, {
      status: response.status,
      body: response.status === 204 ? null : await response.clone().json(),
    });
  return response;
}

/* ------------------------------------------------------------------------------------- DTOs */

/** The lean staff order: the storefront's `OrderDto` plus `internal`, masked by D-141. */
export function toAdminOrderDto(order: MockOrder, who: StaffPersona | null): Schemas["AdminOrderDto"] {
  const seesCost = Boolean(who && can(who, "factory_buy_prices.read"));
  const seesMargin = Boolean(who && can(who, "margin.read"));
  const base = toOrderDto(order);
  return {
    ...base,
    // The spec in words, from the row's own lines when the shared adapter leaves it empty.
    summary:
      base.summary.specs.length > 0
        ? base.summary
        : {
            ...base.summary,
            specs: order.specs.map((spec, index) => ({
              key: `spec_${index + 1}`,
              labelTh: spec.label,
              labelEn: spec.label,
              valueTh: spec.value,
              valueEn: spec.value,
            })),
          },
    ...(cancelledWith.has(order.id)
      ? {
          cancelReasonCode: cancelledWith.get(order.id)!.code,
          cancelReasonNameTh: cancelledWith.get(order.id)!.nameTh,
          cancelReasonNameEn: cancelledWith.get(order.id)!.nameEn,
        }
      : {}),
    nextActions: adminOrderActionsOf(order, who),
    internal: {
      buyCostNet: seesCost ? (order.margin?.buyCostNet ?? null) : null,
      buyPriceNet: seesCost ? (order.margin?.buyCostNet ?? null) : null,
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
    ...statusLabels("status", ORDER_GROUP_STATUS, first.group.status),
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
      ...statusLabels("status", INSTALMENT_STATUS, item.status),
      allocations: [
        { orderId: order.id, orderCode: order.orderCode, grossAmount: item.grossAmount, cashAmount: item.grossAmount },
      ],
    })),
  };
}

function toTimelineEntry(entry: ReturnType<typeof timelineOf>[number]): Schemas["StaffTimelineEntryDto"] {
  // A production step names itself; packio-api sends it as `production.milestone_reached`.
  const milestone = entry.kind === "milestone.completed";
  return {
    id: entry.id,
    occurredAt: entry.at,
    type: milestone ? "production.milestone_reached" : entry.kind,
    messageKey: milestone ? "timeline.production.milestone_reached" : `timeline.${entry.kind}`,
    params: milestone ? { labelTh: entry.title, labelEn: entry.title } : {},
    // D-313: the API words each entry for staff; the mock's own Thai title, in both languages.
    messageTh: entry.title,
    messageEn: entry.title,
    count: 1,
    body: entry.detail,
    source: milestone ? "production_job" : "order",
    visibility: entry.visibility === "customer" ? ["customer", "internal"] : [entry.visibility],
    actor: entry.actor ? { type: "user", displayName: entry.actor.displayName } : { type: "system", displayName: null },
    mentions: [],
    photoFileIds: [],
    shipment: null,
    // When the factory's plan had the step due (D-075): promised against actual.
    promisedAt: entry.promisedAt,
  };
}

/** The customers a company's orders come from: its members (D-120). */
const companyOrders = (companyId: string) =>
  new Set(
    companyStores
      .find((store) => store.company.id === companyId)
      ?.members.filter((member) => member.status !== "removed")
      .map((member) => member.user.id) ?? [],
  );

/** A row of `admin.orders.list`: refs, the group's next unpaid instalment and a slip waiting for Finance. */
function toListItem(order: MockOrder, who: StaffPersona | null): Schemas["AdminOrderListItemDto"] {
  const next = order.instalments.find((item) => !["paid", "cancelled", "refunded"].includes(item.status)) ?? null;
  const waiting = order.payments.flatMap((payment) =>
    payment.slips.filter((slip) => slip.verificationStatus === "manual_review"),
  );
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    groupId: order.groupId,
    groupCode: order.groupCode,
    channel: order.channel,
    customer: { ...order.customer },
    // Staff only (D-050): the factory the order went to, once it has one.
    factory: who && order.factory ? { id: order.factory.id, code: order.factory.code, name: order.factory.name } : null,
    productTypeCode: order.productType.code,
    quantity: order.quantity,
    unit: lineSummaryOf(order.productType.code).unit,
    grossAmount: order.grossAmount,
    currency: "THB",
    status: order.status,
    ...statusLabels("status", ORDER_STATUS, order.status),
    artworkStatus: order.artwork.status,
    ...statusLabels("artworkStatus", ARTWORK_STATUS, order.artwork.status),
    nextInstalment: next
      ? {
          seq: next.seq,
          dueAt: next.dueAt,
          openAmount: (Math.round((Number(next.grossAmount) - Number(next.paidAmount)) * 100) / 100).toFixed(2),
        }
      : null,
    hasSlipToReview: waiting.length > 0,
    slipReviewDueAt:
      waiting
        .map((slip) => slip.slaDueAt)
        .filter((at): at is string => Boolean(at))
        .sort()[0] ?? null,
    promisedShipDate: order.promisedShipDate,
    placedAt: order.createdAt,
  };
}

/** packio-api's seeded `order_cancel_reasons` (D-060), as `admin.orders.listCancelReasons` answers them. */
export const CANCEL_REASONS: Schemas["CancelReasonDto"][] = [
  {
    code: "customer_request",
    nameTh: "ลูกค้าขอยกเลิก",
    nameEn: "Customer asked to cancel",
    appliesTo: "staff",
    requiresCreditNote: false,
  },
  {
    code: "payment_expired",
    nameTh: "เกินกำหนดชำระเงิน",
    nameEn: "Payment window expired",
    appliesTo: "system",
    requiresCreditNote: false,
  },
  {
    code: "cannot_produce",
    nameTh: "โรงงานผลิตไม่ได้ตามสเปก",
    nameEn: "Cannot be produced to spec",
    appliesTo: "staff",
    requiresCreditNote: true,
  },
  {
    code: "duplicate",
    nameTh: "คำสั่งซื้อซ้ำ",
    nameEn: "Duplicate order",
    appliesTo: "staff",
    requiresCreditNote: false,
  },
  {
    code: "changed_mind",
    nameTh: "เปลี่ยนใจ",
    nameEn: "Changed my mind",
    appliesTo: "customer",
    requiresCreditNote: false,
  },
];

/** The reason each order was cancelled with on this desk, by order id (the rows keep the name only). */
const cancelledWith = new Map<string, Schemas["CancelReasonDto"]>();

/** When each group was last reminded: one reminder per group per hour (v0.5.0). */
const remindedAt = new Map<string, number>();

/** `admin.orders.sendPaymentReminder`'s checks: something due, and no reminder in the last hour. */
function reminderRefusal(order: MockOrder): "payments.nothing_due" | "payments.reminder_recent" | null {
  const due = order.instalments.some((item) => ["due", "overdue", "partially_paid"].includes(item.status));
  if (!due || order.status === "cancelled") return "payments.nothing_due";
  const last = remindedAt.get(order.groupId);
  if (last && Date.now() - last < 60 * 60 * 1000) return "payments.reminder_recent";
  return null;
}

const REMINDER_REFUSALS = {
  "payments.nothing_due": "ไม่มีงวดที่ถึงกำหนดชำระ",
  "payments.reminder_recent": "เพิ่งส่งข้อความเตือนไปเมื่อไม่ถึงหนึ่งชั่วโมงที่แล้ว",
} as const;

function remind(order: MockOrder, who: StaffPersona) {
  remindedAt.set(order.groupId, Date.now());
  logEvent(order, "payment.reminder_sent", "ส่งข้อความเตือนชำระเงิน", { id: who.id, displayName: who.displayName });
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
        ...statusLabels("status", ORDER_STATUS, order.status),
        artworkStatus: order.artworkStatus,
        ...statusLabels("artworkStatus", ARTWORK_STATUS, order.artworkStatus),
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

  // admin.orders.list: every order, newest placed first, with the desk's filters (v0.5.0).
  http.get("*/v1/admin/orders", ({ request }) => {
    const who = allowed(request, "orders.read");
    if (!who) return forbidden();
    const url = new URL(request.url);
    const get = (name: string) => url.searchParams.get(name);
    const q = get("q")?.toUpperCase();
    const from = get("placedFrom");
    const to = get("placedTo");
    const companyId = get("companyId");
    const rows = orders
      .filter((order) => !get("status") || order.status === get("status"))
      .filter((order) => !get("artworkStatus") || order.artwork.status === get("artworkStatus"))
      .filter((order) => !get("channel") || order.channel === get("channel"))
      .filter((order) => !get("productTypeCode") || order.productType.code === get("productTypeCode"))
      .filter((order) => !get("factoryId") || order.factory?.id === get("factoryId"))
      .filter((order) => !get("customerId") || order.customer.id === get("customerId"))
      // A company's orders are those its members placed (D-120): the mock's B2B company is customer 2's.
      .filter((order) => !companyId || companyOrders(companyId).has(order.customer.id))
      .filter((order) => !from || order.createdAt.slice(0, 10) >= from)
      .filter((order) => !to || order.createdAt.slice(0, 10) <= to)
      // `q` is a prefix of the order or group code.
      .filter((order) => !q || order.orderCode.startsWith(q) || order.groupCode.startsWith(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((order) => toListItem(order, who));
    const sort = get("sort");
    return HttpResponse.json(
      paginate(sort ? sortBy(rows, sort, (get("order") as "asc" | "desc" | null) ?? "desc") : rows, pageOf(url)),
    );
  }),

  http.get("*/v1/admin/order-cancel-reasons", ({ request }) => {
    if (!allowed(request, "orders.read")) return forbidden();
    const appliesTo = new URL(request.url).searchParams.get("appliesTo");
    return HttpResponse.json(CANCEL_REASONS.filter((reason) => !appliesTo || reason.appliesTo === appliesTo));
  }),

  http.post("*/v1/admin/orders/actions/send-payment-reminders", ({ request }) =>
    replayable(request, async () => {
      const who = allowed(request, "orders.manage");
      if (!who) return forbidden();
      const body = (await request.json().catch(() => null)) as Schemas["BulkPaymentReminderDto"] | null;
      if (!body?.orderIds?.length || body.orderIds.length > 100)
        return problem(422, "validation.failed", "เลือกคำสั่งซื้อ 1–100 รายการ");
      const result: Schemas["PaymentReminderResultDto"] = { sent: 0, skipped: [] };
      for (const orderId of body.orderIds) {
        const order = find(orderId);
        const refusal = order ? reminderRefusal(order) : "http.not_found";
        if (order && !refusal) {
          remind(order, who);
          result.sent += 1;
        } else result.skipped.push({ orderId, reason: refusal ?? "http.not_found" });
      }
      return HttpResponse.json(result);
    }),
  ),

  http.post("*/v1/admin/orders/:orderId/actions/send-payment-reminder", ({ params, request }) =>
    replayable(request, () => {
      const who = allowed(request, "orders.manage");
      if (!who) return forbidden();
      const order = find(params.orderId as string);
      if (!order) return notFound();
      const refusal = reminderRefusal(order);
      if (refusal) return problem(409, refusal, REMINDER_REFUSALS[refusal]);
      remind(order, who);
      return new HttpResponse(null, { status: 204 });
    }),
  ),

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

  http.post("*/v1/admin/orders/:orderId/actions/cancel", ({ params, request }) =>
    replayable(request, async () => {
      const who = allowed(request, "orders.cancel");
      if (!who) return forbidden();
      const order = find(params.orderId as string);
      if (!order) return notFound();
      const body = (await request.json().catch(() => null)) as Schemas["CancelOrderDto"] | null;
      const reason = CANCEL_REASONS.find((candidate) => candidate.code === body?.reasonCode);
      if (!reason) return problem(422, "validation.failed", "เลือกเหตุผลก่อน");
      if (!offered(order, who, "order.cancel"))
        return problem(409, "order.invalid_transition", "ยกเลิกคำสั่งซื้อที่เริ่มผลิตแล้วไม่ได้");
      Object.assign(order, {
        status: "cancelled",
        cancelledAt: bangkokIso(),
        cancelReason: reason.nameTh,
        hasSlipToReview: false,
        slaDueAt: null,
      });
      cancelledWith.set(order.id, reason);
      order.group.status = "cancelled";
      logEvent(
        order,
        "order.cancelled",
        "ยกเลิกคำสั่งซื้อ",
        { id: who.id, displayName: who.displayName },
        body?.note ?? reason.nameTh,
      );
      refreshOrder(order);
      return HttpResponse.json(toAdminOrderDto(order, who));
    }),
  ),

  http.post("*/v1/admin/orders/:orderId/actions/start-production", ({ params, request }) =>
    replayable(request, async () => {
      const who = allowed(request, "production.start_manual");
      if (!who) return forbidden();
      const order = find(params.orderId as string);
      if (!order) return notFound();
      const body = (await request.json().catch(() => null)) as Schemas["StartProductionDto"] | null;
      if (!body?.reason || body.reason.trim().length < 3) return problem(422, "validation.failed", "ระบุเหตุผล");
      if (!offered(order, who, "order.start_production"))
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
      return HttpResponse.json(toAdminJobDto(order, order.jobs[0]!, who));
    }),
  ),

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
    ...statusLabels("status", PAYMENT_STATUS, payment.status),
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
      ...statusLabels("status", SLIP_STATUS, slip.verificationStatus),
      lastCheck: null,
      slaDueAt: slip.slaDueAt,
      createdAt: slip.uploadedAt,
    })),
  };
}
