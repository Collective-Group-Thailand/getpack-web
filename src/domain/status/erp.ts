import { defineStatusMap } from "./types";
import type { ErpPurchaseOrderStatus } from "./contract";

/** A factory's own purchase order, Packio Factory ERP (D-325). */
export const ERP_PURCHASE_ORDER_STATUS = defineStatusMap<ErpPurchaseOrderStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "erpPurchaseOrder.draft" },
  issued: { tone: "info", icon: "send", labelKey: "erpPurchaseOrder.issued" },
  partially_received: { tone: "warning", icon: "package", labelKey: "erpPurchaseOrder.partiallyReceived" },
  received: { tone: "success", icon: "package-check", labelKey: "erpPurchaseOrder.received" },
  closed: { tone: "neutral", icon: "archive", labelKey: "erpPurchaseOrder.closed" },
  cancelled: { tone: "danger", icon: "ban", labelKey: "erpPurchaseOrder.cancelled" },
});
