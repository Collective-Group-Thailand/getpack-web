/**
 * Requests for orders and order groups in the back office (F2 2.2, B3.1–B3.2).
 *
 * Shapes follow packio-api's approved schema design (§3.6 commerce, §3.7 fulfilment): the
 * enums are copied from the §4 catalogue, money uses the §2.9 amount set, and staff-only
 * columns (factory, buy cost, margin — D-141) are optional so the API can leave them out for a
 * role that may not see them. The detail is one page-shaped aggregate, because an order screen
 * needs all of it at once and ten round trips per open order is what makes a back office slow.
 */

import { z } from "zod";

import {
  currency,
  date,
  dateTime,
  fileRef,
  listQuery,
  money,
  nextAction,
  page,
  cursorPage,
  pct,
  request,
  userRef,
  uuid,
} from "./define";

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

/** How urgent a row is, judged by the API against the promise and the business calendar. */
export const urgency = z.enum(["normal", "due_soon", "late"]).meta({ id: "OrderUrgency" });

/** The six CS queues of F2 2.2 / B3.1, plus "everything". */
export const orderQueue = z
  .enum(["waiting_payment", "slip_review", "awaiting_artwork", "ready_to_produce", "due_soon", "late"])
  .meta({ id: "OrderQueue" });

/* ---------------------------------------------------------------------------------- pieces */

const amounts = {
  netAmount: money(),
  discountAmount: money(),
  shippingAmount: money(),
  vatAmount: money(),
  grossAmount: money(),
  currency: currency(),
};

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

export const instalment = z
  .object({
    id: uuid(),
    seq: z.number().int(),
    label: z.string(),
    dueTrigger,
    requiredBefore,
    dueAt: dateTime().nullable(),
    grossAmount: money(),
    paidAmount: money(),
    status: instalmentStatus,
  })
  .meta({ id: "InstalmentDto" });

/* ----------------------------------------------------------------------------------- list */

export const orderSummary = z
  .object({
    id: uuid(),
    orderCode: z.string(),
    groupId: uuid(),
    groupCode: z.string(),
    channel: salesChannel,
    customer: customerRef,
    productType: productTypeRef,
    /** Staff-visible; absent for a role the API hides it from. */
    factory: factoryRef.nullable().optional(),
    quantity: z.number().int(),
    unit: z.string(),
    grossAmount: money(),
    currency: currency(),
    status: orderStatus,
    artworkStatus,
    /** The instalment that matters next — what "รอชำระ" is waiting on. */
    nextInstalment: instalment.pick({ label: true, status: true, dueAt: true, grossAmount: true }).nullable(),
    /** A slip is waiting for Finance (D-061). */
    hasSlipToReview: z.boolean(),
    promisedShipDate: date().nullable(),
    /** The deadline of the queue this row is in, computed on the business calendar. */
    slaDueAt: dateTime().nullable(),
    urgency,
    createdAt: dateTime(),
  })
  .meta({ id: "OrderSummaryDto" });

/* --------------------------------------------------------------------------------- detail */

export const orderLine = z
  .object({
    lineNo: z.number().int(),
    lineType: orderLineType,
    description: z.string(),
    quantity: z.string().describe("Decimal quantity"),
    unit: z.string(),
    unitPrice: z.string().describe("Decimal, up to 6 places"),
    netAmount: money(),
    vatAmount: money(),
    grossAmount: money(),
    waivedReason: z.string().nullable(),
  })
  .meta({ id: "OrderLineDto" });

/** One part of a configuration (a box and its insert), with its own price — legacy "per-part prices". */
export const orderPart = z
  .object({
    name: z.string(),
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    unitPrice: z.string(),
    netAmount: money(),
  })
  .meta({ id: "OrderPartDto" });

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

export const slip = z
  .object({
    id: uuid(),
    file: fileRef(),
    declaredAmount: money(),
    declaredTransferredAt: dateTime(),
    verificationStatus: slipStatus,
    /** What the slip-verification adapter found (D-061). `null` = not checked yet. */
    checks: z
      .object({
        receiverMatched: z.boolean(),
        amountMatched: z.boolean(),
        dateMatched: z.boolean(),
        duplicate: z.boolean(),
      })
      .nullable(),
    slaDueAt: dateTime().nullable(),
    reviewedBy: userRef().nullable(),
    reviewNote: z.string().nullable(),
    uploadedAt: dateTime(),
  })
  .meta({ id: "SlipDto" });

export const payment = z
  .object({
    id: uuid(),
    method: paymentMethod,
    status: paymentStatus,
    amount: money(),
    feeAmount: money(),
    providerRef: z.string().nullable(),
    paidAt: dateTime().nullable(),
    slips: z.array(slip),
  })
  .meta({ id: "OrderPaymentDto" });

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

export const artworkSubmission = z
  .object({
    id: uuid(),
    versionNo: z.number().int(),
    source: z.enum(["upload", "designer", "design_service"]).meta({ id: "ArtworkSource" }),
    preflightStatus,
    findings: z.array(preflightFinding),
    files: z.array(fileRef()),
    submittedAt: dateTime(),
    submittedBy: userRef().nullable(),
  })
  .meta({ id: "ArtworkSubmissionDto" });

export const proofSummary = z
  .object({
    id: uuid(),
    versionNo: z.number().int(),
    status: proofStatus,
    sentAt: dateTime(),
    decidedAt: dateTime().nullable(),
    decisionChannel: z.enum(["web", "line_liff", "cs_on_behalf"]).nullable(),
    file: fileRef(),
    openAnnotations: z.number().int(),
  })
  .meta({ id: "ProofSummaryDto" });

export const milestone = z
  .object({
    seq: z.number().int(),
    key: z.string(),
    name: z.string(),
    status: milestoneStatus,
    dueAt: dateTime().nullable(),
    completedAt: dateTime().nullable(),
    onTime: z.boolean().nullable(),
  })
  .meta({ id: "JobMilestoneDto" });

export const jobSummary = z
  .object({
    id: uuid(),
    jobNo: z.string(),
    kind: z.enum(["production", "mockup", "reproduction"]).meta({ id: "JobKind" }),
    factory: factoryRef.nullable().optional(),
    status: productionJobStatus,
    acceptDueAt: dateTime().nullable(),
    promisedShipDate: date().nullable(),
    atRisk: z.boolean(),
    milestones: z.array(milestone),
  })
  .meta({ id: "JobSummaryDto" });

export const shipmentSummary = z
  .object({
    id: uuid(),
    shipmentNo: z.string(),
    status: shipmentStatus,
    carrier: z.enum(["factory_fleet", "flash_express", "deliveree"]).meta({ id: "CarrierCode" }),
    trackingNo: z.string().nullable(),
    destination: addressSnapshot,
    quantity: z.number().int(),
    cartons: z.number().int(),
    deliveredAt: dateTime().nullable(),
    pod: z
      .object({
        receiverName: z.string(),
        deliveredQuantity: z.number().int(),
        capturedAt: dateTime(),
        photos: z.array(fileRef()),
      })
      .nullable(),
  })
  .meta({ id: "ShipmentSummaryDto" });

export const customerDocument = z
  .object({
    id: uuid(),
    type: documentType,
    number: z.string(),
    status: documentStatus,
    issuedAt: dateTime(),
    grossAmount: money(),
    file: fileRef().nullable(),
  })
  .meta({ id: "CustomerDocumentSummaryDto" });

export const claimSummary = z
  .object({ id: uuid(), claimNo: z.string(), type: claimType, status: claimStatus, submittedAt: dateTime() })
  .meta({ id: "ClaimSummaryDto" });

/** D-141: present only for roles that may see buy cost and margin. */
export const orderMargin = z
  .object({ buyCostNet: money(), marginAmount: money(), marginPct: pct(), belowMarginFloor: z.boolean() })
  .meta({ id: "OrderMarginDto" });

export const orderDetail = orderSummary
  .extend({
    group: z.object({
      id: uuid(),
      groupCode: z.string(),
      status: orderGroupStatus,
      grossAmount: money(),
      orderCount: z.number().int(),
    }),
    ...amounts,
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    parts: z.array(orderPart),
    lines: z.array(orderLine),
    tolerance: z.object({ shortagePct: pct(), overagePct: pct() }),
    designOption,
    mockupOption,
    leadTimeDays: z.number().int(),
    confirmedProductionDate: date().nullable(),
    startMode: z.enum(["auto", "manual_exception"]).nullable(),
    destinations: z.array(addressSnapshot.extend({ id: uuid(), quantity: z.number().int() })),
    taxProfile: z
      .object({
        name: z.string(),
        taxId: z.string(),
        branch: z.string(),
        address: z.string(),
        withholdsTax: z.boolean(),
      })
      .nullable(),
    poNumber: z.string().nullable(),
    instalments: z.array(instalment),
    payments: z.array(payment),
    artwork: z.object({
      status: artworkStatus,
      submissions: z.array(artworkSubmission),
      proofs: z.array(proofSummary),
    }),
    jobs: z.array(jobSummary),
    shipments: z.array(shipmentSummary),
    documents: z.array(customerDocument),
    claims: z.array(claimSummary),
    margin: orderMargin.nullable().optional(),
    ccEmails: z.array(z.string()),
    csRemarks: z.string().nullable(),
    expiresAt: dateTime().nullable(),
    cancelledAt: dateTime().nullable(),
    cancelReason: z.string().nullable(),
    nextActions: z.array(nextAction()),
  })
  .meta({ id: "OrderDetailDto" });

export const timelineEntry = z
  .object({
    id: z.string(),
    at: dateTime(),
    /** `<resource>.<verb>`, e.g. `payment.received`, `proof.approved`, `milestone.completed`. */
    kind: z.string(),
    title: z.string(),
    detail: z.string().nullable(),
    actor: userRef().nullable(),
    visibility: z.enum(["internal", "customer", "partner"]).meta({ id: "ActivityVisibility" }),
    /** Promised vs actual (design-system.md §1.4), when the entry is a milestone. */
    promisedAt: dateTime().nullable(),
  })
  .meta({ id: "OrderTimelineEntryDto" });

export const orderNote = z
  .object({ id: uuid(), author: userRef(), body: z.string(), mentions: z.array(userRef()), createdAt: dateTime() })
  .meta({ id: "OrderNoteDto" });

export const cancelReason = z
  .object({ code: z.string(), name: z.string(), requiresCreditNote: z.boolean() })
  .meta({ id: "OrderCancelReasonDto" });

export const orderGroupDetail = z
  .object({
    id: uuid(),
    groupCode: z.string(),
    status: orderGroupStatus,
    channel: salesChannel,
    customer: customerRef,
    placedBy: userRef(),
    ...amounts,
    poNumber: z.string().nullable(),
    expiresAt: dateTime().nullable(),
    placedAt: dateTime(),
    orders: z.array(orderSummary),
    instalments: z.array(instalment),
  })
  .meta({ id: "OrderGroupDetailDto" });

/* ----------------------------------------------------------------------------------- requests */

export const adminOrderRequests = {
  "GET /v1/admin/orders": request({
    request: "admin.orders",
    summary: "Orders, optionally one CS queue (รอชำระ, รอตรวจสลิป, รอไฟล์, รอเริ่มผลิต, ใกล้ครบกำหนดส่ง, ล่าช้า)",
    decisions: ["D-060", "D-061", "D-073"],
    query: listQuery({
      queue: orderQueue.optional(),
      status: orderStatus.optional(),
      artworkStatus: artworkStatus.optional(),
      channel: salesChannel.optional(),
      productType: z.string().optional(),
      factoryId: uuid().optional(),
      createdFrom: date().optional(),
      createdTo: date().optional(),
    }),
    response: page(orderSummary),
  }),
  "GET /v1/admin/orders/{orderId}": request({
    request: "admin.orders",
    summary: "One order, everything the order screen shows, with the actions this actor may take now",
    response: orderDetail,
  }),
  "GET /v1/admin/orders/{orderId}/timeline": request({
    request: "admin.orders",
    summary: "The staff timeline: every event, including internal ones (B4.4)",
    query: z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().max(100).optional() }),
    response: cursorPage(timelineEntry),
  }),
  "GET /v1/admin/orders/{orderId}/notes": request({
    request: "admin.order-notes",
    summary: "Internal notes on an order, newest first",
    response: z.object({ data: z.array(orderNote) }),
  }),
  "POST /v1/admin/orders/{orderId}/notes": request({
    request: "admin.order-notes",
    summary: "Add an internal note; @mentioned staff are notified",
    body: z.object({ body: z.string().min(1).max(4000), mentions: z.array(uuid()) }),
    response: orderNote,
    status: 201,
  }),
  "GET /v1/admin/order-cancel-reasons": request({
    request: "admin.order-actions",
    summary: "Why an order can be cancelled, and which reasons need a credit note",
    response: z.object({ data: z.array(cancelReason) }),
  }),
  "POST /v1/admin/orders/{orderId}/actions/approve-slip": request({
    request: "admin.order-actions",
    summary: "Accept a slip that failed automatic verification (Finance, D-061)",
    decisions: ["D-061"],
    body: z.object({ slipId: uuid(), note: z.string().max(500).optional() }),
    response: orderDetail,
    idempotent: true,
  }),
  "POST /v1/admin/orders/{orderId}/actions/reject-slip": request({
    request: "admin.order-actions",
    summary: "Refuse a slip, with the reason the customer will see",
    body: z.object({ slipId: uuid(), reason: z.string().min(3).max(500) }),
    response: orderDetail,
  }),
  "POST /v1/admin/orders/{orderId}/actions/start-production": request({
    request: "admin.order-actions",
    summary: "Start production manually — an exception to the automatic gate, with a reason (D-073)",
    decisions: ["D-073"],
    body: z.object({ reason: z.string().min(3).max(500) }),
    response: orderDetail,
    idempotent: true,
  }),
  "POST /v1/admin/orders/{orderId}/actions/cancel": request({
    request: "admin.order-actions",
    summary: "Cancel an order with a reason code; paid amounts go to the refund / credit-note flow (B5)",
    body: z.object({ reasonCode: z.string(), note: z.string().max(1000).optional() }),
    response: orderDetail,
    idempotent: true,
  }),
  "POST /v1/admin/orders/{orderId}/actions/send-payment-reminder": request({
    request: "admin.order-actions",
    summary: "Remind the customer of the instalment that is due",
    status: 204,
  }),
  "POST /v1/admin/orders/{orderId}/actions/record-slip": request({
    request: "admin.order-actions",
    summary: "Upload a slip on the customer's behalf (legacy CS flow); it goes through verification like any other",
    body: z.object({
      instalmentId: uuid(),
      fileId: uuid(),
      declaredAmount: money(),
      declaredTransferredAt: dateTime(),
    }),
    response: orderDetail,
    idempotent: true,
  }),
  "POST /v1/admin/orders/actions/send-payment-reminders": request({
    request: "admin.order-actions",
    summary: "Bulk: remind the customers of several orders in the รอชำระ queue",
    body: z.object({ orderIds: z.array(uuid()).min(1).max(100) }),
    response: z.object({ sent: z.number().int(), skipped: z.array(z.object({ orderId: uuid(), reason: z.string() })) }),
  }),
  "GET /v1/admin/order-groups/{groupId}": request({
    request: "admin.orders",
    summary: "One checkout: its orders and its payment schedule",
    response: orderGroupDetail,
  }),
} as const;
