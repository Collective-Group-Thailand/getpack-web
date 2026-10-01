/**
 * Payout runs, mocked over the published B5.3 surface (D-022, D-093, D-164, D-166): a run takes
 * the payables eligible by a date, per vendor and kind, withholds tax per line type and holds the
 * retention on balances; Finance proposes it, a C-Level other than the proposer approves it; the
 * bank file is generated for the chosen company account and format; the bank's confirmation is
 * imported, and every paid item gets its PV number, its posting and its 50 ทวิ.
 *
 * Postings (accounting-design §5): an advance is P14 (1250 + VAT / cash + WHT), a balance P17
 * (2110 + VAT / cash + WHT + 2130 retention), a released retention P18, another vendor's bill its
 * payment (2120 / cash + WHT). Input VAT goes to 1241 with a validated tax invoice, otherwise to
 * 1242 until one arrives (§2).
 */

import type { Schemas } from "@/lib/api/types";

import { mockRequest } from "../../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../../support";
import { baht } from "../commerce";
import { registerQueue } from "../console";
import { stores } from "../partners";
import { approvals, onApprovalDecided, openApproval } from "../platform";
import { post, satangOf, today } from "./books";
import { companyAccounts } from "./accounts";
import {
  applyAdvanceToBalances,
  factoryHasValidInvoice,
  openRetention,
  payables,
  payoutAccountOf,
  refreshPayables,
  vatPending,
  vendorOf,
  whtFormOf,
  type PayableRow,
} from "./payables";
import { finance, forbiddenUnless, invalid, notFound } from "./support";

type Run = Schemas["PayoutRunDto"];
type Item = Schemas["PayoutItemDto"];

/** ⚖ Default WHT rates per line type (accounting-design §2); the backend reads its tax-rate versions. */
const WHT_PCT: Record<"hire" | "transport" | "service", number> = { hire: 3, transport: 1, service: 3 };

interface RunState {
  run: Run;
  proposerId: string | null;
  /** Payable rows behind each item. */
  sources: Map<string, PayableRow[]>;
  bankFile: string | null;
}

export const runs: RunState[] = [];

/** 50 ทวิ issued for the withholding on paid items — the register F6.3 reads (PND 3 / 53). */
export const whtIssued: {
  id: string;
  wtNumber: string;
  vendorId: string;
  vendorName: string;
  taxId: string;
  whtForm: Schemas["WhtForm"];
  base: number;
  amount: number;
  paidOn: string;
  runNo: string;
  pvNumber: string;
  category: "hire_of_work" | "transport" | "service";
}[] = [];

let runSeq = 0;
let pvSeq = 0;
let wtSeq = 0;

const nextPv = (date: string) => {
  pvSeq += 1;
  return `PV${Number(date.slice(0, 4)) + 543}${date.slice(5, 7)}-${String(pvSeq).padStart(5, "0")}`;
};

/** WHT per category on what an item pays out (net less retention), satang. */
function whtOf(rows: PayableRow[]) {
  const parts = { hire: 0, transport: 0, service: 0 };
  for (const row of rows) {
    const heldShare = row.hireNet > 0 ? row.retentionNet : 0;
    parts.hire += row.hireNet - heldShare;
    parts.transport += row.transportNet;
    parts.service += row.serviceNet;
  }
  const wht = {
    hire: Math.round((parts.hire * WHT_PCT.hire) / 100),
    transport: Math.round((parts.transport * WHT_PCT.transport) / 100),
    service: Math.round((parts.service * WHT_PCT.service) / 100),
  };
  return {
    parts,
    wht,
    base: parts.hire + parts.transport + parts.service,
    total: wht.hire + wht.transport + wht.service,
  };
}

/** Item ids are a plain sequence: the bank file's reference, so two items must never share one. */
let itemSeq = 0;

function buildItem(vendorId: string, kind: Item["kind"], rows: PayableRow[]): Item {
  const vendor = vendorOf(vendorId)!;
  const account = payoutAccountOf(vendorId);
  const net = rows.reduce((sum, row) => sum + satangOf(row.dto.openNetAmount), 0);
  const vat = rows.reduce((sum, row) => sum + satangOf(row.dto.openVatAmount), 0);
  const retention = rows.reduce((sum, row) => sum + row.retentionNet, 0);
  const { base, total } = whtOf(rows);
  return {
    id: mockId("pvi", 1000 + ++itemSeq),
    vendorId,
    vendorName: vendor.legalName,
    kind,
    status: account ? "included" : "excluded",
    apNetAmount: baht(net),
    vatAmount: baht(vat),
    whtBase: baht(base),
    whtAmount: baht(total),
    whtForm: total > 0 ? whtFormOf(vendor) : null,
    retentionAmount: baht(retention),
    cashAmount: baht(net + vat - total - retention),
    vatClaimable: vendor.kind !== "factory" ? vat > 0 : factoryHasValidInvoice(vendorId),
    bankAccountLast4: account?.accountNoLast4 ?? null,
    bankRef: null,
    pvNumber: null,
    paidOn: null,
    failureReason: account ? null : "ผู้ขายยังไม่มีบัญชีธนาคารที่ยืนยันแล้ว",
  };
}

function totals(run: Run) {
  const included = run.items.filter((item) => item.status !== "excluded");
  const sum = (pick: (item: Item) => string) => baht(included.reduce((s, item) => s + satangOf(pick(item)), 0));
  Object.assign(run, {
    apNetAmount: sum((item) => item.apNetAmount),
    vatAmount: sum((item) => item.vatAmount),
    whtAmount: sum((item) => item.whtAmount),
    retentionAmount: sum((item) => item.retentionAmount),
    cashAmount: sum((item) => item.cashAmount),
  });
}

function createRun(input: {
  payOn: string;
  companyBankAccountId: string;
  bankFormat?: string;
  vendorIds?: string[];
  proposerId: string | null;
}): RunState | Response {
  refreshPayables();
  const account = companyAccounts.find((item) => item.id === input.companyBankAccountId);
  if (!account || account.status !== "active" || account.purpose === "collection")
    return problem(422, "payouts.bank_account_missing", "เลือกบัญชีธนาคารบริษัทที่ใช้จ่ายเงินและเปิดใช้งานแล้ว", [
      { path: "companyBankAccountId", code: "invalid", message: "บัญชีนี้ใช้จ่ายเงินไม่ได้" },
    ]);
  // Payable by `payOn`: open or already eligible, with its date on or before the pay date.
  const eligible = payables.filter(
    (row) =>
      ["open", "eligible"].includes(row.dto.status) &&
      row.dto.eligibleAt &&
      row.dto.eligibleAt.slice(0, 10) <= input.payOn &&
      (!input.vendorIds?.length || input.vendorIds.includes(row.dto.vendorId)),
  );
  if (eligible.length === 0)
    return problem(409, "payouts.nothing_eligible", "ไม่มีเจ้าหนี้ที่ถึงกำหนดจ่ายภายในวันที่เลือก");
  runSeq += 1;
  const runNo = `PR${Number(input.payOn.slice(0, 4)) + 543}${input.payOn.slice(5, 7)}-${String(runSeq).padStart(3, "0")}`;
  const groups = new Map<string, PayableRow[]>();
  for (const row of eligible) {
    const key = `${row.dto.vendorId}|${row.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const sources = new Map<string, PayableRow[]>();
  const items = [...groups.entries()].map(([key, rows]) => {
    const [vendorId, kind] = key.split("|") as [string, Item["kind"]];
    const item = buildItem(vendorId, kind, rows);
    sources.set(item.id, rows);
    if (item.status === "included") for (const row of rows) row.dto.status = "in_run";
    return item;
  });
  const run: Run = {
    id: mockId("prun", runSeq),
    runNo,
    payOn: input.payOn,
    status: "draft",
    nextActions: [],
    bankAccount: {
      id: account.id,
      bankCode: account.bankCode,
      accountNoLast4: account.accountNoLast4,
      glAccountCode: account.glAccountCode,
    },
    bankFormat: input.bankFormat ?? account.defaultBulkFormat,
    bankFileReady: false,
    approvalRequestId: null,
    items,
    apNetAmount: "0.00",
    vatAmount: "0.00",
    whtAmount: "0.00",
    retentionAmount: "0.00",
    cashAmount: "0.00",
    currency: "THB",
  };
  totals(run);
  const state: RunState = { run, proposerId: input.proposerId, sources, bankFile: null };
  runs.unshift(state);
  return state;
}

/** Posts one paid item (P14 / P17 / P18 / bill payment) and issues its 50 ทวิ. */
function postPaid(state: RunState, item: Item, paidOn: string, bankRef: string) {
  const rows = state.sources.get(item.id) ?? [];
  const vendor = vendorOf(item.vendorId)!;
  const cashAccount = state.run.bankAccount.glAccountCode;
  const net = satangOf(item.apNetAmount);
  const vat = satangOf(item.vatAmount);
  const wht = satangOf(item.whtAmount);
  const retention = satangOf(item.retentionAmount);
  const cash = satangOf(item.cashAmount);
  const pv = nextPv(paidOn);
  const whtAccount = whtFormOf(vendor) === "pnd3" ? "2232" : "2231";
  const whtCode = whtFormOf(vendor) === "pnd3" ? ("wht_pnd3" as const) : ("wht_pnd53" as const);
  const { base } = whtOf(rows);
  const dims = vendor.kind === "factory" ? { factory: vendor.id } : { vendor: vendor.id };
  const claimable = item.vatClaimable;
  const vatLine = vat
    ? [
        {
          account: claimable ? "1241" : "1242",
          debit: vat,
          taxCode: claimable ? ("input_vat" as const) : ("input_vat_pending" as const),
          taxBase: net,
          dimensions: dims,
        },
      ]
    : [];
  if (vat && !claimable && vendor.kind === "factory") vatPending.set(vendor.id, (vatPending.get(vendor.id) ?? 0) + vat);
  const common = {
    documentDate: paidOn,
    postedAt: `${paidOn}T15:00:00+07:00`,
    source: { type: "payout_item", id: item.id, number: pv },
  };
  const whtLine = wht ? [{ account: whtAccount, credit: wht, taxCode: whtCode, taxBase: base, dimensions: dims }] : [];
  if (item.kind === "advance")
    post({
      ...common,
      rule: "P14",
      description: `จ่ายล่วงหน้า ${vendor.legalName} ${state.run.runNo}`,
      lines: [
        { account: "1250", debit: net, dimensions: dims },
        ...vatLine,
        { account: cashAccount, credit: cash },
        ...whtLine,
      ],
    });
  else if (item.kind === "balance")
    post({
      ...common,
      rule: "P17",
      description: `จ่ายค่าจ้างผลิตคงเหลือ ${vendor.legalName} ${state.run.runNo}`,
      lines: [
        { account: "2110", debit: net, dimensions: dims },
        ...vatLine,
        { account: cashAccount, credit: cash },
        ...whtLine,
        ...(retention ? [{ account: "2130", credit: retention, dimensions: dims }] : []),
      ],
    });
  else if (item.kind === "retention_release")
    post({
      ...common,
      rule: "P18",
      description: `คืนเงินประกันผลงาน ${vendor.legalName} ${state.run.runNo}`,
      lines: [{ account: "2130", debit: net, dimensions: dims }, { account: cashAccount, credit: cash }, ...whtLine],
    });
  else
    post({
      ...common,
      rule: "P25P",
      description: `จ่ายบิล ${vendor.legalName} ${state.run.runNo}`,
      lines: [
        { account: "2120", debit: net + vat, dimensions: dims },
        { account: cashAccount, credit: cash },
        ...whtLine,
      ],
    });

  Object.assign(item, { status: "paid", pvNumber: pv, paidOn, bankRef, failureReason: null });
  for (const row of rows) {
    const [rowNet, rowVat] = [satangOf(row.dto.openNetAmount), satangOf(row.dto.openVatAmount)];
    Object.assign(row.dto, { status: "paid", openNetAmount: "0.00", openVatAmount: "0.00" });
    if (row.kind === "balance") openRetention(row, paidOn);
    if (row.kind === "advance") applyAdvanceToBalances(row.poRow, rowNet, rowVat, paidOn);
  }
  if (wht) {
    const { wht: parts } = whtOf(rows);
    for (const [category, amount] of Object.entries(parts) as ["hire" | "transport" | "service", number][]) {
      if (!amount) continue;
      wtSeq += 1;
      whtIssued.push({
        id: mockId("wti", wtSeq),
        wtNumber: `WT${Number(paidOn.slice(0, 4)) + 543}-${String(wtSeq).padStart(5, "0")}`,
        vendorId: vendor.id,
        vendorName: vendor.legalName,
        taxId: vendor.taxId,
        whtForm: whtFormOf(vendor),
        base: Math.round((amount * 100) / WHT_PCT[category]),
        amount,
        paidOn,
        runNo: state.run.runNo,
        pvNumber: pv,
        category: category === "hire" ? "hire_of_work" : category,
      });
    }
  }
}

function releaseBack(state: RunState, item: Item) {
  for (const row of state.sources.get(item.id) ?? []) if (row.dto.status === "in_run") row.dto.status = "eligible";
}

const runById = (id: string | undefined) => runs.find((state) => state.run.id === id);

onApprovalDecided("payout_run", (approval, outcome) => {
  const state = runById(approval.subjectId);
  if (!state) return;
  if (outcome === "approved") state.run.status = "approved";
  else {
    state.run.status = "rejected";
    for (const item of state.run.items) releaseBack(state, item);
  }
});

/* ---------------------------------------------------------------------------------- seed */

/*
 * Last week's run, confirmed: the advances of the jobs accepted by then (the partner zone shows
 * them paid), posted by P14 with input VAT pending the factory's tax invoice where it had none.
 */
{
  refreshPayables();
  const lastWeek = new Date(Date.now() + 7 * 3_600_000 - 5 * 86_400_000).toISOString().slice(0, 10);
  const scb = companyAccounts[0]!;
  const advances = payables.filter(
    (row) =>
      row.kind === "advance" &&
      ["open", "eligible"].includes(row.dto.status) &&
      row.dto.eligibleAt!.slice(0, 10) <= lastWeek,
  );
  if (advances.length) {
    const created = createRun({
      payOn: lastWeek,
      companyBankAccountId: scb.id,
      proposerId: null,
      vendorIds: [...new Set(advances.map((row) => row.dto.vendorId))],
    });
    if (!(created instanceof Response)) {
      // Only the advances of that week (the balances were not due yet then).
      for (const item of created.run.items.filter((entry) => entry.kind !== "advance")) {
        releaseBack(created, item);
        item.status = "excluded";
        item.failureReason = null;
      }
      created.run.items = created.run.items.filter((item) => item.kind === "advance");
      totals(created.run);
      for (const item of created.run.items.filter((entry) => entry.status === "included"))
        postPaid(created, item, lastWeek, `SCB-BULK-${lastWeek.replace(/-/g, "")}-${item.id.slice(-3)}`);
      created.run.status = "confirmed";
      created.run.bankFileReady = true;
      created.bankFile = "seeded";
    }
  }
  refreshPayables();
}

/* ---------------------------------------------------------------------------- queues */

registerQueue("approvals.act", (persona) => {
  if (!persona.roles.includes("c_level") && !persona.roles.includes("superadmin")) return null;
  const waiting = runs.filter((state) => state.run.status === "proposed" && state.proposerId !== persona.id);
  return {
    key: "finance.payout_runs_awaiting_approval",
    path: "/admin/finance/payouts",
    count: waiting.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});
registerQueue("payouts.manage", () => {
  const waiting = runs.filter((state) => ["proposed", "approved", "file_generated"].includes(state.run.status));
  return {
    key: "finance.payout_runs_awaiting_approval",
    path: "/admin/finance/payouts",
    count: waiting.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});

/* ---------------------------------------------------------------------------- handlers */

const csvOf = (state: RunState) =>
  [
    "reference,bank_code,account_last4,vendor,amount",
    ...state.run.items
      .filter((item) => item.status === "included")
      .map((item) => `${item.id},${vendorBank(item)},${item.bankAccountLast4},"${item.vendorName}",${item.cashAmount}`),
  ].join("\n");
const vendorBank = (item: Item) =>
  stores.get(item.vendorId)?.banks.find((bank) => bank.status === "active")?.bankCode ?? "004";

export const payoutHandlers = [
  finance.get("/v1/admin/payouts/eligible", "payables.read", ({ query }) => {
    refreshPayables();
    const payOn = query.payOn ?? today();
    return payables
      .filter(
        (row) =>
          ["open", "eligible"].includes(row.dto.status) &&
          row.dto.eligibleAt &&
          row.dto.eligibleAt.slice(0, 10) <= payOn,
      )
      .map((row) => row.dto);
  }),
  finance.get("/v1/admin/payout-runs", "payables.read", ({ query }) => {
    const rows = runs.map((state) => state.run).filter((run) => matchesQuery(query.q, run.runNo));
    return paginate(sortBy(rows, query.sort ?? "payOn", query.order ?? "desc"), query);
  }),
  finance.post(
    "/v1/admin/payout-runs",
    { permission: "payouts.manage", idempotent: true, status: 201 },
    ({ body, persona }) => {
      if (!body.payOn) return invalid([{ path: "payOn", code: "required", message: "เลือกวันที่จ่าย" }]);
      const created = createRun({ ...body, proposerId: persona.id });
      return created instanceof Response ? created : created.run;
    },
  ),
  finance.get(
    "/v1/admin/payout-runs/{runId}",
    "payables.read",
    ({ params }) => runById(params.runId)?.run ?? notFound("รอบจ่ายเงิน"),
  ),
  finance.post(
    "/v1/admin/payout-runs/{runId}/actions/propose",
    { permission: "payouts.manage", idempotent: true },
    ({ params, persona }) => {
      const state = runById(params.runId);
      if (!state) return notFound("รอบจ่ายเงิน");
      if (state.run.status !== "draft")
        return problem(409, "payouts.run_invalid_status", "เสนอได้เฉพาะรอบที่ยังเป็นฉบับร่าง");
      if (!state.run.items.some((item) => item.status === "included"))
        return problem(409, "payouts.nothing_eligible", "รอบนี้ไม่มีรายการที่จ่ายได้");
      state.proposerId = persona.id;
      state.run.status = "proposed";
      state.run.approvalRequestId = openApproval({
        policy: "payout_run",
        subjectType: "payout_run",
        subjectId: state.run.id,
        requester: persona,
        amount: state.run.cashAmount,
        payload: {
          runNo: state.run.runNo,
          payOn: state.run.payOn,
          items: state.run.items.filter((item) => item.status === "included").length,
          cashAmount: state.run.cashAmount,
          whtAmount: state.run.whtAmount,
          retentionAmount: state.run.retentionAmount,
        },
      }).id;
      return state.run;
    },
  ),
  finance.post(
    "/v1/admin/payout-runs/{runId}/actions/cancel",
    { permission: "payouts.manage", idempotent: true },
    ({ params, body }) => {
      const state = runById(params.runId);
      if (!state) return notFound("รอบจ่ายเงิน");
      if (!["draft", "proposed", "approved"].includes(state.run.status))
        return problem(409, "payouts.run_invalid_status", "ยกเลิกได้เฉพาะก่อนสร้างไฟล์ธนาคาร");
      if (!body.reason || body.reason.trim().length < 3)
        return invalid([{ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" }]);
      for (const item of state.run.items) releaseBack(state, item);
      const approval = approvals.find((item) => item.id === state.run.approvalRequestId);
      if (approval?.status === "pending")
        Object.assign(approval, { status: "withdrawn", decidedAt: bangkokIso(), currentStepNo: null });
      state.run.status = "cancelled";
      return state.run;
    },
  ),
  finance.post(
    "/v1/admin/payout-runs/{runId}/actions/generate-bank-file",
    { permission: "payouts.execute", idempotent: true },
    ({ params }) => {
      const state = runById(params.runId);
      if (!state) return notFound("รอบจ่ายเงิน");
      if (state.run.status !== "approved")
        return problem(409, "payouts.run_invalid_status", "สร้างไฟล์ได้เฉพาะรอบที่อนุมัติแล้ว");
      state.bankFile = csvOf(state);
      Object.assign(state.run, { status: "file_generated", bankFileReady: true });
      return state.run;
    },
  ),
  finance.get("/v1/admin/payout-runs/{runId}/bank-file", "payouts.execute", ({ params }) => {
    const state = runById(params.runId);
    if (!state) return notFound("รอบจ่ายเงิน");
    if (!state.bankFile) return problem(409, "file.not_ready", "ยังไม่ได้สร้างไฟล์ธนาคารของรอบนี้");
    const text = state.bankFile === "seeded" ? csvOf(state) : state.bankFile;
    return { url: `data:text/csv;charset=utf-8,${encodeURIComponent(text)}`, expiresAt: bangkokIso(15) };
  }),
  finance.post(
    "/v1/admin/payout-runs/{runId}/actions/confirm",
    { permission: "payouts.execute", idempotent: true },
    ({ params, body }) => {
      const state = runById(params.runId);
      if (!state) return notFound("รอบจ่ายเงิน");
      if (state.run.status !== "file_generated")
        return problem(409, "payouts.run_invalid_status", "บันทึกผลได้หลังสร้างไฟล์ธนาคารแล้ว");
      const included = state.run.items.filter((item) => item.status === "included");
      const lines =
        body.confirmations ??
        (body.fileId
          ? included.map((item) => ({
              reference: item.id,
              status: "paid" as const,
              bankRef: `BANK-${item.id.slice(-6)}`,
            }))
          : []);
      if (lines.length === 0)
        return invalid([
          { path: "confirmations", code: "required", message: "ระบุผลการโอนของแต่ละรายการ หรือแนบไฟล์จากธนาคาร" },
        ]);
      const unknown = lines.filter((line) => !included.some((item) => item.id === line.reference));
      if (unknown.length)
        return problem(
          422,
          "payouts.confirmation_mismatch",
          "ผลการโอนมีรายการที่ไม่อยู่ในรอบนี้",
          unknown.map((line) => ({ path: "confirmations", code: "unknown", message: line.reference })),
        );
      const paidOn = today();
      for (const line of lines) {
        const item = included.find((candidate) => candidate.id === line.reference)!;
        if (line.status === "paid") postPaid(state, item, paidOn, line.bankRef ?? `BANK-${item.id.slice(-6)}`);
        else {
          Object.assign(item, { status: "failed", failureReason: line.reason ?? "ธนาคารโอนไม่สำเร็จ" });
          releaseBack(state, item);
        }
      }
      state.run.status = state.run.items.some((item) => item.status === "failed") ? "partially_failed" : "confirmed";
      return state.run;
    },
  ),
  finance.get("/v1/admin/payout-exceptions", "payables.read", () =>
    runs.flatMap((state) =>
      state.run.items
        .filter((item) => item.status === "failed" || (item.status === "excluded" && item.failureReason))
        .map((item) => ({
          id: item.id,
          runId: state.run.id,
          runNo: state.run.runNo,
          vendorName: item.vendorName,
          status: item.status,
          cashAmount: item.cashAmount,
          failureReason: item.failureReason,
        })),
    ),
  ),
  mockRequest("GET /v1/admin/payout-runs/{runId}/items/{itemId}/documents", ({ params, request }) => {
    const denied = forbiddenUnless(request, "payables.read");
    if (denied) return denied;
    const state = runById(params.runId);
    const item = state?.run.items.find((candidate) => candidate.id === params.itemId);
    if (!state || !item) return notFound("รายการจ่าย");
    if (item.status !== "paid") return problem(409, "payouts.item_not_paid", "เอกสารออกเมื่อจ่ายแล้วเท่านั้น");
    const certificates = whtIssued.filter((entry) => entry.pvNumber === item.pvNumber);
    return {
      remittanceAdvice: { url: pdf(`ใบแจ้งการโอน ${item.pvNumber}`), expiresAt: bangkokIso(15) },
      whtCertificates: certificates.map((entry) => ({
        wtNumber: entry.wtNumber,
        whtForm: entry.whtForm,
        base: baht(entry.base),
        amount: baht(entry.amount),
        url: pdf(`50 ทวิ ${entry.wtNumber}`),
        expiresAt: bangkokIso(15),
      })),
    };
  }),
];

const pdf = (title: string) =>
  `data:application/pdf;base64,${Buffer.from(`%PDF-1.4\n% ${title}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`).toString("base64")}`;
