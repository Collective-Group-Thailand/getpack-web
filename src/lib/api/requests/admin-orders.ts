/**
 * Requests for the order desk that packio-api still has to build (U-B0.2): the cancel reasons and
 * the payment reminders. The orders, groups, notes, timeline and the other actions are published
 * (`admin.orders.*`, `admin.orderOperations.*`, U-F0.3).
 *
 * The enums and references below are shared by the other request files; their values are
 * packio-api's (§4 catalogue).
 */

import { z } from "zod";

import { request, uuid } from "./define";

/* ------------------------------------------------------------------------------------ enums */

export const orderStatus = z
  .enum([
    "waiting_payment",
    "paid_for_production",
    "artwork_approved",
    "in_production",
    "shipping",
    "completed",
    "cancelled",
  ])
  .meta({ id: "OrderStatus" });
export const orderGroupStatus = z
  .enum(["pending_company_approval", "waiting_payment", "in_progress", "completed", "cancelled"])
  .meta({ id: "OrderGroupStatus" });
export const artworkStatus = z
  .enum([
    "awaiting_template",
    "awaiting_upload",
    "uploaded",
    "in_review",
    "proof_sent",
    "changes_requested",
    "approved",
  ])
  .meta({ id: "ArtworkStatus" });
export const instalmentStatus = z
  .enum(["pending", "due", "partially_paid", "paid", "overdue", "cancelled", "refunded"])
  .meta({ id: "InstalmentStatus" });
export const paymentStatus = z
  .enum([
    "initiated",
    "pending",
    "awaiting_verification",
    "succeeded",
    "failed",
    "cancelled",
    "expired",
    "refunded",
    "partially_refunded",
  ])
  .meta({ id: "PaymentStatus" });
export const paymentMethod = z
  .enum([
    "scb_qr",
    "scb_qr_cross_bank",
    "card_2c2p",
    "online_banking_2c2p",
    "bank_transfer_slip",
    "store_credit",
    "credit_term_transfer",
  ])
  .meta({ id: "PaymentMethod" });
export const slipStatus = z
  .enum(["pending", "passed", "failed", "manual_review", "manual_approved", "manual_rejected"])
  .meta({ id: "SlipStatus" });
export const salesChannel = z.enum(["web", "cs", "line", "b2b"]).meta({ id: "SalesChannel" });
export const designOption = z
  .enum(["own_file", "online_designer", "hired_design", "free_design"])
  .meta({ id: "DesignOption" });
export const mockupOption = z.enum(["none", "with_print", "without_print"]).meta({ id: "MockupOption" });
export const orderLineType = z
  .enum([
    "product",
    "design_fee",
    "structure_design_fee",
    "mockup",
    "plate",
    "die_block",
    "shipping",
    "service",
    "extra_revision",
  ])
  .meta({ id: "OrderLineType" });
export const dueTrigger = z
  .enum(["at_checkout", "before_production", "before_shipping", "on_delivery", "days_after_delivery"])
  .meta({ id: "DueTrigger" });
export const requiredBefore = z.enum(["none", "production", "shipping"]).meta({ id: "RequiredBefore" });
export const productionJobStatus = z
  .enum(["released", "accepted", "rejected", "in_progress", "on_hold", "completed", "cancelled"])
  .meta({ id: "ProductionJobStatus" });
export const milestoneStatus = z
  .enum(["pending", "in_progress", "completed", "skipped"])
  .meta({ id: "MilestoneStatus" });
export const shipmentStatus = z
  .enum([
    "draft",
    "ready",
    "picked_up",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "failed",
    "returned",
    "cancelled",
  ])
  .meta({ id: "ShipmentStatus" });
export const claimStatus = z
  .enum(["submitted", "under_review", "need_info", "factory_review", "approved", "rejected", "resolved", "closed"])
  .meta({ id: "ClaimStatus" });
export const claimType = z
  .enum(["damaged", "wrong_spec", "print_defect", "quantity_short", "late", "other"])
  .meta({ id: "ClaimType" });
export const proofStatus = z
  .enum(["pending_customer", "approved", "changes_requested", "superseded"])
  .meta({ id: "ProofStatus" });
export const preflightStatus = z
  .enum(["pending", "running", "passed", "passed_with_warnings", "blocked", "error"])
  .meta({ id: "PreflightStatus" });
export const documentType = z.enum(["qt", "iv", "tr", "rc", "cn", "dn"]).meta({ id: "CustomerDocumentType" });
export const documentStatus = z.enum(["issued", "void"]).meta({ id: "CustomerDocumentStatus" });

export const artworkSource = z.enum(["upload", "designer", "design_service"]).meta({ id: "ArtworkSource" });

/** How urgent a row is, judged by the API against the promise and the business calendar. */
export const urgency = z.enum(["normal", "due_soon", "late"]).meta({ id: "OrderUrgency" });

/** The six CS queues of F2 2.2 / B3.1, plus "everything". */
export const orderQueue = z
  .enum(["waiting_payment", "slip_review", "awaiting_artwork", "ready_to_produce", "due_soon", "late"])
  .meta({ id: "OrderQueue" });

/* ---------------------------------------------------------------------------------- pieces */

export const customerRef = z
  .object({
    id: uuid(),
    customerCode: z.string(),
    displayName: z.string(),
    companyName: z.string().nullable(),
  })
  .meta({ id: "CustomerRefDto" });

export const productTypeRef = z.object({ code: z.string(), name: z.string() }).meta({ id: "ProductTypeRefDto" });
export const factoryRef = z.object({ id: uuid(), code: z.string(), name: z.string() }).meta({ id: "FactoryRefDto" });

/* ----------------------------------------------------------------------------------- list */

/* --------------------------------------------------------------------------------- detail */

export const addressSnapshot = z
  .object({
    recipientName: z.string(),
    phone: z.string(),
    line1: z.string(),
    line2: z.string().nullable(),
    subdistrict: z.string().nullable(),
    district: z.string().nullable(),
    province: z.string(),
    postcode: z.string(),
  })
  .meta({ id: "AddressSnapshotDto" });

export const preflightFinding = z
  .object({
    check: z
      .enum([
        "size_mismatch",
        "missing_bleed",
        "low_resolution",
        "rgb_colour",
        "fonts_not_embedded",
        "safe_zone",
        "thin_lines",
        "overprint",
        "ink_coverage",
      ])
      .meta({ id: "PreflightCheck" }),
    severity: z.enum(["block", "warn", "info"]).meta({ id: "PreflightSeverity" }),
    page: z.number().int().nullable(),
    message: z.string(),
  })
  .meta({ id: "PreflightFindingDto" });

/** Who carries it: the factory itself (D-013), or a Packio-booked fallback (D-114). */
export const carrierCode = z.enum(["factory_fleet", "flash_express", "deliveree"]).meta({ id: "CarrierCode" });

export const cancelReason = z
  .object({ code: z.string(), name: z.string(), requiresCreditNote: z.boolean() })
  .meta({ id: "OrderCancelReasonDto" });

/* ----------------------------------------------------------------------------------- requests */

export const adminOrderRequests = {
  "GET /v1/admin/order-cancel-reasons": request({
    request: "admin.order-actions",
    summary: "Why an order can be cancelled, and which reasons need a credit note",
    response: z.object({ data: z.array(cancelReason) }),
  }),
  "POST /v1/admin/orders/{orderId}/actions/send-payment-reminder": request({
    request: "admin.order-actions",
    summary: "Remind the customer of the instalment that is due",
    status: 204,
  }),
  "POST /v1/admin/orders/actions/send-payment-reminders": request({
    request: "admin.order-actions",
    summary: "Bulk: remind the customers of several orders in the รอชำระ queue",
    body: z.object({ orderIds: z.array(uuid()).min(1).max(100) }),
    response: z.object({ sent: z.number().int(), skipped: z.array(z.object({ orderId: uuid(), reason: z.string() })) }),
  }),
} as const;
