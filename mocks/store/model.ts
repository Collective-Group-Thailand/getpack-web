/**
 * The storefront mock's own records, where they differ from the published contract.
 *
 * These are the shapes the frontend once requested (F3) and the mocks were built around. Since
 * U-F0.2 the handlers answer with the published DTOs (`toCartDto`, `toSavedQuote`, …), projected
 * from these records; the records stay because the cart, checkout, RFQ and reorder mocks share
 * them and the admin zone's mocks still speak them until U-F0.3. Nothing in `src` may import this.
 */

import { z } from "zod";

import {
  addressSnapshot,
  designOption,
  dueTrigger,
  mockupOption,
  paymentMethod,
  paymentStatus,
  productTypeRef,
  requiredBefore,
  slipStatus,
} from "@/lib/api/requests/admin-orders";
import { promotionKind } from "@/lib/api/requests/admin-marketing";
import { quoteSource } from "@/lib/api/requests/store-quotes";
import { currency, dateTime, money, pct, uuid } from "@/lib/api/requests/define";

import {
  companyKycDocType,
  companyKycStatus,
  companyReceivables,
  companyStatus,
  creditStatus,
  poNumberPolicy,
} from "../admin/company-model";

/* ------------------------------------------------------------------------------------- cart */

export const cartItemState = z.enum(["ok", "repriced", "unavailable"]).meta({ id: "CartItemState" });

export const cartDestination = z
  .object({
    id: uuid(),
    /** A saved address; `null` while the customer has not picked one yet. */
    addressId: uuid().nullable(),
    address: addressSnapshot.nullable(),
    quantity: z.number().int().positive(),
  })
  .meta({ id: "CartDestinationDto" });

export const cartItem = z
  .object({
    id: uuid(),
    quote: z.object({ id: uuid(), quoteCode: z.string(), validUntil: dateTime(), source: quoteSource }),
    product: z.object({ slug: z.string(), name: z.string(), imageUrl: z.string().nullable() }),
    productType: productTypeRef,
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    quantity: z.number().int(),
    unit: z.string(),
    unitPrice: z.string().describe("Decimal, up to 6 places"),
    grossAmount: money(),
    currency: currency(),
    designOption,
    mockupOption,
    /** Design options this line may switch to; changing one re-prices the line. */
    designOptions: z.array(designOption),
    destinations: z.array(cartDestination),
    state: cartItemState,
    /**
     * `repriced`: the quote expired and the API priced it again — both figures, so the page can
     * say what changed. `unavailable`: it could not be priced again (no instant path any more).
     */
    repricing: z
      .object({
        previousUnitPrice: z.string(),
        previousGrossAmount: money(),
        reason: z.enum(["quote_expired", "configuration_changed"]).meta({ id: "CartRepriceReason" }),
      })
      .nullable(),
    unavailableReason: z.string().nullable(),
  })
  .meta({ id: "CartItemDto" });

export const storeCart = z
  .object({
    id: uuid(),
    items: z.array(cartItem),
    itemCount: z.number().int(),
    /** Before promotions, points and shipping — those are the checkout's (3.3). */
    subtotalAmount: money(),
    vatAmount: money(),
    currency: currency(),
    /** Every line is priced and confirmed and every quantity has an address. */
    readyForCheckout: z.boolean(),
    blockers: z.array(
      z.object({
        itemId: uuid().nullable(),
        code: z.enum(["reprice_unconfirmed", "item_unavailable", "destination_missing", "split_mismatch"]),
        message: z.string(),
      }),
    ),
    updatedAt: dateTime(),
  })
  .meta({ id: "StoreCartDto" });

export type Cart = z.output<typeof storeCart>;
export type Item = z.output<typeof cartItem>;

/* --------------------------------------------------------------------------------- checkout */

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
    /**
     * The buyer's company, when they check out as a member (F3 3.7): its PO rule (D-125), whether
     * this order goes to the approver first (D-123), and what credit is left (D-121, D-122).
     */
    company: z
      .object({
        companyCode: z.string(),
        legalName: z.string(),
        poNumberPolicy: z.enum(["required", "optional", "none"]),
        approvalThreshold: money().nullable(),
        needsApproval: z.boolean(),
        creditAvailableAmount: money(),
        creditBlocked: z.boolean(),
      })
      .nullable(),
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

export type Input = z.output<typeof checkoutInput>;
export type Preview = z.output<typeof checkoutPreview>;
export type Payment = z.output<typeof storePayment>;

/* ------------------------------------------------------------------------------------ company */

export const companyNotice = z
  .object({
    /** D-122: 7 days before, on the due date, and overdue (credit orders blocked after 7 days). */
    kind: z.enum(["due_soon", "due_today", "overdue", "credit_blocked"]).meta({ id: "CompanyNoticeKind" }),
    statementId: uuid().nullable(),
    period: z.string().nullable(),
    amount: money(),
    dueAt: dateTime().nullable(),
    daysOverdue: z.number().int(),
  })
  .meta({ id: "CompanyNoticeDto" });

const companyRole = z.enum(["company_admin", "company_buyer", "company_approver", "company_accountant"]);

/** A credit application as the mock keeps it until the back office decides (D-121). */
export const creditApplication = z.object({
  id: uuid(),
  status: z.enum(["submitted", "approved", "rejected"]),
  requestedLimit: money(),
  termDays: z.number().int(),
  basis: z.enum(["paid_orders", "financial_statement"]),
  submittedAt: dateTime(),
  decidedAt: dateTime().nullable(),
  note: z.string().nullable(),
  approvedLimit: money().nullable(),
});

export const storeCompany = z
  .object({
    id: uuid(),
    companyCode: z.string(),
    legalName: z.string(),
    taxId: z.string(),
    status: companyStatus,
    isVatRegistered: z.boolean(),
    /** The signed-in member's roles in this company. */
    myRoles: z.array(companyRole),
    /** What those roles allow here — the API's reading of them. */
    can: z.object({
      manageMembers: z.boolean(),
      manageSettings: z.boolean(),
      approveOrders: z.boolean(),
      viewFinance: z.boolean(),
      order: z.boolean(),
    }),
    poNumberPolicy,
    /** D-123: orders above it wait for the approver; `null` = no approval step. */
    orderApprovalThreshold: money().nullable(),
    /** D-124: the company's agreed discount, when there is one. */
    discountPct: pct().nullable(),
    credit: z.object({
      status: creditStatus,
      limitAmount: money(),
      availableAmount: money(),
      termDays: z.number().int().nullable(),
      /** D-121: eligible after 3 paid orders or a financial-statement review. */
      eligible: z.boolean(),
      paidOrdersCount: z.number().int(),
      paidOrdersNeeded: z.number().int(),
      /** The terms Finance offers (setting `b2b.credit_terms`). */
      allowedTerms: z.array(z.number().int()),
      application: creditApplication.nullable(),
    }),
    receivables: companyReceivables,
    notices: z.array(companyNotice),
    kyc: z.array(
      z.object({
        docType: companyKycDocType,
        status: companyKycStatus,
        note: z.string().nullable(),
        uploadedAt: dateTime(),
      }),
    ),
    /** Why the company is not active yet, in words, while KYC is under review or was returned. */
    statusNote: z.string().nullable(),
  })
  .meta({ id: "StoreCompanyDto" });

export const companyApproval = z
  .object({
    id: uuid(),
    requestNo: z.string(),
    status: z.enum(["pending", "approved", "rejected", "expired"]).meta({ id: "CompanyApprovalStatus" }),
    requestedBy: z.object({ id: uuid(), displayName: z.string() }),
    requestedAt: dateTime(),
    grossAmount: money(),
    /** The company threshold it went over (D-123). */
    threshold: money(),
    poNumber: z.string().nullable(),
    branch: z.string().nullable(),
    items: z.array(z.object({ name: z.string(), quantity: z.number().int(), unit: z.string(), grossAmount: money() })),
    scheduleLabel: z.string(),
    note: z.string().nullable(),
    decidedBy: z.object({ id: uuid(), displayName: z.string() }).nullable(),
    decidedAt: dateTime().nullable(),
    reason: z.string().nullable(),
    /** Once approved: the orders it placed. */
    orders: z.array(z.object({ id: uuid(), orderCode: z.string() })),
    /** An approval waits this long before it lapses and the price must be checked again. */
    expiresAt: dateTime(),
  })
  .meta({ id: "CompanyApprovalDto" });

export type StoreCompany = z.output<typeof storeCompany>;
export type CompanyApproval = z.output<typeof companyApproval>;
