/**
 * The signed-in customer's own requests that 3.1 needs: completing a profile a little at a time
 * after sign-in (progressive profiling), and finding one of their orders by its code from the
 * global search (api-conventions §3 already names `by-code` as the one business key allowed in
 * a customer path).
 */

import { z } from "zod";

import { orderStatus } from "./admin-orders";
import { customerType } from "./admin-customers";
import { dateTime, request, uuid } from "./define";

export const storeProfilePatch = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z.string().email().max(254).optional(),
    customerType: customerType.optional(),
  })
  .meta({ id: "UpdateStoreProfileDto" });

export const storeOrderLookup = z
  .object({
    orderId: uuid(),
    orderCode: z.string(),
    status: orderStatus,
    createdAt: dateTime(),
  })
  .meta({ id: "StoreOrderLookupDto" });

export const storeAccountRequests = {
  "PATCH /v1/store/me": request({
    request: "store.profile",
    summary: "The customer completes their own profile — name, e-mail, customer type",
    decisions: ["D-020"],
    body: storeProfilePatch,
    // `StoreMeDto` is published; the response is the same shape plus the new fields.
    response: z
      .object({
        id: uuid(),
        displayName: z.string(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        customerType: customerType.nullable(),
      })
      .meta({ id: "StoreProfileDto" }),
  }),
  "GET /v1/store/orders/by-code/{orderCode}": request({
    request: "store.order-by-code",
    summary: "One of the signed-in customer's orders, found by its code; 404 when it is not theirs",
    response: storeOrderLookup,
  }),
} as const;
