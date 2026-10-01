/**
 * Customer money, mocked over the published B5.2 surface: payments and the slip queue (D-061),
 * customer documents with gapless numbers (accounting-design §4), credit notes, refunds,
 * receivables with aging, write-offs and the allowance, customer 50 ทวิ, statements and store
 * credit.
 *
 * The documents are the commerce mock's orders' own: a paid instalment has its tax
 * invoice / receipt (TR, P01 / P02), a delivered order its final TR (P06). The companies mock's
 * two credit accounts have invoices (IV, P07) and collections net of the customer's withholding
 * (RC, P08). Everything posts through `books.post`, so the ledger, the tax papers and the AR
 * control account agree by construction.
 *
 * The slip image is the slip's own file (`SlipDto.fileId`, through `admin.files.download`), and
 * resending a document, its delivery log, the dunning log and the credit-note reasons are the
 * operations packio-api published in U-B0.3 (v0.6.0).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../../auth";
import { can, type StaffPersona } from "../../personas";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../../support";
import { baht, customers, decideSlip, onPaymentSettled, orders, slipUploadedBy, type MockOrder } from "../commerce";
import { companyOfCustomer } from "../companies";
import { registerQueue } from "../console";
import { approvals, onApprovalDecided, openApproval } from "../platform";
import { journalsOf, movement, post, satangOf, SELLER, today, type PostLine } from "./books";
import { finance, invalid, isMoney, notFound, persona } from "./support";

type Doc = Schemas["CustomerDocumentDto"];
type DocLine = Schemas["CustomerDocumentLineDto"];
type Payment = Schemas["AdminPaymentDto"];
type SlipItem = Schemas["SlipQueueItemDto"];
type Refund = Schemas["RefundDto"];
type CreditRequest = Schemas["CreditNoteRequestDto"];
type Receivable = Schemas["ReceivableItemDto"];
type Wht = Schemas["WhtCertificateDto"];
type StoreCreditEntry = Schemas["StoreCreditEntryDto"];
type Party = Schemas["DocumentPartyDto"];
type CnKind = Schemas["CreditNoteKind"];

const DAY = 24 * 60;
const VAT_RATE = "7.0000";
const vatOfGross = (gross: number) => Math.round((gross * 7) / 107);
const daysFromToday = (days: number) => bangkokIso(days * DAY).slice(0, 10);

/* ------------------------------------------------------------------------------- numbering */

/** `TR256910-00001`: type, Buddhist-era year, month, a gapless sequence per (type, month) — §4. */
const sequences = new Map<string, number>();
export function nextNumber(prefix: string, date: string, perYear = false): string {
  const year = Number(date.slice(0, 4)) + 543;
  const key = perYear ? `${prefix}${year}` : `${prefix}${year}${date.slice(5, 7)}`;
  const next = (sequences.get(key) ?? 0) + 1;
  sequences.set(key, next);
  return `${key}-${String(next).padStart(5, "0")}`;
}

/* ------------------------------------------------------------------------------- the parties */

function buyerOf(customerId: string): { party: Party; fullForm: boolean; customer: (typeof customers)[number] } {
  const customer = customers.find((candidate) => candidate.id === customerId) ?? customers[0]!;
  const profile = customer.taxProfiles.find((p) => p.isDefault) ?? customer.taxProfiles[0];
  return profile
    ? {
        party: { name: profile.name, taxId: profile.taxId, branchCode: profile.branchCode, address: profile.address },
        fullForm: true,
        customer,
      }
    : {
        party: { name: customer.displayName, taxId: null, branchCode: null, address: null },
        fullForm: false,
        customer,
      };
}

/** Spreads `total` over `weights` so the parts add up to it exactly (the last takes the remainder). */
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 0);
  const parts = weights.map((weight) => Math.round((total * weight) / sum));
  parts[parts.length - 1]! += total - parts.reduce((a, b) => a + b, 0);
  return parts;
}

/* ------------------------------------------------------------------------------- the stores */

export const documents: Doc[] = [];
export const payments: Payment[] = [];
export const receivables: Receivable[] = [];
export const whtCertificates: Wht[] = [];
export const refunds: Refund[] = [];
export const creditRequests: CreditRequest[] = [];
const storeCredit = new Map<string, StoreCreditEntry[]>();
/** Every customer's store credit, satang — the sub-ledger of 2320. */
export const storeCreditBalance = () =>
  [...storeCredit.values()].flat().reduce((sum, entry) => sum + Math.round(Number(entry.amount) * 100), 0);
/**
 * VAT each document adds to the tax point — what the sales tax report reads. A final TR adds only
 * what its instalments had not taxed; an IV on credit terms adds nothing until it is collected.
 */
export const taxedVat = new Map<string, { vat: number; base: number }>();
/** Who asked for each refund: they cannot record its payout (§8). */
const refundRequesters = new Map<string, string>();

/** A D-122 reminder as `admin.customerDocuments.dunningLog` lists it; `id` orders the mock's own rows. */
export type DunningEntry = Schemas["DunningEntryDto"] & { id: string };
export const dunning: DunningEntry[] = [];
/** Where each document went (`admin.customerDocuments.deliveries`), oldest first. */
const deliveries = new Map<string, Schemas["DocumentDeliveryDto"][]>();

/** An address as packio-api shows it to staff (PDPA): `s***@example.com`, or a LINE name's first letter. */
export function masked(address: string): string {
  const at = address.indexOf("@");
  return at > 0 ? `${address[0]}***${address.slice(at)}` : `${[...address][0] ?? ""}***`;
}

/**
 * packio-api's `ADMIN_DOCUMENT_ACTIONS` (receivables/document-actions.ts, v0.6.0): resend while
 * not void; void an IV or DN nothing was collected on. Filtered by the reader's permissions.
 */
function untouched(doc: Doc): boolean {
  const item = receivables.find((row) => row.document.id === doc.id);
  return !item || (item.status === "open" && satangOf(item.openAmount) === satangOf(item.amount));
}

export function documentActions(doc: Doc, who: StaffPersona | null | undefined): Doc["nextActions"] {
  if (!can(who ?? undefined, "receivables.manage")) return [];
  const actions: Doc["nextActions"] = [];
  if (doc.status !== "void")
    actions.push({ key: "customer_document.resend", irreversible: false, disabledReason: null });
  if (doc.status !== "void" && ["iv", "dn"].includes(doc.docType))
    actions.push({
      key: "customer_document.void",
      irreversible: true,
      disabledReason: untouched(doc) ? null : "receivables.document_settled",
    });
  return actions;
}

const withActions = (doc: Doc, who: StaffPersona | null | undefined): Doc => ({
  ...doc,
  nextActions: documentActions(doc, who),
});

const docById = (id: string | null | undefined) => documents.find((doc) => doc.id === id);
const orderOf = (id: string | null | undefined) => orders.find((order) => order.id === id);

interface IssueInput {
  docType: Doc["docType"];
  docKind: Doc["docKind"];
  date: string;
  issuedAt?: string;
  customerId: string;
  order: MockOrder | null;
  orderCode?: string | null;
  lines: { description: string; net: number; quantity?: string; discount?: number }[];
  /** Document-level VAT; the lines share it exactly. */
  vat: number;
  deductedPrior?: number;
  amountDue?: number;
  paymentId?: string | null;
  receiptVia?: Doc["receiptVia"];
  whtAmount?: number;
  cnKind?: CnKind | null;
  reason?: string | null;
  original?: Doc | null;
  dueDate?: string | null;
  /** What this document adds to the tax point; defaults to its own VAT and net. */
  taxed?: { vat: number; base: number };
}

export function issue(input: IssueInput): Doc {
  const { party, fullForm, customer } = buyerOf(input.customerId);
  const net = input.lines.reduce((sum, line) => sum + line.net, 0);
  const vats = allocate(
    input.vat,
    input.lines.map((line) => line.net),
  );
  const gross = net + input.vat;
  const wht = input.whtAmount ?? 0;
  const doc: Doc = {
    id: mockId("cdoc", documents.length + 1),
    docType: input.docType,
    docKind: input.docKind,
    docNumber: nextNumber(input.docType.toUpperCase(), input.date, input.docType === "iv"),
    documentDate: input.date,
    issuedAt: input.issuedAt ?? `${input.date}T10:00:00+07:00`,
    dueDate: input.dueDate ?? null,
    status: "issued",
    nextActions: [],
    seller: SELLER,
    buyer: party,
    isFullForm: fullForm && input.docType !== "iv",
    isTaxInvoice: ["tr", "cn", "dn"].includes(input.docType),
    taxNature: "hire_of_work",
    currency: "THB",
    netAmount: baht(net),
    vatAmount: baht(input.vat),
    vatRatePct: VAT_RATE,
    grossAmount: baht(gross),
    discountAmount: baht(input.lines.reduce((sum, line) => sum + (line.discount ?? 0), 0)),
    deductedPriorAmount: baht(input.deductedPrior ?? 0),
    amountDue: baht(input.amountDue ?? 0),
    whtAmount: baht(wht),
    cashAmount: baht(input.docType === "tr" || input.docType === "rc" ? gross - wht : 0),
    lines: input.lines.map((line, index): DocLine => ({
      lineNo: index + 1,
      description: line.description,
      quantity: line.quantity ?? "1.000",
      netAmount: baht(line.net),
      vatAmount: baht(vats[index]!),
      grossAmount: baht(line.net + vats[index]!),
      discountAmount: baht(line.discount ?? 0),
      whtAmount: baht(index === 0 ? wht : 0),
    })),
    orderId: input.order?.id ?? null,
    orderCode: input.order?.orderCode ?? input.orderCode ?? null,
    orderGroupId: input.order?.groupId ?? null,
    groupCode: input.order?.groupCode ?? null,
    paymentId: input.paymentId ?? null,
    receiptVia: input.receiptVia ?? null,
    cnKind: input.cnKind ?? null,
    reason: input.reason ?? null,
    originalDocument: input.original ? { id: input.original.id, docNumber: input.original.docNumber } : null,
    receivable: null,
    pdfReady: true,
    voidReason: null,
  };
  documents.push(doc);
  taxedVat.set(doc.id, input.taxed ?? { vat: input.vat, base: net });
  deliveries.set(doc.id, [
    {
      channel: "email",
      recipient: masked(customer.email ?? customer.displayName),
      status: "delivered",
      sentAt: doc.issuedAt,
      kind: "issued",
      requestedAt: doc.issuedAt,
    },
  ]);
  return doc;
}

export function customerOfDoc(doc: Doc): string {
  const order = orderOf(doc.orderId);
  if (order) return order.customer.id;
  const item = receivables.find((row) => row.document.id === doc.id || row.document.id === doc.originalDocument?.id);
  return (
    item?.customerId ??
    customers.find((c) => c.taxProfiles.some((p) => p.taxId === doc.buyer.taxId))?.id ??
    customers[0]!.id
  );
}

const dimsOf = (order: MockOrder | null, customerId: string): PostLine["dimensions"] => {
  const company = companyOfCustomer(customerId);
  return {
    customer: customerId,
    ...(order ? { order: order.id, orderGroup: order.groupId, channel: order.channel === "cs" ? "cs" : "web" } : {}),
    ...(company ? { company: company.id } : {}),
  };
};

const sourceOf = (doc: Doc) => ({ type: "customer_document", id: doc.id, number: doc.docNumber });

/* ------------------------------------------------------------------------------- payments */

/** The clearing account a method lands in (accounting-design §3): gateways, slips, the bank. */
export const CLEARING: Record<string, string> = {
  scb_qr: "1132",
  scb_qr_cross_bank: "1132",
  scb_direct_debit: "1132",
  card_2c2p: "1131",
  online_banking_2c2p: "1131",
  card_instalment_2c2p: "1131",
  bank_transfer_slip: "1133",
  credit_term_transfer: "1121",
  store_credit: "2320",
};
const VIA: Record<string, Doc["receiptVia"]> = {
  scb_qr: "scb",
  scb_qr_cross_bank: "scb",
  scb_direct_debit: "scb",
  card_2c2p: "twoc2p",
  online_banking_2c2p: "twoc2p",
  card_instalment_2c2p: "twoc2p",
  bank_transfer_slip: "slip",
  credit_term_transfer: "bank",
  store_credit: "store_credit",
};

type CommercePayment = MockOrder["payments"][number];

const lastCheckOf = (slip: CommercePayment["slips"][number]): Schemas["SlipCheckResult"] | null =>
  slip.checks?.duplicate
    ? "duplicate"
    : slip.checks && !slip.checks.amountMatched
      ? "mismatch"
      : slip.verificationStatus === "manual_review"
        ? "unreadable"
        : slip.checks
          ? "pass"
          : null;

/** The finance view of a commerce payment, kept in step with it (the order screen changes it too). */
function paymentFrom(order: MockOrder, source: CommercePayment): Payment {
  const existing = payments.find((payment) => payment.id === source.id);
  const refunded = existing && ["refunded", "partially_refunded"].includes(existing.status);
  const view: Payment = {
    id: source.id,
    groupId: order.groupId,
    method: source.method as Payment["method"],
    provider: source.method.startsWith("scb") ? "scb" : source.method.includes("2c2p") ? "2c2p" : "bank_transfer",
    providerRef: source.providerRef,
    status: refunded ? existing.status : (source.status as Payment["status"]),
    amount: source.amount,
    cashAmount: source.amount,
    whtAmount: "0.00",
    feeAmount: source.feeAmount,
    refundedAmount: existing?.refundedAmount ?? "0.00",
    currency: "THB",
    referenceCode: `REF${order.orderCode.slice(-5)}${source.id.slice(-2)}`,
    qrPayload: null,
    redirectUrl: null,
    expiresAt: null,
    failureReason: null,
    failureCode: null,
    paidAt: source.paidAt,
    createdAt: source.slips[0]?.uploadedAt ?? source.paidAt ?? order.createdAt,
    // The commerce payment keeps no receiving accounts (empty until Finance sets them, D-061).
    receiverAccounts: [],
    slips: source.slips.map((slip) => ({
      id: slip.id,
      fileId: slip.file.id,
      declaredAmount: slip.declaredAmount,
      declaredTransferredAt: slip.declaredTransferredAt,
      status: slip.verificationStatus as Schemas["SlipStatus"],
      lastCheck: lastCheckOf(slip),
      slaDueAt: slip.slaDueAt,
      createdAt: slip.uploadedAt,
    })),
  };
  if (!existing) {
    payments.push(view);
    return view;
  }
  Object.assign(existing, view);
  return existing;
}

/** Re-reads every commerce payment, so the finance lists show what the order screen did. */
function syncPayments() {
  for (const order of orders) for (const payment of order.payments) paymentFrom(order, payment);
}

export const orderOfPayment = (payment: Payment) => orders.find((order) => order.groupId === payment.groupId) ?? null;

/** P01 / P02: a paid instalment's tax invoice / receipt, with its journal. */
export function recordInstalment(
  order: MockOrder,
  input: { paymentId: string | null; method: string; gross: number; seq: number; paidAt: string; clearing?: string },
) {
  const orderVat = satangOf(order.vatAmount);
  const orderGross = satangOf(order.grossAmount);
  // A single instalment carries the order's own VAT; the last of several takes the remainder.
  const vat =
    input.gross === orderGross
      ? orderVat
      : input.seq === 1
        ? vatOfGross(input.gross)
        : orderVat - vatOfGross(orderGross - input.gross);
  const net = input.gross - vat;
  const date = input.paidAt.slice(0, 10);
  const label = order.instalments[input.seq - 1]?.label ?? "ชำระเงิน";
  const doc = issue({
    docType: "tr",
    docKind: "instalment",
    date,
    issuedAt: input.paidAt,
    customerId: order.customer.id,
    order,
    lines: [{ description: `งวดที่ ${input.seq} ${label} — คำสั่งซื้อ ${order.orderCode}`, net }],
    vat,
    paymentId: input.paymentId,
    receiptVia: VIA[input.method] ?? "bank",
  });
  const dims = dimsOf(order, order.customer.id);
  post({
    rule: input.clearing === "1140" ? "P29" : input.method === "bank_transfer_slip" ? "P02" : "P01",
    description: `รับชำระงวดที่ ${input.seq} ${order.orderCode}`,
    documentDate: date,
    postedAt: input.paidAt,
    source: sourceOf(doc),
    lines: [
      { account: input.clearing ?? CLEARING[input.method] ?? "1132", debit: input.gross, dimensions: dims },
      { account: "2310", credit: net, dimensions: dims },
      { account: "2210", credit: vat, dimensions: dims, taxCode: "output_vat", taxBase: net },
    ],
  });
  return doc;
}

/** P06 (+P09): the final TR at delivery — full value, the instalments already taxed deducted. */
export function recordDelivery(order: MockOrder, deliveredAt: string) {
  const prior = documents.filter(
    (doc) => doc.orderId === order.id && doc.docKind === "instalment" && doc.status === "issued",
  );
  const priorGross = prior.reduce((sum, doc) => sum + satangOf(doc.grossAmount), 0);
  const priorNet = prior.reduce((sum, doc) => sum + satangOf(doc.netAmount), 0);
  const priorVat = prior.reduce((sum, doc) => sum + satangOf(doc.vatAmount), 0);
  const date = deliveredAt.slice(0, 10);
  const discount = satangOf(order.discountAmount);
  const lines = order.lines.map((line) => ({
    description: line.description,
    net: satangOf(line.netAmount),
    quantity: line.quantity,
    discount: line.lineType === "product" ? discount : 0,
  }));
  const vat = satangOf(order.vatAmount);
  const net = lines.reduce((sum, line) => sum + line.net, 0);
  const remainingNet = net - priorNet;
  const remainingVat = vat - priorVat;
  const doc = issue({
    docType: "tr",
    docKind: "final",
    date,
    issuedAt: deliveredAt,
    customerId: order.customer.id,
    order,
    lines,
    vat,
    deductedPrior: priorGross,
    amountDue: Math.max(0, remainingNet + remainingVat),
    taxed: { vat: remainingVat, base: remainingNet },
  });
  const dims = dimsOf(order, order.customer.id);
  post({
    rule: "P06",
    description: `ส่งมอบแล้ว รับรู้รายได้ ${order.orderCode}`,
    documentDate: date,
    postedAt: deliveredAt,
    source: sourceOf(doc),
    lines: [
      { account: "2310", debit: priorNet, dimensions: dims },
      { account: "1210", debit: remainingNet + remainingVat, dimensions: dims },
      ...(discount ? [{ account: "4910", debit: discount, dimensions: dims, description: "ส่วนลด (P09)" }] : []),
      ...order.lines.map((line) => ({
        account: line.lineType === "shipping" ? "4150" : line.lineType === "design_fee" ? "4130" : "4110",
        credit: satangOf(line.netAmount) + (line.lineType === "product" ? discount : 0),
        dimensions: dims,
        description: line.description,
      })),
      {
        account: "2210",
        credit: remainingVat,
        dimensions: dims,
        taxCode: "output_vat" as const,
        taxBase: remainingNet,
      },
    ],
  });
  if (remainingNet + remainingVat > 0) openReceivable(doc, order.customer.id, date);
  return doc;
}

function openReceivable(doc: Doc, customerId: string, dueDate: string): Receivable {
  const company = companyOfCustomer(customerId);
  const open = satangOf(doc.amountDue) || satangOf(doc.grossAmount);
  const item: Receivable = {
    id: mockId("ar", receivables.length + 1),
    document: { id: doc.id, docNumber: doc.docNumber },
    customerId,
    customerName: buyerOf(customerId).customer.displayName,
    companyId: company?.id ?? null,
    companyName: company?.legalName ?? null,
    orderCode: doc.orderCode,
    amount: baht(open),
    openAmount: baht(open),
    currency: "THB",
    dueDate,
    status: "open",
    writeOffApprovalId: null,
  };
  receivables.push(item);
  doc.receivable = { id: item.id, openAmount: item.openAmount, status: item.status };
  return item;
}

function syncReceivable(item: Receivable) {
  const doc = docById(item.document.id);
  if (doc) doc.receivable = { id: item.id, openAmount: item.openAmount, status: item.status };
}

/** P07: an invoice on credit terms — output VAT not yet due until it is paid (§2). */
function issueCreditInvoice(
  customer: (typeof customers)[number],
  input: { gross: number; date: string; dueDate: string; orderCode: string },
) {
  const vat = vatOfGross(input.gross);
  const net = input.gross - vat;
  const doc = issue({
    docType: "iv",
    docKind: "delivery",
    date: input.date,
    customerId: customer.id,
    order: null,
    orderCode: input.orderCode,
    lines: [{ description: `บรรจุภัณฑ์ตามใบสั่งซื้อ ${input.orderCode} (เครดิตเทอม)`, net }],
    vat,
    amountDue: input.gross,
    dueDate: input.dueDate,
    taxed: { vat: 0, base: 0 },
  });
  const dims = dimsOf(null, customer.id);
  post({
    rule: "P07",
    description: `ใบแจ้งหนี้เครดิตเทอม ${input.orderCode}`,
    documentDate: input.date,
    postedAt: `${input.date}T10:00:00+07:00`,
    source: sourceOf(doc),
    lines: [
      { account: "1210", debit: input.gross, dimensions: dims },
      { account: "4110", credit: net, dimensions: dims },
      { account: "2211", credit: vat, dimensions: dims, taxCode: "output_vat_not_due", taxBase: net },
    ],
  });
  return openReceivable(doc, customer.id, input.dueDate);
}

/** P08: a credit-term collection, net of the customer's withholding, with its RC and a 50 ทวิ to chase. */
export function collect(
  item: Receivable,
  input: { at: string; whtPct: number; via: string; paymentId?: string | null },
) {
  const invoice = docById(item.document.id)!;
  const gross = satangOf(item.openAmount);
  const net = satangOf(invoice.netAmount);
  const vat = satangOf(invoice.vatAmount);
  const wht = Math.round((net * input.whtPct) / 100);
  const date = input.at.slice(0, 10);
  const paymentId = input.paymentId ?? mockId("pay", 900 + payments.length);
  payments.push({
    id: paymentId,
    groupId: null,
    method: "credit_term_transfer",
    provider: "bank_transfer",
    providerRef: `CT-${invoice.docNumber}`,
    status: "succeeded",
    amount: baht(gross),
    cashAmount: baht(gross - wht),
    whtAmount: baht(wht),
    feeAmount: "0.00",
    refundedAmount: "0.00",
    currency: "THB",
    referenceCode: invoice.docNumber,
    qrPayload: null,
    redirectUrl: null,
    expiresAt: null,
    failureReason: null,
    failureCode: null,
    paidAt: input.at,
    createdAt: input.at,
    slips: [],
    receiverAccounts: [],
  });
  const receipt = issue({
    docType: "rc",
    docKind: "collection",
    date,
    issuedAt: input.at,
    customerId: item.customerId,
    order: null,
    orderCode: invoice.orderCode,
    lines: [{ description: `รับชำระตามใบแจ้งหนี้ ${invoice.docNumber}`, net }],
    vat,
    whtAmount: wht,
    original: invoice,
    receiptVia: "bank",
    paymentId,
    // The tax point is the payment: the invoice's VAT becomes due now (P08).
    taxed: { vat, base: net },
  });
  const dims = dimsOf(null, item.customerId);
  post({
    rule: "P08",
    description: `รับชำระ ${invoice.docNumber}`,
    documentDate: date,
    postedAt: input.at,
    source: sourceOf(receipt),
    lines: [
      { account: input.via, debit: gross - wht, dimensions: dims },
      { account: "1230", debit: wht, dimensions: dims, taxCode: "wht_receivable", taxBase: net },
      { account: "1210", credit: gross, dimensions: dims },
      { account: "2211", debit: vat, dimensions: dims, taxCode: "output_vat_not_due", taxBase: net },
      { account: "2210", credit: vat, dimensions: dims, taxCode: "output_vat", taxBase: net },
    ],
  });
  Object.assign(item, { openAmount: "0.00", status: "paid" });
  invoice.amountDue = "0.00";
  syncReceivable(item);
  if (wht > 0)
    whtCertificates.push({
      id: mockId("cwht", whtCertificates.length + 1),
      receipt: { id: receipt.id, docNumber: receipt.docNumber },
      customerId: item.customerId,
      customerName: item.customerName,
      companyName: item.companyName,
      whtBase: baht(net),
      whtAmount: baht(wht),
      status: "pending",
      certificateNo: null,
      certificateDate: null,
      fileId: null,
      createdAt: input.at,
    });
  return receipt;
}

/* ---------------------------------------------------------------------------- credit notes */

/** The statutory reason each credit-note kind maps to (§2 "controlled list"). */
export const CN_REASONS: Record<CnKind, string> = {
  shortage: "shortage_within_tolerance",
  claim: "defective_goods",
  cancellation: "cancellation_before_production",
  price_reduction: "price_reduction",
  return: "returned_goods",
  discount: "post_sale_discount",
};

/** packio-api's seeded reason list (`prisma/seed/data/receivables.ts`), as `admin.customerDocuments.listCreditNoteReasons` returns it. */
export const REASONS = [
  [
    "cancellation_before_production",
    "cancellation",
    "ยกเลิกคำสั่งซื้อก่อนผลิต",
    "Order cancelled before production",
    "both",
    "credit",
  ],
  [
    "shortage_within_tolerance",
    "defective_or_short",
    "สินค้าขาดจำนวนภายในเกณฑ์ที่ตกลง",
    "Shortage within the agreed tolerance",
    "item",
    "credit",
  ],
  [
    "defective_goods",
    "defective_or_short",
    "สินค้าชำรุดบกพร่องหรือไม่ตรงตามที่ตกลง",
    "Defective or non-conforming goods",
    "item",
    "credit",
  ],
  ["short_delivery", "defective_or_short", "สินค้าขาดจำนวน", "Short delivery", "item", "credit"],
  ["returned_goods", "returns", "รับคืนสินค้า", "Goods returned", "item", "credit"],
  ["price_reduction", "price_reduction", "ลดราคาสินค้า/บริการ", "Price reduction", "both", "credit"],
  [
    "service_shortfall",
    "price_reduction",
    "บริการไม่ครบตามข้อตกลง",
    "Service below the agreement",
    "service",
    "credit",
  ],
  ["post_sale_discount", "post_sale_discount", "ส่วนลดหลังการขาย", "Discount after sale", "both", "credit"],
  ["additional_charge", "other", "เพิ่มราคาสินค้า/บริการ", "Additional charge (debit note)", "both", "debit"],
  ["price_increase", "other", "ราคาเพิ่มตามข้อตกลง", "Agreed price increase (debit note)", "both", "debit"],
].map(([code, statutoryCategory, nameTh, nameEn, appliesTo, direction]) => ({
  code: code!,
  statutoryCategory: statutoryCategory as
    "cancellation" | "defective_or_short" | "returns" | "price_reduction" | "post_sale_discount" | "other",
  nameTh: nameTh!,
  nameEn: nameEn!,
  appliesTo: appliesTo as "item" | "service" | "both",
  direction: direction as "credit" | "debit",
}));

/** P19 / P20 / P23: a credit note against the order's tax invoice, settled to credit or the receivable. */
export function issueCreditNote(input: {
  order: MockOrder;
  original: Doc;
  gross: number;
  cnKind: CnKind;
  reasonCode: string;
  note: string;
  settleTo: Schemas["CreditSettlement"];
  at: string;
  approvedBy?: string | null;
}): Doc {
  const vat = vatOfGross(input.gross);
  const net = input.gross - vat;
  const date = input.at.slice(0, 10);
  const doc = issue({
    docType: "cn",
    docKind: "credit_note",
    date,
    issuedAt: input.at,
    customerId: input.order.customer.id,
    order: input.order,
    lines: [{ description: `ลดหนี้ตาม ${input.original.docNumber}: ${input.note}`, net }],
    vat,
    cnKind: input.cnKind,
    reason: input.reasonCode,
    original: input.original,
    // The tax point runs backwards: output VAT comes down by the credit's VAT.
    taxed: { vat: -vat, base: -net },
  });
  const dims = dimsOf(input.order, input.order.customer.id);
  const receivable =
    input.settleTo === "receivable"
      ? receivables.find(
          (item) =>
            ["open", "partially_paid"].includes(item.status) &&
            documents.some((d) => d.id === item.document.id && d.orderId === input.order.id),
        )
      : undefined;
  post({
    rule: input.cnKind === "claim" ? "P20" : input.cnKind === "cancellation" ? "P23" : "P19",
    description: `ใบลดหนี้ ${input.order.orderCode}`,
    documentDate: date,
    postedAt: input.at,
    source: sourceOf(doc),
    approvedBy: input.approvedBy ?? null,
    lines: [
      { account: input.cnKind === "cancellation" ? "2310" : "4920", debit: net, dimensions: dims },
      { account: "2210", debit: vat, dimensions: dims, taxCode: "output_vat", taxBase: -net },
      { account: receivable ? "1210" : "2320", credit: input.gross, dimensions: dims },
    ],
  });
  if (receivable) {
    const open = Math.max(0, satangOf(receivable.openAmount) - input.gross);
    Object.assign(receivable, { openAmount: baht(open), status: open === 0 ? "paid" : "partially_paid" });
    syncReceivable(receivable);
  } else {
    const entries = storeCredit.get(input.order.customer.id) ?? [];
    entries.push({
      id: mockId("scr", 100 + documents.length),
      amount: baht(input.gross),
      source: input.cnKind === "shortage" ? "shortage_credit" : input.cnKind === "claim" ? "claim" : "cancellation",
      docNumber: doc.docNumber,
      orderCode: input.order.orderCode,
      createdAt: input.at,
    });
    storeCredit.set(input.order.customer.id, entries);
  }
  return doc;
}

/** The tax invoices of an order a credit note can go against, and what is left to credit (satang). */
export function creditableOf(order: MockOrder) {
  const invoices = documents.filter(
    (doc) => doc.orderId === order.id && doc.docType === "tr" && doc.status === "issued",
  );
  const invoiced = invoices.reduce(
    (sum, doc) => sum + satangOf(doc.grossAmount) - satangOf(doc.deductedPriorAmount),
    0,
  );
  const credited =
    documents
      .filter((doc) => doc.orderId === order.id && doc.docType === "cn" && doc.status === "issued")
      .reduce((sum, doc) => sum + satangOf(doc.grossAmount), 0) +
    creditRequests
      .filter((request) => request.orderId === order.id && request.status === "pending_approval")
      .reduce((sum, request) => sum + satangOf(request.amount), 0);
  return { invoices, available: invoiced - credited };
}

function requestCreditNote(
  order: MockOrder,
  original: Doc,
  requester: ReturnType<typeof persona>,
  body: Schemas["RequestCreditNoteDto"],
): CreditRequest {
  const id = mockId("cnr", creditRequests.length + 1);
  const settleTo =
    body.settleTo ??
    (receivables.some(
      (r) => documents.some((d) => d.id === r.document.id && d.orderId === order.id) && r.status === "open",
    )
      ? "receivable"
      : "store_credit");
  const approval = openApproval({
    policy: "credit_note",
    subjectType: "customer_document",
    subjectId: id,
    requester,
    amount: body.amount,
    payload: {
      orderCode: order.orderCode,
      originalDocument: original.docNumber,
      cnKind: body.cnKind,
      note: body.note,
      settleTo,
    },
  });
  const request: CreditRequest = {
    id,
    orderId: order.id,
    orderCode: order.orderCode,
    amount: body.amount,
    cnKind: body.cnKind,
    reasonCode: body.reasonCode ?? CN_REASONS[body.cnKind],
    note: body.note,
    settleTo,
    status: "pending_approval",
    approvalRequestId: approval.id,
    creditNote: null,
    claimNo: null,
    createdAt: bangkokIso(),
  };
  creditRequests.unshift(request);
  return request;
}

onApprovalDecided("credit_note", (approval, outcome, decider) => {
  const request = creditRequests.find((item) => item.id === approval.subjectId);
  const order = request ? orderOf(request.orderId) : undefined;
  if (!request || !order) return;
  if (outcome === "rejected") {
    request.status = "rejected";
    return;
  }
  const original = creditableOf(order).invoices.at(-1)!;
  const doc = issueCreditNote({
    order,
    original,
    gross: satangOf(request.amount),
    cnKind: request.cnKind,
    reasonCode: request.reasonCode,
    note: request.note,
    settleTo: request.settleTo ?? "store_credit",
    at: bangkokIso(),
    approvedBy: decider.id,
  });
  Object.assign(request, { status: "issued", creditNote: { id: doc.id, docNumber: doc.docNumber } });
});

/* -------------------------------------------------------------------------------- refunds */

function requestRefund(
  payment: Payment,
  requester: ReturnType<typeof persona>,
  body: Schemas["RequestRefundDto"],
): Refund {
  const id = mockId("rfd", refunds.length + 1);
  const channel = body.channel ?? (payment.provider === "2c2p" ? "original_gateway" : "bank_transfer");
  const approval = openApproval({
    policy: "refund",
    subjectType: "refund",
    subjectId: id,
    requester,
    amount: body.amount,
    payload: { paymentReference: payment.referenceCode, channel, reasonNote: body.reasonNote },
  });
  const refund: Refund = {
    id,
    paymentId: payment.id,
    groupId: payment.groupId,
    amount: body.amount,
    currency: "THB",
    channel,
    status: "pending_approval",
    reasonNote: body.reasonNote,
    approvalRequestId: approval.id,
    providerRef: null,
    failureReason: null,
    completedAt: null,
    createdAt: bangkokIso(),
  };
  refunds.unshift(refund);
  refundRequesters.set(id, requester.id);
  return refund;
}

/** What a payment can still give back (satang): paid, less refunded, less refunds on their way. */
function refundableOf(payment: Payment) {
  const inFlight = refunds
    .filter(
      (refund) =>
        refund.paymentId === payment.id && ["pending_approval", "approved", "processing"].includes(refund.status),
    )
    .reduce((sum, refund) => sum + satangOf(refund.amount), 0);
  return satangOf(payment.amount) - satangOf(payment.refundedAmount) - inFlight;
}

/** P22: the money goes back — cash out of its channel, the customer's credit comes down. */
function settleRefund(refund: Refund, providerRef: string) {
  const payment = payments.find((item) => item.id === refund.paymentId)!;
  const amount = satangOf(refund.amount);
  const order = orderOfPayment(payment);
  const customerId = order?.customer.id ?? customers[0]!.id;
  post({
    rule: "P22",
    description: `คืนเงิน ${payment.referenceCode}`,
    documentDate: today(),
    source: { type: "refund", id: refund.id, number: payment.referenceCode },
    lines: [
      { account: "2320", debit: amount, dimensions: dimsOf(order, customerId) },
      {
        account: refund.channel === "original_gateway" ? (CLEARING[payment.method] ?? "1131") : "1121",
        credit: amount,
      },
    ],
  });
  Object.assign(refund, { status: "succeeded", providerRef, completedAt: bangkokIso() });
  const refunded = satangOf(payment.refundedAmount) + amount;
  Object.assign(payment, {
    refundedAmount: baht(refunded),
    status: refunded >= satangOf(payment.amount) ? "refunded" : "partially_refunded",
  });
  const entries = storeCredit.get(customerId) ?? [];
  entries.push({
    id: mockId("scr", 300 + refunds.length + entries.length),
    amount: baht(-amount),
    source: "refunded",
    docNumber: null,
    orderCode: order?.orderCode ?? null,
    createdAt: bangkokIso(),
  });
  storeCredit.set(customerId, entries);
}

onApprovalDecided("refund", (approval, outcome) => {
  const refund = refunds.find((item) => item.id === approval.subjectId);
  if (!refund) return;
  if (outcome === "rejected") refund.status = "rejected";
  // A gateway refund goes out by API; a bank transfer waits for Finance to record it.
  else if (refund.channel === "original_gateway") settleRefund(refund, `2C2P-RF-${refund.id.slice(-4)}`);
  else refund.status = "approved";
});

/* --------------------------------------------------------------------------- write-offs */

onApprovalDecided("write_off", (approval, outcome, decider) => {
  const item = receivables.find((row) => row.id === approval.subjectId);
  if (!item) return;
  if (outcome === "rejected") {
    item.writeOffApprovalId = null;
    return;
  }
  const amount = satangOf(item.openAmount);
  post({
    rule: "P30",
    description: `ตัดหนี้สูญ ${item.document.docNumber}`,
    documentDate: today(),
    source: { type: "receivable_item", id: item.id, number: item.document.docNumber },
    approvedBy: decider.id,
    lines: [
      { account: "1219", debit: amount, dimensions: { customer: item.customerId } },
      { account: "1210", credit: amount, dimensions: { customer: item.customerId } },
    ],
  });
  Object.assign(item, { openAmount: "0.00", status: "written_off" });
  syncReceivable(item);
});

/* ------------------------------------------------------------------------------- the seed */

for (const order of orders) {
  for (const payment of order.payments) {
    paymentFrom(order, payment);
    if (payment.status !== "succeeded" || !payment.paidAt) continue;
    recordInstalment(order, {
      paymentId: payment.id,
      method: payment.method,
      gross: satangOf(order.instalments[0]!.grossAmount),
      seq: 1,
      paidAt: payment.paidAt,
    });
  }
  // The balance before shipping (D-020), paid by QR — a payment of its own.
  const second = order.instalments[1];
  if (second?.status === "paid") {
    const paidAt = bangkokIso(-60 * 30);
    const id = mockId("pay", 500 + orders.indexOf(order));
    payments.push({
      id,
      groupId: order.groupId,
      method: "scb_qr",
      provider: "scb",
      providerRef: `TXN${9000 + orders.indexOf(order)}`,
      status: "succeeded",
      amount: second.grossAmount,
      cashAmount: second.grossAmount,
      whtAmount: "0.00",
      feeAmount: "0.00",
      refundedAmount: "0.00",
      currency: "THB",
      referenceCode: `REF${order.orderCode.slice(-5)}02`,
      qrPayload: null,
      redirectUrl: null,
      expiresAt: null,
      failureReason: null,
      failureCode: null,
      paidAt,
      createdAt: paidAt,
      slips: [],
      receiverAccounts: [],
    });
    recordInstalment(order, { paymentId: id, method: "scb_qr", gross: satangOf(second.grossAmount), seq: 2, paidAt });
  }
  if (order.status === "completed") recordDelivery(order, bangkokIso(-9 * DAY));
}

/*
 * B2B on credit terms (D-121, D-125): the companies mock's two credit accounts — the first owes
 * THB 84,000 not yet due, the second THB 61,500 of which 38,200 is 12 days overdue (D-122).
 * Each has had an invoice collected net of a 3 % withholding; one 50 ทวิ came back, one did not.
 */
const CREDIT_SEEDS: {
  customer: number;
  gross: number;
  dueIn: number;
  issuedAgo: number;
  collectedAgo?: number;
  certificate?: boolean;
}[] = [
  { customer: 1, gross: 5_000_000, dueIn: 20, issuedAgo: 10 },
  { customer: 1, gross: 3_400_000, dueIn: 9, issuedAgo: 21 },
  { customer: 1, gross: 2_140_000, dueIn: -2, issuedAgo: 32, collectedAgo: 3 },
  { customer: 1, gross: 1_070_000, dueIn: 4, issuedAgo: 26, collectedAgo: 6, certificate: true },
  { customer: 7, gross: 3_820_000, dueIn: -12, issuedAgo: 42 },
  { customer: 7, gross: 2_330_000, dueIn: 18, issuedAgo: 12 },
];
CREDIT_SEEDS.forEach((seed, index) => {
  const item = issueCreditInvoice(customers[seed.customer]!, {
    gross: seed.gross,
    date: daysFromToday(-seed.issuedAgo),
    dueDate: daysFromToday(seed.dueIn),
    orderCode: `PK-2569-B${String(index + 1).padStart(4, "0")}`,
  });
  if (seed.collectedAgo === undefined) return;
  collect(item, { at: bangkokIso(-seed.collectedAgo * DAY), whtPct: 3, via: "1121" });
  if (seed.certificate)
    Object.assign(whtCertificates.at(-1)!, {
      status: "received",
      certificateNo: "50T-6909-0118",
      certificateDate: daysFromToday(-seed.collectedAgo + 1),
      fileId: mockId("fil", 8801),
    });
});

/* Dunning (D-122): reminders 7 days before and on the due date, again 7 days after. */
for (const item of receivables.filter((row) => row.status === "open" && row.companyId)) {
  const doc = docById(item.document.id)!;
  const customer = customers.find((c) => c.id === item.customerId)!;
  const due = Date.parse(`${item.dueDate}T09:00:00+07:00`);
  const reminders = [
    { kind: "before_due" as const, at: due - 7 * 86_400_000 },
    { kind: "on_due" as const, at: due },
    { kind: "overdue" as const, at: due + 7 * 86_400_000 },
  ].filter((reminder) => reminder.at < Date.now());
  for (const reminder of reminders)
    for (const channel of ["email", "line"] as const) {
      const remindedAt = `${new Date(reminder.at + 7 * 3_600_000).toISOString().slice(0, 19)}+07:00`;
      const failed = channel === "line" && reminder.kind === "overdue";
      dunning.push({
        id: mockId("dun", dunning.length + 1),
        documentId: doc.id,
        docNumber: doc.docNumber,
        customerId: item.customerId,
        companyId: item.companyId,
        stage: reminder.kind,
        remindedAt,
        channel,
        recipient: masked(channel === "email" ? (customer.email ?? customer.displayName) : customer.displayName),
        status: failed ? "failed" : channel === "email" ? "delivered" : "sent",
        sentAt: failed ? null : remindedAt,
      });
    }
}

/* A shortage within tolerance credited to the customer's balance (D-080, P19), and a claim credit waiting. */
{
  const completed = orders.filter((order) => order.status === "completed");
  const first = completed[0]!;
  issueCreditNote({
    order: first,
    original: documents.find((doc) => doc.orderId === first.id && doc.docKind === "final")!,
    gross: 35_000,
    cnKind: "shortage",
    reasonCode: CN_REASONS.shortage,
    note: "สินค้าขาด 1.2% อยู่ในเกณฑ์ที่ตกลง คืนเป็นเครดิต (D-080)",
    settleTo: "store_credit",
    at: bangkokIso(-7 * DAY),
  });
  const second = completed[1]!;
  const request = requestCreditNote(second, creditableOf(second).invoices.at(-1)!, persona("cs_lead"), {
    amount: "1284.00",
    cnKind: "claim",
    note: "พิมพ์สีเพี้ยนบางส่วน ลูกค้าขอส่วนลดแทนการผลิตใหม่ (ข้อมูลจำลอง)",
    settleTo: "store_credit",
  });
  request.createdAt = bangkokIso(-5 * 60);
}

/* One refund waiting for the Finance Manager, one approved and waiting for the transfer. */
{
  const paid = payments.filter((payment) => payment.status === "succeeded");
  const waiting = requestRefund(paid[0]!, persona("cs_lead"), {
    amount: "350.00",
    reasonNote: "ลูกค้าขอรับยอดเครดิตคืนเป็นเงินโอน (ข้อมูลจำลอง)",
    channel: "bank_transfer",
  });
  waiting.createdAt = bangkokIso(-90);
  // Asked for by Finance, approved by the Finance Manager: waiting for someone other than the
  // requester to record the transfer (§8).
  const approved = requestRefund(paid[1]!, persona("finance"), {
    amount: "500.00",
    reasonNote: "ลูกค้าโอนเกินยอดงวด คืนส่วนเกิน (ข้อมูลจำลอง)",
    channel: "bank_transfer",
  });
  Object.assign(approved, { status: "approved", createdAt: bangkokIso(-DAY) });
  const manager = persona("finance_manager");
  const approval = approvals.find((item) => item.id === approved.approvalRequestId)!;
  Object.assign(approval, {
    status: "approved",
    currentStepNo: null,
    decidedAt: bangkokIso(-DAY + 60),
    createdAt: bangkokIso(-DAY),
    steps: approval.steps.map((step) => ({ ...step, status: "approved", completedAt: bangkokIso(-DAY + 60) })),
    actions: [
      {
        action: "approve",
        actor: { id: manager.id, displayName: manager.displayName },
        at: bangkokIso(-DAY + 60),
        comment: "ตรวจยอดโอนเกินกับรายการธนาคารแล้ว (ข้อมูลจำลอง)",
        onBehalfOf: null,
        stepNo: 1,
      },
    ],
  });
}

/** Commerce payments that succeed from now on get their TR and journal (P01 / P02). */
onPaymentSettled((order, payment) => {
  const view = paymentFrom(order, payment);
  const seq = Math.max(1, order.instalments.filter((item) => item.status === "paid").length);
  recordInstalment(order, {
    paymentId: view.id,
    method: payment.method,
    gross: satangOf((order.instalments[seq - 1] ?? order.instalments[0]!).grossAmount),
    seq,
    paidAt: payment.paidAt ?? bangkokIso(),
  });
});

/* ---------------------------------------------------------------------------- queues */

export function pendingSlips(): SlipItem[] {
  syncPayments();
  return orders.flatMap((order) =>
    order.payments.flatMap((payment) =>
      payment.slips
        .filter((slip) => slip.verificationStatus === "manual_review")
        .map((slip): SlipItem => ({
          id: slip.id,
          fileId: slip.file.id,
          paymentId: payment.id,
          groupId: order.groupId,
          groupCode: order.groupCode,
          declaredAmount: slip.declaredAmount,
          declaredTransferredAt: slip.declaredTransferredAt,
          expectedAmount: payment.amount,
          lastCheck: lastCheckOf(slip),
          slaDueAt: slip.slaDueAt,
          overdue: slip.slaDueAt ? Date.parse(slip.slaDueAt) < Date.now() : false,
          status: "manual_review",
          createdAt: slip.uploadedAt,
        })),
    ),
  );
}

registerQueue("payments.verify_slip", () => {
  const slips = pendingSlips();
  return {
    key: "finance.slips",
    path: "/admin/finance/slips",
    count: slips.length,
    overdueCount: slips.filter((slip) => slip.overdue).length,
    nextDueAt:
      slips
        .map((slip) => slip.slaDueAt)
        .filter((at): at is string => Boolean(at))
        .sort()[0] ?? null,
  };
});
registerQueue("receivables.manage", () => {
  const pending = whtCertificates.filter((item) => item.status === "pending");
  return {
    key: "finance.wht_certificates_missing",
    path: "/admin/finance/receivables/wht",
    count: pending.length,
    overdueCount: pending.filter((item) => Date.parse(item.createdAt) < Date.now() - 30 * 86_400_000).length,
    nextDueAt: null,
  };
});
registerQueue("receivables.read", () => {
  const overdue = receivables.filter(
    (item) => item.companyId && ["open", "partially_paid"].includes(item.status) && item.dueDate < today(),
  );
  return {
    key: "finance.overdue_b2b_invoices",
    path: "/admin/finance/receivables?overdue=true",
    count: overdue.length,
    overdueCount: overdue.length,
    nextDueAt: null,
  };
});
registerQueue("refunds.complete", (who) => {
  const waiting = refunds.filter(
    (refund) => refund.status === "approved" && refundRequesters.get(refund.id) !== who.id,
  );
  return {
    key: "finance.refunds_to_pay",
    path: "/admin/finance/refunds?status=approved",
    count: waiting.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});

/* ---------------------------------------------------------------------------- handlers */

/** Days past due into the aging buckets (AgingBucketsDto). */
function bucketOf(dueDate: string, asOf: string): keyof Schemas["AgingBucketsDto"] {
  const days = Math.floor((Date.parse(asOf) - Date.parse(dueDate)) / 86_400_000);
  return days <= 0 ? "current" : days <= 30 ? "d1_30" : days <= 60 ? "d31_60" : days <= 90 ? "d61_90" : "over_90";
}
const emptyBuckets = () => ({ current: 0, d1_30: 0, d31_60: 0, d61_90: 0, over_90: 0 });
const toBuckets = (b: ReturnType<typeof emptyBuckets>): Schemas["AgingBucketsDto"] => ({
  current: baht(b.current),
  d1_30: baht(b.d1_30),
  d31_60: baht(b.d31_60),
  d61_90: baht(b.d61_90),
  over_90: baht(b.over_90),
});

const sort = <T>(rows: T[], query: { sort?: string; order?: "asc" | "desc" }, field: string, order: "asc" | "desc") =>
  sortBy(rows, query.sort ?? field, query.order ?? order);

export const receivableHandlers = [
  /* Payments and slips (D-061) */
  finance.get("/v1/admin/slips", "payments.read", ({ query }) =>
    paginate(
      sort(
        pendingSlips().filter((slip) => matchesQuery(query.q, slip.groupCode)),
        query,
        "slaDueAt",
        "asc",
      ),
      query,
    ),
  ),
  // admin.files.download for a slip's file (SlipDto.fileId): whoever reviews slips may read it
  // (packio-api's file policy, D-061). Any other file falls through to the next handler.
  http.get("*/v1/admin/files/:fileId/download", ({ params, request }) => {
    const slip = orders.flatMap((o) => o.payments.flatMap((p) => p.slips)).find((s) => s.file.id === params.fileId);
    if (!slip) return undefined;
    const who = staffPersonaOf(request);
    if (!who) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    if (!can(who, "payments.verify_slip") && !can(who, "payments.read"))
      return problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
    return HttpResponse.json({ url: SLIP_IMAGE, expiresAt: bangkokIso(5) } satisfies Schemas["DownloadUrlDto"]);
  }),
  finance.post(
    "/v1/admin/slips/{slipId}/actions/review",
    { permission: "payments.verify_slip", idempotent: true },
    ({ params, body, persona: who }) => {
      const order = orders.find((o) => o.payments.some((p) => p.slips.some((s) => s.id === params.slipId)));
      if (!order) return notFound("สลิป");
      if (slipUploadedBy.get(params.slipId!) === who.id)
        return problem(403, "sod.self_review", "ผู้อัปโหลดสลิปตรวจสลิปของตัวเองไม่ได้ (D-061)");
      if (body.approve) {
        if (!body.bankTransRef?.trim())
          return invalid([{ path: "bankTransRef", code: "required", message: "กรอกเลขอ้างอิงรายการจากธนาคาร" }]);
        if (payments.some((p) => p.providerRef === body.bankTransRef!.trim()))
          return problem(409, "payments.slip_duplicate", "เลขอ้างอิงนี้ถูกใช้กับการชำระเงินอื่นแล้ว (สลิปซ้ำ)");
      } else if (!body.note?.trim()) {
        return invalid([{ path: "note", code: "required", message: "ระบุเหตุผลที่ไม่อนุมัติ" }]);
      }
      const result = decideSlip(order, params.slipId!, who, {
        approve: body.approve,
        note: body.note?.trim() || null,
        bankTransRef: body.bankTransRef?.trim() ?? null,
        receivedAmount: body.receivedAmount ?? null,
      });
      return result instanceof Response ? result : paymentFrom(order, result.payment);
    },
  ),
  finance.get("/v1/admin/payments", "payments.read", ({ query }) => {
    syncPayments();
    const rows = payments
      .filter((p) => !query.status || p.status === query.status)
      .filter((p) => !query.method || p.method === query.method)
      // `?groupId&orderId` (admin.payments.list, v0.5.0): a payment belongs to its group's orders.
      .filter((p) => !query.groupId || p.groupId === query.groupId)
      .filter((p) => !query.orderId || orders.some((o) => o.id === query.orderId && o.groupId === p.groupId))
      .filter((p) =>
        matchesQuery(
          query.q,
          p.referenceCode,
          p.providerRef,
          orderOfPayment(p)?.orderCode,
          orderOfPayment(p)?.groupCode,
        ),
      );
    return paginate(sort(rows, query, "createdAt", "desc"), query);
  }),
  finance.get("/v1/admin/payments/{paymentId}", "payments.read", ({ params }) => {
    syncPayments();
    return payments.find((p) => p.id === params.paymentId) ?? notFound("การชำระเงิน");
  }),
  finance.post(
    "/v1/admin/payments/{paymentId}/refunds",
    { permission: "refunds.request", idempotent: true, status: 201 },
    ({ params, body, persona: who }) => {
      const payment = payments.find((p) => p.id === params.paymentId);
      if (!payment) return notFound("การชำระเงิน");
      if (!["succeeded", "partially_refunded"].includes(payment.status))
        return problem(409, "refunds.not_refundable", "การชำระเงินนี้คืนเงินไม่ได้");
      const refundable = refundableOf(payment);
      if (!isMoney(body.amount) || satangOf(body.amount) <= 0 || satangOf(body.amount) > refundable)
        return invalid([{ path: "amount", code: "max", message: `คืนได้ไม่เกิน ${baht(refundable)} บาท` }]);
      if (!body.reasonNote?.trim()) return invalid([{ path: "reasonNote", code: "required", message: "ระบุเหตุผล" }]);
      return requestRefund(payment, who, body);
    },
  ),
  finance.get("/v1/admin/refunds", "payments.read", ({ query }) =>
    paginate(
      sort(
        refunds.filter((r) => !query.status || r.status === query.status),
        query,
        "createdAt",
        "desc",
      ),
      query,
    ),
  ),
  finance.get(
    "/v1/admin/refunds/{refundId}",
    "payments.read",
    ({ params }) => refunds.find((r) => r.id === params.refundId) ?? notFound("การคืนเงิน"),
  ),
  finance.post(
    "/v1/admin/refunds/{refundId}/actions/complete",
    { permission: "refunds.complete", idempotent: true },
    ({ params, body, persona: who }) => {
      const refund = refunds.find((r) => r.id === params.refundId);
      if (!refund) return notFound("การคืนเงิน");
      if (refundRequesters.get(refund.id) === who.id)
        return problem(403, "sod.self_complete", "ผู้ขอคืนเงินบันทึกการโอนคืนของตัวเองไม่ได้");
      if (refund.status !== "approved") return problem(409, "refunds.not_approved", "การคืนเงินนี้ยังไม่ได้รับอนุมัติ");
      if (!body.providerRef?.trim())
        return invalid([{ path: "providerRef", code: "required", message: "กรอกเลขอ้างอิงการโอนคืน" }]);
      settleRefund(refund, body.providerRef.trim());
      return refund;
    },
  ),

  /* Customer documents (§4) */
  finance.get("/v1/admin/customer-documents", "receivables.read", ({ query, persona: who }) => {
    const rows = documents
      .filter((doc) => !query.docType || doc.docType === query.docType)
      .filter((doc) => !query.status || doc.status === query.status)
      .filter((doc) => !query.orderId || doc.orderId === query.orderId)
      .filter((doc) => !query.paymentId || doc.paymentId === query.paymentId)
      .filter((doc) => !query.customerId || customerOfDoc(doc) === query.customerId)
      .filter((doc) => !query.companyId || companyOfCustomer(customerOfDoc(doc))?.id === query.companyId)
      .filter((doc) => !query.from || doc.documentDate >= query.from)
      .filter((doc) => !query.to || doc.documentDate <= query.to)
      .filter((doc) =>
        matchesQuery(query.q, doc.docNumber, doc.orderCode, doc.groupCode, doc.buyer.name, doc.buyer.taxId),
      );
    const page = paginate(sort(rows, query, "issuedAt", "desc"), query);
    return { ...page, data: page.data.map((doc) => withActions(doc, who)) };
  }),
  finance.get("/v1/admin/customer-documents/{documentId}", "receivables.read", ({ params, persona: who }) => {
    const doc = docById(params.documentId);
    return doc ? withActions(doc, who) : notFound("เอกสาร");
  }),
  finance.get("/v1/admin/customer-documents/{documentId}/pdf", "receivables.read", ({ params }) =>
    docById(params.documentId) ? { url: PDF, expiresAt: bangkokIso(15) } : notFound("เอกสาร"),
  ),
  finance.post(
    "/v1/admin/customer-documents/{documentId}/actions/void",
    { permission: "receivables.manage", idempotent: true },
    ({ params, body, persona: who }) => {
      const doc = docById(params.documentId);
      if (!doc) return notFound("เอกสาร");
      if (!["iv", "dn"].includes(doc.docType) || doc.status === "void" || !untouched(doc))
        return problem(
          409,
          "receivables.document_not_voidable",
          "ยกเลิกได้เฉพาะใบแจ้งหนี้หรือใบเพิ่มหนี้ที่ยังไม่มีการรับชำระ ใบกำกับภาษีต้องแก้ด้วยใบลดหนี้",
        );
      if (!body.reason || body.reason.trim().length < 3)
        return invalid([{ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" }]);
      for (const journal of journalsOf("customer_document", doc.id).filter(
        (j) => j.status === "posted" && !j.reversedById,
      )) {
        const reversal = post({
          rule: journal.postingRule,
          kind: "reversal",
          description: `กลับรายการ ${journal.entryNo}: ยกเลิก ${doc.docNumber}`,
          documentDate: today(),
          source: journal.source,
          reversesId: journal.id,
          createdBy: who.id,
          lines: journal.lines.map((line) => ({
            account: line.accountCode,
            debit: satangOf(line.credit),
            credit: satangOf(line.debit),
            dimensions: line.dimensions,
            taxCode: line.taxCode,
            taxBase: line.taxBaseAmount === null ? undefined : -satangOf(line.taxBaseAmount),
          })),
        });
        journal.reversedById = reversal.id;
      }
      Object.assign(doc, { status: "void", voidReason: body.reason.trim(), amountDue: "0.00" });
      taxedVat.set(doc.id, { vat: 0, base: 0 });
      const item = receivables.find((row) => row.document.id === doc.id);
      if (item) {
        Object.assign(item, { status: "cancelled", openAmount: "0.00" });
        syncReceivable(item);
      }
      return withActions(doc, who);
    },
  ),
  // admin.customerDocuments.resend (D-143): `customer_document.sent`, routed by the notification
  // matrix to the customer's own e-mail (and LINE when linked). Audited; 409 for a void document.
  finance.post(
    "/v1/admin/customer-documents/{documentId}/actions/resend",
    { permission: "receivables.manage", idempotent: true, status: 202 },
    ({ params }) => {
      const doc = docById(params.documentId);
      if (!doc) return notFound("เอกสาร");
      if (doc.status === "void")
        return problem(409, "receivables.document_not_voidable", "เอกสารที่ยกเลิกแล้วส่งซ้ำไม่ได้");
      const customer = buyerOf(customerOfDoc(doc)).customer;
      const requestedAt = bangkokIso();
      deliveries.set(doc.id, [
        ...(deliveries.get(doc.id) ?? []),
        {
          channel: "email",
          recipient: masked(customer.email ?? customer.displayName),
          status: "sent",
          sentAt: requestedAt,
          kind: "resent",
          requestedAt,
        },
      ]);
      return { documentId: doc.id, requestedAt };
    },
  ),
  finance.get("/v1/admin/customer-documents/{documentId}/deliveries", "receivables.read", ({ params }) =>
    docById(params.documentId) ? [...(deliveries.get(params.documentId) ?? [])].reverse() : notFound("เอกสาร"),
  ),
  finance.get("/v1/admin/credit-note-requests", "receivables.read", ({ query }) =>
    paginate(
      sort(
        creditRequests
          .filter((r) => !query.status || r.status === query.status)
          .filter((r) => matchesQuery(query.q, r.orderCode, r.note)),
        query,
        "createdAt",
        "desc",
      ),
      query,
    ),
  ),
  finance.post(
    "/v1/admin/orders/{orderId}/credit-notes",
    { permission: "credit_notes.request", idempotent: true, status: 201 },
    ({ params, body, persona: who }) => {
      const order = orderOf(params.orderId);
      if (!order) return notFound("คำสั่งซื้อ");
      const { invoices, available } = creditableOf(order);
      if (invoices.length === 0)
        return problem(409, "receivables.credit_exceeds", "คำสั่งซื้อนี้ยังไม่มีใบกำกับภาษีให้ลดหนี้");
      if (!isMoney(body.amount) || satangOf(body.amount) <= 0 || satangOf(body.amount) > available)
        return problem(422, "receivables.credit_exceeds", `ลดหนี้ได้ไม่เกิน ${baht(available)} บาท`, [
          { path: "amount", code: "max", message: `ไม่เกิน ${baht(available)} บาท (ยอดใบกำกับภาษีหักที่ลดหนี้แล้ว)` },
        ]);
      if (!body.note?.trim() || body.note.trim().length < 3)
        return invalid([{ path: "note", code: "min", message: "ระบุรายละเอียดอย่างน้อย 3 ตัวอักษร" }]);
      if (
        body.reasonCode &&
        !REASONS.some((reason) => reason.code === body.reasonCode && reason.direction === "credit")
      )
        return problem(422, "receivables.reason_invalid", "เหตุผลนี้ไม่อยู่ในรายการเหตุผลตามกฎหมาย");
      return requestCreditNote(order, invoices.at(-1)!, who, body);
    },
  ),

  finance.get("/v1/admin/credit-note-reasons", "receivables.read", () => REASONS),
  finance.post(
    "/v1/admin/orders/{orderId}/debit-notes",
    { permission: "receivables.debit_notes.issue", idempotent: true, status: 201 },
    ({ params, body, persona: who }) => {
      const order = orderOf(params.orderId);
      if (!order) return notFound("คำสั่งซื้อ");
      const original = creditableOf(order).invoices.at(-1);
      if (!original) return problem(409, "receivables.credit_exceeds", "คำสั่งซื้อนี้ยังไม่มีใบกำกับภาษีให้เพิ่มหนี้");
      if (!isMoney(body.net) || satangOf(body.net) <= 0)
        return invalid([{ path: "net", code: "min", message: "กรอกยอดก่อนภาษีที่เพิ่ม" }]);
      if (!REASONS.some((reason) => reason.code === body.reasonCode && reason.direction === "debit"))
        return problem(422, "receivables.reason_invalid", "เลือกเหตุผลของใบเพิ่มหนี้จากรายการ", [
          { path: "reasonCode", code: "enum", message: "เลือกเหตุผลจากรายการ" },
        ]);
      if (!body.note?.trim() || body.note.trim().length < 3)
        return invalid([{ path: "note", code: "min", message: "ระบุรายละเอียดอย่างน้อย 3 ตัวอักษร" }]);
      const net = satangOf(body.net);
      const vat = Math.round(net * 0.07);
      const date = today();
      const dueDate = body.dueDate ?? daysFromToday(30);
      const doc = issue({
        docType: "dn",
        docKind: "debit_note",
        date,
        issuedAt: bangkokIso(),
        customerId: order.customer.id,
        order,
        lines: [{ description: `เพิ่มหนี้ตาม ${original.docNumber}: ${body.note.trim()}`, net }],
        vat,
        amountDue: net + vat,
        dueDate,
        reason: body.reasonCode,
        original,
      });
      const dims = dimsOf(order, order.customer.id);
      post({
        rule: null,
        kind: "auto",
        description: `ใบเพิ่มหนี้ ${order.orderCode}`,
        documentDate: date,
        source: sourceOf(doc),
        createdBy: who.id,
        lines: [
          { account: "1210", debit: net + vat, dimensions: dims },
          { account: "4110", credit: net, dimensions: dims },
          { account: "2210", credit: vat, dimensions: dims, taxCode: "output_vat", taxBase: net },
        ],
      });
      openReceivable(doc, order.customer.id, dueDate);
      return doc;
    },
  ),

  /* Receivables (§6) */
  finance.get("/v1/admin/receivables", "receivables.read", ({ query }) => {
    const overdue = String(query.overdue) === "true";
    const rows = receivables
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter((row) => !query.companyId || row.companyId === query.companyId)
      .filter((row) => !overdue || (["open", "partially_paid"].includes(row.status) && row.dueDate < today()))
      .filter((row) => matchesQuery(query.q, row.document.docNumber, row.customerName, row.companyName, row.orderCode));
    return paginate(sort(rows, query, "dueDate", "asc"), query);
  }),
  finance.get("/v1/admin/receivables/aging", "receivables.read", ({ query }) => {
    const asOf = query.asOf ?? today();
    const parties = new Map<string, { row: Receivable; buckets: ReturnType<typeof emptyBuckets> }>();
    const totals = emptyBuckets();
    for (const row of receivables.filter((r) => ["open", "partially_paid"].includes(r.status))) {
      if (query.companyId && row.companyId !== query.companyId) continue;
      const key = row.companyId ?? row.customerId;
      const entry = parties.get(key) ?? { row, buckets: emptyBuckets() };
      const bucket = bucketOf(row.dueDate, asOf);
      entry.buckets[bucket] += satangOf(row.openAmount);
      totals[bucket] += satangOf(row.openAmount);
      parties.set(key, entry);
    }
    return {
      asOf,
      currency: "THB",
      totals: toBuckets(totals),
      parties: [...parties.values()].map(({ row, buckets }) => ({
        customerId: row.customerId,
        customerName: row.customerName,
        companyId: row.companyId,
        companyName: row.companyName,
        buckets: toBuckets(buckets),
      })),
    };
  }),
  finance.post(
    "/v1/admin/receivables/allowance",
    { permission: "receivables.manage", idempotent: true },
    ({ body, persona: who }) => {
      if (!isMoney(body.amount))
        return problem(
          422,
          "receivables.allowance_rates_unset",
          "ยังไม่ได้ตั้งอัตราค่าเผื่อหนี้สงสัยจะสูญ กรอกยอดเป้าหมายเอง",
          [{ path: "amount", code: "required", message: "กรอกยอดค่าเผื่อที่ต้องการ" }],
        );
      if (!body.asOf || body.asOf > today())
        return invalid([{ path: "asOf", code: "max", message: "วันที่ต้องไม่เกินวันนี้" }]);
      const current = -movement("1219");
      const target = satangOf(body.amount);
      const change = target - current;
      const id = mockId("prov", allowanceRuns++);
      if (change !== 0)
        post({
          rule: "P30",
          description: `ปรับค่าเผื่อหนี้สงสัยจะสูญ ณ ${body.asOf}`,
          documentDate: body.asOf,
          source: { type: "allowance", id, number: null },
          createdBy: who.id,
          lines:
            change > 0
              ? [
                  { account: "6130", debit: change },
                  { account: "1219", credit: change },
                ]
              : [
                  { account: "1219", debit: -change },
                  { account: "6130", credit: -change },
                ],
        });
      return { id, amount: baht(change), targetAmount: baht(target), method: "manual" };
    },
  ),
  finance.post(
    "/v1/admin/receivables/{itemId}/actions/request-write-off",
    { permission: "receivables.write_off.request", idempotent: true },
    ({ params, body, persona: who }) => {
      const item = receivables.find((row) => row.id === params.itemId);
      if (!item) return notFound("รายการลูกหนี้");
      if (!["open", "partially_paid"].includes(item.status) || item.writeOffApprovalId)
        return problem(
          409,
          "receivables.nothing_to_write_off",
          "รายการนี้ไม่มียอดค้างให้ตัดหนี้สูญ หรือมีคำขออยู่แล้ว",
        );
      if (!body.reason || body.reason.trim().length < 3)
        return invalid([{ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" }]);
      const approval = openApproval({
        policy: "write_off",
        subjectType: "receivable_item",
        subjectId: item.id,
        requester: who,
        amount: item.openAmount,
        payload: { document: item.document.docNumber, customer: item.customerName, reason: body.reason.trim() },
      });
      item.writeOffApprovalId = approval.id;
      return item;
    },
  ),
  finance.get("/v1/admin/customer-wht-certificates", "receivables.read", ({ query }) => {
    const older = query.olderThanDays ?? null;
    const rows = whtCertificates
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => older === null || Date.parse(row.createdAt) < Date.now() - older * 86_400_000)
      .filter((row) =>
        matchesQuery(query.q, row.customerName, row.companyName, row.receipt.docNumber, row.certificateNo),
      );
    return paginate(sort(rows, query, "createdAt", "desc"), query);
  }),
  finance.post(
    "/v1/admin/customer-wht-certificates/{certificateId}/actions/record",
    { permission: "receivables.manage" },
    ({ params, body }) => {
      const item = whtCertificates.find((row) => row.id === params.certificateId);
      if (!item) return notFound("หนังสือรับรอง");
      if (item.status !== "pending")
        return problem(409, "receivables.certificate_invalid", "หนังสือรับรองนี้บันทึกไปแล้ว");
      const errors = [
        ...(!body.certificateNo?.trim()
          ? [{ path: "certificateNo", code: "required", message: "กรอกเลขที่หนังสือรับรอง" }]
          : []),
        ...(!body.certificateDate
          ? [{ path: "certificateDate", code: "required", message: "กรอกวันที่ในหนังสือรับรอง" }]
          : []),
        ...(body.certificateDate && body.certificateDate > today()
          ? [{ path: "certificateDate", code: "max", message: "วันที่ต้องไม่เกินวันนี้" }]
          : []),
      ];
      if (errors.length) return invalid(errors);
      Object.assign(item, {
        status: "received",
        certificateNo: body.certificateNo.trim(),
        certificateDate: body.certificateDate,
        fileId: body.fileId ?? null,
      });
      return item;
    },
  ),
  finance.post(
    "/v1/admin/customer-wht-certificates/{certificateId}/actions/waive",
    { permission: "receivables.manage" },
    ({ params, body }) => {
      const item = whtCertificates.find((row) => row.id === params.certificateId);
      if (!item) return notFound("หนังสือรับรอง");
      if (item.status !== "pending")
        return problem(409, "receivables.certificate_invalid", "หนังสือรับรองนี้ไม่ได้รอติดตามแล้ว");
      if (!body.reason || body.reason.trim().length < 3)
        return invalid([{ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" }]);
      item.status = "waived";
      return item;
    },
  ),
  finance.get("/v1/admin/customers/{customerId}/store-credit", "receivables.read", ({ params }) => {
    const entries = storeCredit.get(params.customerId!) ?? [];
    return {
      balance: baht(entries.reduce((sum, entry) => sum + satangOf(entry.amount), 0)),
      currency: "THB",
      entries: [...entries].reverse(),
    };
  }),
  finance.get("/v1/admin/companies/{companyId}/statement", "receivables.read", ({ params, query }) => {
    const month = query.month ?? today().slice(0, 7);
    const lines = receivables
      .filter((row) => row.companyId === params.companyId)
      .map((row) => ({ row, doc: docById(row.document.id)! }))
      .filter(({ doc }) => doc.documentDate.slice(0, 7) <= month && doc.status === "issued")
      .map(({ row, doc }) => ({
        groupId: mockId("grp", 900 + receivables.indexOf(row)),
        groupCode: doc.orderCode ?? doc.docNumber,
        placedAt: doc.issuedAt,
        dueAt: `${row.dueDate}T23:59:00+07:00`,
        grossAmount: row.amount,
        paidAmount: baht(satangOf(row.amount) - satangOf(row.openAmount)),
        openAmount: row.openAmount,
        branchCode: doc.buyer.branchCode,
        poNumber: `PO-${(doc.orderCode ?? "0000").slice(-4)}`,
      }));
    return {
      month,
      currency: "THB",
      lines,
      totalGrossAmount: baht(lines.reduce((s, l) => s + satangOf(l.grossAmount), 0)),
      totalPaidAmount: baht(lines.reduce((s, l) => s + satangOf(l.paidAmount), 0)),
      openBalance: baht(lines.reduce((s, l) => s + satangOf(l.openAmount), 0)),
    };
  }),
  finance.get("/v1/admin/dunning-log", "receivables.read", ({ query }) => {
    const rows = dunning
      .filter((row) => !query.companyId || row.companyId === query.companyId)
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter((row) => !query.documentId || row.documentId === query.documentId)
      .filter((row) => !query.from || row.remindedAt.slice(0, 10) >= query.from)
      .filter((row) => matchesQuery(query.q, row.docNumber))
      .sort((a, b) => b.remindedAt.localeCompare(a.remindedAt) || a.id.localeCompare(b.id));
    const page = paginate(rows, query);
    return { ...page, data: page.data.map(({ id, ...entry }) => (void id, entry)) };
  }),
];

let allowanceRuns = 1;

/** An obviously fake slip image, so the review screen has something to show beside the numbers. */
const SLIP_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="560" viewBox="0 0 360 560"><rect width="360" height="560" fill="#f4f6f8"/><rect x="20" y="20" width="320" height="520" rx="16" fill="#fff" stroke="#d0d7de"/><text x="180" y="80" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#1f2328">สลิปโอนเงิน (ตัวอย่าง)</text><text x="180" y="116" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#57606a">ข้อมูลจำลอง ไม่ใช่รายการจริง</text></svg>',
  );

/** A tiny, valid PDF: what a mock returns where the API returns a short-lived signed URL. */
const PDF = `data:application/pdf;base64,${Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
).toString("base64")}`;
