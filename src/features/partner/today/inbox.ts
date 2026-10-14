import type { IconName } from "@/ui/icons";

/**
 * D-399: where each ERP inbox item opens and the glyph it shows. One document opens that document; a count opens
 * the list it counts.
 */
export const INBOX_ICON: Record<string, IconName> = {
  purchase_request: "cart",
  invoice_variance: "scale",
  journal: "list-ordered",
  account_change: "layers",
  rule_version: "layers",
  receipt_late: "truck",
  receipt_today: "truck",
  po_draft: "document",
  stock_low: "warehouse",
  payable_overdue: "credit-card",
  payable_week: "credit-card",
  mo_late: "factory",
  mo_to_release: "play",
  machine_down: "wrench",
  ncr_due: "shield-alert",
  quotation_expiring: "document",
  so_draft: "cart",
  followup_today: "users",
  followup_late: "users",
  delivery_late: "truck",
  delivery_today: "truck",
  receivable_overdue: "coins",
  period_to_close: "lock",
  bank_lines: "credit-card",
  tax_due: "stamp",
  alerts: "bell",
};

const DOCUMENT_HREF: Record<string, (id: string) => string> = {
  erp_purchase_request: (id) => `/purchasing/requests/${id}`,
  erp_supplier_invoice: (id) => `/payables/invoices/${id}`,
  erp_gl_journal_entry: (id) => `/ledger/journals/${id}`,
  erp_gl_account_change: () => `/ledger/accounts?view=changes`,
  erp_gl_posting_rule: (id) => `/ledger/accounts/rules/${id}`,
  erp_purchase_order: (id) => `/purchasing/${id}`,
  erp_production_order: (id) => `/planning/orders/${id}`,
  erp_maintenance_order: (id) => `/maintenance/${id}`,
  erp_ncr: (id) => `/quality/ncrs/${id}`,
  erp_quotation: (id) => `/quotations/${id}`,
  erp_delivery_note: (id) => `/deliveries/${id}`,
  erp_gl_period: (id) => `/ledger/periods/${id}`,
  erp_gl_tax_filing: () => `/ledger#tax`,
};

const LIST_HREF: Record<string, string> = {
  purchase_request_more: "/purchasing/requests",
  invoice_variance_more: "/payables",
  journal_more: "/ledger/journals?view=pending",
  receipt_late_more: "/purchasing",
  po_draft: "/purchasing",
  stock_low: "/stock",
  payable_overdue: "/payables",
  payable_week: "/payables",
  mo_late_more: "/planning",
  mo_to_release: "/planning",
  ncr_due_more: "/quality/ncrs",
  so_draft: "/sales-orders",
  followup_today: "/crm",
  followup_late: "/crm",
  delivery_late_more: "/deliveries",
  receivable_overdue: "/receivables",
  bank_lines: "/ledger/bank",
  alerts: "/alerts",
};

export function inboxHref(item: { kind: string; document: { type: string; id: string } | null }): string {
  if (item.document) return DOCUMENT_HREF[item.document.type]?.(item.document.id) ?? "/";
  return LIST_HREF[item.kind] ?? "/";
}

export const inboxIcon = (kind: string): IconName => INBOX_ICON[kind.replace(/_more$/, "")] ?? "inbox";
