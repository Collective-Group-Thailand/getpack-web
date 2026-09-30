/**
 * The instalment centre (F3 3.3, D-020, D-122): every instalment of the customer's order groups,
 * what is due and what is paid. Checkout and payments are published (`store.checkout.*`,
 * `store.payments.*`) and called directly since U-F0.2; this is what packio-api still builds
 * (U-B0.1 `store.instalments`).
 */

import { z } from "zod";

import { dueTrigger, instalmentStatus, requiredBefore } from "./admin-orders";
import { currency, dateTime, fileRef, listQuery, money, page, request, uuid } from "./define";

/* ----------------------------------------------------------------------------------- checkout */

export const storeInstalment = z
  .object({
    id: uuid(),
    order: z.object({ id: uuid(), orderCode: z.string() }),
    groupCode: z.string(),
    seq: z.number().int(),
    label: z.string(),
    dueTrigger,
    requiredBefore,
    dueAt: dateTime().nullable(),
    grossAmount: money(),
    paidAmount: money(),
    currency: currency(),
    status: instalmentStatus,
    /** The receipt / tax invoice issued for it (B5). */
    receipt: fileRef().nullable(),
    /** The payment in progress, if any. */
    activePaymentId: uuid().nullable(),
    payable: z.boolean(),
  })
  .meta({ id: "StoreInstalmentDto" });

/* ----------------------------------------------------------------------------------- requests */

export const storeCheckoutRequests = {
  "GET /v1/store/instalments": request({
    request: "store.instalments",
    summary: "The customer's instalments across orders: what is due, what is paid, receipts",
    decisions: ["D-020"],
    query: listQuery({ status: instalmentStatus.optional() }),
    response: page(storeInstalment),
  }),
} as const;
