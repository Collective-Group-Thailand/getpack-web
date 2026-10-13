import { defineStatusMap } from "./types";
import type {
  DefectSeverity,
  ErpCheckResult,
  ErpGlAssetStatus,
  ErpGlBankLineStatus,
  ErpNcrStatus,
  ErpDocExpiry,
  ErpMachineState,
  ErpMaintenanceStatus,
  ErpOperationStatus,
  ErpProductionStatus,
  ErpPurchaseOrderStatus,
  ErpPurchaseRequestStatus,
  ErpRfqStatus,
  ErpRfqSupplierStatus,
  ErpSupplierApproval,
  ErpSupplierInvoiceStatus,
  ErpLeadStage,
  ErpOpportunityStage,
  ErpQuotationStatus,
  ErpSalesOrderStatus,
  ErpDeliveryStatus,
  ErpSalesInvoiceStatus,
  ErpIssuedStatus,
  ErpReceiptStatus,
  ErpWhtCertificateStatus,
} from "./contract";

/** A factory's own purchase order, Packio Factory ERP (D-325). */
export const ERP_PURCHASE_ORDER_STATUS = defineStatusMap<ErpPurchaseOrderStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "erpPurchaseOrder.draft" },
  issued: { tone: "info", icon: "send", labelKey: "erpPurchaseOrder.issued" },
  partially_received: { tone: "warning", icon: "package", labelKey: "erpPurchaseOrder.partiallyReceived" },
  received: { tone: "success", icon: "package-check", labelKey: "erpPurchaseOrder.received" },
  closed: { tone: "neutral", icon: "archive", labelKey: "erpPurchaseOrder.closed" },
  cancelled: { tone: "danger", icon: "ban", labelKey: "erpPurchaseOrder.cancelled" },
});

/** A purchase request (D-336). */
export const ERP_PURCHASE_REQUEST_STATUS = defineStatusMap<ErpPurchaseRequestStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "erpPurchaseRequest.draft" },
  submitted: { tone: "warning", icon: "hourglass", labelKey: "erpPurchaseRequest.submitted" },
  approved: { tone: "info", icon: "check", labelKey: "erpPurchaseRequest.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "erpPurchaseRequest.rejected" },
  ordered: { tone: "success", icon: "cart", labelKey: "erpPurchaseRequest.ordered" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "erpPurchaseRequest.cancelled" },
});

/** A supplier invoice the factory owes (D-337). */
export const ERP_SUPPLIER_INVOICE_STATUS = defineStatusMap<ErpSupplierInvoiceStatus>({
  matched: { tone: "info", icon: "file-check", labelKey: "erpSupplierInvoice.matched" },
  variance: { tone: "warning", icon: "warning", labelKey: "erpSupplierInvoice.variance" },
  approved: { tone: "info", icon: "check", labelKey: "erpSupplierInvoice.approved" },
  partially_paid: { tone: "warning", icon: "coins", labelKey: "erpSupplierInvoice.partiallyPaid" },
  paid: { tone: "success", icon: "check", labelKey: "erpSupplierInvoice.paid" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "erpSupplierInvoice.cancelled" },
});

/** A production order (D-340). */
export const ERP_PRODUCTION_STATUS = defineStatusMap<ErpProductionStatus>({
  planned: { tone: "neutral", icon: "calendar", labelKey: "erpProduction.planned" },
  released: { tone: "info", icon: "send", labelKey: "erpProduction.released" },
  in_progress: { tone: "warning", icon: "play", labelKey: "erpProduction.inProgress" },
  completed: { tone: "success", icon: "check", labelKey: "erpProduction.completed" },
  closed: { tone: "neutral", icon: "archive", labelKey: "erpProduction.closed" },
  cancelled: { tone: "danger", icon: "ban", labelKey: "erpProduction.cancelled" },
});

/** One operation of a production order on the floor (D-341). */
export const ERP_OPERATION_STATUS = defineStatusMap<ErpOperationStatus>({
  pending: { tone: "neutral", icon: "clock", labelKey: "erpOperation.pending" },
  in_progress: { tone: "warning", icon: "play", labelKey: "erpOperation.inProgress" },
  paused: { tone: "danger", icon: "pause", labelKey: "erpOperation.paused" },
  done: { tone: "success", icon: "check", labelKey: "erpOperation.done" },
  skipped: { tone: "neutral", icon: "minus", labelKey: "erpOperation.skipped" },
});

/** A request for quotation to several suppliers (D-348). */
export const ERP_RFQ_STATUS = defineStatusMap<ErpRfqStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "erpRfq.draft" },
  sent: { tone: "info", icon: "send", labelKey: "erpRfq.sent" },
  awarded: { tone: "success", icon: "check", labelKey: "erpRfq.awarded" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "erpRfq.cancelled" },
});

/** One supplier's answer to a request for quotation (D-348). */
export const ERP_RFQ_SUPPLIER_STATUS = defineStatusMap<ErpRfqSupplierStatus>({
  invited: { tone: "neutral", icon: "hourglass", labelKey: "erpRfqSupplier.invited" },
  quoted: { tone: "success", icon: "receipt", labelKey: "erpRfqSupplier.quoted" },
  declined: { tone: "danger", icon: "ban", labelKey: "erpRfqSupplier.declined" },
});

/** A supplier's standing on the approved supplier list for an item (D-351). */
export const ERP_SUPPLIER_APPROVAL = defineStatusMap<ErpSupplierApproval>({
  pending: { tone: "warning", icon: "hourglass", labelKey: "erpSupplierApproval.pending" },
  approved: { tone: "success", icon: "shield-check", labelKey: "erpSupplierApproval.approved" },
  suspended: { tone: "danger", icon: "ban", labelKey: "erpSupplierApproval.suspended" },
});

/** A maintenance order (D-355). */
export const ERP_MAINTENANCE_STATUS = defineStatusMap<ErpMaintenanceStatus>({
  open: { tone: "warning", icon: "warning", labelKey: "erpMaintenance.open" },
  scheduled: { tone: "info", icon: "calendar", labelKey: "erpMaintenance.scheduled" },
  in_progress: { tone: "warning", icon: "wrench", labelKey: "erpMaintenance.inProgress" },
  done: { tone: "success", icon: "check", labelKey: "erpMaintenance.done" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "erpMaintenance.cancelled" },
});

/** What a machine is doing now (D-353, D-355). */
export const ERP_MACHINE_STATE = defineStatusMap<ErpMachineState>({
  running: { tone: "success", icon: "play", labelKey: "erpMachine.running" },
  idle: { tone: "neutral", icon: "clock", labelKey: "erpMachine.idle" },
  down: { tone: "danger", icon: "warning", labelKey: "erpMachine.down" },
  maintenance: { tone: "warning", icon: "wrench", labelKey: "erpMachine.maintenance" },
});

/** Where a document stands against its expiry date (D-356). */
export const ERP_DOC_EXPIRY = defineStatusMap<ErpDocExpiry>({
  none: { tone: "neutral", icon: "document", labelKey: "erpDocExpiry.none" },
  valid: { tone: "success", icon: "check", labelKey: "erpDocExpiry.valid" },
  expiring: { tone: "warning", icon: "hourglass", labelKey: "erpDocExpiry.expiring" },
  expired: { tone: "danger", icon: "warning", labelKey: "erpDocExpiry.expired" },
});

/** A lead in the factory's CRM (D-359). */
export const ERP_LEAD_STAGE = defineStatusMap<ErpLeadStage>({
  new: { tone: "info", icon: "sparkles", labelKey: "erpLead.new" },
  contacted: { tone: "neutral", icon: "phone", labelKey: "erpLead.contacted" },
  qualified: { tone: "warning", icon: "star", labelKey: "erpLead.qualified" },
  converted: { tone: "success", icon: "check", labelKey: "erpLead.converted" },
  lost: { tone: "danger", icon: "ban", labelKey: "erpLead.lost" },
});

/** A sales opportunity's stage (D-359). */
export const ERP_OPPORTUNITY_STAGE = defineStatusMap<ErpOpportunityStage>({
  prospecting: { tone: "neutral", icon: "search", labelKey: "erpOpportunity.prospecting" },
  proposal: { tone: "info", icon: "document", labelKey: "erpOpportunity.proposal" },
  negotiation: { tone: "warning", icon: "handshake", labelKey: "erpOpportunity.negotiation" },
  won: { tone: "success", icon: "check", labelKey: "erpOpportunity.won" },
  lost: { tone: "danger", icon: "ban", labelKey: "erpOpportunity.lost" },
});

/** A quotation to the factory's own customer (D-360). */
export const ERP_QUOTATION_STATUS = defineStatusMap<ErpQuotationStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "erpQuotation.draft" },
  sent: { tone: "info", icon: "send", labelKey: "erpQuotation.sent" },
  accepted: { tone: "success", icon: "check", labelKey: "erpQuotation.accepted" },
  rejected: { tone: "danger", icon: "ban", labelKey: "erpQuotation.rejected" },
  expired: { tone: "warning", icon: "hourglass", labelKey: "erpQuotation.expired" },
  superseded: { tone: "neutral", icon: "history", labelKey: "erpQuotation.superseded" },
  cancelled: { tone: "neutral", icon: "close", labelKey: "erpQuotation.cancelled" },
});

/** A sales order (D-361). */
export const ERP_SALES_ORDER_STATUS = defineStatusMap<ErpSalesOrderStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "erpSalesOrder.draft" },
  confirmed: { tone: "info", icon: "check", labelKey: "erpSalesOrder.confirmed" },
  partially_delivered: { tone: "warning", icon: "truck", labelKey: "erpSalesOrder.partiallyDelivered" },
  delivered: { tone: "success", icon: "package-check", labelKey: "erpSalesOrder.delivered" },
  closed: { tone: "neutral", icon: "archive", labelKey: "erpSalesOrder.closed" },
  cancelled: { tone: "danger", icon: "ban", labelKey: "erpSalesOrder.cancelled" },
});

/** A delivery note (D-362). */
export const ERP_DELIVERY_STATUS = defineStatusMap<ErpDeliveryStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "erpDelivery.draft" },
  issued: { tone: "info", icon: "truck", labelKey: "erpDelivery.issued" },
  delivered: { tone: "success", icon: "package-check", labelKey: "erpDelivery.delivered" },
  cancelled: { tone: "danger", icon: "ban", labelKey: "erpDelivery.cancelled" },
});

/** A sales invoice / tax invoice (D-363). */
export const ERP_SALES_INVOICE_STATUS = defineStatusMap<ErpSalesInvoiceStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "erpSalesInvoice.draft" },
  issued: { tone: "info", icon: "receipt", labelKey: "erpSalesInvoice.issued" },
  partially_paid: { tone: "warning", icon: "coins", labelKey: "erpSalesInvoice.partiallyPaid" },
  paid: { tone: "success", icon: "check", labelKey: "erpSalesInvoice.paid" },
  voided: { tone: "danger", icon: "ban", labelKey: "erpSalesInvoice.voided" },
});

/** A credit or debit note (D-364). */
export const ERP_ISSUED_STATUS = defineStatusMap<ErpIssuedStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "erpIssued.draft" },
  issued: { tone: "success", icon: "check", labelKey: "erpIssued.issued" },
  voided: { tone: "danger", icon: "ban", labelKey: "erpIssued.voided" },
});

/** A receipt, refund or billing note (D-365). */
export const ERP_RECEIPT_STATUS = defineStatusMap<ErpReceiptStatus>({
  issued: { tone: "success", icon: "check", labelKey: "erpReceipt.issued" },
  cancelled: { tone: "danger", icon: "ban", labelKey: "erpReceipt.cancelled" },
});

/** A 50 ทวิ certificate (D-366). */
export const ERP_WHT_STATUS = defineStatusMap<ErpWhtCertificateStatus>({
  issued: { tone: "success", icon: "check", labelKey: "erpWht.issued" },
  voided: { tone: "danger", icon: "ban", labelKey: "erpWht.voided" },
});

/** A quality check's result (D-372). */
export const ERP_CHECK_RESULT = defineStatusMap<ErpCheckResult>({
  pending: { tone: "info", icon: "hourglass", labelKey: "erpCheck.pending" },
  pass: { tone: "success", icon: "check", labelKey: "erpCheck.pass" },
  conditional: { tone: "warning", icon: "flag", labelKey: "erpCheck.conditional" },
  fail: { tone: "danger", icon: "ban", labelKey: "erpCheck.fail" },
});

/** A nonconformance report (D-374). */
export const ERP_NCR_STATUS = defineStatusMap<ErpNcrStatus>({
  open: { tone: "danger", icon: "flag", labelKey: "erpNcr.open" },
  in_progress: { tone: "warning", icon: "wrench", labelKey: "erpNcr.in_progress" },
  verified: { tone: "info", icon: "shield-check", labelKey: "erpNcr.verified" },
  closed: { tone: "success", icon: "check", labelKey: "erpNcr.closed" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "erpNcr.cancelled" },
});

/** How serious a nonconformance is (D-374). */
export const ERP_NCR_SEVERITY = defineStatusMap<DefectSeverity>({
  minor: { tone: "neutral", icon: "info", labelKey: "erpNcrSeverity.minor" },
  major: { tone: "warning", icon: "warning", labelKey: "erpNcrSeverity.major" },
  critical: { tone: "danger", icon: "danger", labelKey: "erpNcrSeverity.critical" },
});

/** A bank statement line (D-394). */
export const ERP_GL_BANK_LINE_STATUS = defineStatusMap<ErpGlBankLineStatus>({
  open: { tone: "warning", icon: "hourglass", labelKey: "erpGlBankLine.open" },
  matched: { tone: "success", icon: "check", labelKey: "erpGlBankLine.matched" },
  ignored: { tone: "neutral", icon: "ban", labelKey: "erpGlBankLine.ignored" },
});

/** A fixed asset (D-393). */
export const ERP_GL_ASSET_STATUS = defineStatusMap<ErpGlAssetStatus>({
  active: { tone: "success", icon: "check", labelKey: "erpGlAsset.active" },
  disposed: { tone: "neutral", icon: "archive", labelKey: "erpGlAsset.disposed" },
  written_off: { tone: "danger", icon: "ban", labelKey: "erpGlAsset.written_off" },
});
