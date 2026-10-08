/**
 * After production, from the customer's side: tracking, receipt, the claim form, claims, the
 * reorder preview and the reorder, all at their published paths.
 *
 * Orders are the back office's rows (`../admin/commerce`) and claims the logistics desk's
 * (`../admin/logistics`, F2 2.8): a claim filed here is on the desk's queue, and what the desk
 * writes to the customer comes back in the thread. Liability, the factory and internal notes stay
 * behind. The public tracking page answers anyone with the token and says nothing personal.
 *
 * Reorders are re-priced by an obviously fake 3 % and become a quotation in the cart; checkout
 * (F3 3.3) places them like any other.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";
import type { StoreQuote } from "./quotes";

import { baht, orders, refreshOrder, satang, type MockOrder } from "../admin/commerce";
import {
  adoptClaim,
  claimRow,
  claimTrustFactsOf,
  customerClaimReply,
  fileCustomerClaim,
  type LogisticsClaim,
} from "../admin/logistics";
import { files } from "../admin/platform";
import { bangkokIso, paginate, problem } from "../support";
import { addToCart, edited } from "./cart";
import { customerOf, type MockCustomer } from "./customers";
import {
  claimWindowEnd,
  deliveredAt,
  orderOf,
  receipts,
  ordersOf,
  productOf,
  toProgress,
  toShipments,
  trackingTokenOf,
} from "./orders";
import { toStoreOrderDto } from "./order-dto";
import { nextQuoteId, quotesOf } from "./quotes";
import { CLAIM_STATUS, SHIPMENT_STATUS } from "@/domain/status";
import { statusLabels } from "../status-labels";

const DAY = 24 * 60;
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");

function mine(request: Request, orderId: string) {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const order = orderOf(customer, orderId);
  return order ? { customer, order } : notFound();
}

/** The contract declares an Idempotency-Key on these; the API refuses a call without one. */
function keyRequired(request: Request): Response | null {
  return request.headers.get("idempotency-key")
    ? null
    : problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้");
}

/** A delivery's status as the public page names it (a draft or a cancelled one is not shown). */
const TRACKING_OF: Partial<Record<Schemas["ShipmentStatus"], Schemas["TrackingStatus"]>> = {
  ready: "ready",
  picked_up: "picked_up",
  in_transit: "in_transit",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  failed: "failed",
  returned: "returned",
};

const isDelivered = (order: MockOrder) =>
  order.shipments.length > 0 && order.shipments.every((shipment) => shipment.status === "delivered");

/* ----------------------------------------------------------------------------------- claims */

/**
 * A desk row as the customer sees it (`StoreClaimDto`): what they filed, what the team asked for
 * and decided, what was done, and what they may do now (packio-api's `STORE_CLAIM_ACTIONS`).
 * Liability, the factory and internal notes stay behind; there is no free thread (D-225).
 */
function toClaim(row: LogisticsClaim): Schemas["StoreClaimDto"] {
  const order = orders.find((candidate) => candidate.id === row.order.id);
  const asked = row.messages.filter(
    (message) => message.audience === "customer" && message.author !== order?.customer.displayName,
  );
  return {
    ...claimTrustFactsOf(row.status),
    id: row.id,
    claimNo: row.claimNo,
    orderId: row.order.id,
    orderCode: row.order.orderCode,
    type: row.type,
    origin: row.origin,
    status: row.status,
    ...statusLabels("status", CLAIM_STATUS, row.status),
    description: row.description,
    requestedResolution: row.requestedResolution,
    claimedQuantity: row.claimedQuantity,
    claimedAmount: row.claimedAmount,
    receivedAt: row.receivedAt,
    windowEndsAt: row.windowEndsAt,
    submittedAt: row.submittedAt,
    infoRequest: row.status === "need_info" ? (asked.at(-1)?.body ?? null) : null,
    decisionNote: row.decision?.reason ?? null,
    photos: {
      product: row.evidence.productPhotos.map((photo) => photo.id),
      carton: row.evidence.cartonPhotos.map((photo) => photo.id),
    },
    resolutions: row.resolutions.map((resolution, index) => ({
      action: resolution.action,
      amount: resolution.amount,
      quantity: resolution.action === "reproduction_job" ? row.claimedQuantity : null,
      jobNo: resolution.action === "reproduction_job" ? (resolution.reference ?? `JOB-R${index + 1}`) : null,
      refundId: null,
      executedAt: resolution.executedAt,
    })),
    nextActions:
      row.status === "need_info" ? [{ key: "claim.answer_info", irreversible: false, disabledReason: null }] : [],
  };
}

/** The desk's rows for one customer's orders, adopting the ones the seed lists but never built. */
function claimsOf(customer: MockCustomer): LogisticsClaim[] {
  return ordersOf(customer).flatMap((order) =>
    order.claims.map((summary) => claimOf(order, summary.id)).filter((row): row is LogisticsClaim => Boolean(row)),
  );
}

function claimOf(order: MockOrder, claimId: string): LogisticsClaim | undefined {
  const row = claimRow(claimId);
  if (row) return row.order.id === order.id ? row : undefined;
  const summary = order.claims.find((candidate) => candidate.id === claimId);
  return summary ? adoptClaim(order, summary) : undefined;
}

/** An uploaded file as a reference with a thumbnail the customer's page can show. */
function photoOf(fileId: string) {
  const file = files.get(fileId);
  const name = file?.originalName ?? "photo.jpg";
  const thumb = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#d9e6e1"/><text x="80" y="66" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#1f6f5c">${name.replace(/[<&>]/g, "")}</text></svg>`,
  )}`;
  return {
    id: fileId,
    originalName: name,
    mimeType: file?.mimeType ?? "image/jpeg",
    sizeBytes: file?.sizeBytes ?? 0,
    thumbnailUrl: thumb,
    url: thumb,
  };
}

/* ---------------------------------------------------------------------------------- reorder */

const REPRICE = 1.03;
// Plates and dies are kept for a reorder (D-153); design, mockup and shipping are not carried over.
const WAIVABLE = new Set(["plate", "die_block"]);

export function reorderOf(order: MockOrder, quantity: number) {
  const product = order.lines.find((line) => line.lineType === "product");
  const unitNet = product ? (satang(product.netAmount) / order.quantity) * REPRICE : 0;
  const productNet = Math.round(unitNet * quantity);
  const vat = (net: number) => Math.round(net * 0.07);
  const lines: StoreQuote["lines"] = [
    {
      lineType: "product",
      description: `${product?.description.split(" ")[0] ?? order.productType.name} ${quantity.toLocaleString("th-TH")} ${order.unit}`,
      quantity: String(quantity),
      unit: order.unit,
      unitPrice: (unitNet / 100).toFixed(6),
      netAmount: baht(productNet),
      vatAmount: baht(vat(productNet)),
      grossAmount: baht(productNet + vat(productNet)),
      oneOff: false,
      waivedReason: null,
    },
    ...order.lines
      .filter((line) => WAIVABLE.has(line.lineType))
      .map((line) => ({
        lineType: line.lineType,
        description: line.description,
        quantity: "1",
        unit: "งาน",
        unitPrice: "0.000000",
        netAmount: "0.00",
        vatAmount: "0.00",
        grossAmount: "0.00",
        oneOff: true,
        waivedReason:
          line.lineType === "plate"
            ? `ใช้เพลตเดิมจาก ${order.orderCode} ได้ (D-153)`
            : `ใช้บล็อกไดคัทเดิมจาก ${order.orderCode} ได้ (D-153)`,
      })),
  ];
  const net = productNet;
  const vatAmount = vat(net);
  const originalUnit = product ? satang(product.grossAmount) / order.quantity / 100 : 0;
  const unitPrice = (net + vatAmount) / quantity / 100;
  return { lines, net, vatAmount, unitPrice, originalUnit };
}

/** The catalogue's minimum quantity for a reorder, in the mock. */
const REORDER_MIN = 500;

/** Previews handed out, by token (30 minutes, D-153). */
const previews = new Map<string, { quantity: number; reuse: boolean; grossAmount: string; expiresAt: number }>();

/** `ReorderPreviewDto`: the same spec at today's price; the approved artwork carries over when kept. */
function previewOf(order: MockOrder, quantity: number, reuse: boolean): Schemas["ReorderPreviewDto"] {
  const priced = reorderOf(order, quantity);
  const proofSkipped = reuse && order.artworkStatus === "approved";
  const lead = Math.max(5, order.leadTimeDays - (proofSkipped ? 2 : 0));
  const previewToken = `rop.${order.id.slice(-6)}.${quantity}.${reuse ? 1 : 0}`;
  const grossAmount = baht(priced.net + priced.vatAmount);
  const expiresAt = Date.now() + 30 * 60_000;
  previews.set(previewToken, { quantity, reuse, grossAmount, expiresAt });
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    previousQuantity: order.quantity,
    quantity,
    quantityLimits: { min: REORDER_MIN, max: 1_000_000 },
    proofSkipped,
    unitPrice: priced.unitPrice.toFixed(6),
    productAmount: baht(priced.net),
    designFeeAmount: "0.00",
    // D-289: the same specification reused keeps the factory's plates (a fake register entry and amount).
    toolingAmount: proofSkipped ? "0.00" : null,
    toolingWaiver: proofSkipped
      ? {
          reason: "tooling_reuse",
          waivedAmount: "1500.00",
          tooling: [{ id: `tool-${order.id.slice(-6)}`, kind: "plates" } as unknown as Schemas["ToolingRefDto"]],
        }
      : null,
    shippingAmount: null,
    vatAmount: baht(priced.vatAmount),
    grossAmount,
    currency: "THB",
    leadTimeDays: lead,
    earliestShipDate: bangkokIso(DAY * lead).slice(0, 10),
    earliestDeliveryDate: bangkokIso(DAY * (lead + 2)).slice(0, 10),
    previewToken,
    previewExpiresAt: new Date(expiresAt + 7 * 3_600_000).toISOString().replace("Z", "+07:00"),
  };
}

/** A reorder as a quotation in the customer's cart (D-153); bulk reorders (F3 3.7) add theirs here too. */
export function addReorderToCart(customer: MockCustomer, order: MockOrder, quantity: number) {
  const priced = reorderOf(order, quantity);
  const product = productOf(order);
  const { id, quoteCode } = nextQuoteId();
  const quote: StoreQuote = {
    id,
    quoteCode,
    status: "saved",
    productType: order.productType,
    product: {
      slug: product.slug ?? "reorder",
      name: product.name,
      imageUrl: product.imageUrl,
    },
    specs: [...order.specs, { label: "สั่งซ้ำจาก", value: order.orderCode }],
    quantity: quantity,
    unit: order.unit,
    lines: priced.lines,
    unitPrice: priced.unitPrice.toFixed(6),
    netAmount: baht(priced.net),
    discountAmount: "0.00",
    shippingAmount: "0.00",
    vatAmount: baht(priced.vatAmount),
    grossAmount: baht(priced.net + priced.vatAmount),
    currency: "THB",
    promotion: null,
    designOption: order.artworkStatus === "approved" ? "own_file" : order.designOption,
    mockupOption: "none",
    leadTimeDays: order.leadTimeDays,
    earliestShipDate: bangkokIso(DAY * order.leadTimeDays).slice(0, 10),
    estimatedDeliveryDate: null,
    deliveryPostcode: null,
    tolerance: order.tolerance,
    validUntil: `${bangkokIso(15 * DAY).slice(0, 10)}T23:59:59+07:00`,
    configuration: { reorderOf: order.id },
    source: "instant",
    nextActions: [],
    createdAt: bangkokIso(),
  };
  quotesOf(customer.persona).unshift(quote);
  return { quoteId: quote.id, cartItemId: addToCart(customer, quote) };
}

/* --------------------------------------------------------------------------------- handlers */

export const storeFulfilmentHandlers = [
  // store.timeline.track (published, U-F0.2): anyone with the token sees the steps and the
  // carriers' progress, the promised and estimated dates — no order code, product, name or place
  // (D-143).
  http.get("*/v1/store/track/:token", ({ params }) => {
    const order = orders.find((candidate) => trackingTokenOf(candidate) === params.token);
    if (!order || order.status === "cancelled") return problem(404, "http.not_found", "ไม่พบข้อมูลการติดตามนี้");
    const progress = toProgress(order);
    return HttpResponse.json({
      status: order.status,
      promisedShipDate: order.promisedShipDate,
      estimatedDeliveryDate: progress.estimatedDeliveryDate,
      shippedAt: progress.shippedAt,
      deliveredAt: progress.deliveredAt,
      steps: progress.steps,
      shipments: toShipments(order).map((shipment) => ({
        shipmentNo: shipment.shipmentNo,
        status: TRACKING_OF[shipment.status] ?? "ready",
        ...statusLabels("status", SHIPMENT_STATUS, TRACKING_OF[shipment.status] ?? "ready"),
        carrier: shipment.carrier,
        trackingNo: shipment.trackingNo,
        trackingUrl: shipment.trackingUrl,
        cartonsCount: shipment.cartonsCount,
        steps: shipment.events.flatMap((event) =>
          TRACKING_OF[event.status]
            ? [
                {
                  status: TRACKING_OF[event.status]!,
                  statusLabelTh: statusLabels("status", SHIPMENT_STATUS, TRACKING_OF[event.status]!).statusLabelTh,
                  occurredAt: event.occurredAt,
                },
              ]
            : [],
        ),
      })),
    } satisfies Schemas["PublicTrackingDto"]);
  }),

  // store.claims.confirmReceipt (published, U-F0.2): answers with the order.
  http.post("*/v1/store/orders/:orderId/actions/confirm-receipt", ({ params, request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const found = mine(request, String(params.orderId));
    if (found instanceof Response) return found;
    const { order } = found;
    if (!isDelivered(order))
      return problem(409, "order.invalid_transition", "ยังส่งสินค้าไม่ครบ ยืนยันรับสินค้าได้หลังส่งถึงแล้ว");
    if (!receipts.has(order.id)) {
      receipts.set(order.id, { confirmedAt: bangkokIso() });
      // D-081: confirming completes the order; the claim window runs from now (D-082).
      if (order.status === "shipping") order.status = "completed";
      refreshOrder(order);
    }
    return HttpResponse.json(toStoreOrderDto(order));
  }),

  // store.claims.getForm (D-082): whether a claim can be filed now, the deliveries, the photo rules.
  http.get("*/v1/store/orders/:orderId/claim-form", ({ params, request }) => {
    const found = mine(request, String(params.orderId));
    if (found instanceof Response) return found;
    const { order } = found;
    const windowEndsAt = claimWindowEnd(order);
    const delivered = order.shipments.filter((shipment) => shipment.deliveredAt);
    const open = Boolean(windowEndsAt && Date.parse(windowEndsAt) > Date.now());
    const form: Schemas["ClaimFormDto"] = {
      orderId: order.id,
      orderCode: order.orderCode,
      quantityOrdered: order.quantity,
      deliveredAt: deliveredAt(order),
      windowEndsAt,
      open,
      closedReason: !windowEndsAt ? "not_delivered" : open ? null : "window_closed",
      types: ["damaged", "wrong_spec", "print_defect", "quantity_short", "late", "other"],
      resolutions: ["reprint", "partial_refund", "full_refund", "credit"],
      shipments: delivered.map((shipment) => ({
        id: shipment.id,
        shipmentNo: shipment.shipmentNo,
        quantity: shipment.quantity,
        deliveredQuantity: shipment.pod?.deliveredQuantity ?? null,
        deliveredAt: shipment.deliveredAt!,
        windowEndsAt: windowEndsAt!,
        open,
      })),
      evidence: {
        accept: ["image/jpeg", "image/png", "image/webp", "image/heic"],
        maxBytes: 15_000_000,
        productPhotosMin: 1,
        productPhotosMax: 10,
        cartonPhotosMin: 1,
        cartonPhotosMax: 10,
        purpose: "evidence",
      },
    };
    return HttpResponse.json(form);
  }),

  // store.claims.submit (published, U-F0.2).
  http.post("*/v1/store/orders/:orderId/claims", async ({ params, request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const found = mine(request, String(params.orderId));
    if (found instanceof Response) return found;
    const { order } = found;
    const body = (await request.json()) as Schemas["SubmitClaimDto"];
    // D-082: both kinds of photo; the API's validation answers the same way.
    if (!body.productPhotoFileIds?.length || !body.cartonPhotoFileIds?.length)
      return problem(422, "validation.failed", "ต้องแนบรูปสินค้าและรูปกล่องอย่างน้อยอย่างละ 1 รูป");
    const windowEndsAt = claimWindowEnd(order);
    const received = receipts.get(order.id)?.confirmedAt ?? deliveredAt(order);
    if (!windowEndsAt || !received || Date.parse(windowEndsAt) <= Date.now())
      return problem(422, "claims.window_closed", "เลยกำหนดเปิดเคลม 7 วันหลังได้รับสินค้าแล้ว (D-082)");
    const row = fileCustomerClaim(order, {
      type: body.type,
      shipmentId: body.shipmentId ?? null,
      affectedQuantity: body.claimedQuantity ?? null,
      description: body.description,
      requestedResolution: body.requestedResolution,
      productPhotos: body.productPhotoFileIds.map(photoOf),
      cartonPhotos: body.cartonPhotoFileIds.map(photoOf),
      receivedAt: received,
      windowEndsAt,
    });
    return HttpResponse.json(toClaim(row), { status: 201 });
  }),

  // store.claims.list / get (published, U-F0.2): the customer's claims, by order when asked.
  http.get("*/v1/store/claims", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const rows = claimsOf(customer)
      .filter((row) => !query.orderId || row.order.id === query.orderId)
      .filter((row) => !query.status || row.status === query.status)
      .map(toClaim)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return HttpResponse.json(paginate(rows, { page: Number(query.page ?? 1), perPage: Number(query.perPage ?? 20) }));
  }),
  http.get("*/v1/store/claims/:claimId", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const row = claimsOf(customer).find((candidate) => candidate.id === params.claimId);
    return row ? HttpResponse.json(toClaim(row)) : problem(404, "http.not_found", "ไม่พบเคลมนี้");
  }),

  // store.claims.getTimeline (U2.F4, D-263): what happened, who must act now and by when. The mock
  // derives it from the claim's status: a day to respond, three to decide (the guarantee's example),
  // the clock stopped while Packio waits for the customer.
  http.get("*/v1/store/claims/:claimId/timeline", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const row = claimsOf(customer).find((candidate) => candidate.id === params.claimId);
    if (!row) return problem(404, "http.not_found", "ไม่พบเคลมนี้");
    const at = (hours: number) => {
      const date = new Date(Date.parse(row.submittedAt) + hours * 3_600_000 + 7 * 3_600_000);
      return `${date.toISOString().slice(0, 19)}+07:00`;
    };
    const ORDER = [
      "submitted",
      "under_review",
      "need_info",
      "factory_review",
      "approved",
      "rejected",
      "resolved",
      "closed",
    ] as const;
    const reached = ORDER.indexOf(row.status as (typeof ORDER)[number]);
    const events: Schemas["ClaimTimelineEventDto"][] = [{ type: "claim.submitted", at: row.submittedAt }];
    if (reached >= 1) events.push({ type: "claim.under_review", at: at(4) });
    if (row.status === "need_info") events.push({ type: "claim.info_requested", at: at(6) });
    if (["approved", "resolved", "closed"].includes(row.status)) events.push({ type: "claim.approved", at: at(30) });
    if (row.status === "rejected") events.push({ type: "claim.rejected", at: at(30) });
    if (["resolved", "closed"].includes(row.status)) events.push({ type: "claim.resolved", at: at(50) });
    if (row.status === "closed") events.push({ type: "claim.closed", at: at(60) });
    const decided = ["approved", "rejected", "resolved", "closed"].includes(row.status);
    const owner: Schemas["ClaimOwner"] =
      row.status === "need_info"
        ? "customer"
        : row.status === "factory_review"
          ? "factory"
          : decided
            ? "none"
            : "packio";
    const responseDueAt = at(24);
    const decisionDueAt = decided || row.status === "need_info" ? null : at(72);
    const now = Date.now();
    return HttpResponse.json({
      claimId: row.id,
      status: row.status,
      events,
      sla: {
        currentOwner: owner,
        guaranteeVersionNo: 1,
        respondedAt: reached >= 1 ? at(4) : null,
        responseDueAt,
        responseOverdue: reached < 1 && Date.parse(responseDueAt) < now,
        decisionDueAt,
        decisionOverdue: decisionDueAt !== null && Date.parse(decisionDueAt) < now,
      },
    } satisfies Schemas["ClaimTimelineDto"]);
  }),

  // store.claims.respondInfo (published, U-F0.2): only while the team is waiting for more.
  http.post("*/v1/store/claims/:claimId/info", async ({ params, request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const row = claimsOf(customer).find((candidate) => candidate.id === params.claimId);
    if (!row) return problem(404, "http.not_found", "ไม่พบเคลมนี้");
    if (row.status !== "need_info") return problem(409, "claims.invalid_status", "เคลมนี้ไม่ได้รอข้อมูลเพิ่มจากคุณ");
    const body = (await request.json()) as Schemas["ClaimInfoDto"];
    const order = orders.find((candidate) => candidate.id === row.order.id)!;
    return HttpResponse.json(toClaim(customerClaimReply(row, order.customer.displayName, body.response)));
  }),

  // store.claims.previewReorder (D-153): today's price for a quantity; nothing is saved.
  http.get("*/v1/store/orders/:orderId/reorder", ({ params, request }) => {
    const found = mine(request, String(params.orderId));
    if (found instanceof Response) return found;
    const { order } = found;
    if (order.status === "cancelled")
      return problem(409, "orders.invalid_status", "สั่งซ้ำจากคำสั่งซื้อที่ยกเลิกไม่ได้");
    const url = new URL(request.url);
    const reuse = url.searchParams.get("reuseArtwork") !== "false";
    const asked = Number(url.searchParams.get("quantity") ?? order.quantity);
    const quantity = Math.max(REORDER_MIN, Number.isFinite(asked) && asked > 0 ? Math.round(asked) : order.quantity);
    return HttpResponse.json(previewOf(order, quantity, reuse));
  }),

  // store.claims.reorder: today's price into the cart, held to the preview when one is sent.
  http.post("*/v1/store/orders/:orderId/actions/reorder", async ({ params, request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const found = mine(request, String(params.orderId));
    if (found instanceof Response) return found;
    const { customer, order } = found;
    const body = (await request.json().catch(() => ({}))) as Schemas["ReorderOrderDto"];
    const quantity = body.quantity ?? order.quantity;
    if (body.previewToken) {
      const preview = previews.get(body.previewToken);
      if (
        !preview ||
        preview.quantity !== quantity ||
        preview.reuse !== (body.reuseArtwork ?? true) ||
        preview.expiresAt < Date.now()
      )
        return problem(409, "orders.reorder_preview_expired", "ราคาที่แสดงหมดอายุแล้ว กรุณาดูราคาใหม่");
      if (preview.grossAmount !== previewOf(order, quantity, preview.reuse).grossAmount)
        return problem(409, "orders.reorder_repriced", "ราคาวันนี้เปลี่ยนจากที่แสดง กรุณาดูราคาใหม่");
    }
    addReorderToCart(customer, order, quantity);
    return edited(customer, 201);
  }),
];
