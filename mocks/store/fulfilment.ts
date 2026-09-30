/**
 * After production, from the customer's side, mocked (CONTRACT-REQUEST store.tracking,
 * store.receipt, store.claims, store.reorder).
 *
 * Orders are the back office's rows (`../admin/commerce`) and claims the logistics desk's
 * (`../admin/logistics`, F2 2.8): a claim filed here is on the desk's queue, and what the desk
 * writes to the customer comes back in the thread. Liability, the factory and internal notes stay
 * behind. The public tracking page answers anyone with the token and says nothing personal.
 *
 * Reorders are re-priced by an obviously fake 3 % and become a quotation in the cart; checkout
 * (F3 3.3) places them like any other.
 */

import { http } from "msw";
import type { z } from "zod";

import type { storeClaim } from "@/lib/api/requests/store-fulfilment";
import type { Schemas } from "@/lib/api/types";
import type { StoreQuote } from "./quotes";

import { baht, orders, refreshOrder, satang, type MockOrder } from "../admin/commerce";
import { adoptClaim, claimRow, customerClaimReply, fileCustomerClaim, type LogisticsClaim } from "../admin/logistics";
import { files } from "../admin/platform";
import { mockRequest } from "../route";
import { bangkokIso, problem } from "../support";
import { addToCart, edited } from "./cart";
import { customerOf, type MockCustomer } from "./customers";
import {
  claimWindowEnd,
  deliveredAt,
  orderOf,
  receipts,
  stagesOf,
  toDetail,
  toSummary,
  trackingTokenOf,
} from "./orders";
import { nextQuoteId, quotesOf } from "./quotes";

type Claim = z.output<typeof storeClaim>;

const DAY = 24 * 60;
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
const TEAM = "ทีม Packio";

function mine(request: Request, orderId: string) {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const order = orderOf(customer, orderId);
  return order ? { customer, order } : notFound();
}

const isDelivered = (order: MockOrder) =>
  order.shipments.length > 0 && order.shipments.every((shipment) => shipment.status === "delivered");

/* ----------------------------------------------------------------------------------- claims */

const RESOLUTION_OF: Record<string, Claim["requestedResolution"]> = {
  reproduction_job: "reprint",
  credit_note: "credit",
  store_credit: "credit",
};

/** A desk row as the customer sees it: their messages and the team's, the outcome in words. */
function toClaim(row: LogisticsClaim): Claim {
  const order = orders.find((candidate) => candidate.id === row.order.id);
  const resolution = row.resolutions.at(-1);
  const decided = row.decision && ["approved", "rejected", "resolved", "closed"].includes(row.status);
  return {
    id: row.id,
    claimNo: row.claimNo,
    order: row.order,
    type: row.type,
    status: row.status,
    shipment: row.shipment,
    affectedQuantity: row.claimedQuantity,
    description: row.description,
    requestedResolution: row.requestedResolution,
    evidence: row.evidence,
    automatic: row.origin === "tolerance_auto",
    submittedAt: row.submittedAt,
    respondBy: row.slaDueAt,
    messages: row.messages
      .filter((message) => message.audience === "customer")
      .map((message, at) => {
        const customer = message.author === order?.customer.displayName;
        return {
          id: `${row.id}:${at}`,
          at: message.at,
          authorKind: customer ? ("customer" as const) : ("staff" as const),
          authorName: customer ? message.author : TEAM,
          body: message.body,
          files: [],
        };
      }),
    outcome:
      decided && row.decision
        ? {
            decision: row.status === "rejected" ? "rejected" : "approved",
            resolution: resolution
              ? (RESOLUTION_OF[resolution.action] ?? row.requestedResolution)
              : row.status === "rejected"
                ? null
                : row.requestedResolution,
            amount: resolution?.amount ?? null,
            note: row.decision.reason,
            at: row.decision.at,
          }
        : null,
    canReply: !["rejected", "resolved", "closed"].includes(row.status),
  };
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

const tokenOf = (order: MockOrder, quantity: number) => `rop.${order.id.slice(-6)}.${quantity}`;

/** A reorder as a quotation in the customer's cart (D-153); bulk reorders (F3 3.7) add theirs here too. */
export function addReorderToCart(customer: MockCustomer, order: MockOrder, quantity: number) {
  const priced = reorderOf(order, quantity);
  const summary = toSummary(order);
  const { id, quoteCode } = nextQuoteId();
  const quote: StoreQuote = {
    id,
    quoteCode,
    status: "saved",
    productType: order.productType,
    product: {
      slug: summary.product.slug ?? "reorder",
      name: summary.product.name,
      imageUrl: summary.product.imageUrl,
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
  mockRequest("GET /v1/store/tracking/{token}", ({ params }) => {
    const order = orders.find((candidate) => trackingTokenOf(candidate) === params.token);
    if (!order || order.status === "cancelled") return problem(404, "http.not_found", "ไม่พบข้อมูลการติดตามนี้");
    const summary = toSummary(order);
    return {
      orderCode: order.orderCode,
      status: order.status,
      productName: summary.product.name,
      quantity: order.quantity,
      unit: order.unit,
      stages: stagesOf(order),
      estimatedDeliveryDate: order.promisedShipDate,
      shipments: order.shipments.map((shipment) => ({
        shipmentNo: shipment.shipmentNo,
        status: shipment.status,
        carrier: shipment.carrier,
        trackingNo: shipment.trackingNo,
        trackingUrl: null,
        province: shipment.destination.province,
        quantity: shipment.quantity,
        cartons: shipment.cartons,
        shippedAt: bangkokIso(-DAY * 3),
        deliveredAt: shipment.deliveredAt,
        events: [
          { at: bangkokIso(-DAY * 3), status: "picked_up" as const, location: "โรงงานพาร์ตเนอร์" },
          { at: bangkokIso(-DAY * 3 + 180), status: "in_transit" as const, location: null },
          ...(shipment.deliveredAt
            ? [{ at: shipment.deliveredAt, status: "delivered" as const, location: shipment.destination.province }]
            : []),
        ],
      })),
      updatedAt: bangkokIso(),
    };
  }),

  mockRequest("POST /v1/store/orders/{orderId}/actions/confirm-receipt", ({ params, request }) => {
    const found = mine(request, params.orderId);
    if (found instanceof Response) return found;
    const { order } = found;
    if (!isDelivered(order))
      return problem(409, "order.not_delivered", "ยังส่งสินค้าไม่ครบ ยืนยันรับสินค้าได้หลังส่งถึงแล้ว");
    if (!receipts.has(order.id)) {
      receipts.set(order.id, { confirmedAt: bangkokIso() });
      // D-081: confirming completes the order; the claim window runs from now (D-082).
      if (order.status === "shipping") order.status = "completed";
      refreshOrder(order);
    }
    return toDetail(order);
  }),

  mockRequest("GET /v1/store/orders/{orderId}/claim-form", ({ params, request }) => {
    const found = mine(request, params.orderId);
    if (found instanceof Response) return found;
    const { order } = found;
    const windowEndsAt = claimWindowEnd(order);
    if (!windowEndsAt || !deliveredAt(order))
      return problem(409, "claim.not_delivered", "เปิดเคลมได้หลังได้รับสินค้าแล้ว");
    return {
      windowEndsAt,
      open: Date.parse(windowEndsAt) > Date.now(),
      types: ["damaged", "wrong_spec", "print_defect", "quantity_short", "late", "other"],
      resolutions: ["reprint", "partial_refund", "full_refund", "credit"],
      shipments: order.shipments.map((shipment) => ({
        id: shipment.id,
        shipmentNo: shipment.shipmentNo,
        province: shipment.destination.province,
        deliveredQuantity: shipment.pod?.deliveredQuantity ?? null,
        deliveredAt: shipment.deliveredAt,
      })),
      evidence: {
        accept: "image/jpeg,image/png,image/webp,image/heic",
        maxBytes: 15_000_000,
        minProductPhotos: 1,
        minCartonPhotos: 1,
        maxPhotos: 10,
      },
    };
  }),

  mockRequest("POST /v1/store/orders/{orderId}/claims", ({ params, body, request }) => {
    const found = mine(request, params.orderId);
    if (found instanceof Response) return found;
    const { order } = found;
    const windowEndsAt = claimWindowEnd(order);
    const received = receipts.get(order.id)?.confirmedAt ?? deliveredAt(order);
    if (!windowEndsAt || !received || Date.parse(windowEndsAt) <= Date.now())
      return problem(422, "claim.window_closed", "เลยกำหนดเปิดเคลม 7 วันหลังได้รับสินค้าแล้ว (D-082)");
    const row = fileCustomerClaim(order, {
      type: body.type,
      shipmentId: body.shipmentId ?? null,
      affectedQuantity: body.affectedQuantity ?? null,
      description: body.description,
      requestedResolution: body.requestedResolution,
      productPhotos: body.productPhotoFileIds.map(photoOf),
      cartonPhotos: body.cartonPhotoFileIds.map(photoOf),
      receivedAt: received,
      windowEndsAt,
    });
    return toClaim(row);
  }),

  mockRequest("GET /v1/store/orders/{orderId}/claims/{claimId}", ({ params, request }) => {
    const found = mine(request, params.orderId);
    if (found instanceof Response) return found;
    const row = claimOf(found.order, params.claimId);
    return row ? toClaim(row) : problem(404, "http.not_found", "ไม่พบเคลมนี้");
  }),

  mockRequest("POST /v1/store/orders/{orderId}/claims/{claimId}/messages", ({ params, body, request }) => {
    const found = mine(request, params.orderId);
    if (found instanceof Response) return found;
    const row = claimOf(found.order, params.claimId);
    if (!row) return problem(404, "http.not_found", "ไม่พบเคลมนี้");
    if (!toClaim(row).canReply) return problem(409, "claim.closed", "เคลมนี้ปิดแล้ว");
    return toClaim(customerClaimReply(row, found.order.customer.displayName, body.body));
  }),

  mockRequest("GET /v1/store/orders/{orderId}/reorder", ({ params, query, request }) => {
    const found = mine(request, params.orderId);
    if (found instanceof Response) return found;
    const { order } = found;
    if (order.status === "cancelled") return problem(409, "reorder.not_allowed", "สั่งซ้ำจากคำสั่งซื้อที่ยกเลิกไม่ได้");
    const minQuantity = 500;
    const quantity = Math.max(minQuantity, query.quantity ?? order.quantity);
    const priced = reorderOf(order, quantity);
    const summary = toSummary(order);
    const approved = order.artworkStatus === "approved";
    return {
      source: {
        orderId: order.id,
        orderCode: order.orderCode,
        quantity: order.quantity,
        unitPrice: priced.originalUnit.toFixed(6),
      },
      product: summary.product,
      specs: order.specs,
      artwork: {
        reused: approved,
        proofSkipped: approved,
        approvedProofVersion: approved ? Math.max(1, order.artwork.proofs.length) : null,
        note: approved ? null : "คำสั่งซื้อเดิมยังไม่มีไฟล์งานที่อนุมัติ ต้องส่งไฟล์และตรวจปรู๊ฟใหม่",
      },
      quantity,
      minQuantity,
      maxQuantity: 1_000_000,
      unit: order.unit,
      lines: priced.lines,
      unitPrice: priced.unitPrice.toFixed(6),
      netAmount: baht(priced.net),
      vatAmount: baht(priced.vatAmount),
      grossAmount: baht(priced.net + priced.vatAmount),
      priceChanged: priced.unitPrice.toFixed(2) !== priced.originalUnit.toFixed(2),
      leadTimeDays: Math.max(5, order.leadTimeDays - (approved ? 2 : 0)),
      earliestShipDate: bangkokIso(DAY * Math.max(5, order.leadTimeDays - (approved ? 2 : 0))).slice(0, 10),
      previewToken: tokenOf(order, quantity),
      expiresAt: bangkokIso(30),
    };
  }),

  // Published (U-F0.2): `store.claims.reorder` puts the order again in the cart at today's price
  // and answers with the cart. There is no preview token to hold the price to (CONTRACT-GAP
  // store.reorder); the cart shows what it costs.
  http.post("*/v1/store/orders/:orderId/actions/reorder", async ({ params, request }) => {
    const found = mine(request, String(params.orderId));
    if (found instanceof Response) return found;
    const { customer, order } = found;
    const body = (await request.json().catch(() => ({}))) as Schemas["ReorderOrderDto"];
    addReorderToCart(customer, order, body.quantity ?? order.quantity);
    return edited(customer, 201);
  }),
];
