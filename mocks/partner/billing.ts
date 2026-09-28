/**
 * CONTRACT-REQUEST partner.billing-statements, partner.payouts, partner.claims,
 * partner.scorecard, partner.users, partner.notification-preferences — the factory's money and
 * account (F5 5.3), derived from the rows the other mocks already hold: the factory's jobs and
 * their POs (`./jobs.ts`), the logistics desk's delivered shipments and claims, and the payout
 * policy version in the factory's configuration (D-022, D-164).
 *
 * Money is computed here, in satang, and handed out as decimal strings — the zone only formats
 * it (CLAUDE.md). The statement generated last period is confirmed with a validated tax invoice;
 * this period's is sent and waiting, and picks up every POD the factory records until it is
 * confirmed (then it is frozen).
 */

import type { z } from "zod";

import {
  billingStatementSummary,
  payoutSummary,
  type billingStatement,
  type payoutDetail,
  type payoutScheduleJob,
  type statementOfAccount,
  type vendorInvoice,
} from "@/lib/api/requests/partner-billing";
import {
  partnerClaimSummary,
  type factoryUser,
  type partnerClaim,
  type partnerNotificationPreference,
  type partnerScorecard,
} from "@/lib/api/requests/partner-account";
import type { RequestKey } from "@/lib/api/requests/registry";

import { orders, type MockOrder } from "../admin/commerce";
import { claims, shipments, type Claim, type Shipment } from "../admin/logistics";
import { stores } from "../admin/partners";
import { files } from "../admin/platform";
import { mockRequest, type MockContext } from "../route";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { buyAmountOf, extraOf, factoryJobs, titleOf } from "./jobs";
import { PARTNER_PERSONAS, type PartnerRole } from "./personas";
import { own } from "./support";

type Statement = z.output<typeof billingStatement>;
type Invoice = z.output<typeof vendorInvoice>;
type ScheduleJob = z.output<typeof payoutScheduleJob>;
type Payout = z.output<typeof payoutDetail>;
type Account = z.output<typeof statementOfAccount>;
type PartnerClaim = z.output<typeof partnerClaim>;
type Scorecard = z.output<typeof partnerScorecard>;
type User = z.output<typeof factoryUser>;
type Preference = z.output<typeof partnerNotificationPreference>;
type Ctx = Pick<MockContext<RequestKey>, "request" | "params">;

const DAY = 24 * 60;
const now = () => bangkokIso();
const today = () => bangkokIso().slice(0, 10);
const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T12:00:00+07:00`) + days * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 10);

/* ---------------------------------------------------------------------------- satang */

const satang = (amount: string) => Math.round(Number(amount) * 100);
const baht = (value: number) => {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
};
const share = (amount: string, pct: string) => Math.round((satang(amount) * Number(pct)) / 100);

/** A tiny, valid PDF: what a mock returns where the API returns a short-lived signed URL. */
const PDF = `data:application/pdf;base64,${Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
).toString("base64")}`;
const document = (id: string, name: string) => ({
  id,
  originalName: name,
  mimeType: "application/pdf",
  sizeBytes: 1024,
  thumbnailUrl: null,
  url: PDF,
});

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

/* ------------------------------------------------------------------- payout schedule */

export function acceptedOn(jobId: string, fallback: string) {
  const job = orders.flatMap((order) => order.jobs).find((item) => item.id === jobId);
  const entry = job ? extraOf(job).history.find((item) => item.text.startsWith("โรงงานรับงาน")) : undefined;
  return (entry?.at ?? fallback).slice(0, 10);
}

function schedule(factoryId: string): ScheduleJob[] {
  const policy = policyOf(factoryId);
  const advancePct = policy?.advancePct ?? "30.0000";
  const retentionPct = policy?.retentionPct ?? "0.0000";
  const balancePct = (100 - Number(advancePct) - Number(retentionPct)).toFixed(4);
  const claimWindow = policy?.claimWindowDays ?? 7;
  const release = policy?.retentionReleaseDays ?? 30;
  const delivered = deliveries(factoryId);
  return factoryJobs(factoryId)
    .filter(({ job }) => ["accepted", "in_progress", "completed", "on_hold"].includes(job.status))
    .map(({ order, job }) => {
      const po = buyAmountOf(order);
      const accepted = acceptedOn(job.id, extraOf(job).releasedAt);
      const mine = delivered.filter((item) => item.order.id === order.id);
      const shippedAll = mine.reduce((total, item) => total + item.quantity, 0) >= order.quantity * 0.95;
      const lastPod =
        mine
          .map((item) => item.deliveredOn)
          .sort()
          .at(-1) ?? null;
      const balanceOn = shippedAll && lastPod ? addDays(lastPod, claimWindow) : null;
      const retentionOn = balanceOn ? addDays(balanceOn, release) : null;
      const state = (on: string | null) =>
        on === null
          ? ("open" as const)
          : on <= addDays(today(), -3)
            ? ("paid" as const)
            : on <= today()
              ? ("eligible" as const)
              : ("open" as const);
      const paid = (on: string | null) => (state(on) === "paid" ? addDays(on!, 2) : null);
      const item = (
        kind: "advance" | "balance" | "retention",
        pct: string,
        on: string | null,
        waiting: ScheduleJob["items"][number]["waitingFor"],
      ) => ({
        kind,
        pct,
        amount: baht(share(po, pct)),
        eligibleAt: on,
        waitingFor: on ? null : waiting,
        status: state(on),
        paidOn: paid(on),
        payoutId: paid(on) ? mockId("pvo", Number(paid(on)!.replace(/-/g, "")) % 1_000_000) : null,
      });
      return {
        job: { id: job.id, jobNo: job.jobNo, title: titleOf(order) },
        poAmount: po,
        items: [
          item("advance", advancePct, accepted, "acceptance"),
          item("balance", balancePct, balanceOn, lastPod ? "claim_window" : "pod"),
          ...(Number(retentionPct) > 0 ? [item("retention", retentionPct, retentionOn, "retention_period")] : []),
        ],
      };
    });
}

/* --------------------------------------------------------------------------- payouts */

const WHT_PCT = "3.0000"; // ⚖ hire of work — the auditor confirms (D-022); the API decides.

function payouts(factoryId: string): Payout[] {
  const byDay = new Map<string, { kind: "advance" | "balance" | "retention"; reference: string; amount: string }[]>();
  for (const job of schedule(factoryId))
    for (const item of job.items)
      if (item.paidOn)
        byDay.set(item.paidOn, [
          ...(byDay.get(item.paidOn) ?? []),
          { kind: item.kind, reference: job.job.jobNo, amount: item.amount },
        ]);
  const bank = stores.get(factoryId)?.banks.find((item) => item.status === "active")?.accountNoLast4 ?? "0000";
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([paidOn, allocations]) => {
      const gross = allocations.reduce((total, item) => total + satang(item.amount), 0);
      const wht = Math.round((gross * Number(WHT_PCT)) / 100);
      const id = mockId("pvo", Number(paidOn.replace(/-/g, "")) % 1_000_000);
      return {
        id,
        pvNumber: `PV-2569-${paidOn.slice(5).replace("-", "")}`,
        paidOn,
        status: "paid" as const,
        gross: baht(gross),
        wht: baht(wht),
        deductions: "0.00",
        net: baht(gross - wht),
        currency: "THB" as const,
        bankLast4: bank,
        allocations,
        remittanceAdvice: document(
          mockId("rma", Number(paidOn.replace(/-/g, "")) % 1_000_000),
          `remittance-${paidOn}.pdf`,
        ),
        whtCertificate: document(mockId("wht", Number(paidOn.replace(/-/g, "")) % 1_000_000), `50-tawi-${paidOn}.pdf`),
        failureReason: null,
      };
    });
}

/* ------------------------------------------------------------------ billing statements */

export interface StatementState {
  frozen: Statement | null;
  status: Statement["status"];
  confirmedBy: Statement["confirmedBy"];
  confirmedAt: string | null;
  disputeNote: string | null;
  invoices: Invoice[];
  replays: Set<string>;
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
      invoices: [],
      replays: new Set(),
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

function buildStatement(factoryId: string, index: 0 | 1): Statement {
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
              file: document(mockId("vif", 1), "invoice-INV-6909-0012.pdf"),
              eTaxReference: null,
              status: "validated",
              rejectReason: null,
              recordedAt: bangkokIso(-DAY * 2),
            },
          ],
        }
      : {},
  );
  if (state.frozen)
    return {
      ...state.frozen,
      status: state.status,
      confirmedBy: state.confirmedBy,
      confirmedAt: state.confirmedAt,
      disputeNote: state.disputeNote,
      taxInvoices: state.invoices,
      ...derivedOf(state),
    };
  const lines: Statement["lines"] = [];
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
  const vat = store.factory.isVatRegistered ? Math.round(net * 0.07) : 0;
  const statement: Statement = {
    id,
    bsNumber: `BS-${store.factory.code}-${periodFrom.slice(0, 7).replace("-", "")}`,
    periodFrom,
    periodTo,
    status: state.status,
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
    taxInvoiceStatus: null,
    inputVatStatus: "pending_document",
    lines,
    confirmedBy: state.confirmedBy,
    confirmedAt: state.confirmedAt,
    disputeNote: state.disputeNote,
    taxInvoices: state.invoices,
    nextActions: [],
  };
  return { ...statement, ...derivedOf(state) };
}

function derivedOf(state: StatementState): Pick<Statement, "taxInvoiceStatus" | "inputVatStatus" | "nextActions"> {
  const latest = state.invoices.at(-1) ?? null;
  const validated = state.invoices.some((item) => item.status === "validated");
  return {
    taxInvoiceStatus: latest?.status ?? null,
    // Input VAT is claimable only with a valid tax invoice (accounting-design §2).
    inputVatStatus: validated ? "claimable" : "pending_document",
    nextActions:
      state.status === "sent" || state.status === "generated"
        ? ["confirm", "dispute"]
        : state.status === "confirmed" && !validated && latest?.status !== "submitted"
          ? ["submit_tax_invoice"]
          : [],
  };
}

export const statementsOf = (factoryId: string): Statement[] =>
  deliveries(factoryId).length ? [buildStatement(factoryId, 1), buildStatement(factoryId, 0)] : [];

/* ------------------------------------------------------------------------------- claims */

const claimEvidence = new Map<string, PartnerClaim["evidence"]>();

function claimOf(claim: Claim): PartnerClaim {
  const order = orders.find((item) => item.id === claim.order.id);
  const job = order?.jobs[0];
  const deductions = claim.resolutions
    .filter((item) => item.action === "factory_deduction" && item.amount)
    .map((item, index) => ({
      id: mockId("vdd", index + 1),
      amount: item.amount!,
      status: "applied" as const,
      appliedOn: item.executedAt.slice(0, 10),
    }));
  return {
    id: claim.id,
    claimNo: claim.claimNo,
    type: claim.type,
    status: claim.status,
    job: { id: job?.id ?? null, jobNo: job?.jobNo ?? null },
    shipmentNo: claim.shipment?.shipmentNo ?? null,
    submittedAt: claim.submittedAt,
    liability: claim.liability,
    factoryResponse: claim.factoryResponse?.response ?? null,
    responseDueAt: claim.status === "factory_review" && !claim.factoryResponse ? claim.slaDueAt : null,
    deduction: deductions.length ? baht(deductions.reduce((total, item) => total + satang(item.amount), 0)) : null,
    // D-142: what the customer wrote about the goods, never who they are.
    description: claim.description,
    requestedResolution: claim.requestedResolution,
    claimedQuantity: claim.claimedQuantity,
    evidence: [
      ...claim.evidence.productPhotos.map((file) => ({ role: "product" as const, file })),
      ...claim.evidence.cartonPhotos.map((file) => ({ role: "carton" as const, file })),
      ...(claimEvidence.get(claim.id) ?? []),
    ],
    factoryNote: claim.factoryResponse?.note ?? null,
    factoryRespondedAt: claim.factoryResponse?.at ?? null,
    decision: claim.decision?.reason ?? null,
    deductions,
    nextActions: claim.status === "factory_review" && !claim.factoryResponse ? ["respond"] : [],
  };
}

/* -------------------------------------------------------------------------- scorecards */

function scorecards(factoryId: string, months: number): Scorecard[] {
  const jobs = factoryJobs(factoryId).length;
  const seed = Number.parseInt(stores.get(factoryId)?.factory.code.slice(1) ?? "1", 10);
  const start = new Date(Date.now() + 7 * 3_600_000);
  return Array.from({ length: months }, (_, index) => {
    const at = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - index, 1));
    const wobble = ((index * 7 + seed * 3) % 9) - 4;
    return {
      month: at.toISOString().slice(0, 7),
      jobsCount: Math.max(0, jobs - index),
      onTimeAcceptancePct: (94 + wobble / 2).toFixed(1),
      onTimeShippingPct: (88 + wobble).toFixed(1),
      qcFirstPassPct: (96 - Math.abs(wobble) / 2).toFixed(1),
      claimRatePct: (1.5 + Math.abs(wobble) / 4).toFixed(1),
      onTimeUpdatesPct: (90 + wobble).toFixed(1),
      computedAt: index === 0 ? null : `${at.toISOString().slice(0, 7)}-01T02:00:00+07:00`,
    };
  });
}

/* ------------------------------------------------------------------------------- users */

const invited = new Map<string, User[]>();
const roleChanges = new Map<string, Partial<Pick<User, "roles" | "status">>>();

function usersOf(factoryId: string, selfId: string): User[] {
  const people = PARTNER_PERSONAS.filter((persona) => persona.factoryId === factoryId).map((persona, index): User => ({
    id: persona.id,
    displayName: persona.displayName,
    email: persona.email,
    roles: persona.roles,
    status: "active",
    lastSignInAt: bangkokIso(-60 * (index + 1) * 5),
    isSelf: persona.id === selfId,
  }));
  return [...people, ...(invited.get(factoryId) ?? [])].map((user) => ({
    ...user,
    ...roleChanges.get(user.id),
    isSelf: user.id === selfId,
  }));
}

/* ----------------------------------------------------------------------- notifications */

const CATEGORIES: Preference["category"][] = ["jobs", "shipping", "prices", "billing", "claims", "account"];
const CHANNELS: Preference["channel"][] = ["web_push", "line", "email"];
const preferences = new Map<string, Preference[]>();

function preferencesOf(userId: string): Preference[] {
  let list = preferences.get(userId);
  if (!list) {
    list = CATEGORIES.flatMap((category) =>
      CHANNELS.map((channel) => {
        // A job to accept and an account notice always reach the user (D-074, security).
        const locked = (category === "jobs" && channel === "email") || (category === "account" && channel === "email");
        return { category, channel, enabled: channel !== "line", locked };
      }),
    );
    preferences.set(userId, list);
  }
  return list;
}

/* ----------------------------------------------------------------------------- handlers */

const ownOf = (context: Ctx, permission?: string) => own(context.request, context.params.factoryId, permission);
const perm = {
  billing: "factory_billing.read",
  confirm: "factory_billing.confirm",
  payouts: "factory_payouts.read",
  claims: "factory_claims.read",
  respond: "factory_claims.respond",
  scorecard: "factory_scorecard.read",
  users: "factory_users.manage",
};

function statementFor(context: Ctx, permission: string) {
  const ok = ownOf(context, permission);
  if (ok instanceof Response) return ok;
  const statement = statementsOf(ok.store.factory.id).find((item) => item.id === context.params.statementId);
  return statement
    ? { ...ok, statement, state: stateOf(statement.id) }
    : problem(404, "billing.not_found", "ไม่พบใบวางบิลนี้");
}

const replayed = (state: StatementState, request: Request) => {
  const key = request.headers.get("idempotency-key") ?? "";
  if (state.replays.has(key)) return true;
  state.replays.add(key);
  return false;
};

export const billingRequestHandlers = [
  mockRequest("GET /v1/partner/factories/{factoryId}/billing-statements", (context) => {
    const ok = ownOf(context, perm.billing);
    if (ok instanceof Response) return ok;
    const rows = statementsOf(ok.store.factory.id)
      .filter((item) => !context.query.status || item.status === context.query.status)
      .map((item) => billingStatementSummary.parse(item));
    return paginate(rows, context.query);
  }),
  mockRequest("GET /v1/partner/factories/{factoryId}/billing-statements/{statementId}", (context) => {
    const found = statementFor(context, perm.billing);
    return found instanceof Response ? found : found.statement;
  }),
  mockRequest("POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/actions/confirm", (context) => {
    const found = statementFor(context, perm.confirm);
    if (found instanceof Response) return found;
    const { statement, state, who } = found;
    if (replayed(state, context.request) || state.status === "confirmed")
      return buildStatementById(found.store.factory.id, statement.id);
    if (!["sent", "generated"].includes(state.status))
      return problem(409, "billing.invalid_transition", "ยืนยันได้เฉพาะใบวางบิลที่รอโรงงานตรวจ");
    Object.assign(state, {
      status: "confirmed",
      confirmedBy: { id: who.id, displayName: who.displayName },
      confirmedAt: now(),
      frozen: statement,
    });
    return buildStatementById(found.store.factory.id, statement.id);
  }),
  mockRequest("POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/actions/dispute", (context) => {
    const found = statementFor(context, perm.confirm);
    if (found instanceof Response) return found;
    const { statement, state } = found;
    if (replayed(state, context.request)) return buildStatementById(found.store.factory.id, statement.id);
    if (!["sent", "generated"].includes(state.status))
      return problem(409, "billing.invalid_transition", "โต้แย้งได้เฉพาะใบวางบิลที่รอโรงงานตรวจ");
    Object.assign(state, { status: "disputed", disputeNote: context.body.note, frozen: statement });
    return buildStatementById(found.store.factory.id, statement.id);
  }),
  mockRequest("POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/tax-invoices", (context) => {
    const found = statementFor(context, perm.confirm);
    if (found instanceof Response) return found;
    const { statement, state, store } = found;
    const { body } = context;
    if (replayed(state, context.request)) return buildStatementById(store.factory.id, statement.id);
    if (state.status !== "confirmed")
      return problem(409, "billing.not_confirmed", "ยืนยันใบวางบิลก่อน แล้วจึงบันทึกใบกำกับภาษี");
    const errors: { path: string; code: string; message: string }[] = [];
    if (body.sellerTaxId !== store.factory.taxId)
      errors.push({ path: "sellerTaxId", code: "mismatch", message: "เลขประจำตัวผู้เสียภาษีไม่ตรงกับของโรงงาน" });
    if (body.source === "pdf_upload" && (!body.fileId || !files.has(body.fileId)))
      errors.push({ path: "fileId", code: "required", message: "แนบไฟล์ใบกำกับภาษี (PDF)" });
    if (body.source === "e_tax" && !body.eTaxReference)
      errors.push({ path: "eTaxReference", code: "required", message: "ระบุเลขอ้างอิง e-Tax" });
    if (state.invoices.some((item) => item.invoiceNo === body.invoiceNo && item.status !== "rejected"))
      errors.push({ path: "invoiceNo", code: "unique", message: "ใบกำกับภาษีเลขนี้บันทึกไปแล้ว" });
    if (errors.length) return problem(422, "validation.failed", "ตรวจข้อมูลใบกำกับภาษีอีกครั้ง", errors);
    const file = body.fileId ? files.get(body.fileId) : null;
    state.invoices.push({
      id: mockId("vin", 100 + state.invoices.length),
      invoiceNo: body.invoiceNo,
      invoiceDate: body.invoiceDate,
      sellerTaxId: body.sellerTaxId,
      sellerBranchCode: body.sellerBranchCode,
      source: body.source,
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
      eTaxReference: body.eTaxReference ?? null,
      // Finance validates it against the statement (D-090); until then input VAT is pending.
      status: "submitted",
      rejectReason: null,
      recordedAt: now(),
    });
    return buildStatementById(store.factory.id, statement.id);
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/payout-schedule", (context) => {
    const ok = ownOf(context, perm.payouts);
    return ok instanceof Response ? ok : schedule(ok.store.factory.id);
  }),
  mockRequest("GET /v1/partner/factories/{factoryId}/payouts", (context) => {
    const ok = ownOf(context, perm.payouts);
    if (ok instanceof Response) return ok;
    const rows = payouts(ok.store.factory.id).map((item) => payoutSummary.parse(item));
    return paginate(rows, context.query);
  }),
  mockRequest("GET /v1/partner/factories/{factoryId}/payouts/{payoutId}", (context) => {
    const ok = ownOf(context, perm.payouts);
    if (ok instanceof Response) return ok;
    const payout = payouts(ok.store.factory.id).find((item) => item.id === context.params.payoutId);
    return payout ?? problem(404, "payouts.not_found", "ไม่พบรายการจ่ายนี้");
  }),
  mockRequest("GET /v1/partner/factories/{factoryId}/statement-of-account", (context) => {
    const ok = ownOf(context, perm.payouts);
    if (ok instanceof Response) return ok;
    const factoryId = ok.store.factory.id;
    const from = context.query.from ?? addDays(today(), -90);
    const to = context.query.to ?? today();
    const events: Omit<Account["entries"][number], "balance">[] = [
      ...statementsOf(factoryId)
        .filter((item) => item.status === "confirmed")
        .map((item) => ({
          date: (item.confirmedAt ?? item.generatedAt).slice(0, 10),
          kind: "statement" as const,
          reference: item.bsNumber,
          description: "ใบวางบิลที่ยืนยันแล้ว",
          credit: item.totals.gross,
          debit: "0.00",
        })),
      ...payouts(factoryId).map((item) => ({
        date: item.paidOn!,
        kind: "payout" as const,
        reference: item.pvNumber,
        description: "Packio โอนเงิน (รวมภาษีหัก ณ ที่จ่าย)",
        credit: "0.00",
        debit: item.gross,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let balance = 0;
    let opening = 0;
    const entries: Account["entries"] = [];
    for (const event of events) {
      const change = satang(event.credit) - satang(event.debit);
      if (event.date < from) {
        opening += change;
        balance += change;
        continue;
      }
      if (event.date > to) continue;
      balance += change;
      entries.push({ ...event, balance: baht(balance) });
    }
    return { from, to, opening: baht(opening), entries, closing: baht(balance), currency: "THB" };
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/claims", (context) => {
    const ok = ownOf(context, perm.claims);
    if (ok instanceof Response) return ok;
    const rows = claims
      .filter((claim) => claim.factory?.id === ok.store.factory.id)
      .filter((claim) => !context.query.status || claim.status === context.query.status)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map((claim) => partnerClaimSummary.parse(claimOf(claim)));
    return paginate(rows, context.query);
  }),
  mockRequest("GET /v1/partner/factories/{factoryId}/claims/{claimId}", (context) => {
    const ok = ownOf(context, perm.claims);
    if (ok instanceof Response) return ok;
    const claim = claims.find((item) => item.id === context.params.claimId && item.factory?.id === ok.store.factory.id);
    return claim ? claimOf(claim) : problem(404, "claims.not_found", "ไม่พบเคลมนี้");
  }),
  mockRequest("POST /v1/partner/factories/{factoryId}/claims/{claimId}/actions/respond", (context) => {
    const ok = ownOf(context, perm.respond);
    if (ok instanceof Response) return ok;
    const claim = claims.find((item) => item.id === context.params.claimId && item.factory?.id === ok.store.factory.id);
    if (!claim) return problem(404, "claims.not_found", "ไม่พบเคลมนี้");
    if (claim.factoryResponse) return claimOf(claim);
    if (claim.status !== "factory_review")
      return problem(409, "claims.not_awaiting_factory", "เคลมนี้ไม่ได้รอคำตอบจากโรงงาน");
    const { body } = context;
    claim.factoryResponse = { response: body.response, note: body.note, at: now() };
    // Back to the claims desk, with the factory's word on it (D-083).
    claim.status = "under_review";
    claim.messages.push({ at: now(), author: ok.who.displayName, audience: "factory", body: body.note });
    claim.updatedAt = now();
    if (body.evidenceFileIds?.length)
      claimEvidence.set(
        claim.id,
        body.evidenceFileIds.map((id) => {
          const file = files.get(id);
          return {
            role: "factory" as const,
            file: {
              id,
              originalName: file?.originalName ?? "evidence.jpg",
              mimeType: file?.mimeType ?? "image/jpeg",
              sizeBytes: file?.sizeBytes ?? 0,
              thumbnailUrl: null,
              url: null,
            },
          };
        }),
      );
    return claimOf(claim);
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/scorecards", (context) => {
    const ok = ownOf(context, perm.scorecard);
    return ok instanceof Response ? ok : scorecards(ok.store.factory.id, context.query.months ?? 6);
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/users", (context) => {
    const ok = ownOf(context, perm.users);
    return ok instanceof Response ? ok : usersOf(ok.store.factory.id, ok.who.id);
  }),
  mockRequest("POST /v1/partner/factories/{factoryId}/users", (context) => {
    const ok = ownOf(context, perm.users);
    if (ok instanceof Response) return ok;
    const { body } = context;
    const factoryId = ok.store.factory.id;
    if (usersOf(factoryId, ok.who.id).some((user) => user.email?.toLowerCase() === body.email.toLowerCase()))
      return problem(409, "users.exists", "มีผู้ใช้อีเมลนี้ในโรงงานแล้ว", [
        { path: "email", code: "unique", message: "ซ้ำ" },
      ]);
    const created: User = {
      id: mockId("pui", (invited.get(factoryId)?.length ?? 0) + 1),
      displayName: body.displayName,
      email: body.email,
      roles: body.roles,
      status: "invited",
      lastSignInAt: null,
      isSelf: false,
    };
    invited.set(factoryId, [...(invited.get(factoryId) ?? []), created]);
    return created;
  }),
  mockRequest("PATCH /v1/partner/factories/{factoryId}/users/{userId}", (context) => {
    const ok = ownOf(context, perm.users);
    if (ok instanceof Response) return ok;
    const user = usersOf(ok.store.factory.id, ok.who.id).find((item) => item.id === context.params.userId);
    if (!user) return problem(404, "users.not_found", "ไม่พบผู้ใช้นี้");
    const { body } = context;
    if (
      user.isSelf &&
      (body.status === "deactivated" || (body.roles && !body.roles.includes("factory_owner" as PartnerRole)))
    )
      return problem(409, "users.last_owner", "โรงงานต้องมีเจ้าของอย่างน้อยหนึ่งคน — เปลี่ยนสิทธิ์ของตัวเองไม่ได้");
    roleChanges.set(user.id, {
      ...roleChanges.get(user.id),
      ...(body.roles ? { roles: body.roles } : {}),
      ...(body.status ? { status: body.status } : {}),
    });
    return usersOf(ok.store.factory.id, ok.who.id).find((item) => item.id === user.id)!;
  }),

  mockRequest("GET /v1/partner/me/notification-preferences", (context) => {
    const ok = own(context.request, partnerFactory(context.request));
    if (ok instanceof Response) return ok;
    return { preferences: preferencesOf(ok.who.id), lineLinked: false };
  }),
  mockRequest("PUT /v1/partner/me/notification-preferences", (context) => {
    const ok = own(context.request, partnerFactory(context.request));
    if (ok instanceof Response) return ok;
    const list = preferencesOf(ok.who.id);
    for (const change of context.body.preferences) {
      const row = list.find((item) => item.category === change.category && item.channel === change.channel);
      if (row && !row.locked) row.enabled = change.enabled;
    }
    return { preferences: list, lineLinked: false };
  }),
];

function buildStatementById(factoryId: string, id: string): Statement {
  return statementsOf(factoryId).find((item) => item.id === id)!;
}

/** The factory the signed-in user acts for, for `/me` requests that carry no factory id. */
function partnerFactory(request: Request): string {
  const token = request.headers.get("authorization") ?? "";
  const key = token.match(/partner\.([a-z_]+)$/)?.[1] ?? "planner";
  return PARTNER_PERSONAS.find((persona) => persona.key === key)?.factoryId ?? "";
}
