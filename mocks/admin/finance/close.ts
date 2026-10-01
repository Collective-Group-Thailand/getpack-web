/**
 * Period close, financial reports and audit support (packio-api B5.6, published; accounting-design
 * §6–§8): the month's close checklist with its nine steps, owners, evidence and blocking checks,
 * which gates the ledger's close and lock; the trial balance, GL detail, balance sheet, profit
 * and loss by dimension and indirect cash flow, each with its integrity check; and the auditor's
 * reproducible samples, exception reports and prepared-by-client pack.
 *
 * Every figure is a sum over the same posted journals the other finance mocks write, so a zero
 * difference is a property of the data (the month simulation in the e2e relies on it). The
 * roll-forwards of 2330 / 2130 and the §7 step 8 comparison outside a checklist are packio-api's
 * U-B0.3 operations (`admin.financialReports.accountRollForward`, `.subledgerReconciliation`).
 */

import type { Schemas } from "@/lib/api/types";

import { PERSONAS } from "../../personas";
import { bangkokIso, mockId, problem } from "../../support";
import { baht, customers } from "../commerce";
import { fileNameOf, settingValue } from "../platform";
import { rollForward } from "./assets";
import { lines as bankLines, settlements, unidentified } from "./banking";
import { ACCOUNTS, accountOf, fiscalYears, journals, monthRange, post, previousMonth, satangOf } from "./books";
import { registerCloseGate, transitionPeriod } from "./ledger";
import { invoicesAll, payables, vendorOf, vendorsAll, banksOf } from "./payables";
import { runs, whtIssued } from "./payouts";
import { documents, pendingSlips, receivables, storeCreditBalance } from "./receivables";
import { reports as taxReports } from "./tax";
import { finance, invalid, notFound } from "./support";

type Checklist = Schemas["CloseChecklistDto"];
type Task = Schemas["CloseTaskDto"];
type TaskKey = Schemas["CloseTaskKey"];
type Journal = Schemas["JournalDto"];
type Period = Schemas["FiscalPeriodDto"];

const signed = (satang: number) => (satang < 0 ? `-${baht(-satang)}` : baht(satang));
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const periodOfMonth = (month: string): Period | undefined =>
  fiscalYears.flatMap((year) => year.periods).find((period) => period.startDate === `${month}-01`);
const posted = () => journals.filter((journal) => journal.status === "posted");
const personRef = (id: string | null | undefined): Schemas["PersonRefDto"] | null => {
  const found = PERSONAS.find((item) => item.id === id);
  return found ? { id: found.id, name: found.displayName } : null;
};

/* ---------------------------------------------------------------------- points liability (P10–P12) */

/**
 * The loyalty ledger's movements, posted once as the backend's P10 / P11 / P12 would have: points
 * earned (when available) at the point value, points redeemed. So 2330 carries the liability the
 * roll-forward and the balance sheet show.
 */
{
  const pointValue = Number(settingValue<string>("loyalty.point_value"));
  customers.forEach((customer, index) => {
    const available = customer.loyalty.availablePoints;
    if (!available) return;
    const redeemed = available > 20 && index % 3 === 0 ? Math.min(40, Math.floor(available / 4)) : 0;
    const earned = available + redeemed;
    const at =
      customer.createdAt.slice(0, 10) > previousMonth() ? customer.createdAt.slice(0, 10) : `${previousMonth()}-20`;
    post({
      rule: "P10",
      description: `คะแนนสะสมที่ได้รับ ${customer.displayName}`,
      documentDate: at,
      source: { type: "points_entry", id: mockId("pts", index * 100 + 2), number: null },
      lines: [
        { account: "6120", debit: Math.round(earned * pointValue * 100), dimensions: { customer: customer.id } },
        { account: "2330", credit: Math.round(earned * pointValue * 100), dimensions: { customer: customer.id } },
      ],
    });
    if (redeemed)
      post({
        rule: "P11",
        description: `ใช้คะแนนแลกส่วนลด ${customer.displayName}`,
        documentDate: bangkokIso(-8 * 24 * 60).slice(0, 10),
        source: { type: "points_entry", id: mockId("pts", index * 100 + 3), number: null },
        lines: [
          { account: "2330", debit: Math.round(redeemed * pointValue * 100), dimensions: { customer: customer.id } },
          { account: "4930", credit: Math.round(redeemed * pointValue * 100), dimensions: { customer: customer.id } },
        ],
      });
  });
}

/* ------------------------------------------------------------------------------ reconciliation */

const movementOf = (codes: string[], until?: string) => {
  let total = 0;
  for (const journal of posted()) {
    if (until && journal.entryDate > until) continue;
    for (const line of journal.lines)
      if (codes.includes(line.accountCode)) total += satangOf(line.debit) - satangOf(line.credit);
  }
  return total;
};

const openPayables = (kind: string, withVat = false) =>
  payables
    .filter((row) => row.kind === kind && ["open", "eligible", "in_run"].includes(row.dto.status))
    .reduce((sum, row) => sum + satangOf(row.dto.openNetAmount) + (withVat ? satangOf(row.dto.openVatAmount) : 0), 0);

/** Sub-ledger ↔ GL (§7 step 8): the open amounts of each sub-ledger against its control account. */
export function subledgerRows(month = previousMonth()) {
  const ar = receivables
    .filter((item) => ["open", "partially_paid"].includes(item.status))
    .reduce((sum, item) => sum + satangOf(item.openAmount), 0);
  const rows = [
    { key: "receivables", accounts: "1210", subledger: ar, gl: movementOf(["1210"]) },
    { key: "factory_payables", accounts: "2110", subledger: openPayables("balance"), gl: -movementOf(["2110"]) },
    {
      key: "vendor_payables",
      accounts: "2120",
      subledger: openPayables("vendor_bill", true),
      gl: -movementOf(["2120"]),
    },
    { key: "retention", accounts: "2130", subledger: openPayables("retention_release"), gl: -movementOf(["2130"]) },
    { key: "store_credit", accounts: "2320", subledger: storeCreditBalance(), gl: -movementOf(["2320"]) },
  ].map((row) => ({
    key: row.key,
    accounts: row.accounts,
    subledger: signed(row.subledger),
    gl: signed(row.gl),
    difference: signed(row.gl - row.subledger),
  }));
  for (const row of rollForward(month, month).reconciliation)
    rows.push({
      key: `fixed_assets_${row.accountCode}`,
      accounts: row.accountCode,
      subledger: row.register,
      gl: row.gl,
      difference: row.difference,
    });
  return rows;
}

/* ------------------------------------------------------------------------------------ checks */

const REQUIRED_TAX_PAPERS: Schemas["TaxReportKind"][] = ["sales_tax", "purchase_tax", "pp30", "pnd3", "pnd53"];
const STEPS: [TaskKey, number, boolean][] = [
  ["statements_imported", 1, true],
  ["slips_and_unidentified", 2, true],
  ["deliveries_received", 3, true],
  ["receivables_reviewed", 4, false],
  ["rollforwards_reviewed", 5, false],
  ["accruals_recorded", 6, true],
  ["tax_papers_reconciled", 7, true],
  ["subledgers_reconciled", 8, true],
  ["review", 9, false],
];

function check(month: string, key: TaskKey): Schemas["CheckResultDto"] {
  const { from, to } = monthRange(month);
  switch (key) {
    case "statements_imported": {
      const threshold = settingValue<number>("close.unmatched_items_threshold");
      const open = bankLines.filter((line) => line.matchStatus === "unmatched" && line.txnDate <= to);
      const waiting = settlements.filter((item) => item.status === "imported" && item.settlementDate <= to);
      return {
        passed: open.length + waiting.length <= threshold,
        summary: `${open.length} unmatched statement line(s), ${waiting.length} settlement(s) not in the bank (threshold ${threshold})`,
        figures: { unmatchedLines: open.length, settlementsNotMatched: waiting.length, threshold },
        items: [
          ...open.map((line) => ({
            type: "statement_line",
            id: line.id,
            date: line.txnDate,
            amount: line.amount,
            description: line.description,
          })),
          ...waiting.map((item) => ({
            type: "gateway_settlement",
            id: item.id,
            date: item.settlementDate,
            amount: item.netAmount,
            description: item.provider,
          })),
        ],
      };
    }
    case "slips_and_unidentified": {
      const slips = pendingSlips().filter((slip) => slip.createdAt.slice(0, 10) <= to);
      const parked = unidentified.filter((item) => item.status === "open" && item.receivedOn <= to);
      return {
        passed: slips.length === 0,
        summary: `${slips.length} slip(s) awaiting verification; ${parked.length} unidentified receipt(s) open`,
        figures: {
          slipsAwaitingVerification: slips.length,
          unidentifiedOpen: parked.length,
          unidentifiedAmount: baht(parked.reduce((sum, item) => sum + satangOf(item.amount), 0)),
        },
        items: slips.map((slip) => ({
          type: "payment",
          id: slip.paymentId,
          date: slip.createdAt.slice(0, 10),
          amount: slip.declaredAmount,
          description: slip.groupCode ?? "",
        })),
      };
    }
    case "deliveries_received":
      return {
        passed: true,
        summary: "Every delivery with a proof of delivery has its goods receipt",
        figures: { podWithoutGr: 0 },
        items: [],
      };
    case "receivables_reviewed": {
      const overdue = receivables.filter(
        (item) => ["open", "partially_paid"].includes(item.status) && (item.dueDate ?? "9999") <= to,
      );
      return {
        passed: true,
        summary: `${overdue.length} receivable(s) overdue at ${to} (${baht(overdue.reduce((sum, item) => sum + satangOf(item.openAmount), 0))})`,
        figures: {
          overdueItems: overdue.length,
          overdueAmount: baht(overdue.reduce((sum, item) => sum + satangOf(item.openAmount), 0)),
        },
        items: [],
      };
    }
    case "rollforwards_reviewed":
      return {
        passed: true,
        summary: `Points liability ${signed(-movementOf(["2330"], to))}; retention payable ${signed(-movementOf(["2130"], to))} at ${to}`,
        figures: {
          pointsLiability: signed(-movementOf(["2330"], to)),
          retentionPayable: signed(-movementOf(["2130"], to)),
        },
        items: [],
      };
    case "accruals_recorded": {
      const pending = journals.filter(
        (j) =>
          ["manual", "reversal", "recurring"].includes(j.kind) &&
          j.status === "pending_approval" &&
          j.documentDate >= from &&
          j.documentDate <= to,
      );
      return {
        passed: pending.length === 0,
        summary: `${pending.length} manual journal(s) of the month waiting for approval`,
        figures: { pendingJournals: pending.length },
        items: pending.map((j) => ({
          type: "journal_entry",
          id: j.id,
          date: j.documentDate,
          amount: j.totalDebit,
          description: j.description,
        })),
      };
    }
    case "tax_papers_reconciled": {
      const final = taxReports.filter(
        (report) => report.period === month && ["final", "filed"].includes(report.status),
      );
      const missing = REQUIRED_TAX_PAPERS.filter((kind) => !final.some((report) => report.kind === kind));
      return {
        passed: missing.length === 0,
        summary: missing.length
          ? `Not final: ${missing.join(", ")}`
          : "VAT and WHT papers final and reconciled to the GL",
        figures: { final: final.length, required: REQUIRED_TAX_PAPERS.length },
        items: missing.map((kind) => ({ type: "tax_report", id: null, date: null, amount: null, description: kind })),
      };
    }
    case "subledgers_reconciled": {
      const rows = subledgerRows(month);
      const off = rows.filter((row) => row.difference !== "0.00");
      return {
        passed: off.length === 0,
        summary: off.length
          ? `Differences: ${off.map((row) => `${row.key} ${row.difference}`).join("; ")}`
          : "Sub-ledgers agree with the GL",
        figures: Object.fromEntries(rows.map((row) => [row.key, row.difference])),
        items: rows.map((row) => ({
          type: "reconciliation",
          id: row.key,
          date: null,
          amount: row.difference,
          description: `${row.accounts}: sub-ledger ${row.subledger}, GL ${row.gl}`,
        })),
      };
    }
    case "review":
      return {
        passed: true,
        summary: "Reviewed and closed by a Finance Manager other than the submitter",
        figures: {},
        items: [],
      };
  }
}

/* -------------------------------------------------------------------------------- checklists */

const checklists = new Map<string, Checklist & { submittedById: string | null }>();

function open(month: string, period: Period, by: string) {
  const checklist = {
    id: mockId("ccl", checklists.size + 1),
    period: month,
    periodStatus: period.status,
    status: "open" as const,
    submittedAt: null,
    submittedBy: null,
    submittedById: null,
    closedAt: null,
    closedBy: null,
    lockedAt: null,
    auditorSignedOffAt: null,
    tasks: STEPS.map(([key, stepNo, automatic], index): Task => ({
      id: mockId("ctk", checklists.size * 10 + index + 1),
      key,
      stepNo,
      automatic,
      status: "pending",
      owner: null,
      note: null,
      waivedReason: null,
      checkResult: null,
      checkedAt: null,
      completedAt: null,
      completedBy: null,
      evidence: [],
    })),
  };
  void by;
  checklists.set(month, checklist);
  return checklist;
}

const view = ({ submittedById: _submittedById, ...dto }: Checklist & { submittedById: string | null }): Checklist => ({
  ...dto,
  periodStatus: periodOfMonth(dto.period)?.status ?? dto.periodStatus,
});

// The ledger asks before it closes or locks a month (packio-api `PERIOD_CLOSE_GATE`).
registerCloseGate((period, to) => {
  const month = period.startDate.slice(0, 7);
  const checklist = checklists.get(month);
  if (to === "closed") {
    const review = checklist?.tasks.find((task) => task.key === "review");
    if (checklist?.status !== "in_review" || review?.status !== "done")
      return problem(409, "close.checklist_incomplete", `ปิดงวด ${month} ได้เมื่อรายการตรวจปิดงวดผ่านการอนุมัติแล้ว`);
  }
  if (to === "locked") {
    if (checklist?.status !== "closed")
      return problem(409, "close.checklist_incomplete", `ล็อกงวด ${month} ได้เมื่อปิดงวดตามรายการตรวจแล้ว`);
    if (period.periodNo === 12 && !checklist.auditorSignedOffAt)
      return problem(409, "close.auditor_sign_off_required", "งวดสิ้นปีล็อกได้หลังผู้สอบบัญชีลงนามแล้ว");
  }
  return null;
});

function withChecklist(
  month: string | undefined,
  run: (checklist: Checklist & { submittedById: string | null }) => Response | Checklist,
) {
  if (!month || !MONTH.test(month)) return invalid([{ path: "period", code: "pattern", message: "YYYY-MM" }]);
  const checklist = checklists.get(month);
  if (!checklist) return notFound("รายการตรวจปิดงวด");
  const result = run(checklist);
  return result instanceof Response ? result : view(checklist);
}

const editable = (checklist: Checklist) =>
  checklist.status === "open"
    ? null
    : problem(409, "close.checklist_not_open", "รายการตรวจปิดงวดนี้ส่งตรวจแล้ว แก้ไขไม่ได้");

function taskOf(checklist: Checklist, key: string | undefined) {
  return checklist.tasks.find((task) => task.key === key);
}

/* --------------------------------------------------------------------------- financial reports */

function range(from: unknown, to: unknown) {
  if (typeof from !== "string" || typeof to !== "string" || !MONTH.test(from) || !MONTH.test(to) || from > to)
    return null;
  return { from, to, start: `${from}-01`, end: monthRange(to).to };
}

function movements(start: string, end: string) {
  const rows = new Map<string, { opening: number; debit: number; credit: number }>();
  for (const journal of posted()) {
    if (journal.entryDate > end) continue;
    for (const line of journal.lines) {
      const row = rows.get(line.accountCode) ?? { opening: 0, debit: 0, credit: 0 };
      if (journal.entryDate < start) row.opening += satangOf(line.debit) - satangOf(line.credit);
      else {
        row.debit += satangOf(line.debit);
        row.credit += satangOf(line.credit);
      }
      rows.set(line.accountCode, row);
    }
  }
  return ACCOUNTS.map((account) => ({ account, ...(rows.get(account.code) ?? { opening: 0, debit: 0, credit: 0 }) }));
}

export function trialBalance(from: string, to: string, includeZero = false): Schemas["TrialBalanceDto"] {
  const { start, end } = range(from, to)!;
  const rows = movements(start, end).filter((row) => includeZero || row.opening || row.debit || row.credit);
  const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const totals = {
    opening: sum((r) => r.opening),
    debit: sum((r) => r.debit),
    credit: sum((r) => r.credit),
    closing: sum((r) => r.opening + r.debit - r.credit),
  };
  return {
    from,
    to,
    accounts: rows.map((row) => ({
      accountCode: row.account.code,
      nameTh: row.account.nameTh,
      nameEn: row.account.nameEn,
      accountType: row.account.accountType,
      normalSide: row.account.normalSide,
      opening: signed(row.opening),
      debit: baht(row.debit),
      credit: baht(row.credit),
      closing: signed(row.opening + row.debit - row.credit),
    })),
    totals: {
      opening: signed(totals.opening),
      debit: baht(totals.debit),
      credit: baht(totals.credit),
      closing: signed(totals.closing),
    },
    balanced: totals.opening === 0 && totals.closing === 0 && totals.debit === totals.credit,
  };
}

const PL_TYPES = ["revenue", "cost_of_sales", "expense"];

export function balanceSheet(asOf: string): Schemas["BalanceSheetDto"] {
  const yearStart = `${asOf.slice(0, 4)}-01-01`;
  const rows = movements(yearStart, asOf);
  const section = (type: string, sign: 1 | -1) =>
    rows
      .filter((row) => row.account.accountType === type)
      .map((row) => ({ row, balance: (row.opening + row.debit - row.credit) * sign }))
      .filter((item) => item.balance !== 0)
      .map((item) => ({
        accountCode: item.row.account.code,
        nameTh: item.row.account.nameTh,
        nameEn: item.row.account.nameEn,
        balance: signed(item.balance),
      }));
  const total = (lines: { balance: string }[]) =>
    lines.reduce((sum, line) => sum + Math.round(Number(line.balance) * 100), 0);
  const assets = section("asset", 1);
  const liabilities = section("liability", -1);
  const equity = section("equity", -1);
  const pl = rows.filter((row) => PL_TYPES.includes(row.account.accountType));
  const priorYears = pl.reduce((sum, row) => sum - row.opening, 0);
  const currentYear = pl.reduce((sum, row) => sum + row.credit - row.debit, 0);
  const equityTotal = total(equity) + priorYears + currentYear;
  return {
    asOf,
    fiscalYearStart: yearStart,
    assets,
    liabilities,
    equity,
    priorYearsProfit: signed(priorYears),
    currentYearProfit: signed(currentYear),
    totals: { assets: signed(total(assets)), liabilities: signed(total(liabilities)), equity: signed(equityTotal) },
    difference: signed(total(assets) - total(liabilities) - equityTotal),
  };
}

function dimensionOf(line: Journal["lines"][number], dimension: Schemas["ProfitAndLossDimension"]): string | null {
  const d = line.dimensions;
  switch (dimension) {
    case "none":
      return null;
    case "factory": {
      const vendor = d.factory ? vendorOf(d.factory) : undefined;
      return vendor ? vendor.legalName : (d.factory ?? null);
    }
    case "product_type":
      return d.productType ?? null;
    case "channel":
      return d.channel ?? null;
    case "campaign":
      return d.campaign ?? null;
    case "cost_centre":
      return d.costCentre ?? null;
  }
}

export function profitAndLoss(
  from: string,
  to: string,
  dimension: Schemas["ProfitAndLossDimension"],
): Schemas["ProfitAndLossDto"] {
  const { start, end } = range(from, to)!;
  const groups = new Map<string, { revenue: number; cost: number; expenses: number; accounts: Map<string, number> }>();
  for (const journal of posted()) {
    if (journal.entryDate < start || journal.entryDate > end) continue;
    for (const line of journal.lines) {
      const type = accountOf(line.accountCode).accountType;
      if (!PL_TYPES.includes(type)) continue;
      const key = dimensionOf(line, dimension) ?? "(none)";
      const group = groups.get(key) ?? { revenue: 0, cost: 0, expenses: 0, accounts: new Map<string, number>() };
      const amount = satangOf(line.credit) - satangOf(line.debit);
      if (type === "revenue") group.revenue += amount;
      else if (type === "cost_of_sales") group.cost -= amount;
      else group.expenses -= amount;
      group.accounts.set(line.accountCode, (group.accounts.get(line.accountCode) ?? 0) + amount);
      groups.set(key, group);
    }
  }
  const lines = [...groups.entries()]
    .sort(([a], [b]) => (a === "(none)" ? 1 : b === "(none)" ? -1 : a.localeCompare(b)))
    .map(([key, group]) => {
      const gross = group.revenue - group.cost;
      return {
        dimension: key,
        revenue: signed(group.revenue),
        costOfSales: signed(group.cost),
        grossMargin: signed(gross),
        grossMarginPct: group.revenue === 0 ? null : ((gross / group.revenue) * 100).toFixed(2),
        expenses: signed(group.expenses),
        netProfit: signed(gross - group.expenses),
        accounts: [...group.accounts.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([accountCode, amount]) => ({ accountCode, amount: signed(amount) })),
      };
    });
  const total = (key: "revenue" | "costOfSales" | "grossMargin" | "expenses" | "netProfit") =>
    signed(lines.reduce((sum, line) => sum + Math.round(Number(line[key]) * 100), 0));
  return {
    from,
    to,
    dimension,
    lines,
    totals: {
      revenue: total("revenue"),
      costOfSales: total("costOfSales"),
      grossMargin: total("grossMargin"),
      expenses: total("expenses"),
      netProfit: total("netProfit"),
    },
  };
}

export function cashFlow(from: string, to: string): Schemas["CashFlowDto"] {
  const { start, end } = range(from, to)!;
  const rows = movements(start, end);
  const net = rows
    .filter((row) => PL_TYPES.includes(row.account.accountType))
    .reduce((sum, row) => sum + row.credit - row.debit, 0);
  const sections = {
    operating: [] as Schemas["CashLineDto"][],
    investing: [] as Schemas["CashLineDto"][],
    financing: [] as Schemas["CashLineDto"][],
  };
  const totals = { operating: net, investing: 0, financing: 0 };
  let cash = 0;
  for (const row of rows.filter((item) => !PL_TYPES.includes(item.account.accountType))) {
    const movement = row.credit - row.debit;
    if (movement === 0) continue;
    if (row.account.cashFlowClass === "cash") {
      cash -= movement;
      continue;
    }
    const key =
      row.account.cashFlowClass === "investing"
        ? "investing"
        : row.account.cashFlowClass === "financing" || row.account.accountType === "equity"
          ? "financing"
          : "operating";
    totals[key] += movement;
    sections[key].push({ accountCode: row.account.code, nameTh: row.account.nameTh, amount: signed(movement) });
  }
  const change = totals.operating + totals.investing + totals.financing;
  return {
    from,
    to,
    netProfit: signed(net),
    operating: { adjustments: sections.operating, total: signed(totals.operating) },
    investing: { lines: sections.investing, total: signed(totals.investing) },
    financing: { lines: sections.financing, total: signed(totals.financing) },
    netChange: signed(change),
    cashMovement: signed(cash),
    difference: signed(change - cash),
  };
}

function glDetail(
  accountCode: string,
  from: string,
  to: string,
  page: number,
  perPage: number,
): Schemas["GlDetailDto"] | Response {
  const account = ACCOUNTS.find((item) => item.code === accountCode);
  if (!account) return notFound("บัญชี");
  const { start, end } = range(from, to)!;
  let opening = 0;
  const within: { journal: Journal; line: Journal["lines"][number] }[] = [];
  for (const journal of posted())
    for (const line of journal.lines) {
      if (line.accountCode !== accountCode || journal.entryDate > end) continue;
      if (journal.entryDate < start) opening += satangOf(line.debit) - satangOf(line.credit);
      else within.push({ journal, line });
    }
  within.sort(
    (a, b) =>
      a.journal.entryDate.localeCompare(b.journal.entryDate) ||
      (a.journal.entryNo ?? "").localeCompare(b.journal.entryNo ?? ""),
  );
  let running = opening;
  const all = within.map(({ journal, line }) => {
    running += satangOf(line.debit) - satangOf(line.credit);
    const party = line.dimensions.vendor ?? line.dimensions.factory;
    const customer = customers.find((item) => item.id === line.dimensions.customer);
    return {
      journalEntryId: journal.id,
      entryNo: journal.entryNo,
      jvNumber: journal.jvNumber,
      kind: journal.kind,
      ruleKey: journal.postingRule,
      entryDate: journal.entryDate,
      documentDate: journal.documentDate,
      description: line.description ?? journal.description,
      sourceType: journal.source?.type ?? null,
      sourceId: journal.source?.id ?? null,
      sourceNo: journal.source?.number ?? null,
      domainEventId: journal.domainEventId,
      postedBy: personRef(journal.approvedBy ?? journal.createdBy),
      orderCode: null,
      vendorName: party ? (vendorOf(party)?.legalName ?? null) : null,
      customerName: customer?.displayName ?? null,
      taxCode: line.taxCode,
      debit: line.debit,
      credit: line.credit,
      balance: signed(running),
    };
  });
  const debit = within.reduce((sum, item) => sum + satangOf(item.line.debit), 0);
  const credit = within.reduce((sum, item) => sum + satangOf(item.line.credit), 0);
  return {
    accountCode,
    nameTh: account.nameTh,
    from,
    to,
    opening: signed(opening),
    debit: baht(debit),
    credit: baht(credit),
    closing: signed(opening + debit - credit),
    total: all.length,
    lines: all.slice((page - 1) * perPage, page * perPage),
  };
}

/** A control account month by month (points liability 2330, retention 2130), in its normal direction. */
export function accountRollForward(accountCode: string, from: string, to: string): Schemas["AccountRollForwardDto"] {
  const account = accountOf(accountCode);
  const sign = account.normalSide === "debit" ? 1 : -1;
  const months: Schemas["RollForwardMonthDto"][] = [];
  for (
    let month = from;
    month <= to;
    month = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 7)
  ) {
    const { from: start, to: end } = monthRange(month);
    let opening = 0;
    let increases = 0;
    let decreases = 0;
    const rules = new Map<string, { increases: number; decreases: number }>();
    for (const journal of posted())
      for (const line of journal.lines) {
        if (line.accountCode !== accountCode || journal.entryDate > end) continue;
        const amount = (satangOf(line.debit) - satangOf(line.credit)) * sign;
        if (journal.entryDate < start) {
          opening += amount;
          continue;
        }
        // packio-api names a journal without a posting rule `manual`.
        const rule = journal.postingRule ?? "manual";
        const entry = rules.get(rule) ?? { increases: 0, decreases: 0 };
        if (amount >= 0) {
          increases += amount;
          entry.increases += amount;
        } else {
          decreases -= amount;
          entry.decreases -= amount;
        }
        rules.set(rule, entry);
      }
    months.push({
      month,
      opening: signed(opening),
      increases: baht(increases),
      decreases: baht(decreases),
      closing: signed(opening + increases - decreases),
      byRule: [...rules.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([rule, entry]) => ({ ruleKey: rule, increase: baht(entry.increases), decrease: baht(entry.decreases) })),
    });
  }
  return { accountCode, nameTh: account.nameTh, normalSide: account.normalSide, months };
}

/* ------------------------------------------------------------------------------ audit support */

type SampleItem = Schemas["SampleItemDto"];

function population(month: string, kind: Schemas["AuditPopulation"]): SampleItem[] {
  const { from, to } = monthRange(month);
  const inMonth = (date: string | null | undefined) => Boolean(date && date >= from && date <= to);
  switch (kind) {
    case "customer_documents":
      return documents
        .filter((doc) => inMonth(doc.documentDate))
        .map((doc) => ({ id: doc.id, number: doc.docNumber, date: doc.documentDate, amount: doc.grossAmount }));
    case "vendor_invoices":
      return invoicesAll()
        .filter((bill) => inMonth(bill.invoiceDate))
        .map((bill) => ({
          id: bill.id,
          number: bill.vendorInvoiceNo,
          date: bill.invoiceDate,
          amount: bill.grossAmount,
        }));
    case "journal_entries": {
      const period = periodOfMonth(month);
      return posted()
        .filter((j) => j.periodId === period?.id)
        .map((j) => ({
          id: j.id,
          number: j.jvNumber ?? j.entryNo ?? j.id,
          date: j.documentDate,
          amount: j.totalDebit,
        }));
    }
    case "payout_items":
      return runs
        .flatMap((state) => state.run.items)
        .filter((item) => item.status === "paid" && inMonth(item.paidOn))
        .map((item) => ({
          id: item.id,
          number: item.pvNumber ?? item.id,
          date: item.paidOn ?? "",
          amount: item.cashAmount,
        }));
    case "wht_certificates":
      return whtIssued
        .filter((item) => inMonth(item.paidOn))
        .map((item) => ({ id: item.id, number: item.wtNumber, date: item.paidOn, amount: baht(item.amount) }));
  }
}

/** mulberry32, as packio-api draws: the same seed gives the same sample. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], n: number, next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

export function drawSample(
  input: Schemas["DrawSampleDto"],
  seedText?: string,
): Omit<Schemas["AuditSampleDto"], "id" | "createdAt"> {
  const items = population(input.period, input.population);
  const seed = seedText ? Number(BigInt(seedText) & 0xffffffffn) : 1 + Math.floor(Math.random() * 2 ** 31);
  const next = prng(seed);
  const size = Math.min(input.size, items.length);
  let selected: SampleItem[];
  if (input.method === "random" || items.length === 0) selected = pick(items, size, next);
  else {
    const sorted = [...items].sort((a, b) => satangOf(b.amount) - satangOf(a.amount));
    const total = sorted.reduce((sum, item) => sum + Math.abs(satangOf(item.amount)), 0);
    const bands: SampleItem[][] = [[], [], []];
    let running = 0;
    for (const item of sorted) {
      bands[total === 0 ? 2 : Math.min(2, Math.floor((running / total) * 3))]!.push(item);
      running += Math.abs(satangOf(item.amount));
    }
    const nonEmpty = bands.filter((band) => band.length > 0);
    const quotas = nonEmpty.map((band) => Math.max(1, Math.round((band.length / items.length) * size)));
    while (quotas.reduce((a, q) => a + q, 0) > size) quotas[quotas.indexOf(Math.max(...quotas))]!--;
    selected = nonEmpty.flatMap((band, i) => pick(band, Math.min(quotas[i]!, band.length), next));
  }
  return {
    period: input.period,
    population: input.population,
    method: input.method,
    populationSize: items.length,
    seed: String(seed),
    selected,
  };
}

const inHours = (at: string) => {
  const hours = settingValue<{ start: string; end: string; weekdays: number[] }>("audit.business_hours");
  const local = new Date(Date.parse(at) + 7 * 3_600_000);
  const hhmm = local.toISOString().slice(11, 16);
  const weekday = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
  return hours.weekdays.includes(weekday) && hhmm >= hours.start && hhmm < hours.end;
};

export function exceptions(month: string): Schemas["ExceptionReportDto"][] {
  const { from, to } = monthRange(month);
  const inMonth = (date: string | null | undefined) => Boolean(date && date >= from && date <= to);
  const period = periodOfMonth(month);
  const manual = posted().filter(
    (j) => j.periodId === period?.id && ["manual", "reversal", "recurring"].includes(j.kind) && j.createdBy,
  );
  const report = (
    key: Schemas["AuditExceptionKey"],
    description: string,
    items: Schemas["ExceptionItemDto"][],
  ): Schemas["ExceptionReportDto"] => ({
    key,
    description,
    count: items.length,
    items: items.slice(0, 200),
  });
  // Gaps inside each gapless series used in the month.
  const series = new Map<string, number[]>();
  for (const doc of documents.filter((item) => inMonth(item.documentDate))) {
    const [prefix, seq] = doc.docNumber.split("-") as [string, string];
    series.set(prefix, [...(series.get(prefix) ?? []), Number(seq)]);
  }
  const gaps: Schemas["ExceptionItemDto"][] = [];
  for (const [prefix, numbers] of series) {
    const sorted = [...numbers].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++)
      for (let n = sorted[i - 1]! + 1; n < sorted[i]!; n++)
        gaps.push({
          id: null,
          reference: `${prefix}-${String(n).padStart(5, "0")}`,
          date: null,
          amount: null,
          detail: "ไม่พบเลขที่นี้ในชุดเลขที่",
        });
  }
  const byMaker = new Map<string, Journal[]>();
  for (const journal of manual) byMaker.set(journal.createdBy!, [...(byMaker.get(journal.createdBy!) ?? []), journal]);
  const accounts = new Map<string, string[]>();
  for (const vendor of vendorsAll())
    for (const bank of banksOf(vendor.id)) {
      const key = `${bank.bankCode}-${bank.accountNoLast4}`;
      accounts.set(key, [...(accounts.get(key) ?? []), vendor.legalName]);
    }
  const nextMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))
    .toISOString()
    .slice(0, 7);
  const next = monthRange(nextMonth);
  return [
    report("series_gaps", "Numbers missing inside a gapless series in the period", gaps),
    report(
      "outside_business_hours",
      "Manual journals posted outside business hours on business weekdays",
      manual
        .filter((j) => j.postedAt && !inHours(j.postedAt))
        .map((j) => ({
          id: j.id,
          reference: j.jvNumber ?? j.entryNo ?? j.id,
          date: j.documentDate,
          amount: j.totalDebit,
          detail: `บันทึกเมื่อ ${j.postedAt}`,
        })),
    ),
    report(
      "back_dated_documents",
      "Documents and manual journals dated before the day they were made",
      manual
        .filter((j) => j.postedAt && j.documentDate < j.postedAt.slice(0, 10))
        .map((j) => ({
          id: j.id,
          reference: j.jvNumber ?? j.entryNo ?? j.id,
          date: j.documentDate,
          amount: j.totalDebit,
          detail: `ลงวันที่ ${j.documentDate} บันทึก ${j.postedAt!.slice(0, 10)}`,
        })),
    ),
    report(
      "manual_journals_by_user",
      "Posted manual journals per maker",
      [...byMaker.entries()].map(([maker, list]) => ({
        id: maker,
        reference: personRef(maker)?.name ?? maker,
        date: null,
        amount: baht(list.reduce((sum, j) => sum + satangOf(j.totalDebit), 0)),
        detail: `${list.length} รายการ`,
      })),
    ),
    report(
      "reversals",
      "Reversing entries posted in the period",
      posted()
        .filter((j) => j.periodId === period?.id && j.kind === "reversal")
        .map((j) => ({
          id: j.id,
          reference: j.jvNumber ?? j.entryNo ?? j.id,
          date: j.documentDate,
          amount: j.totalDebit,
          detail: j.description,
        })),
    ),
    report(
      "duplicate_vendor_bank_accounts",
      "Bank account numbers used by more than one vendor (only the last 4 digits shown)",
      [...accounts.entries()]
        .filter(([, names]) => new Set(names).size > 1)
        .map(([key, names]) => ({
          id: null,
          reference: `xxx${key.split("-")[1]}`,
          date: null,
          amount: null,
          detail: [...new Set(names)].join(", "),
        })),
    ),
    report(
      "duplicate_slip_references",
      "Slips carrying a bank transaction reference seen more than once",
      pendingSlips()
        .filter((slip) => slip.lastCheck === "duplicate")
        .map((slip) => ({
          id: slip.paymentId,
          reference: slip.groupCode ?? slip.id,
          date: slip.createdAt.slice(0, 10),
          amount: slip.declaredAmount,
          detail: "เลขอ้างอิงซ้ำกับสลิปอื่น",
        })),
    ),
    report(
      "credit_notes_after_period_end",
      "Credit notes dated in the following month against documents of the period",
      documents
        .filter((doc) => doc.docType === "cn" && doc.documentDate >= next.from && doc.documentDate <= next.to)
        .filter((doc) => inMonth(documents.find((original) => original.id === doc.originalDocument?.id)?.documentDate))
        .map((doc) => ({
          id: doc.id,
          reference: doc.docNumber,
          date: doc.documentDate,
          amount: doc.grossAmount,
          detail: `อ้างอิง ${doc.originalDocument?.docNumber ?? ""}`,
        })),
    ),
    report(
      "payouts_without_valid_tax_invoice",
      "Payouts with VAT paid before a valid tax invoice (input VAT pending document)",
      runs
        .flatMap((state) => state.run.items)
        .filter(
          (item) =>
            item.status === "paid" && inMonth(item.paidOn) && satangOf(item.vatAmount) > 0 && !item.vatClaimable,
        )
        .map((item) => ({
          id: item.id,
          reference: item.pvNumber ?? item.id,
          date: item.paidOn,
          amount: item.vatAmount,
          detail: item.vendorName,
        })),
    ),
  ];
}

const samples: Schemas["AuditSampleDto"][] = [];
const pbcExports: (Schemas["PbcExportDto"] & { csv: string })[] = [];
const pbcRow = ({ csv: _csv, ...row }: Schemas["PbcExportDto"] & { csv: string }): Schemas["PbcExportDto"] => row;

const csvField = (value: unknown) => {
  const text =
    value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const sheet = (name: string, rows: Record<string, unknown>[]) => {
  const columns = rows.length ? Object.keys(rows[0]!) : ["(empty)"];
  return [
    `## ${name}`,
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvField(row[column])).join(",")),
  ].join("\r\n");
};

/** The PBC pack as the backend's workbook has it, one section per sheet (the mock writes CSV). */
function pbcPack(month: string, by: string): string {
  const period = periodOfMonth(month);
  const checklist = checklists.get(month);
  const parts = [
    sheet("README", [
      {
        period: month,
        generatedAt: bangkokIso(),
        generatedBy: by,
        note: "Prepared by client — Packio ledger export (mock)",
      },
    ]),
    sheet("TrialBalance", trialBalance(month, month).accounts as unknown as Record<string, unknown>[]),
    sheet(
      "GLDetail",
      posted()
        .filter((j) => j.periodId === period?.id)
        .flatMap((j) =>
          j.lines.map((line) => ({
            entryNo: j.entryNo,
            jvNumber: j.jvNumber,
            kind: j.kind,
            entryDate: j.entryDate,
            documentDate: j.documentDate,
            account: line.accountCode,
            debit: line.debit,
            credit: line.credit,
            taxCode: line.taxCode,
            source: j.source?.type ?? null,
            sourceNo: j.source?.number ?? null,
            journalEntryId: j.id,
            domainEventId: j.domainEventId,
          })),
        ),
    ),
    ...(["customer_documents", "vendor_invoices", "journal_entries", "payout_items", "wht_certificates"] as const).map(
      (kind) => sheet(kind, population(month, kind) as unknown as Record<string, unknown>[]),
    ),
    sheet(
      "TaxReports",
      taxReports
        .filter((r) => r.period === month)
        .map((r) => ({
          kind: r.kind,
          status: r.status,
          reportAmount: r.reportAmount,
          glAmount: r.glAmount,
          glDifference: r.glDifference,
          filingRef: r.filingRef,
        })),
    ),
    sheet("FixedAssets", rollForward(month, month).categories as unknown as Record<string, unknown>[]),
    sheet(
      "CloseChecklist",
      (checklist?.tasks ?? []).map((task) => ({
        step: task.stepNo,
        key: task.key,
        status: task.status,
        note: task.note,
        waivedReason: task.waivedReason,
        completedAt: task.completedAt,
      })),
    ),
    sheet(
      "Exceptions",
      exceptions(month).map((item) => ({ key: item.key, count: item.count, description: item.description })),
    ),
  ];
  return `\uFEFF${parts.join("\r\n\r\n")}\r\n`;
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/* ---------------------------------------------------------------------------------- handlers */

const monthOk = (month: unknown): month is string => typeof month === "string" && MONTH.test(month);

export const closeHandlers = [
  finance.get("/v1/admin/close-checklists/{period}", "close.read", ({ params }) =>
    withChecklist(params.period, (checklist) => checklist),
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}",
    { permission: "close.manage", idempotent: true, status: 201 },
    ({ params, persona }) => {
      const month = params.period;
      if (!monthOk(month)) return invalid([{ path: "period", code: "pattern", message: "YYYY-MM" }]);
      const period = periodOfMonth(month);
      if (!period) return notFound("งวดบัญชี");
      const checklist = checklists.get(month) ?? open(month, period, persona.id);
      return view(checklist);
    },
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}/tasks/{taskKey}/actions/check",
    { permission: "close.manage", idempotent: true },
    ({ params }) =>
      withChecklist(params.period, (checklist) => {
        const refused = editable(checklist);
        if (refused) return refused;
        const task = taskOf(checklist, params.taskKey);
        if (!task) return notFound("ขั้นตอน");
        const result = check(checklist.period, task.key);
        Object.assign(task, { checkResult: result, checkedAt: bangkokIso() });
        if (task.status === "pending" || task.status === "blocked")
          task.status = task.automatic && !result.passed ? "blocked" : "pending";
        return checklist;
      }),
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}/tasks/{taskKey}/actions/complete",
    { permission: "close.manage", idempotent: true },
    ({ params, body, persona }) =>
      withChecklist(params.period, (checklist) => {
        if (params.taskKey === "review")
          return problem(409, "close.review_by_approval", "ขั้นตอนสุดท้ายเสร็จเมื่อผู้จัดการการเงินอนุมัติ");
        const refused = editable(checklist);
        if (refused) return refused;
        const task = taskOf(checklist, params.taskKey);
        if (!task) return notFound("ขั้นตอน");
        if (task.status === "done" || task.status === "waived")
          return problem(409, "close.task_done", "ขั้นตอนนี้เสร็จแล้ว");
        const result = check(checklist.period, task.key);
        Object.assign(task, { checkResult: result, checkedAt: bangkokIso() });
        if (task.automatic && !result.passed) {
          task.status = "blocked";
          return problem(422, "close.check_failed", `ยังผ่านการตรวจไม่ได้: ${result.summary}`);
        }
        Object.assign(task, {
          status: "done",
          note: body?.note ?? null,
          completedAt: bangkokIso(),
          completedBy: personRef(persona.id),
        });
        return checklist;
      }),
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}/tasks/{taskKey}/actions/waive",
    { permission: "close.approve", idempotent: true },
    ({ params, body, persona }) =>
      withChecklist(params.period, (checklist) => {
        if (params.taskKey === "review")
          return problem(409, "close.review_by_approval", "ขั้นตอนสุดท้ายเสร็จเมื่อผู้จัดการการเงินอนุมัติ");
        const refused = editable(checklist);
        if (refused) return refused;
        const task = taskOf(checklist, params.taskKey);
        if (!task) return notFound("ขั้นตอน");
        if (task.status === "done" || task.status === "waived")
          return problem(409, "close.task_done", "ขั้นตอนนี้เสร็จแล้ว");
        if (!body?.reason || body.reason.trim().length < 3)
          return invalid([{ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" }]);
        Object.assign(task, {
          status: "waived",
          waivedReason: body.reason.trim(),
          completedAt: bangkokIso(),
          completedBy: personRef(persona.id),
        });
        return checklist;
      }),
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}/tasks/{taskKey}/actions/assign",
    { permission: "close.manage", idempotent: true },
    ({ params, body }) =>
      withChecklist(params.period, (checklist) => {
        const task = taskOf(checklist, params.taskKey);
        if (!task) return notFound("ขั้นตอน");
        const owner = personRef(body?.ownerUserId);
        if (!owner) return notFound("ผู้รับผิดชอบ");
        task.owner = owner;
        return checklist;
      }),
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}/tasks/{taskKey}/evidence",
    { permission: "close.manage", idempotent: true, status: 201 },
    ({ params, body }) =>
      withChecklist(params.period, (checklist) => {
        const refused = editable(checklist);
        if (refused) return refused;
        const task = taskOf(checklist, params.taskKey);
        if (!task) return notFound("ขั้นตอน");
        if (!body?.fileId || !body.description?.trim())
          return invalid([{ path: "description", code: "required", message: "ระบุว่าหลักฐานแสดงอะไร" }]);
        const name = fileNameOf(body.fileId);
        if (!name) return notFound("ไฟล์");
        task.evidence = [...task.evidence, { fileId: body.fileId, name: `${body.description.trim()} (${name})` }];
        return checklist;
      }),
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}/actions/submit",
    { permission: "close.manage", idempotent: true },
    ({ params, persona }) =>
      withChecklist(params.period, (checklist) => {
        const refused = editable(checklist);
        if (refused) return refused;
        const openTasks = checklist.tasks.filter(
          (task) => task.key !== "review" && !["done", "waived"].includes(task.status),
        );
        if (openTasks.length)
          return problem(
            409,
            "close.tasks_open",
            `ยังมีขั้นตอนที่ไม่เสร็จ: ${openTasks.map((task) => task.stepNo).join(", ")}`,
          );
        const period = periodOfMonth(checklist.period)!;
        if (period.status === "open") {
          const moved = transitionPeriod(period, "soft-close");
          if (moved instanceof Response) return moved;
        }
        Object.assign(checklist, {
          status: "in_review",
          submittedAt: bangkokIso(),
          submittedBy: personRef(persona.id),
          submittedById: persona.id,
        });
        return checklist;
      }),
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}/actions/approve",
    { permission: "close.approve", idempotent: true },
    ({ params, body, persona }) =>
      withChecklist(params.period, (checklist) => {
        if (checklist.status !== "in_review")
          return problem(409, "close.checklist_not_in_review", "รายการตรวจปิดงวดยังไม่ได้ส่งตรวจ");
        if (checklist.submittedById === persona.id)
          return problem(409, "iam.sod_conflict", "ผู้ส่งรายการตรวจปิดงวดอนุมัติเองไม่ได้");
        const review = taskOf(checklist, "review")!;
        Object.assign(review, {
          status: "done",
          note: body?.note ?? null,
          completedAt: bangkokIso(),
          completedBy: personRef(persona.id),
        });
        const moved = transitionPeriod(periodOfMonth(checklist.period)!, "close");
        if (moved instanceof Response) {
          Object.assign(review, { status: "pending", note: null, completedAt: null, completedBy: null });
          return moved;
        }
        Object.assign(checklist, { status: "closed", closedAt: bangkokIso(), closedBy: personRef(persona.id) });
        return checklist;
      }),
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}/actions/return",
    { permission: "close.approve", idempotent: true },
    ({ params, body }) =>
      withChecklist(params.period, (checklist) => {
        if (checklist.status !== "in_review")
          return problem(409, "close.checklist_not_in_review", "รายการตรวจปิดงวดยังไม่ได้ส่งตรวจ");
        if (!body?.reason || body.reason.trim().length < 3)
          return invalid([{ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" }]);
        const period = periodOfMonth(checklist.period)!;
        if (period.status === "soft_closed") transitionPeriod(period, "reopen");
        Object.assign(checklist, { status: "open", submittedAt: null, submittedBy: null, submittedById: null });
        return checklist;
      }),
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}/actions/sign-off",
    { permission: "close.audit_sign_off", idempotent: true },
    ({ params }) =>
      withChecklist(params.period, (checklist) => {
        if (checklist.status !== "closed") return problem(409, "close.checklist_not_closed", "ลงนามได้เมื่อปิดงวดแล้ว");
        checklist.auditorSignedOffAt ??= bangkokIso();
        return checklist;
      }),
  ),
  finance.post(
    "/v1/admin/close-checklists/{period}/actions/lock",
    { permission: "close.approve", idempotent: true },
    ({ params }) =>
      withChecklist(params.period, (checklist) => {
        const moved = transitionPeriod(periodOfMonth(checklist.period)!, "lock");
        if (moved instanceof Response) return moved;
        Object.assign(checklist, { status: "locked", lockedAt: bangkokIso() });
        return checklist;
      }),
  ),

  finance.get("/v1/admin/financial-reports/trial-balance", "ledger.read", ({ query }) =>
    range(query.from, query.to)
      ? trialBalance(String(query.from), String(query.to), String(query.includeZero) === "true")
      : invalid([{ path: "from", code: "range", message: "YYYY-MM ถึง YYYY-MM" }]),
  ),
  finance.get("/v1/admin/financial-reports/gl-detail", "ledger.read", ({ query }) => {
    if (!range(query.from, query.to) || !query.accountCode)
      return invalid([{ path: "from", code: "range", message: "YYYY-MM ถึง YYYY-MM และบัญชี" }]);
    return glDetail(
      String(query.accountCode),
      String(query.from),
      String(query.to),
      Number(query.page ?? 1),
      Math.min(200, Number(query.perPage ?? 50)),
    );
  }),
  finance.get("/v1/admin/financial-reports/balance-sheet", "ledger.read", ({ query }) =>
    typeof query.asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.asOf)
      ? balanceSheet(query.asOf)
      : invalid([{ path: "asOf", code: "date", message: "YYYY-MM-DD" }]),
  ),
  finance.get("/v1/admin/financial-reports/profit-and-loss", "ledger.read", ({ query }) =>
    range(query.from, query.to)
      ? profitAndLoss(
          String(query.from),
          String(query.to),
          (query.dimension ?? "none") as Schemas["ProfitAndLossDimension"],
        )
      : invalid([{ path: "from", code: "range", message: "YYYY-MM ถึง YYYY-MM" }]),
  ),
  finance.get("/v1/admin/financial-reports/cash-flow", "ledger.read", ({ query }) =>
    range(query.from, query.to)
      ? cashFlow(String(query.from), String(query.to))
      : invalid([{ path: "from", code: "range", message: "YYYY-MM ถึง YYYY-MM" }]),
  ),
  // admin.financialReports.accountRollForward: the roll-forward accounts only (2330, 2130).
  finance.get("/v1/admin/financial-reports/roll-forward", "ledger.read", ({ query }) => {
    const accountCode = String(query.accountCode ?? "");
    if (!["2330", "2130"].includes(accountCode) || !range(query.from, query.to))
      return invalid([{ path: "accountCode", code: "enum", message: "2330 หรือ 2130 และช่วงเดือน" }]);
    return accountRollForward(accountCode, String(query.from), String(query.to));
  }),
  // admin.financialReports.subledgerReconciliation: the sub-ledgers as of now; `period` moves the fixed-asset row.
  finance.get("/v1/admin/financial-reports/subledger-reconciliation", "ledger.read", ({ query }) => {
    const period = query.period ?? previousMonth();
    return { asOf: bangkokIso(), period, rows: subledgerRows(period) };
  }),

  finance.get("/v1/admin/audit/exceptions", "audit_support.read", ({ query }) =>
    monthOk(query.period)
      ? exceptions(query.period)
      : invalid([{ path: "period", code: "pattern", message: "YYYY-MM" }]),
  ),
  finance.get("/v1/admin/audit/samples", "audit_support.read", () => samples),
  finance.post(
    "/v1/admin/audit/samples",
    { permission: "audit_support.sample", idempotent: true, status: 201 },
    ({ body }) => {
      if (!body || !monthOk(body.period)) return invalid([{ path: "period", code: "pattern", message: "YYYY-MM" }]);
      if (!Number.isInteger(body.size) || body.size < 1 || body.size > 500)
        return invalid([{ path: "size", code: "range", message: "1–500" }]);
      if (body.seed !== undefined && !/^[0-9]{1,15}$/.test(body.seed))
        return invalid([{ path: "seed", code: "pattern", message: "ตัวเลขไม่เกิน 15 หลัก" }]);
      const sample: Schemas["AuditSampleDto"] = {
        id: mockId("smp", samples.length + 1),
        createdAt: bangkokIso(),
        ...drawSample(body, body.seed),
      };
      samples.unshift(sample);
      return sample;
    },
  ),
  finance.get("/v1/admin/audit/pbc-exports", "audit_support.export", () => pbcExports.map(pbcRow)),
  finance.post(
    "/v1/admin/audit/pbc-exports",
    { permission: "audit_support.export", idempotent: true, status: 201 },
    async ({ body, persona }) => {
      if (!body || !monthOk(body.period)) return invalid([{ path: "period", code: "pattern", message: "YYYY-MM" }]);
      const csv = pbcPack(body.period, persona.displayName);
      const row = {
        id: mockId("pbc", pbcExports.length + 1),
        period: body.period,
        generatedAt: bangkokIso(),
        sha256: await sha256(csv),
        csv,
      };
      pbcExports.unshift(row);
      return pbcRow(row);
    },
  ),
  finance.get("/v1/admin/audit/pbc-exports/{exportId}/file", "audit_support.export", ({ params }) => {
    const row = pbcExports.find((item) => item.id === params.exportId);
    if (!row) return notFound("ชุดเอกสาร PBC");
    return { url: `data:text/csv;charset=utf-8,${encodeURIComponent(row.csv)}`, expiresAt: bangkokIso(15) };
  }),
];
