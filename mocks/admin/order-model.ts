/**
 * The shape the fake orders are kept in — the page aggregate F2 asked for, now only a fixture model.
 * The published order is lean (`AdminOrderDto`); `./orders.ts` and `../store/order-dto.ts` turn a
 * row into the contract's DTOs on the way out. Kept as zod so the rows stay checked while they are
 * built.
 */

import { z } from "zod";

import {
  addressSnapshot,
  artworkSource,
  artworkStatus,
  carrierCode,
  claimStatus,
  claimType,
  customerRef,
  designOption,
  documentStatus,
  documentType,
  dueTrigger,
  factoryRef,
  instalmentStatus,
  milestoneStatus,
  mockupOption,
  orderGroupStatus,
  orderLineType,
  orderStatus,
  paymentMethod,
  paymentStatus,
  preflightFinding,
  preflightStatus,
  productionJobStatus,
  productTypeRef,
  proofStatus,
  requiredBefore,
  salesChannel,
  shipmentStatus,
  slipStatus,
  urgency,
} from "@/lib/api/requests/admin-orders";
import { currency, date, dateTime, fileRef, money, nextAction, pct, userRef, uuid } from "@/lib/api/requests/define";

const amounts = {
  netAmount: money(),
  discountAmount: money(),
  shippingAmount: money(),
  vatAmount: money(),
  grossAmount: money(),
  currency: currency(),
};

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

export const artworkSubmission = z
  .object({
    id: uuid(),
    versionNo: z.number().int(),
    source: artworkSource,
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
    carrier: carrierCode,
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
