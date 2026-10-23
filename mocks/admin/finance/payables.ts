/**
 * Supplier AP, mocked over the published B5.3 surface: vendors (the factories and the others —
 * carriers, freelancers, services), factory purchase orders, goods receipts from POD (D-165),
 * the billing statements getpack generates and the factory confirms (D-090), the factory's own tax
 * invoices, other vendors' bills, the AP open items with the date each becomes payable under the
 * frozen payout policy (D-022, D-164), and bank-account changes under dual approval with a
 * call-back (§8, D-169).
 *
 * The factory side is the partner zone's own rows: POs are the factories' released jobs, GRs
 * their delivered shipments, and statements and tax invoices the partner billing mock's state —
 * so a statement the factory confirms, or a tax invoice it submits, is what Finance sees here,
 * and a validation here is what the factory sees there.
 */

import type { Schemas } from "@/lib/api/types";

import { can, type StaffPersona } from "../../personas";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../../support";
import { acceptedOn, deliveries, policyOf, statementStates, statementsOf, type Delivery } from "../../partner/billing";
import { buyAmountOf, extraOf, factoryJobs, titleOf } from "../../partner/jobs";
import { baht } from "../commerce";
import { registerQueue } from "../console";
import { activateIfReady, stores } from "../partners";
import { onApprovalDecided, openApproval } from "../platform";
import { post, satangOf, today } from "./books";
import { finance, invalid, isMoney, notFound } from "./support";

type Vendor = Schemas["VendorDto"];
type Po = Schemas["PurchaseOrderDto"];
type Gr = Schemas["GoodsReceiptDto"];
type Line = Schemas["ApLineDto"];
type Statement = Schemas["BillingStatementDto"];
type Invoice = Schemas["VendorInvoiceDto"];
type Payable = Schemas["PayableDto"];
type BankAccount = Schemas["BankAccountDto"];

const DAY = 86_400_000;
const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T12:00:00+07:00`) + days * DAY + 7 * 3_600_000).toISOString().slice(0, 10);
const vatOf = (net: number, registered: boolean) => (registered ? Math.round(net * 0.07) : 0);

/* ------------------------------------------------------------------------------- vendors */

/** The factories that trade with getpack: every one that has passed onboarding. */
const factoryStores = () =>
  [...stores.values()].filter((store) => ["trial", "active", "suspended"].includes(store.factory.status));

function factoryVendor(store: typeof stores extends Map<string, infer S> ? S : never): Vendor {
  const policy = policyOf(store.factory.id);
  return {
    id: store.factory.id,
    kind: "factory",
    legalName: store.factory.legalName,
    taxId: store.factory.taxId,
    branchCode: store.factory.branchCode,
    juristicType: store.factory.juristicType === "partnership" ? "partnership" : "company",
    isVatRegistered: store.factory.isVatRegistered,
    paymentTermsDays: policy?.paymentTermsDays ?? 30,
    defaultWhtCategory: "hire_of_work",
  };
}

const others: Vendor[] = [
  {
    id: mockId("vnd", 1),
    kind: "carrier",
    legalName: "บริษัท ขนส่งด่วนตัวอย่าง จำกัด (ข้อมูลจำลอง)",
    taxId: "0105561234567",
    branchCode: "00000",
    juristicType: "company",
    isVatRegistered: true,
    paymentTermsDays: 15,
    defaultWhtCategory: "transport",
  },
  {
    id: mockId("vnd", 2),
    kind: "freelancer",
    legalName: "คุณออกแบบ ตัวอย่าง (ข้อมูลจำลอง)",
    taxId: "1100700123458",
    branchCode: "00000",
    juristicType: "individual",
    isVatRegistered: false,
    paymentTermsDays: 7,
    defaultWhtCategory: "service",
  },
  {
    id: mockId("vnd", 3),
    kind: "service",
    legalName: "บริษัท บริการสำนักงานตัวอย่าง จำกัด (ข้อมูลจำลอง)",
    taxId: "0105559876543",
    branchCode: "00001",
    juristicType: "company",
    isVatRegistered: true,
    paymentTermsDays: 30,
    defaultWhtCategory: "service",
  },
];

export const vendorsAll = (): Vendor[] => [...factoryStores().map(factoryVendor), ...others];
export const vendorOf = (id: string) => vendorsAll().find((vendor) => vendor.id === id);
export const whtFormOf = (vendor: Vendor): Schemas["WhtForm"] =>
  vendor.juristicType === "individual" ? "pnd3" : "pnd53";

/** The bank accounts of vendors that are not factories (factories keep theirs in the partners mock). */
const otherBanks = new Map<string, BankAccount[]>(
  others.map((vendor, index) => [
    vendor.id,
    index === 2
      ? [] // the service vendor has no account yet: a run excludes it (§8 exception)
      : [
          {
            id: mockId("vba", index + 1),
            bankCode: index === 0 ? "004" : "002",
            accountName: vendor.legalName,
            accountNoLast4: String(7810 + index * 11),
            branchName: "สาขาตัวอย่าง",
            status: "active",
            duplicateOfOtherVendor: false,
            approvalRequestId: null,
            effectiveFrom: bangkokIso(-60 * 24 * 90),
            createdAt: bangkokIso(-60 * 24 * 90),
            verification: {
              calledAt: bangkokIso(-60 * 24 * 90),
              calledNumberMasked: "xxxxxx1234",
              outcome: "confirmed",
            },
          },
        ],
  ]),
);

export const banksOf = (vendorId: string): BankAccount[] =>
  stores.get(vendorId)?.banks ?? otherBanks.get(vendorId) ?? [];

/** The account a payout goes to: active, and its change verified by a call-back (§8). */
export const payoutAccountOf = (vendorId: string) =>
  banksOf(vendorId).find((bank) => bank.status === "active" && bank.verification?.outcome !== "mismatch") ?? null;

/** Whoever recorded a vendor's bills cannot change its bank account (SoD, §8). */
const billRecorders = new Map<string, Set<string>>();

/* -------------------------------------------------------------------------- POs and GRs */

const PO_STATUS: Record<string, Po["status"]> = {
  released: "issued",
  accepted: "accepted",
  in_progress: "accepted",
  on_hold: "accepted",
  completed: "received",
  rejected: "cancelled",
  cancelled: "cancelled",
};

interface PoRow {
  po: Po;
  factoryId: string;
  orderId: string;
  /** Production net (satang) — what the payout policy's percentages apply to. */
  productionNet: number;
  acceptedOn: string | null;
}

function poLines(net: number, vat: boolean): Line[] {
  return [
    {
      lineNo: 1,
      lineType: "production",
      description: "ค่าจ้างผลิตตามใบสั่งผลิต",
      quantity: 1,
      unitPrice: (net / 100).toFixed(6),
      netAmount: baht(net),
      vatAmount: baht(vatOf(net, vat)),
      grossAmount: baht(net + vatOf(net, vat)),
      whtCategory: "hire_of_work",
    },
  ];
}

let poSeq = 0;
const poRows = new Map<string, PoRow>();

/** One PO per released production job, at the buy price frozen at release (§6, D-022). */
export function purchaseOrders(): PoRow[] {
  for (const store of factoryStores())
    for (const { order, job } of factoryJobs(store.factory.id)) {
      const existing = poRows.get(job.id);
      const accepted = ["accepted", "in_progress", "on_hold", "completed"].includes(job.status);
      if (existing) {
        existing.po.status = existing.po.status === "closed" ? "closed" : (PO_STATUS[job.status] ?? "issued");
        existing.acceptedOn ??= accepted ? today() : null;
        continue;
      }
      const net = satangOf(buyAmountOf(order));
      const vat = vatOf(net, store.factory.isVatRegistered);
      poSeq += 1;
      poRows.set(job.id, {
        factoryId: store.factory.id,
        orderId: order.id,
        productionNet: net,
        acceptedOn: accepted ? acceptedOn(job.id, extraOf(job).releasedAt) : null,
        po: {
          id: mockId("po", poSeq),
          poNumber: `PO2569-${String(poSeq).padStart(5, "0")}`,
          jobNo: job.jobNo,
          orderCode: order.orderCode,
          factoryId: store.factory.id,
          poKind: "production",
          status: PO_STATUS[job.status] ?? "issued",
          issuedAt: extraOf(job).releasedAt,
          netAmount: baht(net),
          vatAmount: baht(vat),
          grossAmount: baht(net + vat),
          currency: "THB",
          lines: poLines(net, store.factory.isVatRegistered),
        },
      });
    }
  return [...poRows.values()];
}

interface GrRow {
  gr: Gr;
  factoryId: string;
  poRow: PoRow;
  delivery: Delivery;
  productionNet: number;
  shippingNet: number;
}

let grSeq = 0;
const grRows = new Map<string, GrRow>();

/** A GR per delivered shipment: payable quantity = min(delivered, ordered) (D-165, P15). */
export function goodsReceipts(): GrRow[] {
  purchaseOrders();
  for (const store of factoryStores())
    for (const delivery of deliveries(store.factory.id)) {
      if (grRows.has(delivery.shipment.id)) continue;
      const poRow = [...poRows.values()].find((row) => row.orderId === delivery.order.id);
      if (!poRow) continue;
      const production = Math.round((poRow.productionNet * delivery.quantity) / delivery.order.quantity);
      const shipping = 25_000 + delivery.shipment.cartons * 5_000;
      const vatRegistered = store.factory.isVatRegistered;
      grSeq += 1;
      const lines: Line[] = [
        {
          lineNo: 1,
          lineType: "production",
          description: `${titleOf(delivery.order)} · ${poRow.po.jobNo}`,
          quantity: delivery.quantity,
          unitPrice: (production / 100 / Math.max(1, delivery.quantity)).toFixed(6),
          netAmount: baht(production),
          vatAmount: baht(vatOf(production, vatRegistered)),
          grossAmount: baht(production + vatOf(production, vatRegistered)),
          whtCategory: "hire_of_work",
        },
        {
          lineNo: 2,
          lineType: "shipping",
          description: `ค่าจัดส่ง ${delivery.shipment.shipmentNo}`,
          quantity: delivery.shipment.cartons,
          unitPrice: (shipping / 100 / Math.max(1, delivery.shipment.cartons)).toFixed(6),
          netAmount: baht(shipping),
          vatAmount: baht(vatOf(shipping, vatRegistered)),
          grossAmount: baht(shipping + vatOf(shipping, vatRegistered)),
          whtCategory: "transport",
        },
      ];
      const net = production + shipping;
      const vat = vatOf(production, vatRegistered) + vatOf(shipping, vatRegistered);
      const row: GrRow = {
        factoryId: store.factory.id,
        poRow,
        delivery,
        productionNet: production,
        shippingNet: shipping,
        gr: {
          id: mockId("gr", grSeq),
          grNumber: `GR2569-${String(grSeq).padStart(5, "0")}`,
          poNumber: poRow.po.poNumber,
          receivedOn: delivery.deliveredOn,
          receivedQuantity: delivery.shipment.pod?.deliveredQuantity ?? delivery.quantity,
          payableQuantity: delivery.quantity,
          netAmount: baht(net),
          vatAmount: baht(vat),
          grossAmount: baht(net + vat),
          lines,
        },
      };
      grRows.set(delivery.shipment.id, row);
      onGoodsReceipt(row);
    }
  return [...grRows.values()];
}

/* ------------------------------------------------------------------------------- payables */

export interface PayableRow {
  dto: Payable;
  kind: Schemas["PayoutKind"];
  factoryId: string | null;
  /** WHT categories of what is open, satang: production = hire of work, shipping = transport. */
  hireNet: number;
  transportNet: number;
  serviceNet: number;
  /** Net held back when this is paid (D-164), satang. */
  retentionNet: number;
  gr: GrRow | null;
  invoice: Invoice | null;
  /** The PO an advance or balance belongs to. */
  poRow: PoRow | null;
}

export const payables: PayableRow[] = [];
let payableSeq = 0;

function addPayable(
  input: Omit<PayableRow, "dto"> & {
    vendor: Vendor;
    net: number;
    vat: number;
    eligibleAt: string | null;
    source: Payable["source"];
    poNumber?: string | null;
    orderCode?: string | null;
    retentionPct?: string;
  },
): PayableRow {
  payableSeq += 1;
  const row: PayableRow = {
    kind: input.kind,
    factoryId: input.factoryId,
    hireNet: input.hireNet,
    transportNet: input.transportNet,
    serviceNet: input.serviceNet,
    retentionNet: input.retentionNet,
    gr: input.gr,
    invoice: input.invoice,
    poRow: input.poRow,
    dto: {
      id: mockId("pay", 800 + payableSeq),
      vendorId: input.vendor.id,
      vendorName: input.vendor.legalName,
      source: input.source,
      status: "open",
      openNetAmount: baht(input.net),
      openVatAmount: baht(input.vat),
      eligibleAt: input.eligibleAt ? `${input.eligibleAt}T00:00:00+07:00` : null,
      poNumber: input.poNumber ?? null,
      orderCode: input.orderCode ?? null,
      retentionPct: input.retentionPct ?? "0.0000",
      currency: "THB",
    },
  };
  payables.push(row);
  return row;
}

/** Recomputes `eligible` from the dates — the API does this on its business calendar. */
export function refreshPayables() {
  goodsReceipts();
  for (const store of factoryStores())
    for (const row of purchaseOrders().filter((item) => item.factoryId === store.factory.id && item.acceptedOn)) {
      if (payables.some((payable) => payable.kind === "advance" && payable.poRow === row)) continue;
      const policy = policyOf(store.factory.id);
      const net = Math.round((row.productionNet * Number(policy?.advancePct ?? "30")) / 100);
      addPayable({
        kind: "advance",
        factoryId: store.factory.id,
        vendor: factoryVendor(store),
        source: "advance",
        net,
        vat: vatOf(net, store.factory.isVatRegistered),
        hireNet: net,
        transportNet: 0,
        serviceNet: 0,
        retentionNet: 0,
        eligibleAt: row.acceptedOn,
        poNumber: row.po.poNumber,
        orderCode: row.po.orderCode,
        gr: null,
        invoice: null,
        poRow: row,
      });
    }
  for (const row of payables)
    if (row.dto.status === "open" && row.dto.eligibleAt && row.dto.eligibleAt.slice(0, 10) <= today())
      row.dto.status = "eligible";
}

/** P15 (+P16): the GR puts what getpack owes into AP; an advance already paid is applied to it. */
function onGoodsReceipt(row: GrRow) {
  const store = stores.get(row.factoryId)!;
  const dims = { factory: row.factoryId, order: row.delivery.order.id };
  post({
    rule: "P15",
    description: `รับมอบงาน ${row.gr.grNumber} (${row.poRow.po.poNumber})`,
    documentDate: row.gr.receivedOn,
    postedAt: `${row.gr.receivedOn}T18:00:00+07:00`,
    source: { type: "goods_receipt", id: row.gr.id, number: row.gr.grNumber },
    lines: [
      { account: "5110", debit: row.productionNet, dimensions: dims },
      { account: "5120", debit: row.shippingNet, dimensions: dims },
      { account: "2110", credit: row.productionNet + row.shippingNet, dimensions: dims },
    ],
  });
  const policy = policyOf(row.factoryId);
  const advanceShare = Math.round((row.productionNet * Number(policy?.advancePct ?? "30")) / 100);
  const advance = payables.find((payable) => payable.kind === "advance" && payable.poRow === row.poRow);
  const applied = advance?.dto.status === "paid" ? advanceShare : 0;
  if (applied)
    post({
      rule: "P16",
      description: `หักเงินล่วงหน้ากับ ${row.gr.grNumber}`,
      documentDate: row.gr.receivedOn,
      postedAt: `${row.gr.receivedOn}T18:00:00+07:00`,
      source: { type: "goods_receipt", id: row.gr.id, number: row.gr.grNumber },
      lines: [
        { account: "2110", debit: applied, dimensions: dims },
        { account: "1250", credit: applied, dimensions: dims },
      ],
    });
  const retentionPct = policy?.retentionPct ?? "0.0000";
  const retention = Math.round((row.productionNet * Number(retentionPct)) / 100);
  const hire = row.productionNet - applied;
  const vatRegistered = store.factory.isVatRegistered;
  const claimWindow = policy?.claimWindowDays ?? 7;
  addPayable({
    kind: "balance",
    factoryId: row.factoryId,
    vendor: factoryVendor(store),
    source: "goods_receipt",
    net: hire + row.shippingNet,
    vat: vatOf(hire, vatRegistered) + vatOf(row.shippingNet, vatRegistered),
    hireNet: hire,
    transportNet: row.shippingNet,
    serviceNet: 0,
    retentionNet: retention,
    // D-022: after POD and the claim window.
    eligibleAt: addDays(row.gr.receivedOn, claimWindow),
    poNumber: row.poRow.po.poNumber,
    orderCode: row.poRow.po.orderCode,
    retentionPct,
    gr: row,
    invoice: null,
    poRow: row.poRow,
  });
}

/**
 * P16 for an advance paid after its goods receipt: it is applied to the balance still open, and
 * the balance comes down by the advance's net and the VAT paid with it.
 */
export function applyAdvanceToBalances(poRow: PoRow | null, advanceNet: number, advanceVat: number, date: string) {
  if (!poRow) return;
  let net = advanceNet;
  let vat = advanceVat;
  for (const balance of payables.filter(
    (row) => row.kind === "balance" && row.poRow === poRow && ["open", "eligible"].includes(row.dto.status),
  )) {
    if (net <= 0) break;
    const take = Math.min(net, balance.hireNet);
    const takeVat = Math.min(vat, satangOf(balance.dto.openVatAmount));
    const dims = { factory: poRow.factoryId, order: poRow.orderId };
    post({
      rule: "P16",
      description: `หักเงินล่วงหน้ากับ ${balance.gr?.gr.grNumber ?? poRow.po.poNumber}`,
      documentDate: date,
      source: {
        type: "goods_receipt",
        id: balance.gr?.gr.id ?? poRow.po.id,
        number: balance.gr?.gr.grNumber ?? poRow.po.poNumber,
      },
      lines: [
        { account: "2110", debit: take, dimensions: dims },
        { account: "1250", credit: take, dimensions: dims },
      ],
    });
    balance.hireNet -= take;
    balance.dto.openNetAmount = baht(satangOf(balance.dto.openNetAmount) - take);
    balance.dto.openVatAmount = baht(satangOf(balance.dto.openVatAmount) - takeVat);
    net -= take;
    vat -= takeVat;
  }
}

/** The retention held on a balance, payable after the release period (D-164, P18). */
export function openRetention(balance: PayableRow, paidOn: string) {
  if (!balance.factoryId || balance.retentionNet === 0) return;
  const store = stores.get(balance.factoryId)!;
  const release = policyOf(balance.factoryId)?.retentionReleaseDays ?? 30;
  addPayable({
    kind: "retention_release",
    factoryId: balance.factoryId,
    vendor: factoryVendor(store),
    source: "retention",
    net: balance.retentionNet,
    vat: 0,
    hireNet: balance.retentionNet,
    transportNet: 0,
    serviceNet: 0,
    retentionNet: 0,
    eligibleAt: addDays(paidOn, release),
    poNumber: balance.dto.poNumber,
    orderCode: balance.dto.orderCode,
    gr: balance.gr,
    invoice: null,
    poRow: balance.poRow,
  });
}

/* ------------------------------------------------------------------- statements, invoices */

const STATEMENT_STATUS: Record<string, Statement["status"]> = {
  generated: "generated",
  sent: "sent",
  confirmed: "confirmed",
  disputed: "disputed",
  superseded: "superseded",
};

function statementsAll() {
  return factoryStores().flatMap((store) => statementsOf(store.factory.id).map((statement) => ({ store, statement })));
}

/**
 * getpack-api's `ADMIN_STATEMENT_ACTIONS` (payables/statement-actions.ts, v0.6.0): capture a tax
 * invoice while none is recorded or validated (a rejected one is replaced), validate a recorded one.
 */
function statementActions(dto: Omit<Statement, "nextActions">, who: StaffPersona | null): Statement["nextActions"] {
  if (!can(who ?? undefined, "payables.manage")) return [];
  const statuses = dto.taxInvoices.map((invoice) => invoice.status);
  const actions: Statement["nextActions"] = [];
  if (dto.status !== "superseded" && !statuses.some((status) => status === "recorded" || status === "validated"))
    actions.push({ key: "billing_statement.capture_tax_invoice", irreversible: false, disabledReason: null });
  if (statuses.includes("recorded"))
    actions.push({ key: "billing_statement.validate_tax_invoice", irreversible: false, disabledReason: null });
  return actions;
}

function toStatement(found: ReturnType<typeof statementsAll>[number], who: StaffPersona | null): Statement {
  const dto = statementOf(found);
  return { ...dto, nextActions: statementActions(dto, who) };
}

function statementOf({ store, statement }: ReturnType<typeof statementsAll>[number]): Statement {
  const registered = store.factory.isVatRegistered;
  // Void tax invoices are left out of the statement (and of its tax-invoice status).
  const invoices = statementInvoices({ store, statement }).filter((invoice) => invoice.status !== "void");
  const latest = invoices.at(-1);
  return {
    id: statement.id,
    bsNumber: statement.bsNumber,
    factoryId: store.factory.id,
    periodFrom: statement.periodFrom,
    periodTo: statement.periodTo,
    status: STATEMENT_STATUS[statement.status] ?? "sent",
    generatedAt: statement.generatedAt,
    confirmedAt: statement.confirmedAt,
    confirmedBy: statement.confirmedBy,
    // The partner model keeps the dispute note only, not the lines it named.
    disputedLineNos: [],
    currency: "THB",
    totals: {
      production: statement.totals.production,
      shipping: statement.totals.shipping,
      // The partner model has no mock-up, design or reproduction lines.
      other: "0.00",
      deductions: statement.totals.deductions,
      advanceOffset: statement.totals.alreadyPaid,
      net: statement.totals.net,
      vat: statement.totals.vat,
      gross: statement.totals.gross,
      alreadyPaid: statement.totals.alreadyPaid,
      remaining: statement.totals.remaining,
    },
    taxInvoices: [...invoices].reverse(),
    taxInvoiceStatus: !latest || latest.status === "void" ? "none" : latest.status,
    inputVatStatus: latest?.inputVatStatus ?? null,
    nextActions: [],
    disputeNote: statement.disputeNote,
    netAmount: statement.totals.net,
    vatAmount: statement.totals.vat,
    grossAmount: statement.totals.gross,
    lines: statement.lines.map((line, index) => {
      const net = satangOf(line.amount);
      const vat = vatOf(net, registered);
      return {
        lineNo: index + 1,
        // The contract has no advance-offset kind: the partner model's offset is a deduction here.
        kind: line.kind === "advance_offset" ? "deduction" : line.kind,
        description: line.description,
        reference: line.reference,
        quantity: line.quantity,
        netAmount: line.amount,
        vatAmount: baht(vat),
        grossAmount: baht(net + vat),
      };
    }),
  };
}

const INVOICE_STATUS: Record<string, Invoice["status"]> = {
  submitted: "recorded",
  validated: "validated",
  rejected: "rejected",
};

/** The factories' own tax invoices (from the partner billing state), then the other vendors' bills. */
const bills: Invoice[] = [];

function factoryInvoices(): Invoice[] {
  return statementsAll().flatMap(statementInvoices);
}

/** One statement's factory tax invoices, oldest first (as the partner billing state keeps them). */
function statementInvoices({ store, statement }: ReturnType<typeof statementsAll>[number]): Invoice[] {
  return (statementStates.get(statement.id)?.invoices ?? []).map((invoice): Invoice => ({
    id: invoice.id,
    vendorId: store.factory.id,
    erpInvoiceId: null,
    vendorName: store.factory.legalName,
    bsNumber: statement.bsNumber,
    vendorInvoiceNo: invoice.invoiceNo,
    invoiceDate: invoice.invoiceDate,
    sellerTaxId: invoice.sellerTaxId,
    sellerBranchCode: invoice.sellerBranchCode,
    source: invoice.source,
    fileId: invoice.file?.id ?? null,
    isTaxInvoice: true,
    status: INVOICE_STATUS[invoice.status] ?? "recorded",
    rejectionReason: invoice.rejectReason,
    inputVatStatus:
      invoice.status === "validated"
        ? "claimable"
        : store.factory.isVatRegistered
          ? "pending_document"
          : "not_claimable",
    netAmount: statement.totals.net,
    vatAmount: statement.totals.vat,
    grossAmount: statement.totals.gross,
    lines: statement.lines.map((line) => ({
      description: line.description,
      netAmount: line.amount,
      vatAmount: baht(vatOf(satangOf(line.amount), store.factory.isVatRegistered)),
      whtCategory: line.kind === "shipping" ? "transport" : line.kind === "production" ? "hire_of_work" : "none",
      accountCode: line.kind === "shipping" ? "5120" : line.kind === "production" ? "5110" : null,
    })),
  }));
}

export const invoicesAll = (): Invoice[] => [...factoryInvoices(), ...bills];

/** Whether a factory has a validated tax invoice — input VAT on its payments is then claimable (§2). */
export const factoryHasValidInvoice = (factoryId: string) =>
  factoryInvoices().some((invoice) => invoice.vendorId === factoryId && invoice.status === "validated");

/** VAT paid to a factory while its tax invoice was missing, parked in 1242 (satang, per factory). */
export const vatPending = new Map<string, number>();

/* ---------------------------------------------------------------------- other vendors' bills */

/** P25 / P26: an expense or cost bill, input VAT only on a valid tax invoice (§2). */
function recordBill(vendor: Vendor, input: Schemas["RecordBillDto"], recordedBy: string | null): Invoice {
  const net = input.lines.reduce((sum, line) => sum + satangOf(line.netAmount), 0);
  const vat = input.isTaxInvoice ? input.lines.reduce((sum, line) => sum + satangOf(line.vatAmount), 0) : 0;
  const invoice: Invoice = {
    id: mockId("vbl", bills.length + 1),
    vendorId: vendor.id,
    erpInvoiceId: null,
    vendorName: vendor.legalName,
    bsNumber: null,
    vendorInvoiceNo: input.vendorInvoiceNo,
    invoiceDate: input.invoiceDate,
    sellerTaxId: vendor.taxId,
    sellerBranchCode: vendor.branchCode,
    source: input.fileId ? "pdf_upload" : "manual",
    fileId: input.fileId ?? null,
    isTaxInvoice: input.isTaxInvoice,
    status: "validated",
    rejectionReason: null,
    inputVatStatus: input.isTaxInvoice && vendor.isVatRegistered ? "claimable" : "not_claimable",
    netAmount: baht(net),
    vatAmount: baht(vat),
    grossAmount: baht(net + vat),
    lines: input.lines.map((line) => ({
      description: line.description,
      netAmount: line.netAmount,
      vatAmount: input.isTaxInvoice ? line.vatAmount : "0.00",
      whtCategory: line.whtCategory,
      accountCode: line.accountCode,
    })),
  };
  bills.push(invoice);
  post({
    rule: vendor.kind === "freelancer" ? "P26" : "P25",
    description: `บิล ${vendor.legalName} เลขที่ ${input.vendorInvoiceNo}`,
    documentDate: input.invoiceDate,
    source: { type: "vendor_invoice", id: invoice.id, number: input.vendorInvoiceNo },
    createdBy: recordedBy,
    lines: [
      ...input.lines.map((line) => ({
        account: line.accountCode,
        debit: satangOf(line.netAmount),
        dimensions: { vendor: vendor.id },
      })),
      ...(vat
        ? [
            {
              account: "1241",
              debit: vat,
              taxCode: "input_vat" as const,
              taxBase: net,
              dimensions: { vendor: vendor.id },
            },
          ]
        : []),
      { account: "2120", credit: net + vat, dimensions: { vendor: vendor.id } },
    ],
  });
  const sum = (category: Schemas["WhtCategory"]) =>
    input.lines
      .filter((line) => line.whtCategory === category)
      .reduce((total, line) => total + satangOf(line.netAmount), 0);
  addPayable({
    kind: "vendor_bill",
    factoryId: null,
    vendor,
    source: "vendor_invoice",
    net,
    vat,
    hireNet: sum("hire_of_work"),
    transportNet: sum("transport"),
    serviceNet: sum("service"),
    retentionNet: 0,
    eligibleAt: addDays(input.invoiceDate, vendor.paymentTermsDays),
    gr: null,
    invoice,
    poRow: null,
  });
  if (recordedBy) billRecorders.set(vendor.id, new Set([...(billRecorders.get(vendor.id) ?? []), recordedBy]));
  return invoice;
}

/* ---------------------------------------------------------------------------------- seed */

refreshPayables();
recordBill(
  others[0]!,
  {
    vendorInvoiceNo: "INV-TR-6909-0231",
    invoiceDate: addDays(today(), -12),
    isTaxInvoice: true,
    lines: [
      {
        accountCode: "5130",
        description: "ขนส่งสำรองกรณีโรงงานส่งไม่ได้ (ข้อมูลจำลอง)",
        netAmount: "1850.00",
        vatAmount: "129.50",
        whtCategory: "transport",
      },
    ],
  },
  null,
);
recordBill(
  others[1]!,
  {
    vendorInvoiceNo: "FL-2569-014",
    invoiceDate: addDays(today(), -4),
    isTaxInvoice: false,
    lines: [
      {
        accountCode: "5140",
        description: "ออกแบบลายกล่อง 2 แบบ (ข้อมูลจำลอง)",
        netAmount: "4500.00",
        vatAmount: "0.00",
        whtCategory: "service",
      },
    ],
  },
  null,
);
// The service vendor has no bank account on record yet: its bill is excluded from a run (§8).
recordBill(
  others[2]!,
  {
    vendorInvoiceNo: "SV-6909-0077",
    invoiceDate: addDays(today(), -25),
    isTaxInvoice: true,
    lines: [
      {
        accountCode: "6900",
        description: "บริการทำความสะอาดสำนักงาน (ข้อมูลจำลอง)",
        netAmount: "3200.00",
        vatAmount: "224.00",
        whtCategory: "service",
      },
    ],
  },
  null,
);
refreshPayables();

/* ---------------------------------------------------------------------------- approvals */

onApprovalDecided("vendor_bank_account_change", (approval) => {
  const lists = [...[...stores.values()].map((store) => store.banks), ...otherBanks.values()];
  const list = lists.find((candidate) => candidate.some((item) => item.id === approval.subjectId));
  const account = list?.find((item) => item.id === approval.subjectId);
  if (list && account) activateIfReady(list, account);
});

/* ---------------------------------------------------------------------------- queues */

registerQueue("payables.manage", () => {
  const waiting = invoicesAll().filter((invoice) => invoice.status === "recorded").length;
  const confirmedWithout = statementsAll().filter(
    ({ statement }) =>
      statement.status === "confirmed" &&
      !(statementStates.get(statement.id)?.invoices ?? []).some((invoice) => invoice.status === "validated"),
  ).length;
  return {
    key: "finance.bills_missing_tax_invoice",
    path: "/admin/finance/payables/statements",
    count: waiting + confirmedWithout,
    overdueCount: 0,
    nextDueAt: null,
  };
});
registerQueue("payables.read", () => ({
  key: "finance.deliveries_without_gr",
  path: "/admin/finance/payables/goods-receipts",
  // Every POD the logistics desk accepts gets its GR at once (P15): the backend's check is the
  // same count, so the queue exists and reads zero until a GR fails to post.
  count: factoryStores().reduce(
    (sum, store) => sum + deliveries(store.factory.id).filter((item) => !grRows.has(item.shipment.id)).length,
    0,
  ),
  overdueCount: 0,
  nextDueAt: null,
}));

/* ---------------------------------------------------------------------------- handlers */

const sort = <T>(rows: T[], query: { sort?: string; order?: "asc" | "desc" }, field: string, order: "asc" | "desc") =>
  sortBy(rows, query.sort ?? field, query.order ?? order);

export const payableHandlers = [
  finance.get("/v1/admin/vendors", "payables.read", ({ query }) =>
    vendorsAll().filter((vendor) => !query.kind || vendor.kind === query.kind),
  ),
  finance.post(
    "/v1/admin/vendors",
    { permission: "payables.vendors.manage", idempotent: true, status: 201 },
    ({ body }) => {
      const errors = [
        ...(!body.legalName?.trim() ? [{ path: "legalName", code: "required", message: "กรอกชื่อผู้ขาย" }] : []),
        ...(!/^\d{13}$/.test(body.taxId ?? "")
          ? [{ path: "taxId", code: "pattern", message: "เลขประจำตัวผู้เสียภาษี 13 หลัก" }]
          : []),
      ];
      if (errors.length) return invalid(errors);
      if (
        vendorsAll().some((vendor) => vendor.taxId === body.taxId && vendor.branchCode === (body.branchCode ?? "00000"))
      )
        return problem(409, "payables.vendor_exists", "มีผู้ขายเลขประจำตัวผู้เสียภาษีและสาขานี้แล้ว");
      const vendor: Vendor = {
        id: mockId("vnd", others.length + 1),
        kind: body.kind,
        legalName: body.legalName.trim(),
        taxId: body.taxId,
        branchCode: body.branchCode ?? "00000",
        juristicType: body.juristicType,
        isVatRegistered: body.isVatRegistered,
        paymentTermsDays: body.paymentTermsDays,
        defaultWhtCategory: body.defaultWhtCategory,
      };
      others.push(vendor);
      otherBanks.set(vendor.id, []);
      return vendor;
    },
  ),
  finance.get("/v1/admin/vendors/{vendorId}/bank-accounts", "payables.read", ({ params }) =>
    vendorOf(params.vendorId!) ? banksOf(params.vendorId!) : notFound("ผู้ขาย"),
  ),
  finance.post(
    "/v1/admin/vendors/{vendorId}/bank-accounts",
    { permission: "payables.vendors.manage", idempotent: true, status: 201 },
    ({ params, body, persona }) => {
      const vendor = vendorOf(params.vendorId!);
      if (!vendor || vendor.kind === "factory") return notFound("ผู้ขาย");
      if (billRecorders.get(vendor.id)?.has(persona.id))
        return problem(
          403,
          "sod.bill_recorder_bank_change",
          "ผู้บันทึกบิลของผู้ขายรายนี้เปลี่ยนบัญชีธนาคารของผู้ขายไม่ได้ (แยกหน้าที่)",
        );
      const digits = (body.accountNo ?? "").replace(/[\s-]/g, "");
      if (!/^\d{10,15}$/.test(digits))
        return invalid([{ path: "accountNo", code: "pattern", message: "เลขบัญชี 10–15 หลัก" }]);
      const list = otherBanks.get(vendor.id)!;
      const duplicate =
        [...otherBanks.entries()].some(
          ([id, banks]) =>
            id !== vendor.id &&
            banks.some((bank) => bank.accountNoLast4 === digits.slice(-4) && bank.bankCode === body.bankCode),
        ) ||
        [...stores.values()].some((store) =>
          store.banks.some((bank) => bank.accountNoLast4 === digits.slice(-4) && bank.bankCode === body.bankCode),
        );
      const account: BankAccount = {
        id: mockId("vba", 100 + [...otherBanks.values()].flat().length),
        bankCode: body.bankCode,
        accountName: body.accountName,
        accountNoLast4: digits.slice(-4),
        branchName: body.branchName ?? null,
        status: "pending_approval",
        duplicateOfOtherVendor: duplicate,
        approvalRequestId: null,
        effectiveFrom: null,
        createdAt: bangkokIso(),
        verification: null,
      };
      account.approvalRequestId = openApproval({
        policy: "vendor_bank_account_change",
        subjectType: "vendor_bank_account",
        subjectId: account.id,
        requester: persona,
        payload: { vendor: vendor.legalName, bankCode: body.bankCode, bankLast4: account.accountNoLast4, duplicate },
      }).id;
      list.unshift(account);
      return account;
    },
  ),
  finance.post(
    "/v1/admin/vendor-bank-accounts/{accountId}/verification-calls",
    { permission: "vendor_bank_accounts.verify" },
    ({ params, body }) => {
      for (const list of otherBanks.values()) {
        const account = list.find((item) => item.id === params.accountId);
        if (!account) continue;
        if (!body.calledNumber?.trim() || !body.calledAt)
          return invalid([{ path: "calledNumber", code: "required", message: "กรอกเบอร์ที่โทรและเวลา" }]);
        account.verification = {
          calledAt: body.calledAt,
          calledNumberMasked: body.calledNumber.replace(/\d(?=\d{3})/g, "x"),
          outcome: body.outcome,
        };
        activateIfReady(list, account);
        return account;
      }
      return notFound("บัญชี");
    },
  ),
  finance.post(
    "/v1/admin/vendors/{vendorId}/bills",
    { permission: "payables.bills.record", idempotent: true, status: 201 },
    ({ params, body, persona }) => {
      const vendor = vendorOf(params.vendorId!);
      if (!vendor || vendor.kind === "factory") return notFound("ผู้ขาย");
      const errors = [
        ...(!body.vendorInvoiceNo?.trim()
          ? [{ path: "vendorInvoiceNo", code: "required", message: "กรอกเลขที่บิล" }]
          : []),
        ...(!body.lines?.length ? [{ path: "lines", code: "min", message: "เพิ่มรายการอย่างน้อยหนึ่งรายการ" }] : []),
        ...(body.lines ?? []).flatMap((line, index) => [
          ...(!isMoney(line.netAmount)
            ? [{ path: `lines[${index}].netAmount`, code: "pattern", message: "จำนวนเงินไม่ถูกต้อง" }]
            : []),
          ...(["1210", "2110", "2120", "1250"].includes(line.accountCode)
            ? [{ path: `lines[${index}].accountCode`, code: "control", message: "บัญชีคุมบันทึกตรงไม่ได้" }]
            : []),
        ]),
      ];
      if (errors.length) return invalid(errors);
      if (bills.some((bill) => bill.vendorId === vendor.id && bill.vendorInvoiceNo === body.vendorInvoiceNo.trim()))
        return problem(409, "payables.invoice_duplicate", "บันทึกบิลเลขนี้ของผู้ขายรายนี้ไปแล้ว");
      return recordBill(vendor, { ...body, vendorInvoiceNo: body.vendorInvoiceNo.trim() }, persona.id);
    },
  ),
  finance.get("/v1/admin/purchase-orders", "payables.read", ({ query }) => {
    const rows = purchaseOrders()
      .map((row) => row.po)
      .filter((po) => !query.factoryId || po.factoryId === query.factoryId)
      .filter((po) => !query.status || po.status === query.status)
      .filter((po) => matchesQuery(query.q, po.poNumber, po.jobNo, po.orderCode));
    return paginate(sort(rows, query, "issuedAt", "desc"), query);
  }),
  finance.get(
    "/v1/admin/purchase-orders/{poId}",
    "payables.read",
    ({ params }) => purchaseOrders().find((row) => row.po.id === params.poId)?.po ?? notFound("ใบสั่งผลิต"),
  ),
  finance.get("/v1/admin/goods-receipts", "payables.read", ({ query }) => {
    const rows = goodsReceipts()
      .filter((row) => !query.factoryId || row.factoryId === query.factoryId)
      .map((row) => row.gr)
      .filter((gr) => matchesQuery(query.q, gr.grNumber, gr.poNumber));
    return paginate(sort(rows, query, "receivedOn", "desc"), query);
  }),
  finance.get("/v1/admin/billing-statements", "payables.read", ({ query, persona }) => {
    const rows = statementsAll()
      .map((found) => toStatement(found, persona))
      .filter((statement) => !query.factoryId || statement.factoryId === query.factoryId)
      .filter((statement) => !query.status || statement.status === query.status)
      .filter((statement) => matchesQuery(query.q, statement.bsNumber));
    return paginate(sort(rows, query, "periodTo", "desc"), query);
  }),
  finance.get("/v1/admin/billing-statements/{statementId}", "payables.read", ({ params, persona }) => {
    const found = statementsAll().find(({ statement }) => statement.id === params.statementId);
    return found ? toStatement(found, persona) : notFound("ใบวางบิล");
  }),
  finance.post(
    "/v1/admin/billing-statements/{statementId}/tax-invoices",
    { permission: "payables.manage", idempotent: true, status: 201 },
    ({ params, body, persona }) => {
      const found = statementsAll().find(({ statement }) => statement.id === params.statementId);
      if (!found) return notFound("ใบวางบิล");
      const state = statementStates.get(found.statement.id)!;
      // The same check `billing_statement.capture_tax_invoice` offers on (ADMIN_STATEMENT_ACTIONS).
      if (!statementActions(statementOf(found), persona).some((a) => a.key === "billing_statement.capture_tax_invoice"))
        return problem(409, "payables.invoice_duplicate", "ใบวางบิลนี้มีใบกำกับภาษีที่บันทึกหรือตรวจรับแล้ว");
      const errors = [
        ...(!body.vendorInvoiceNo?.trim()
          ? [{ path: "vendorInvoiceNo", code: "required", message: "กรอกเลขที่ใบกำกับภาษีของโรงงาน" }]
          : []),
        ...(!/^\d{13}$/.test(body.sellerTaxId ?? "")
          ? [{ path: "sellerTaxId", code: "pattern", message: "เลขประจำตัวผู้เสียภาษี 13 หลัก" }]
          : []),
        ...(!/^\d{5}$/.test(body.sellerBranchCode ?? "")
          ? [{ path: "sellerBranchCode", code: "pattern", message: "รหัสสาขา 5 หลัก" }]
          : []),
        ...(!isMoney(body.netAmount) ? [{ path: "netAmount", code: "pattern", message: "จำนวนเงินไม่ถูกต้อง" }] : []),
        ...(!isMoney(body.vatAmount) ? [{ path: "vatAmount", code: "pattern", message: "จำนวนเงินไม่ถูกต้อง" }] : []),
        ...(body.source === "pdf_upload" && !body.fileId
          ? [{ path: "fileId", code: "required", message: "แนบไฟล์ใบกำกับภาษี" }]
          : []),
      ];
      if (errors.length) return invalid(errors);
      if (
        invoicesAll().some(
          (invoice) =>
            invoice.vendorId === found.store.factory.id && invoice.vendorInvoiceNo === body.vendorInvoiceNo.trim(),
        )
      )
        return problem(409, "payables.invoice_duplicate", "บันทึกใบกำกับภาษีเลขนี้ของโรงงานนี้ไปแล้ว");
      state.invoices.push({
        id: mockId("vin", 100 + state.invoices.length + invoicesAll().length),
        invoiceNo: body.vendorInvoiceNo.trim(),
        invoiceDate: body.invoiceDate,
        sellerTaxId: body.sellerTaxId,
        sellerBranchCode: body.sellerBranchCode,
        source: body.source,
        file: null,
        eTaxReference: body.source === "e_tax" ? body.vendorInvoiceNo.trim() : null,
        status: "submitted",
        rejectReason: null,
        recordedAt: bangkokIso(),
      });
      // Captured amounts differing from the statement are for validation to refuse, not capture.
      capturedAmounts.set(state.invoices.at(-1)!.id, { net: body.netAmount, vat: body.vatAmount });
      return factoryInvoices().find((invoice) => invoice.id === state.invoices.at(-1)!.id)!;
    },
  ),
  finance.get("/v1/admin/vendor-invoices", "payables.read", ({ query }) => {
    const rows = invoicesAll()
      .filter((invoice) => !query.status || invoice.status === query.status)
      .filter((invoice) => !query.vendorId || invoice.vendorId === query.vendorId)
      .filter((invoice) => matchesQuery(query.q, invoice.vendorInvoiceNo, invoice.vendorName, invoice.bsNumber));
    return paginate(sort(rows, query, "invoiceDate", "desc"), query);
  }),
  finance.get(
    "/v1/admin/vendor-invoices/{invoiceId}",
    "payables.read",
    ({ params }) => invoicesAll().find((invoice) => invoice.id === params.invoiceId) ?? notFound("ใบกำกับภาษี"),
  ),
  finance.post(
    "/v1/admin/vendor-invoices/{invoiceId}/actions/validate",
    { permission: "payables.manage", idempotent: true },
    ({ params, body, persona }) => {
      const found = statementsAll().find(({ statement }) =>
        (statementStates.get(statement.id)?.invoices ?? []).some((invoice) => invoice.id === params.invoiceId),
      );
      if (!found) return notFound("ใบกำกับภาษีของโรงงาน");
      const partnerInvoice = statementStates
        .get(found.statement.id)!
        .invoices.find((invoice) => invoice.id === params.invoiceId)!;
      if (partnerInvoice.status !== "submitted")
        return problem(409, "payables.invoice_not_pending", "ใบกำกับภาษีนี้ตรวจไปแล้ว");
      if (!body.valid) {
        if (!body.reason?.trim())
          return invalid([{ path: "reason", code: "required", message: "ระบุเหตุผลที่ไม่รับ" }]);
        Object.assign(partnerInvoice, { status: "rejected", rejectReason: body.reason.trim() });
        return factoryInvoices().find((invoice) => invoice.id === params.invoiceId)!;
      }
      // §2: the seller must be the factory, and the amounts the statement's.
      const factory = found.store.factory;
      if (partnerInvoice.sellerTaxId !== factory.taxId || partnerInvoice.sellerBranchCode !== factory.branchCode)
        return problem(
          422,
          "payables.invoice_mismatch",
          "ผู้ขายในใบกำกับภาษีไม่ตรงกับโรงงาน (เลขประจำตัวผู้เสียภาษีหรือสาขา)",
        );
      const captured = capturedAmounts.get(partnerInvoice.id);
      if (captured && (captured.net !== found.statement.totals.net || captured.vat !== found.statement.totals.vat))
        return problem(422, "payables.invoice_mismatch", "ยอดในใบกำกับภาษีไม่ตรงกับใบวางบิล");
      Object.assign(partnerInvoice, { status: "validated", rejectReason: null });
      // P17V: VAT already paid while the invoice was missing moves from pending to input VAT.
      const pending = vatPending.get(factory.id) ?? 0;
      if (pending > 0) {
        post({
          rule: "P17V",
          description: `ภาษีซื้อพร้อมใช้ ${partnerInvoice.invoiceNo}`,
          documentDate: partnerInvoice.invoiceDate,
          source: { type: "vendor_invoice", id: partnerInvoice.id, number: partnerInvoice.invoiceNo },
          createdBy: persona.id,
          lines: [
            {
              account: "1241",
              debit: pending,
              taxCode: "input_vat",
              taxBase: Math.round(pending / 0.07),
              dimensions: { factory: factory.id },
            },
            { account: "1242", credit: pending, taxCode: "input_vat_pending", dimensions: { factory: factory.id } },
          ],
        });
        vatPending.set(factory.id, 0);
      }
      return factoryInvoices().find((invoice) => invoice.id === params.invoiceId)!;
    },
  ),
  finance.get("/v1/admin/payables", "payables.read", ({ query }) => {
    refreshPayables();
    const rows = payables
      .map((row) => row.dto)
      .filter((dto) => !query.status || dto.status === query.status)
      .filter((dto) => !query.vendorId || dto.vendorId === query.vendorId)
      .filter((dto) => matchesQuery(query.q, dto.vendorName, dto.poNumber, dto.orderCode));
    return paginate(sort(rows, query, "eligibleAt", "asc"), query);
  }),
];

const capturedAmounts = new Map<string, { net: string; vat: string }>();
