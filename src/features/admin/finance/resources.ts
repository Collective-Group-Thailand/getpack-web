/**
 * The finance lists, in a plain module so Server Components can prefetch the first page with the
 * same fetcher the client refetches with. All of them are packio-api's published B5 surface
 * except the dunning log (CONTRACT-REQUEST `admin.dunning-log`).
 */

import type { z } from "zod";

import type { dunningEntry, settlementSummary } from "@/lib/api/requests/admin-finance";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type SlipItem = Schemas["SlipQueueItemDto"];
export type Payment = Schemas["AdminPaymentDto"];
export type CustomerDocument = Schemas["CustomerDocumentDto"];
export type CreditNoteRequest = Schemas["CreditNoteRequestDto"];
export type Refund = Schemas["RefundDto"];
export type Receivable = Schemas["ReceivableItemDto"];
export type WhtCertificate = Schemas["WhtCertificateDto"];
export type DunningEntry = z.output<typeof dunningEntry>;

export const DOC_TYPES = ["tr", "iv", "rc", "cn", "dn"] as const satisfies readonly Schemas["CustomerDocumentType"][];
export const CN_KINDS = [
  "shortage",
  "claim",
  "cancellation",
  "price_reduction",
  "return",
  "discount",
] as const satisfies readonly Schemas["CreditNoteKind"][];
export const REFUND_STATUSES = [
  "pending_approval",
  "approved",
  "processing",
  "succeeded",
  "failed",
  "rejected",
] as const satisfies readonly Schemas["RefundStatus"][];
export const RECEIVABLE_STATUSES = [
  "open",
  "partially_paid",
  "paid",
  "written_off",
  "cancelled",
] as const satisfies readonly Schemas["ArItemStatus"][];

export const slipsList = defineList<SlipItem>({
  key: "slip",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/slips", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.groupCode ?? row.id.slice(0, 8),
  defaults: { sort: "slaDueAt", order: "asc" },
  staleTime: STALE_TIME.live,
});

export const paymentsList = defineList<Payment>({
  key: "payment",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/payments", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.referenceCode,
  defaults: { filterKeys: ["status", "method"], sort: "createdAt", order: "desc" },
});

export const documentsList = defineList<CustomerDocument>({
  key: "customer-document",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/customer-documents", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.docNumber,
  defaults: {
    filterKeys: ["docType", "status", "from", "to", "customerId", "companyId", "orderId"],
    sort: "issuedAt",
    order: "desc",
  },
});

export const creditRequestsList = defineList<CreditNoteRequest>({
  key: "credit-note-request",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/credit-note-requests", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.orderCode,
  defaults: { filterKeys: ["status"], sort: "createdAt", order: "desc" },
});

export const refundsList = defineList<Refund>({
  key: "refund",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/refunds", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  defaults: { filterKeys: ["status"], sort: "createdAt", order: "desc" },
});

export const receivablesList = defineList<Receivable>({
  key: "receivable",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/receivables", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.document.docNumber,
  defaults: { filterKeys: ["status", "overdue", "companyId", "customerId"], sort: "dueDate", order: "asc" },
});

export const whtCertificatesList = defineList<WhtCertificate>({
  key: "customer-wht-certificate",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/customer-wht-certificates", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.receipt.docNumber,
  defaults: {
    filterKeys: ["status", "olderThanDays"],
    filters: { status: "pending" },
    sort: "createdAt",
    order: "asc",
  },
});

export const dunningList = defineList<DunningEntry>({
  key: "dunning",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/dunning-log", { query: query as never }),
  getRowId: (row) => row.id,
  defaults: { filterKeys: ["companyId", "customerId", "documentId"] },
});

export type Journal = Schemas["JournalDto"];
export const JOURNAL_KINDS = [
  "auto",
  "manual",
  "reversal",
  "recurring",
  "closing",
] as const satisfies readonly Schemas["JournalKind"][];
export const JOURNAL_STATUSES = [
  "draft",
  "pending_approval",
  "posted",
  "rejected",
] as const satisfies readonly Schemas["JournalStatus"][];

export const journalsList = defineList<Journal>({
  key: "journal",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/ledger/journals", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.entryNo ?? row.id.slice(0, 8),
  defaults: {
    filterKeys: ["status", "kind", "accountCode", "periodId", "sourceType", "sourceId", "domainEventId", "from", "to"],
    sort: "entryDate",
    order: "desc",
  },
});

/* ------------------------------------------------------------------ 6.2 payables, payouts, bank */

export type PayableItem = Schemas["PayableDto"];
export type PurchaseOrder = Schemas["PurchaseOrderDto"];
export type GoodsReceipt = Schemas["GoodsReceiptDto"];
export type BillingStatement = Schemas["BillingStatementDto"];
export type VendorInvoice = Schemas["VendorInvoiceDto"];
export type Vendor = Schemas["VendorDto"];
export type PayoutRun = Schemas["PayoutRunDto"];
export type BankLine = Schemas["BankStatementLineDto"];
export type SettlementSummary = z.output<typeof settlementSummary>;

export const PAYABLE_STATUSES = [
  "open",
  "eligible",
  "in_run",
  "paid",
  "cancelled",
] as const satisfies readonly Schemas["PayableStatus"][];
export const PO_STATUSES = [
  "issued",
  "accepted",
  "received",
  "closed",
  "cancelled",
] as const satisfies readonly Schemas["PoStatus"][];
export const VENDOR_BILL_STATUSES = [
  "recorded",
  "validated",
  "rejected",
  "void",
] as const satisfies readonly Schemas["VendorInvoiceStatus"][];
export const BANK_MATCH_STATUSES = [
  "unmatched",
  "matched",
  "unidentified",
  "ignored",
] as const satisfies readonly Schemas["BankMatchStatus"][];

export const payablesList = defineList<PayableItem>({
  key: "payable",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/payables", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  defaults: { filterKeys: ["status", "vendorId"], sort: "eligibleAt", order: "asc" },
});

export const purchaseOrdersList = defineList<PurchaseOrder>({
  key: "purchase-order",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/purchase-orders", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.poNumber,
  defaults: { filterKeys: ["status", "factoryId"], sort: "issuedAt", order: "desc" },
});

export const goodsReceiptsList = defineList<GoodsReceipt>({
  key: "goods-receipt",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/goods-receipts", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.grNumber,
  defaults: { filterKeys: ["factoryId"], sort: "receivedOn", order: "desc" },
});

export const billingStatementsList = defineList<BillingStatement>({
  key: "billing-statement",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/billing-statements", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.bsNumber,
  defaults: { filterKeys: ["status", "factoryId"], sort: "periodTo", order: "desc" },
});

export const vendorInvoicesList = defineList<VendorInvoice>({
  key: "vendor-invoice",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/vendor-invoices", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.vendorInvoiceNo,
  defaults: { filterKeys: ["status", "vendorId"], sort: "invoiceDate", order: "desc" },
});

export const payoutRunsList = defineList<PayoutRun>({
  key: "payout-run",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/payout-runs", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.runNo,
  defaults: { sort: "payOn", order: "desc" },
});

export const bankLinesList = defineList<BankLine>({
  key: "bank-line",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/bank-statement-lines", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  defaults: {
    filterKeys: ["matchStatus", "companyBankAccountId"],
    filters: { matchStatus: "unmatched" },
    sort: "txnDate",
    order: "desc",
  },
});

export const settlementsList = defineList<SettlementSummary>({
  key: "gateway-settlement",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/gateway-settlements", { query: query as never }),
  getRowId: (row) => row.id,
  defaults: { filterKeys: ["status", "provider"], sort: "settlementDate", order: "desc" },
});
