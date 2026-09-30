/**
 * The published `OrderDto` (`store.orders.get`, `store.orders.getByCode`, …) built from the back
 * office's order rows (`../admin/commerce`), which stay in the admin zone's request shape until
 * U-F0.3. One adapter, so every store operation that answers an order answers the same one.
 *
 * The published order is lean: no product, no group, no next actions (CONTRACT-GAP store.orders,
 * store.order-group-ref, entity.next-actions). What it has is mapped; nothing is added.
 */

import type { Schemas } from "@/lib/api/types";

import { baht, satang, type MockOrder } from "../admin/commerce";
import { mockId } from "../support";

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
    cancelledAt: order.cancelledAt,
  };
}
