import { defineStatusMap } from "./types";
import type {
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
