/**
 * The published `OrderDto` (`store.orders.get`, `store.orders.getByCode`, …) built from the back
 * office's order rows (`../admin/commerce`), which stay in the admin zone's request shape until
 * U-F0.3. One adapter, so every store operation that answers an order answers the same one.
 *
 * The order names no group (CONTRACT-GAP store.order-group-ref). Since v0.4.0 it carries its
 * product and spec lines (`summary`), the receipt stamps, the tolerance outcome, the delivery
 * estimate and — on the storefront — the customer's `nextActions`, computed from the same facts as
 * packio-api's `STORE_ORDER_ACTIONS` (`src/modules/orders/order-actions.ts` at v0.6.0).
 */

import type { Schemas } from "@/lib/api/types";

import { lineSummaryOf } from "../admin/catalog";
import { baht, satang, type MockOrder } from "../admin/commerce";
import { bangkokIso, mockId } from "../support";
import { catalogProducts, imageUrl } from "./catalog";

const DAY_MS = 86_400_000;
/** `claims.window_days` (D-082) and `orders.auto_complete_days` (D-081), as the mock settings have them. */
const CLAIM_WINDOW_DAYS = 7;
const AUTO_COMPLETE_DAYS = 7;

/** Receipt confirmed by the customer (D-081) — the fulfilment mock writes here. */
export const receipts = new Map<string, { confirmedAt: string }>();

export function deliveredAt(order: MockOrder): string | null {
  return order.shipments.map((shipment) => shipment.deliveredAt).find(Boolean) ?? null;
}

const plusDays = (iso: string, days: number) =>
  new Date(Date.parse(iso) + days * DAY_MS).toISOString().replace("Z", "+00:00");

export function claimWindowEnd(order: MockOrder): string | null {
  const base = receipts.get(order.id)?.confirmedAt ?? deliveredAt(order);
  return base ? plusDays(base, CLAIM_WINDOW_DAYS) : null;
}

/** The product an order was made from, as far as its row tells (web orders name it in their first line). */
export function productOf(order: MockOrder): {
  slug: string | null;
  name: string;
  nameEn: string;
  imageUrl: string | null;
} {
  const row = catalogProducts().find((candidate) => order.lines[0]?.description.startsWith(String(candidate.nameTh)));
  return {
    slug: row ? String(row.slug) : null,
    name: row ? String(row.nameTh) : order.productType.name,
    nameEn: row ? String(row.nameEn) : order.productType.name,
    imageUrl: row ? imageUrl(((row.images as { fileId: string }[] | undefined) ?? [])[0]?.fileId) : null,
  };
}

/** The sales unit a row's word stands for (`ProductUnit`). */
export const unitOf = (word: string): Schemas["ProductUnit"] => UNITS[word] ?? "piece";

const UNITS: Record<string, Schemas["ProductUnit"]> = {
  ชิ้น: "piece",
  ใบ: "piece",
  กล่อง: "box",
  ซอง: "pouch",
  หลอด: "tube",
  ชุด: "set",
  งาน: "job",
};

/** The order's product, spec lines and sales unit (`LineSummaryDto`), from its row. */
function summaryOf(order: MockOrder): Schemas["LineSummaryDto"] {
  const product = productOf(order);
  return {
    ...lineSummaryOf(order.productType.code),
    product: product.slug
      ? { slug: product.slug, nameTh: product.name, nameEn: product.nameEn, imageUrl: product.imageUrl }
      : null,
    unit: unitOf(order.unit),
    specs: order.specs.map((spec, index) => ({
      key: `spec_${index + 1}`,
      labelTh: spec.label,
      labelEn: spec.label,
      valueTh: spec.value,
      valueEn: spec.value,
    })),
  };
}

/** The receipt stamps (D-081, D-082): delivered, confirmed or completed by itself, the claim window. */
function receiptOf(order: MockOrder): Schemas["OrderReceiptDto"] {
  const delivered = deliveredAt(order);
  const confirmed = receipts.get(order.id)?.confirmedAt ?? null;
  const completed = order.status === "completed" ? (confirmed ?? delivered) : null;
  return {
    deliveredAt: delivered,
    confirmedAt: confirmed,
    completedAt: completed,
    completionMode: completed ? (confirmed ? "customer_confirmed" : "auto_after_days") : null,
    autoCompleteAt: delivered && !completed ? plusDays(delivered, AUTO_COMPLETE_DAYS) : null,
    claimWindowEndsAt: claimWindowEnd(order),
  };
}

/** Delivered against ordered once every delivery has its POD (D-021, D-080); the credit is the mock's. */
function toleranceOf(order: MockOrder): Schemas["OrderToleranceOutcomeDto"] | null {
  const shipments = order.shipments;
  if (shipments.length === 0 || !shipments.every((shipment) => shipment.status === "delivered" && shipment.pod))
    return null;
  const delivered = shipments.reduce((sum, shipment) => sum + (shipment.pod?.deliveredQuantity ?? 0), 0);
  const ordered = order.quantity;
  const shortage = (Number(order.tolerance.shortagePct) / 100) * ordered;
  const overage = (Number(order.tolerance.overagePct) / 100) * ordered;
  const outcome: Schemas["ToleranceOutcome"] =
    delivered === ordered
      ? "exact"
      : delivered < ordered
        ? ordered - delivered <= shortage
          ? "shortage_within"
          : "shortage_outside"
        : delivered - ordered <= overage
          ? "overage_within"
          : "overage_outside";
  const product = order.lines.find((line) => line.lineType === "product");
  return {
    orderedQuantity: ordered,
    deliveredQuantity: delivered,
    outcome,
    creditAmount:
      outcome === "shortage_within" && product
        ? baht(Math.round((satang(product.grossAmount) * (ordered - delivered)) / ordered))
        : null,
    evaluatedAt:
      shipments
        .map((shipment) => shipment.deliveredAt ?? "")
        .sort()
        .at(-1) || bangkokIso(),
  };
}

const PRE_PRODUCTION = ["waiting_payment", "paid_for_production", "artwork_approved"];
const OWN_ARTWORK = ["own_file", "online_designer"];

/** packio-api's `STORE_ORDER_ACTIONS` over the row's facts (D-070, D-073, D-081, D-082, D-153). */
export function storeOrderActions(order: MockOrder): Schemas["NextActionDto"][] {
  const dto = toOrderDto(order);
  const takesArtwork = PRE_PRODUCTION.includes(dto.status) && dto.artworkStatus !== "approved";
  const received = dto.receipt.deliveredAt !== null && dto.cancelledAt === null;
  const actions: Schemas["NextActionDto"][] = [];
  const offer = (key: string, irreversible = false, disabledReason: string | null = null) =>
    actions.push({ key, irreversible, disabledReason });
  if (takesArtwork && OWN_ARTWORK.includes(dto.designOption)) offer("order.upload_artwork");
  if (takesArtwork && dto.artworkStatus === "proof_sent") offer("order.approve_proof", true);
  if (received && dto.receipt.completedAt === null) offer("order.confirm_receipt", true);
  const claimWindow = dto.receipt.claimWindowEndsAt;
  if (received && claimWindow !== null)
    offer("order.open_claim", false, Date.parse(claimWindow) >= Date.now() ? null : "claims.window_closed");
  if (received) offer("order.reorder");
  return actions;
}

/** The order as the storefront serves it: the published DTO with the customer's own actions. */
export function toStoreOrderDto(order: MockOrder): Schemas["OrderDto"] {
  return { ...toOrderDto(order), nextActions: storeOrderActions(order) };
}

/** A stable fake id per order and namespace (the rows carry no quote or geo ids of their own). */
function sibling(order: MockOrder, namespace: string, n = 0): string {
  return mockId(namespace, (Number.parseInt(order.id.slice(-6), 16) % 0x10000) * 16 + n);
}

export function toOrderDto(order: MockOrder): Schemas["OrderDto"] {
  const shipping = order.lines
    .filter((line) => line.lineType === "shipping")
    .reduce((sum, line) => sum + satang(line.netAmount), 0);
  return {
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    artworkStatus: order.artwork.status,
    productTypeCode: order.productType.code,
    summary: summaryOf(order),
    quoteId: sibling(order, "qte"),
    quantityOrdered: order.quantity,
    designOption: order.designOption,
    mockupOption: order.mockupOption,
    toleranceShortagePct: order.tolerance.shortagePct,
    toleranceOveragePct: order.tolerance.overagePct,
    leadTimeDays: order.leadTimeDays,
    promisedShipDate: order.promisedShipDate,
    totals: {
      netAmount: order.netAmount,
      discountAmount: order.discountAmount,
      shippingNetAmount: baht(shipping),
      vatAmount: order.vatAmount,
      grossAmount: order.grossAmount,
      whtAmount: "0.00",
      cashAmount: order.grossAmount,
      currency: "THB",
    },
    lines: order.lines.map((line) => ({
      id: sibling(order, "oln", line.lineNo),
      lineNo: line.lineNo,
      lineType: line.lineType,
      descriptionTh: line.description,
      descriptionEn: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: "0.00",
      netAmount: line.netAmount,
      vatRatePct: "7.00",
      vatAmount: line.vatAmount,
      grossAmount: line.grossAmount,
      whtCategory: "none",
      whtAmount: "0.00",
    })),
    destinations: order.destinations.map((destination, index) => ({
      id: destination.id,
      quantity: destination.quantity,
      shippingNetAmount: index === 0 ? baht(shipping) : "0.00",
      address: {
        recipientName: destination.recipientName,
        phone: destination.phone,
        line1: destination.line1,
        line2: destination.line2,
        subdistrictId: destination.subdistrict ? sibling(order, "sdt", index) : null,
        subdistrictNameTh: destination.subdistrict,
        districtNameTh: destination.district,
        provinceId: sibling(order, "prv", index),
        provinceNameTh: destination.province,
        postcode: destination.postcode,
      },
    })),
    statusChangedAt: order.createdAt,
    createdAt: order.createdAt,
    cancelledAt: order.cancelledAt,
    // The rows keep the reason as text only, no reason code.
    cancelReasonCode: null,
    cancelReasonNameTh: order.cancelReason,
    cancelReasonNameEn: null,
    // The quotation's delivery estimate moved with the promised ship date: two days after it.
    estimatedDeliveryDate: order.promisedShipDate
      ? plusDays(`${order.promisedShipDate}T00:00:00+07:00`, 2).slice(0, 10)
      : null,
    receipt: receiptOf(order),
    toleranceOutcome: toleranceOf(order),
    // Each surface adds its own: `toStoreOrderDto` here, the back office its staff actions.
    nextActions: [],
  };
}
