import { defineStatusMap } from "./types";
import type {
  ErpOperationStatus,
  ErpProductionStatus,
  ErpPurchaseOrderStatus,
  ErpPurchaseRequestStatus,
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
  done: { tone: "success", icon: "check", labelKey: "erpOperation.done" },
  skipped: { tone: "neutral", icon: "minus", labelKey: "erpOperation.skipped" },
});
