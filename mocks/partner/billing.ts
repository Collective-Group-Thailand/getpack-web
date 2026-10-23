/**
 * The factory's money with getpack (F5 5.3) on the published partner surface, `partner.payables.*`
 * (contract v0.6.0): billing statements on the token-scoped `/v1/partner/billing-statements` (D-044),
 * the factory's own tax invoice against one, the payout schedule per job (D-022, D-164), payouts with
 * their remittance advice and 50 ทวิ, and the statement of account.
 *
 * Derived from the rows the other mocks hold: the factory's jobs (`./jobs.ts`), the logistics desk's
 * delivered shipments and claims, and the payout policy in the factory's configuration. The statement
 * model below is mock-only and is also what the back office's payables mock reads
 * (`mocks/admin/finance/payables.ts`), so a statement the factory confirms is confirmed there; it is
 * turned into `BillingStatementDto` on the way out. Money is computed here, in satang, and handed out
 * as decimal strings — the zone only formats it (CLAUDE.md).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { orders, type MockOrder } from "../admin/commerce";
import { claims, shipments, type Shipment } from "../admin/logistics";
import { stores, type Store } from "../admin/partners";
import { files } from "../admin/platform";
import { nextActions, type ActionRule } from "../next-actions";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { buyAmountOf, extraOf, factoryJobs, titleOf } from "./jobs";
import { canPartner, PARTNER_PERSONAS, type PartnerPersona } from "./personas";
import { once, own, ownScope } from "./support";

type StatementDto = Schemas["BillingStatementDto"];
type InvoiceDto = Schemas["VendorInvoiceDto"];
type ScheduleJobDto = Schemas["PayoutScheduleJobDto"];
type PayoutDto = Schemas["PartnerPayoutDetailDto"];
type AccountDto = Schemas["StatementOfAccountDto"];

const DAY = 24 * 60;
const now = () => bangkokIso();
const today = () => bangkokIso().slice(0, 10);
export const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T12:00:00+07:00`) + days * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 10);
const startOf = (day: string) => `${day}T00:00:00+07:00`;

/* ---------------------------------------------------------------------------- satang */

export const satang = (amount: string) => Math.round(Number(amount) * 100);
export const baht = (value: number) => {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
};
const share = (amount: string, pct: string) => Math.round((satang(amount) * Number(pct)) / 100);
const vatOf = (net: number, registered: boolean) => (registered ? Math.round(net * 0.07) : 0);
const MONEY = /^\d{1,12}\.\d{2}$/;

/** A tiny, valid PDF: what a mock returns where the API returns a short-lived signed URL. */
export const PDF = `data:application/pdf;base64,${Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
).toString("base64")}`;
export const signed = (url: string): Schemas["DownloadUrlDto"] => ({ url, expiresAt: bangkokIso(5) });

/* ------------------------------------------------------------------------ deliveries */

export interface Delivery {
  shipment: Shipment;
  order: MockOrder;
  deliveredOn: string;
  quantity: number;
}

export function deliveries(factoryId: string): Delivery[] {
  return shipments
    .filter((item) => item.factory.id === factoryId && item.status === "delivered")
    .flatMap((shipment) => {
      const order = orders.find((candidate) => candidate.id === shipment.order.id);
      if (!order) return [];
      const at = shipment.pod?.capturedAt ?? shipment.lastEvent?.occurredAt ?? now();
      // D-165: the payable is min(delivered, shipped) — overage within tolerance is not paid.
      const quantity = Math.min(shipment.pod?.deliveredQuantity ?? shipment.quantity, shipment.quantity);
      return [{ shipment, order, deliveredOn: at.slice(0, 10), quantity }];
    });
}

export const policyOf = (factoryId: string) => stores.get(factoryId)?.config.payoutPolicy.current ?? null;

export function acceptedOn(jobId: string, fallback: string) {
  const job = orders.flatMap((order) => order.jobs).find((item) => item.id === jobId);
  const entry = job ? extraOf(job).history.find((item) => item.text.startsWith("โรงงานรับงาน")) : undefined;
  return (entry?.at ?? fallback).slice(0, 10);
}

/* ------------------------------------------------------------------ the statement model */

interface FileModel {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl: string | null;
  url: string | null;
}

/** The factory's own tax invoice, as both zones' mocks keep it (`submitted` = the API's `recorded`). */
export interface InvoiceModel {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  sellerTaxId: string;
  sellerBranchCode: string;
  source: "pdf_upload" | "e_tax" | "manual";
  file: FileModel | null;
  eTaxReference: string | null;
  status: "submitted" | "validated" | "rejected";
  rejectReason: string | null;
  recordedAt: string;
  /** The amounts the factory keyed from its own invoice (`CaptureTaxInvoiceDto`); Finance checks them. */
  netAmount?: string;
  vatAmount?: string;
}

export interface StatementLineModel {
  id: string;
  kind: "production" | "shipping" | "deduction" | "advance_offset";
  description: string;
  reference: string | null;
  quantity: number | null;
  amount: string;
}

export interface StatementModel {
  id: string;
  bsNumber: string;
  periodFrom: string;
  periodTo: string;
  status: Schemas["BillingStatementStatus"];
  generatedAt: string;
  totals: {
    production: string;
    shipping: string;
    deductions: string;
    net: string;
    vat: string;
    gross: string;
    alreadyPaid: string;
    remaining: string;
  };
  currency: "THB";
  lines: StatementLineModel[];
  confirmedBy: { id: string; displayName: string } | null;
  confirmedAt: string | null;
  disputeNote: string | null;
  disputedLineNos: number[];
  taxInvoices: InvoiceModel[];
}

export interface StatementState {
  frozen: StatementModel | null;
  status: StatementModel["status"];
  confirmedBy: StatementModel["confirmedBy"];
  confirmedAt: string | null;
  disputeNote: string | null;
  disputedLineNos: number[];
  invoices: InvoiceModel[];
}

export const statementStates = new Map<string, StatementState>();

function stateOf(id: string, seeded: Partial<StatementState> = {}): StatementState {
  let state = statementStates.get(id);
  if (!state) {
    state = {
      frozen: null,
      status: "sent",
      confirmedBy: null,
      confirmedAt: null,
      disputeNote: null,
      disputedLineNos: [],
      invoices: [],
      ...seeded,
    };
    statementStates.set(id, state);
  }
  return state;
}

function deductionsOf(factoryId: string, orderIds: Set<string>) {
  return claims
    .filter((claim) => claim.factory?.id === factoryId && orderIds.has(claim.order.id))
    .flatMap((claim) =>
      claim.resolutions
        .filter((item) => item.action === "factory_deduction" && item.amount)
        .map((item) => ({ claim, amount: satang(item.amount!) })),
    );
}

const fileModel = (id: string, name: string): FileModel => ({
  id,
  originalName: name,
  mimeType: "application/pdf",
  sizeBytes: 1024,
  thumbnailUrl: null,
  url: PDF,
});

function buildStatement(factoryId: string, index: 0 | 1): StatementModel {
  const store = stores.get(factoryId)!;
  const id = mockId("bst", Number.parseInt(store.factory.code.slice(1), 10) * 10 + index);
  const monthStart = `${today().slice(0, 7)}-01`;
  const all = deliveries(factoryId);
  const mine =
    index === 0
      ? all.filter((item) => item.deliveredOn < monthStart)
      : all.filter((item) => item.deliveredOn >= monthStart);
  const periodFrom = index === 0 ? addDays(monthStart, -30).slice(0, 8) + "01" : monthStart;
  const periodTo = index === 0 ? addDays(monthStart, -1) : today();
  const state = stateOf(
    id,
    index === 0
      ? {
          status: "confirmed",
          confirmedBy: { id: PARTNER_PERSONAS[5]!.id, displayName: PARTNER_PERSONAS[5]!.displayName },
          confirmedAt: bangkokIso(-DAY * 3),
          invoices: [
            {
              id: mockId("vin", 1),
              invoiceNo: "INV-6909-0012",
              invoiceDate: addDays(monthStart, -1),
              sellerTaxId: store.factory.taxId,
              sellerBranchCode: store.factory.branchCode,
              source: "pdf_upload",
              file: fileModel(mockId("vif", 1), "invoice-INV-6909-0012.pdf"),
              eTaxReference: null,
              status: "validated",
              rejectReason: null,
              recordedAt: bangkokIso(-DAY * 2),
            },
          ],
        }
      : {},
  );
  const live = {
    status: state.status,
    confirmedBy: state.confirmedBy,
    confirmedAt: state.confirmedAt,
    disputeNote: state.disputeNote,
    disputedLineNos: state.disputedLineNos,
    taxInvoices: state.invoices,
  };
  if (state.frozen) return { ...state.frozen, ...live };
  const lines: StatementLineModel[] = [];
  let production = 0;
  let shipping = 0;
  let advance = 0;
  const policy = policyOf(factoryId);
  const orderIds = new Set<string>();
  for (const item of mine) {
    const po = satang(buyAmountOf(item.order));
    const amount = Math.round((po * item.quantity) / item.order.quantity);
    production += amount;
    orderIds.add(item.order.id);
    lines.push({
      id: mockId("bsl", lines.length + index * 500 + 1),
      kind: "production",
      description: `${titleOf(item.order)} · ${item.order.jobs[0]?.jobNo ?? item.order.orderCode}`,
      reference: item.shipment.shipmentNo,
      quantity: item.quantity,
      amount: baht(amount),
    });
    const fleet = 25_000 + item.shipment.cartons * 5_000;
    shipping += fleet;
    lines.push({
      id: mockId("bsl", lines.length + index * 500 + 1),
      kind: "shipping",
      description: `ค่าจัดส่ง ${item.shipment.destination.province}`,
      reference: item.shipment.shipmentNo,
      quantity: item.shipment.cartons,
      amount: baht(fleet),
    });
    advance += Math.round((amount * Number(policy?.advancePct ?? 0)) / 100);
  }
  const deductions = deductionsOf(factoryId, orderIds);
  for (const { claim, amount } of deductions)
    lines.push({
      id: mockId("bsl", lines.length + index * 500 + 1),
      kind: "deduction",
      description: `หักค่าเคลม ${claim.claimNo}`,
      reference: claim.claimNo,
      quantity: null,
      amount: baht(-amount),
    });
  if (advance)
    lines.push({
      id: mockId("bsl", lines.length + index * 500 + 1),
      kind: "advance_offset",
      description: "หักเงินล่วงหน้าที่จ่ายเมื่อรับงาน",
      reference: null,
      quantity: null,
      amount: baht(-advance),
    });
  const deducted = deductions.reduce((total, item) => total + item.amount, 0);
  const net = production + shipping - deducted;
  const vat = vatOf(net, store.factory.isVatRegistered);
  return {
    id,
    bsNumber: `BS-${store.factory.code}-${periodFrom.slice(0, 7).replace("-", "")}`,
    periodFrom,
    periodTo,
    generatedAt: index === 0 ? `${monthStart}T08:00:00+07:00` : bangkokIso(-60),
    totals: {
      production: baht(production),
      shipping: baht(shipping),
      deductions: baht(-deducted),
      net: baht(net),
      vat: baht(vat),
      gross: baht(net + vat),
      alreadyPaid: baht(advance),
      remaining: baht(net + vat - advance),
    },
    currency: "THB",
    lines,
    ...live,
  };
}

export const statementsOf = (factoryId: string): StatementModel[] =>
  deliveries(factoryId).length ? [buildStatement(factoryId, 1), buildStatement(factoryId, 0)] : [];

/* ------------------------------------------------------------------- the published shapes */

const INVOICE_STATUS: Record<InvoiceModel["status"], Schemas["VendorInvoiceStatus"]> = {
  submitted: "recorded",
  validated: "validated",
  rejected: "rejected",
};

export function toVendorInvoiceDto(store: Store, statement: StatementModel, invoice: InvoiceModel): InvoiceDto {
  const registered = store.factory.isVatRegistered;
  const net = invoice.netAmount ?? statement.totals.net;
  const vat = invoice.vatAmount ?? statement.totals.vat;
  return {
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
    isTaxInvoice: registered,
    status: INVOICE_STATUS[invoice.status],
    rejectionReason: invoice.rejectReason,
    inputVatStatus:
      invoice.status === "validated" ? "claimable" : satang(vat) > 0 ? "pending_document" : "not_claimable",
    netAmount: net,
    vatAmount: vat,
    grossAmount: baht(satang(net) + satang(vat)),
    lines: statement.lines.map((line) => ({
      description: line.description,
      netAmount: line.amount,
      vatAmount: baht(vatOf(satang(line.amount), registered)),
      whtCategory: line.kind === "shipping" ? "transport" : line.kind === "production" ? "hire_of_work" : "none",
      accountCode: line.kind === "shipping" ? "5120" : line.kind === "production" ? "5110" : null,
    })),
  };
}

interface StatementFacts {
  status: string;
  invoiceStatuses: string[];
}

const DECIDABLE = ["generated", "sent", "disputed"];
/** A tax invoice is still wanted while none is recorded or validated (a rejected one is replaced). */
const wantsInvoice = (s: StatementFacts) => !s.invoiceStatuses.some((i) => i === "recorded" || i === "validated");

/** getpack-api `src/modules/payables/statement-actions.ts` (v0.6.0), the factory's rules. */
const PARTNER_STATEMENT_ACTIONS: ActionRule<StatementFacts>[] = [
  {
    key: "billing_statement.confirm",
    permissions: ["factory_payables.manage"],
    irreversible: true,
    when: (s) => DECIDABLE.includes(s.status),
  },
  {
    key: "billing_statement.dispute",
    permissions: ["factory_payables.manage"],
    when: (s) => DECIDABLE.includes(s.status),
  },
  {
    key: "billing_statement.submit_tax_invoice",
    permissions: ["factory_payables.manage"],
    when: (s) => s.status !== "superseded" && wantsInvoice(s),
  },
];

/** A statement as `partner.payables.*` answers it, for the signed-in factory user. */
export function toStatementDto(store: Store, statement: StatementModel, who: PartnerPersona): StatementDto {
  const registered = store.factory.isVatRegistered;
  const invoices = statement.taxInvoices.map((invoice) => toVendorInvoiceDto(store, statement, invoice));
  const latest = invoices.at(-1);
  return {
    id: statement.id,
    bsNumber: statement.bsNumber,
    factoryId: store.factory.id,
    periodFrom: statement.periodFrom,
    periodTo: statement.periodTo,
    status: statement.status,
    generatedAt: statement.generatedAt,
    confirmedAt: statement.confirmedAt,
    confirmedBy: statement.confirmedBy,
    disputeNote: statement.disputeNote,
    disputedLineNos: statement.disputedLineNos,
    currency: "THB",
    totals: {
      production: statement.totals.production,
      shipping: statement.totals.shipping,
      // The mock has no mock-up, design or reproduction lines.
      other: "0.00",
      deductions: statement.totals.deductions,
      advanceOffset: statement.totals.alreadyPaid,
      net: statement.totals.net,
      vat: statement.totals.vat,
      gross: statement.totals.gross,
      alreadyPaid: statement.totals.alreadyPaid,
      remaining: statement.totals.remaining,
    },
    netAmount: statement.totals.net,
    vatAmount: statement.totals.vat,
    grossAmount: statement.totals.gross,
    lines: statement.lines.map((line, index) => {
      const net = satang(line.amount);
      const vat = vatOf(net, registered);
      return {
        lineNo: index + 1,
        // The contract has no advance-offset kind: as on the back office's statement, it is a deduction.
        kind: line.kind === "advance_offset" ? "deduction" : line.kind,
        description: line.description,
        reference: line.reference,
        quantity: line.quantity,
        netAmount: line.amount,
        vatAmount: baht(vat),
        grossAmount: baht(net + vat),
      };
    }),
    // Newest first, as the contract lists them.
    taxInvoices: [...invoices].reverse(),
    taxInvoiceStatus: !latest || latest.status === "void" ? "none" : latest.status,
    inputVatStatus: latest?.inputVatStatus ?? null,
    nextActions: nextActions(
      { status: statement.status, invoiceStatuses: invoices.map((invoice) => invoice.status) },
      PARTNER_STATEMENT_ACTIONS,
      (permission) => canPartner(who, permission),
    ),
  };
}

/* ------------------------------------------------------------------- payout schedule */

interface ScheduleItem {
  id: string;
  source: "advance" | "goods_receipt" | "retention";
  net: number;
  vat: number;
  eligibleOn: string | null;
  status: Schemas["PayableStatus"];
  paidOn: string | null;
}

interface ScheduleRow {
  order: MockOrder;
  jobNo: string;
  poNumber: string;
  purchaseOrderId: string;
  poStatus: Schemas["PoStatus"];
  balancePending: boolean;
  items: ScheduleItem[];
}

const PO_STATUS: Record<string, Schemas["PoStatus"]> = {
  accepted: "accepted",
  in_progress: "accepted",
  on_hold: "accepted",
  completed: "received",
};
const SOURCES: ScheduleItem["source"][] = ["advance", "goods_receipt", "retention"];

const dayNumber = (day: string) => Number(day.replace(/-/g, "")) % 1_000_000;
const payoutIdOf = (paidOn: string, source: ScheduleItem["source"]) =>
  mockId("pvo", dayNumber(paidOn) * 4 + SOURCES.indexOf(source));

function scheduleRows(factoryId: string): ScheduleRow[] {
  const policy = policyOf(factoryId);
  const registered = stores.get(factoryId)?.factory.isVatRegistered ?? true;
  const advancePct = policy?.advancePct ?? "30.0000";
  const retentionPct = policy?.retentionPct ?? "0.0000";
  const balancePct = (100 - Number(advancePct) - Number(retentionPct)).toFixed(4);
  const claimWindow = policy?.claimWindowDays ?? 7;
  const release = policy?.retentionReleaseDays ?? 30;
  const delivered = deliveries(factoryId);
  return factoryJobs(factoryId)
    .filter(({ job }) => ["accepted", "in_progress", "completed", "on_hold"].includes(job.status))
    .map(({ order, job }, index) => {
      const po = buyAmountOf(order);
      const accepted = acceptedOn(job.id, extraOf(job).releasedAt);
      const lastPod =
        delivered
          .filter((item) => item.order.id === order.id)
          .map((item) => item.deliveredOn)
          .sort()
          .at(-1) ?? null;
      const balanceOn = lastPod ? addDays(lastPod, claimWindow) : null;
      const retentionOn = balanceOn ? addDays(balanceOn, release) : null;
      const state = (on: string | null): Schemas["PayableStatus"] =>
        on === null ? "open" : on <= addDays(today(), -3) ? "paid" : on <= today() ? "eligible" : "open";
      const item = (source: ScheduleItem["source"], pct: string, on: string | null): ScheduleItem => {
        const net = share(po, pct);
        const status = state(on);
        return {
          id: mockId("pay", index * 4 + SOURCES.indexOf(source) + 1),
          source,
          net,
          vat: vatOf(net, registered),
          eligibleOn: on,
          status,
          paidOn: status === "paid" ? addDays(on!, 2) : null,
        };
      };
      return {
        order,
        jobNo: job.jobNo,
        poNumber: `PO2569-${job.jobNo.replace(/\D/g, "").slice(-5).padStart(5, "0")}`,
        purchaseOrderId: mockId("po", index + 900),
        poStatus: PO_STATUS[job.status] ?? "issued",
        // The balance (and the retention with it) opens with the goods receipt at POD (D-165).
        balancePending: lastPod === null,
        items: [
          item("advance", advancePct, accepted),
          ...(lastPod ? [item("goods_receipt", balancePct, balanceOn)] : []),
          ...(lastPod && Number(retentionPct) > 0 ? [item("retention", retentionPct, retentionOn)] : []),
        ],
      };
    });
}

function toScheduleJobDto(factoryId: string, row: ScheduleRow): ScheduleJobDto {
  const policy = policyOf(factoryId);
  return {
    purchaseOrderId: row.purchaseOrderId,
    poNumber: row.poNumber,
    poStatus: row.poStatus,
    jobNo: row.jobNo,
    orderCode: row.order.orderCode,
    balancePending: row.balancePending,
    terms: {
      advancePct: policy?.advancePct ?? "30.0000",
      advanceTrigger: policy?.advanceTrigger ?? "job_accepted",
      balanceTrigger: policy?.balanceTrigger ?? "after_pod_and_claim_window",
      claimWindowDays: policy?.claimWindowDays ?? 7,
      paymentTermsDays: policy?.paymentTermsDays ?? 0,
      retentionPct: policy?.retentionPct ?? "0.0000",
      retentionReleaseDays: policy?.retentionReleaseDays ?? 30,
    },
    items: row.items.map((item) => {
      const open = item.status === "paid" || item.status === "cancelled" ? 0 : 1;
      return {
        id: item.id,
        source: item.source,
        netAmount: baht(item.net),
        vatAmount: baht(item.vat),
        openNetAmount: baht(item.net * open),
        openVatAmount: baht(item.vat * open),
        eligibleAt: item.eligibleOn ? startOf(item.eligibleOn) : null,
        status: item.status,
        paidOn: item.paidOn,
        payoutId: item.paidOn ? payoutIdOf(item.paidOn, item.source) : null,
        waitingFor:
          item.status === "open"
            ? "eligibility_date"
            : item.status === "eligible"
              ? "payout_run"
              : item.status === "in_run"
                ? "bank_confirmation"
                : null,
      };
    }),
  };
}

/* --------------------------------------------------------------------------- payouts */

const WHT_PCT = "3.0000"; // ⚖ hire of work — the auditor confirms (D-022); the API decides.
const KIND_OF: Record<ScheduleItem["source"], Schemas["PayoutKind"]> = {
  advance: "advance",
  goods_receipt: "balance",
  retention: "retention_release",
};

/** The payouts made to a factory: one per day and kind of payable paid (the runs are Finance's). */
function payouts(factoryId: string): PayoutDto[] {
  const groups = new Map<string, { row: ScheduleRow; item: ScheduleItem }[]>();
  for (const row of scheduleRows(factoryId))
    for (const item of row.items)
      if (item.paidOn) {
        const key = `${item.paidOn}|${item.source}`;
        groups.set(key, [...(groups.get(key) ?? []), { row, item }]);
      }
  const store = stores.get(factoryId);
  const bank = store?.banks.find((item) => item.status === "active")?.accountNoLast4 ?? null;
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, paid]): PayoutDto => {
      const [paidOn, source] = key.split("|") as [string, ScheduleItem["source"]];
      const net = paid.reduce((total, { item }) => total + item.net, 0);
      const vat = paid.reduce((total, { item }) => total + item.vat, 0);
      const wht = Math.round((net * Number(WHT_PCT)) / 100);
      const pv = `PV-2569-${paidOn.slice(5).replace("-", "")}${"ABR"[SOURCES.indexOf(source)]}`;
      return {
        id: payoutIdOf(paidOn, source),
        pvNumber: pv,
        kind: KIND_OF[source],
        status: "paid",
        payOn: paidOn,
        paidOn,
        apNetAmount: baht(net),
        vatAmount: baht(vat),
        whtAmount: baht(wht),
        retentionAmount: "0.00",
        claimDeductionAmount: "0.00",
        cashAmount: baht(net + vat - wht),
        currency: "THB",
        bankAccountLast4: bank,
        bankRef: `KTB${dayNumber(paidOn)}`,
        failureReason: null,
        remittanceAdviceAvailable: true,
        whtCertificates: [
          {
            id: mockId("wtc", dayNumber(paidOn) * 4 + SOURCES.indexOf(source)),
            wtNumber: `WT2569-${pv.slice(-5)}`,
            form: "pnd53",
            whtRatePct: WHT_PCT,
            paidAmount: baht(net),
            whtAmount: baht(wht),
            paidOn,
            pdfReady: true,
          },
        ],
        allocations: paid.map(({ row, item }) => ({
          payableId: item.id,
          source: item.source,
          netAmount: baht(item.net),
          vatAmount: baht(item.vat),
          jobNo: row.jobNo,
          orderCode: row.order.orderCode,
          poNumber: row.poNumber,
          grNumber: item.source === "advance" ? null : `GR-${row.jobNo}`,
          bsNumber: null,
        })),
        claimDeductions: [],
      };
    });
}

function toPayoutSummary(payout: PayoutDto): Schemas["PartnerPayoutDto"] {
  return {
    id: payout.id,
    pvNumber: payout.pvNumber,
    kind: payout.kind,
    status: payout.status,
    payOn: payout.payOn,
    paidOn: payout.paidOn,
    apNetAmount: payout.apNetAmount,
    vatAmount: payout.vatAmount,
    whtAmount: payout.whtAmount,
    retentionAmount: payout.retentionAmount,
    claimDeductionAmount: payout.claimDeductionAmount,
    cashAmount: payout.cashAmount,
    currency: payout.currency,
    bankAccountLast4: payout.bankAccountLast4,
    whtCertificates: payout.whtCertificates,
  };
}

/* ----------------------------------------------------------------- statement of account */

function account(factoryId: string, from: string, to: string): AccountDto {
  const registered = stores.get(factoryId)?.factory.isVatRegistered ?? true;
  const events: Omit<AccountDto["entries"][number], "balance">[] = [
    ...deliveries(factoryId).map((item) => {
      const production = Math.round((satang(buyAmountOf(item.order)) * item.quantity) / item.order.quantity);
      const net = production + 25_000 + item.shipment.cartons * 5_000;
      return {
        date: item.deliveredOn,
        kind: "goods_receipt" as const,
        reference: `GR-${item.shipment.shipmentNo}`,
        credit: baht(net + vatOf(net, registered)),
        debit: "0.00",
      };
    }),
    ...payouts(factoryId).map((item) => ({
      date: item.paidOn!,
      kind: "payout" as const,
      reference: item.pvNumber,
      credit: "0.00",
      // What getpack paid, with the tax it withheld for the factory.
      debit: baht(satang(item.cashAmount) + satang(item.whtAmount)),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  let opening = 0;
  let credit = 0;
  let debit = 0;
  const entries: AccountDto["entries"] = [];
  for (const event of events) {
    const change = satang(event.credit) - satang(event.debit);
    if (event.date < from) {
      opening += change;
      balance += change;
      continue;
    }
    if (event.date > to) continue;
    balance += change;
    credit += satang(event.credit);
    debit += satang(event.debit);
    entries.push({ ...event, balance: baht(balance) });
  }
  return {
    factoryId,
    from,
    to,
    opening: baht(opening),
    entries,
    closing: baht(balance),
    totalCredit: baht(credit),
    totalDebit: baht(debit),
    currency: "THB",
  };
}

/* ----------------------------------------------------------------------------- handlers */

const invalid = (errors: { path: string; code: string; message: string }[]) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", errors);
const noStatement = () => problem(404, "http.not_found", "ไม่พบใบวางบิลนี้");
const noPayout = () => problem(404, "http.not_found", "ไม่พบรายการจ่ายนี้");
export const pageQuery = (url: URL) => ({
  page: Number(url.searchParams.get("page") ?? 1),
  perPage: Number(url.searchParams.get("perPage") ?? 25),
});
const isDay = (value: string | null | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

function statementFor(request: Request, statementId: unknown, permission: string) {
  const ok = ownScope(request, permission);
  if (ok instanceof Response) return ok;
  const statement = statementsOf(ok.store.factory.id).find((item) => item.id === statementId);
  return statement ? { ...ok, statement, state: stateOf(statement.id) } : noStatement();
}

const freshDto = (store: Store, statementId: string, who: PartnerPersona) =>
  toStatementDto(
    store,
    statementsOf(store.factory.id).find((item) => item.id === statementId)!,
    who,
  );

export const billingHandlers = [
  /* ------------------------------------------------------------ billing statements (D-090) */
  http.get("*/v1/partner/billing-statements", ({ request }) => {
    const ok = ownScope(request, "factory_payables.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = statementsOf(ok.store.factory.id)
      .filter((item) => !status || item.status === status)
      .filter((item) => matchesQuery(q, item.bsNumber))
      .map((item) => toStatementDto(ok.store, item, ok.who));
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  http.get("*/v1/partner/billing-statements/:statementId", ({ request, params }) => {
    const found = statementFor(request, params.statementId, "factory_payables.read");
    return found instanceof Response
      ? found
      : HttpResponse.json(toStatementDto(found.store, found.statement, found.who));
  }),
  http.post("*/v1/partner/billing-statements/:statementId/actions/confirm", ({ request, params }) =>
    once(request, `bs-confirm:${String(params.statementId)}`, () => {
      const found = statementFor(request, params.statementId, "factory_payables.manage");
      if (found instanceof Response) return found;
      const { statement, state, who, store } = found;
      if (!DECIDABLE.includes(state.status))
        return problem(409, "payables.statement_not_confirmable", "ยืนยันได้เฉพาะใบวางบิลที่รอโรงงานตรวจ");
      Object.assign(state, {
        status: "confirmed",
        confirmedBy: { id: who.id, displayName: who.displayName },
        confirmedAt: now(),
        frozen: state.frozen ?? statement,
      });
      return HttpResponse.json(freshDto(store, statement.id, who));
    }),
  ),
  http.post("*/v1/partner/billing-statements/:statementId/actions/dispute", async ({ request, params }) => {
    const body = (await request
      .clone()
      .json()
      .catch(() => ({}))) as Partial<Schemas["DisputeStatementDto"]>;
    return once(request, `bs-dispute:${String(params.statementId)}`, () => {
      const found = statementFor(request, params.statementId, "factory_payables.manage");
      if (found instanceof Response) return found;
      const { statement, state, who, store } = found;
      const note = body.note?.trim() ?? "";
      if (note.length < 3 || note.length > 1000)
        return invalid([{ path: "note", code: "too_small", message: "อย่างน้อย 3 ตัวอักษร" }]);
      const lineNos = [...new Set(body.lineNos ?? [])].sort((a, b) => a - b);
      const unknown = lineNos.filter((n) => !Number.isInteger(n) || n < 1 || n > statement.lines.length);
      if (unknown.length)
        return invalid([{ path: "lineNos", code: "unknown_line", message: `ไม่มีรายการ ${unknown.join(", ")}` }]);
      if (!DECIDABLE.includes(state.status))
        return problem(409, "payables.statement_not_confirmable", "โต้แย้งได้เฉพาะใบวางบิลที่รอโรงงานตรวจ");
      Object.assign(state, {
        status: "disputed",
        disputeNote: note,
        disputedLineNos: lineNos,
        frozen: state.frozen ?? statement,
      });
      return HttpResponse.json(freshDto(store, statement.id, who));
    });
  }),
  http.post("*/v1/partner/billing-statements/:statementId/tax-invoices", async ({ request, params }) => {
    const body = (await request
      .clone()
      .json()
      .catch(() => ({}))) as Partial<Schemas["CaptureTaxInvoiceDto"]>;
    return once(request, `bs-invoice:${String(params.statementId)}`, () => {
      const found = statementFor(request, params.statementId, "factory_payables.manage");
      if (found instanceof Response) return found;
      const { statement, state, store } = found;
      const number = body.vendorInvoiceNo?.trim() ?? "";
      const errors = [
        ...(!number || number.length > 64
          ? [{ path: "vendorInvoiceNo", code: "required", message: "ระบุเลขที่ใบกำกับภาษี" }]
          : []),
        ...(!isDay(body.invoiceDate) ? [{ path: "invoiceDate", code: "date", message: "YYYY-MM-DD" }] : []),
        ...(!/^\d{13}$/.test(body.sellerTaxId ?? "")
          ? [{ path: "sellerTaxId", code: "pattern", message: "เลขประจำตัวผู้เสียภาษี 13 หลัก" }]
          : []),
        ...(!/^\d{5}$/.test(body.sellerBranchCode ?? "")
          ? [{ path: "sellerBranchCode", code: "pattern", message: "รหัสสาขา 5 หลัก" }]
          : []),
        ...(!MONEY.test(body.netAmount ?? "")
          ? [{ path: "netAmount", code: "pattern", message: "จำนวนเงินไม่ถูกต้อง" }]
          : []),
        ...(!MONEY.test(body.vatAmount ?? "")
          ? [{ path: "vatAmount", code: "pattern", message: "จำนวนเงินไม่ถูกต้อง" }]
          : []),
        ...(body.source !== "pdf_upload" && body.source !== "e_tax"
          ? [{ path: "source", code: "enum", message: "pdf_upload | e_tax" }]
          : []),
      ];
      if (errors.length) return invalid(errors);
      if (state.invoices.some((item) => item.invoiceNo === number))
        return problem(409, "payables.invoice_duplicate", "บันทึกใบกำกับภาษีเลขนี้ไปแล้ว");
      const file = body.fileId ? files.get(body.fileId) : null;
      if (body.fileId && (!file || file.uploadStatus !== "uploaded"))
        return problem(409, "file.not_ready", "ไฟล์ยังอัปโหลดไม่เสร็จ");
      const invoice: InvoiceModel = {
        id: mockId("vin", 200 + [...statementStates.values()].reduce((n, item) => n + item.invoices.length, 0)),
        invoiceNo: number,
        invoiceDate: body.invoiceDate!,
        sellerTaxId: body.sellerTaxId!,
        sellerBranchCode: body.sellerBranchCode!,
        source: body.source!,
        file: file
          ? {
              id: file.id,
              originalName: file.originalName,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
              thumbnailUrl: null,
              url: null,
            }
          : null,
        // An e-Tax invoice's reference is its number; the file is the e-Tax document (`CaptureTaxInvoiceDto`).
        eTaxReference: body.source === "e_tax" ? number : null,
        // Finance validates it against the statement (D-090); until then input VAT is pending.
        status: "submitted",
        rejectReason: null,
        recordedAt: now(),
        netAmount: body.netAmount!,
        vatAmount: body.vatAmount!,
      };
      state.invoices.push(invoice);
      return HttpResponse.json(toVendorInvoiceDto(store, statement, invoice), { status: 201 });
    });
  }),

  /* ------------------------------------------------------------- payouts (D-022, D-164) */
  http.get("*/v1/partner/factories/:factoryId/payout-schedule", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_payables.read");
    if (ok instanceof Response) return ok;
    const factoryId = ok.store.factory.id;
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const rows = scheduleRows(factoryId)
      .filter((row) => matchesQuery(q, row.jobNo, row.poNumber, row.order.orderCode))
      .map((row) => toScheduleJobDto(factoryId, row));
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  // The payout calendar (U2.F7): what is still open, when it is expected to be paid and on what basis,
  // and the runs of the last 90 days. Mock-only run days: Tuesday and Friday.
  http.get("*/v1/partner/factories/:factoryId/payout-calendar", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_payables.read");
    if (ok instanceof Response) return ok;
    const factoryId = ok.store.factory.id;
    const weekdays = [2, 5];
    const nextRunDay = (from: string) => {
      for (let step = 0; step < 7; step++) {
        const day = addDays(from, step);
        if (weekdays.includes(new Date(`${day}T12:00:00+07:00`).getUTCDay())) return day;
      }
      return from;
    };
    const payables = scheduleRows(factoryId).flatMap((row) =>
      row.items
        .filter((item) => item.status !== "paid")
        .map((item): Schemas["CalendarPayableDto"] => {
          const expectedPayOn = item.eligibleOn
            ? nextRunDay(item.eligibleOn < today() ? today() : item.eligibleOn)
            : null;
          return {
            id: item.id,
            source: item.source,
            status: item.status,
            purchaseOrderId: row.purchaseOrderId,
            poNumber: row.poNumber,
            netAmount: baht(item.net),
            vatAmount: baht(item.vat),
            openNetAmount: baht(item.net),
            openVatAmount: baht(item.vat),
            eligibleAt: item.eligibleOn ? startOf(item.eligibleOn) : null,
            expectedPayOn,
            expectedBasis: expectedPayOn ? "run_calendar" : "eligibility_pending",
            runId: null,
          };
        }),
    );
    const since = addDays(today(), -90);
    const runs = payouts(factoryId)
      .filter((payout) => payout.payOn >= since)
      .map((payout): Schemas["CalendarRunDto"] => ({
        id: mockId("prn", dayNumber(payout.payOn)),
        runNo: `RUN-${payout.payOn.replace(/-/g, "")}`,
        payOn: payout.payOn,
        status: "confirmed",
        lines: [
          {
            payoutId: payout.id,
            pvNumber: payout.pvNumber,
            kind: payout.kind,
            status: payout.status,
            paidOn: payout.paidOn,
            apNetAmount: payout.apNetAmount,
            vatAmount: payout.vatAmount,
            whtAmount: payout.whtAmount,
            retentionAmount: payout.retentionAmount,
            cashAmount: payout.cashAmount,
          },
        ],
      }));
    const merged = [
      ...runs
        .reduce((byDay, run) => {
          const seen = byDay.get(run.payOn);
          byDay.set(run.payOn, seen ? { ...seen, lines: [...seen.lines, ...run.lines] } : run);
          return byDay;
        }, new Map<string, Schemas["CalendarRunDto"]>())
        .values(),
    ];
    return HttpResponse.json({ currency: "THB", payables, runCalendar: { weekdays }, runs: merged });
  }),
  http.get("*/v1/partner/factories/:factoryId/payouts", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_payables.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const status = url.searchParams.get("status");
    const rows = payouts(ok.store.factory.id)
      .filter((item) => !isDay(from) || item.payOn >= from)
      .filter((item) => !isDay(to) || item.payOn <= to)
      .filter((item) => !status || item.status === status)
      .map(toPayoutSummary);
    return HttpResponse.json(rows);
  }),
  http.get("*/v1/partner/factories/:factoryId/payouts/:payoutId", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_payables.read");
    if (ok instanceof Response) return ok;
    const payout = payouts(ok.store.factory.id).find((item) => item.id === params.payoutId);
    return payout ? HttpResponse.json(payout) : noPayout();
  }),
  http.get("*/v1/partner/factories/:factoryId/payouts/:payoutId/documents", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_payables.read");
    if (ok instanceof Response) return ok;
    const payout = payouts(ok.store.factory.id).find((item) => item.id === params.payoutId);
    if (!payout) return noPayout();
    if (payout.status !== "paid")
      return problem(409, "payouts.run_invalid_status", "เอกสารการจ่ายเงินออกได้เมื่อโอนสำเร็จแล้ว");
    return HttpResponse.json({
      remittanceAdvice: signed(PDF),
      whtCertificates: payout.whtCertificates.map((certificate) => ({
        ...certificate,
        download: certificate.pdfReady ? signed(PDF) : null,
      })),
    } satisfies Schemas["PayoutItemDocumentsDto"]);
  }),
  http.get("*/v1/partner/factories/:factoryId/wht-certificates/:certificateId/pdf", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_payables.read");
    if (ok instanceof Response) return ok;
    const found = payouts(ok.store.factory.id)
      .flatMap((item) => item.whtCertificates)
      .some((item) => item.id === params.certificateId);
    return found
      ? HttpResponse.json(signed(PDF))
      : problem(404, "http.not_found", "ไม่พบหนังสือรับรองการหักภาษี ณ ที่จ่าย");
  }),
  http.get("*/v1/partner/factories/:factoryId/statement-of-account", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_payables.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    return HttpResponse.json(
      account(ok.store.factory.id, isDay(from) ? from : addDays(today(), -90), isDay(to) ? to : today()),
    );
  }),
];
