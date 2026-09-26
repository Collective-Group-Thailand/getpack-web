/**
 * Checkout, payment schedules, payments and the customer's address book (F3 3.3, B3.1–B3.3,
 * D-020, D-053, D-060, D-061, D-110, D-131–D-133).
 *
 * The checkout is **priced by the API twice**: a preview the customer reviews (every promotion's
 * effect, the points they may redeem, the payment schedules they may choose, what is due now),
 * and the placement, which re-prices and refuses with `409 checkout.repriced` and a fresh preview
 * when anything moved — the storefront then shows the difference for the customer to confirm
 * (design-system.md §1.3: a price never changes silently). Nothing here is computed in the browser.
 *
 * Payments follow the gateways' own flows: SCB/PromptPay QR (a payload and image with an expiry,
 * settled by webhook — the page watches the payment), 2C2P card and online banking (redirect out
 * and back), and bank transfer with a slip that is verified automatically, or by Finance within
 * the D-061 SLA.
 */

import { z } from "zod";

import { customerAddress, customerType, taxProfile } from "./admin-customers";
import { dueTrigger, instalmentStatus, paymentMethod, paymentStatus, requiredBefore, slipStatus } from "./admin-orders";
import { promotionKind } from "./admin-marketing";
import { currency, dateTime, fileRef, listQuery, money, page, request, uuid } from "./define";

/* ----------------------------------------------------------------------------- address book */

export const addressInput = z
  .object({
    label: z.string().trim().min(1).max(60),
    recipientName: z.string().trim().min(1).max(120),
    phone: z.string().regex(/^0\d{8,9}$/),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional(),
    subdistrict: z.string().trim().max(120).optional(),
    district: z.string().trim().max(120).optional(),
    province: z.string().trim().min(1).max(120),
    postcode: z.string().regex(/^\d{5}$/),
    isDefault: z.boolean().optional(),
  })
  .meta({ id: "StoreAddressInputDto" });

export const taxProfileInput = z
  .object({
    taxType: customerType,
    name: z.string().trim().min(1).max(200),
    /** 13 digits; the API checks the checksum as well. */
    taxId: z.string().regex(/^\d{13}$/),
    branchType: z.enum(["head_office", "branch"]),
    /** `00000` for the head office. */
    branchCode: z.string().regex(/^\d{5}$/),
    address: z.string().trim().min(1).max(500),
    /** A juristic customer who withholds tax on services (ภ.ง.ด.53) — the API computes the amount. */
    withholdsTax: z.boolean(),
    isDefault: z.boolean().optional(),
  })
  .meta({ id: "StoreTaxProfileInputDto" });

/* ----------------------------------------------------------------------------------- checkout */

export const checkoutInput = z
  .object({
    contact: z.object({
      name: z.string().trim().min(1).max(120),
      phone: z.string().regex(/^0\d{8,9}$/),
      email: z.string().email().max(254),
    }),
    /**
     * `shared`: every item goes to `addressId`. `per_item`: each cart line's own destinations,
     * split as the cart says (D-110).
     */
    delivery: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("shared"), addressId: uuid() }),
      z.object({ mode: z.literal("per_item") }),
    ]),
    /** `null`: a receipt in the contact's name (an abbreviated tax invoice). */
    taxProfileId: uuid().nullable(),
    couponCodes: z.array(z.string().trim().min(1).max(40)).max(3),
    pointsToRedeem: z.number().int().min(0),
    /** One of the preview's `schedule.options[].key`; omitted = the API's default. */
    scheduleKey: z.string().optional(),
    paymentMethod: paymentMethod.optional(),
    poNumber: z.string().trim().max(60).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .meta({ id: "CheckoutInputDto" });

export const appliedPromotion = z
  .object({
    kind: promotionKind,
    code: z.string().nullable(),
    title: z.string(),
    discountAmount: money(),
    /** D-053 margin guard: the benefit was reduced; `cappedNote` says so in words. */
    capped: z.boolean(),
    cappedNote: z.string().nullable(),
  })
  .meta({ id: "AppliedPromotionDto" });

export const rejectedCode = z
  .object({
    code: z.string(),
    reason: z.enum(["not_found", "expired", "not_applicable", "used_up", "min_not_met", "not_combinable"]),
    message: z.string(),
  })
  .meta({ id: "RejectedPromotionCodeDto" });

export const scheduleInstalment = z
  .object({
    seq: z.number().int(),
    label: z.string(),
    dueTrigger,
    requiredBefore,
    grossAmount: money(),
  })
  .meta({ id: "ScheduleInstalmentDto" });

export const scheduleOption = z
  .object({
    key: z.string(),
    kind: z.enum(["full", "deposit", "template", "credit_term"]).meta({ id: "ScheduleKind" }),
    label: z.string(),
    description: z.string(),
    instalments: z.array(scheduleInstalment),
    /** B2B credit term: the number of days, when `kind = credit_term` (D-121). */
    creditDays: z.number().int().nullable(),
  })
  .meta({ id: "ScheduleOptionDto" });

export const paymentMethodOption = z
  .object({
    method: paymentMethod,
    available: z.boolean(),
    /** Why a method is not offered: over its limit, credit blocked (D-122)… */
    unavailableReason: z.string().nullable(),
    /** A fee the customer pays for this method, when there is one. */
    feeAmount: money().nullable(),
  })
  .meta({ id: "PaymentMethodOptionDto" });

export const checkoutPreview = z
  .object({
    /** The priced snapshot `POST /v1/store/checkout` places; it expires with `expiresAt`. */
    previewToken: z.string(),
    expiresAt: dateTime(),
    items: z.array(
      z.object({
        cartItemId: uuid(),
        name: z.string(),
        quantity: z.number().int(),
        unit: z.string(),
        grossAmount: money(),
        destinations: z.array(z.object({ label: z.string(), quantity: z.number().int() })),
      }),
    ),
    promotions: z.object({ applied: z.array(appliedPromotion), rejected: z.array(rejectedCode) }),
    points: z.object({
      balance: z.number().int(),
      /** D-133: at least THB 10 worth, at most 20 % of the order and never below the margin floor. */
      min: z.number().int(),
      max: z.number().int(),
      /** D-131, shown as "1 คะแนน = ฿2.50" — never multiplied here. */
      pointValue: money(),
      redeemed: z.number().int(),
      redeemedAmount: money(),
      /** Earned on this order once it completes and the claim window passes (D-130, D-132). */
      toEarn: z.number().int(),
    }),
    schedule: z.object({
      options: z.array(scheduleOption),
      selectedKey: z.string(),
      /** Why these options, in words: "ยอดตั้งแต่ ฿20,000 แบ่งชำระได้" (D-020 threshold from settings). */
      note: z.string().nullable(),
    }),
    paymentMethods: z.array(paymentMethodOption),
    taxInvoice: z
      .object({ name: z.string(), taxId: z.string(), branch: z.string(), withholdsTax: z.boolean() })
      .nullable(),
    totals: z.object({
      itemsAmount: money(),
      discountAmount: money(),
      shippingAmount: money(),
      pointsAmount: money(),
      vatAmount: money(),
      grossAmount: money(),
      /** What a withholding customer deducts and certifies (50 ทวิ); `0.00` otherwise. */
      withholdingAmount: money(),
      /** The first instalment — what is paid today. */
      payableNowAmount: money(),
      currency: currency(),
    }),
    blockers: z.array(z.object({ code: z.string(), message: z.string() })),
  })
  .meta({ id: "CheckoutPreviewDto" });

export const placedOrder = z
  .object({
    groupId: uuid(),
    groupCode: z.string(),
    orders: z.array(z.object({ id: uuid(), orderCode: z.string() })),
    grossAmount: money(),
    /** The instalment to pay now; `null` on a credit term (D-121). */
    firstInstalment: z
      .object({ id: uuid(), label: z.string(), grossAmount: money(), dueAt: dateTime().nullable() })
      .nullable(),
    /** D-060: unpaid orders expire at this time. */
    expiresAt: dateTime().nullable(),
  })
  .meta({ id: "PlacedOrderDto" });

/* ----------------------------------------------------------------------------------- payments */

export const storePayment = z
  .object({
    id: uuid(),
    instalmentId: uuid(),
    orderGroupCode: z.string(),
    method: paymentMethod,
    status: paymentStatus,
    amount: money(),
    currency: currency(),
    /** When a QR or a redirect stops being valid. */
    expiresAt: dateTime().nullable(),
    qr: z.object({ payload: z.string(), imageUrl: z.string() }).nullable(),
    /** 2C2P: where to send the customer; they come back to `/checkout/return`. */
    redirectUrl: z.string().nullable(),
    /** Bank transfer: Collective Group (Thailand)'s account for this payment (D-093, from settings). */
    bankAccount: z.object({ bank: z.string(), accountName: z.string(), accountNo: z.string() }).nullable(),
    slips: z.array(
      z.object({
        id: uuid(),
        status: slipStatus,
        message: z.string().nullable(),
        /** D-061: Finance reviews a failed check within 4 business hours. */
        reviewDueAt: dateTime().nullable(),
        uploadedAt: dateTime(),
      }),
    ),
    paidAt: dateTime().nullable(),
    failureReason: z.string().nullable(),
  })
  .meta({ id: "StorePaymentDto" });

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
  "GET /v1/store/me/addresses": request({
    request: "store.address-book",
    summary: "The customer's saved addresses",
    response: z.object({ data: z.array(customerAddress) }),
  }),
  "POST /v1/store/me/addresses": request({
    request: "store.address-book",
    summary: "Save an address; the first one becomes the default",
    body: addressInput,
    response: customerAddress,
    status: 201,
  }),
  "PATCH /v1/store/me/addresses/{addressId}": request({
    request: "store.address-book",
    summary: "Change a saved address or make it the default",
    body: addressInput.partial(),
    response: customerAddress,
  }),
  "DELETE /v1/store/me/addresses/{addressId}": request({
    request: "store.address-book",
    summary: "Remove a saved address (orders keep their snapshot)",
    status: 204,
  }),
  "GET /v1/store/me/tax-profiles": request({
    request: "store.address-book",
    summary: "The customer's tax-invoice profiles (individual, juristic, government; head office or branch)",
    decisions: ["D-125"],
    response: z.object({ data: z.array(taxProfile) }),
  }),
  "POST /v1/store/me/tax-profiles": request({
    request: "store.address-book",
    summary: "Save a tax-invoice profile; the API validates the tax id",
    body: taxProfileInput,
    response: taxProfile,
    status: 201,
  }),
  "PATCH /v1/store/me/tax-profiles/{profileId}": request({
    request: "store.address-book",
    summary: "Change a tax-invoice profile",
    body: taxProfileInput.partial(),
    response: taxProfile,
  }),
  "DELETE /v1/store/me/tax-profiles/{profileId}": request({
    request: "store.address-book",
    summary: "Remove a tax-invoice profile",
    status: 204,
  }),
  "POST /v1/store/checkout/actions/preview": request({
    request: "store.checkout",
    summary:
      "Price the checkout: promotions and their capped effect, points, payment schedules, methods, what is due now",
    decisions: ["D-020", "D-053", "D-110", "D-131", "D-133"],
    body: checkoutInput,
    response: checkoutPreview,
  }),
  "POST /v1/store/checkout": request({
    request: "store.checkout",
    summary: "Place the order group from a preview; 409 checkout.repriced with a fresh preview if anything moved since",
    decisions: ["D-020", "D-050", "D-060", "D-110"],
    body: checkoutInput.extend({ previewToken: z.string() }),
    response: placedOrder,
    status: 201,
    idempotent: true,
  }),
  "POST /v1/store/instalments/{instalmentId}/payments": request({
    request: "store.payments",
    summary: "Start paying an instalment with a method: a QR, a gateway redirect, or bank-transfer details",
    decisions: ["D-061"],
    body: z.object({ method: paymentMethod, returnUrl: z.string().url().optional() }),
    response: storePayment,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/store/payments/{paymentId}": request({
    request: "store.payments",
    summary: "A payment's live status — polled, and refreshed by the realtime channel",
    response: storePayment,
  }),
  "POST /v1/store/payments/{paymentId}/slips": request({
    request: "store.payments",
    summary: "Attach a transfer slip; verified at once, or reviewed by Finance within 4 business hours (D-061)",
    decisions: ["D-061"],
    body: z.object({ fileId: uuid(), declaredAmount: money(), declaredTransferredAt: dateTime() }),
    response: storePayment,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/store/instalments": request({
    request: "store.instalments",
    summary: "The customer's instalments across orders: what is due, what is paid, receipts",
    decisions: ["D-020"],
    query: listQuery({ status: instalmentStatus.optional() }),
    response: page(storeInstalment),
  }),
} as const;
