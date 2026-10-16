/**
 * The general ledger (getpack-api B5.1, published): journals with their lines, manual / recurring /
 * reversing entries under maker-checker (§8, D-169), the chart of accounts and its changes, cost
 * centres, the posting rules with their versions and a preview, and the fiscal periods
 * `open → soft_closed → closed → locked` (§1.4).
 *
 * A manual journal is a draft its maker edits under `If-Match`, submits, and a Finance Manager
 * other than the maker approves — only then is it posted, with a JV number, into its own period or,
 * when that is closed, the next open one. Rule changes, account changes and recurring definitions
 * go through their approval policies the same way.
 */

import { HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../../support";
import { baht } from "../commerce";
import { onApprovalDecided, openApproval } from "../platform";
import {
  ACCOUNTS,
  fiscalYears,
  journals,
  movement,
  periodOfDate,
  post,
  postingPeriod,
  previousMonth,
  satangOf,
  toLines,
  today,
  type PostLine,
} from "./books";
import { finance, invalid, isMoney, notFound } from "./support";

type Journal = Schemas["JournalDto"];
type Rule = Schemas["PostingRuleDto"];
type Period = Schemas["FiscalPeriodDto"];

/* --------------------------------------------------------------------------- manual journals */

const drafts = new Map<string, { journal: Journal; version: number; makerId: string }>();
let jvSeq = 0;
/** `JV256909-00001`: type, Buddhist-era year and month, then the sequence (§4). */
const jvNumberOf = (date: string) =>
  `JV${Number(date.slice(0, 4)) + 543}${date.slice(5, 7)}-${String(++jvSeq).padStart(5, "0")}`;
let draftSeq = 0;

function manualLines(lines: Schemas["ManualJournalLineDto"][]): PostLine[] {
  return lines.map((line) => ({
    account: line.accountCode,
    [line.side]: satangOf(line.amount),
    description: line.description ?? null,
    dimensions: line.dimensions,
  }));
}

/** `cost_centre` → `costCentre`: the account's dimension names are snake case, a line's camel case. */
const dimensionKey = (dimension: string) =>
  dimension.replace(/_(\w)/g, (_, letter: string) => letter.toUpperCase()) as keyof Schemas["JournalLineDimensionsDto"];

/** §3: postable, active, not a control account; the dimensions each account requires. */
function checkManual(body: Schemas["ManualJournalDto"]) {
  const errors: { path: string; code: string; message: string }[] = [];
  if (!body.description?.trim()) errors.push({ path: "description", code: "required", message: "ระบุคำอธิบาย" });
  if (!body.documentDate) errors.push({ path: "documentDate", code: "required", message: "ระบุวันที่เอกสาร" });
  if (!body.lines || body.lines.length < 2)
    errors.push({ path: "lines", code: "min", message: "ต้องมีอย่างน้อยสองบรรทัด" });
  (body.lines ?? []).forEach((line, index) => {
    const account = ACCOUNTS.find((item) => item.code === line.accountCode);
    if (!account || !account.isPostable || account.status !== "active")
      errors.push({
        path: `lines[${index}].accountCode`,
        code: "ledger.account_invalid",
        message: "บัญชีนี้บันทึกไม่ได้",
      });
    else if (account.isControl)
      errors.push({
        path: `lines[${index}].accountCode`,
        code: "ledger.account_invalid",
        message: "บัญชีคุมรับเฉพาะรายการจากระบบย่อย",
      });
    else
      for (const dimension of account.requiredDimensions)
        if (!line.dimensions?.[dimensionKey(dimension)])
          errors.push({
            path: `lines[${index}].dimensions`,
            code: "required",
            message: `บัญชีนี้ต้องระบุ ${dimension}`,
          });
    if (!isMoney(line.amount) || satangOf(line.amount) <= 0)
      errors.push({ path: `lines[${index}].amount`, code: "min", message: "จำนวนเงินต้องมากกว่า 0" });
  });
  if (errors.length) return invalid(errors);
  const debit = body.lines
    .filter((line) => line.side === "debit")
    .reduce((sum, line) => sum + satangOf(line.amount), 0);
  const credit = body.lines
    .filter((line) => line.side === "credit")
    .reduce((sum, line) => sum + satangOf(line.amount), 0);
  if (debit !== credit)
    return problem(422, "ledger.unbalanced", `เดบิต ${baht(debit)} ไม่เท่ากับเครดิต ${baht(credit)}`, [
      { path: "lines", code: "ledger.unbalanced", message: "ยอดเดบิตและเครดิตต้องเท่ากัน" },
    ]);
  return null;
}

function draftOf(body: Schemas["ManualJournalDto"], makerId: string, existing?: Journal): Journal {
  const lines = manualLines(body.lines);
  // A draft sits in its own period; where it posts is decided at approval (§1.4).
  const period = periodOfDate(body.documentDate) ?? postingPeriod(body.documentDate);
  const journal: Journal = {
    id: existing?.id ?? mockId("jnd", ++draftSeq),
    entryNo: null,
    jvNumber: null,
    kind: existing?.kind ?? "manual",
    status: "draft",
    description: body.description.trim(),
    documentDate: body.documentDate,
    entryDate: body.documentDate,
    periodId: period.id,
    currency: "THB",
    postingRule: null,
    postingRuleVersion: null,
    source: null,
    domainEventId: null,
    createdBy: makerId,
    approvedBy: null,
    approvalRequestId: null,
    autoReverseOn: body.autoReverseOn ?? null,
    postedAt: null,
    rejectionReason: null,
    reversesId: existing?.reversesId ?? null,
    reversedById: null,
    totalDebit: baht(lines.reduce((sum, line) => sum + (line.debit ?? 0), 0)),
    totalCredit: baht(lines.reduce((sum, line) => sum + (line.credit ?? 0), 0)),
    lines: toLines(lines),
  };
  return journal;
}

const etagOfDraft = (entry: { journal: Journal; version: number }) => `W/"${entry.journal.id}-${entry.version}"`;

const allJournals = () => [...journals, ...[...drafts.values()].map((entry) => entry.journal)];
const findJournal = (id: string | undefined) => allJournals().find((journal) => journal.id === id);

onApprovalDecided("manual_journal", (approval, outcome, decider) => {
  const entry = [...drafts.values()].find((item) => item.journal.approvalRequestId === approval.id);
  if (!entry) return;
  if (outcome === "rejected") {
    Object.assign(entry.journal, { status: "rejected", rejectionReason: approval.actions.at(-1)?.comment ?? null });
    return;
  }
  const draft = entry.journal;
  drafts.delete(draft.id);
  // Into its own period when open, otherwise the next open one with the document date kept (§1.4).
  const period = postingPeriod(draft.documentDate);
  const jvNumber = jvNumberOf(period.startDate < draft.documentDate ? draft.documentDate : period.startDate);
  const posted = post({
    rule: null,
    kind: draft.kind,
    jvNumber,
    description: draft.description,
    documentDate: draft.documentDate,
    source: draft.reversesId ? (findJournal(draft.reversesId)?.source ?? null) : null,
    createdBy: entry.makerId,
    approvedBy: decider.id,
    approvalRequestId: approval.id,
    reversesId: draft.reversesId,
    autoReverseOn: draft.autoReverseOn,
    lines: draft.lines.map((line) => ({
      account: line.accountCode,
      debit: satangOf(line.debit),
      credit: satangOf(line.credit),
      description: line.description,
      dimensions: line.dimensions,
      taxCode: line.taxCode,
      taxBase: line.taxBaseAmount === null ? undefined : satangOf(line.taxBaseAmount),
    })),
  });
  // Keep the id the maker has been looking at: the draft becomes the posted entry.
  const index = journals.indexOf(posted);
  journals[index] = { ...posted, id: draft.id };
  if (draft.reversesId) {
    const original = journals.find((journal) => journal.id === draft.reversesId);
    if (original) original.reversedById = draft.id;
  }
});

/* ------------------------------------------------------------------------- account changes */

const accountChanges: Schemas["AccountChangeDto"][] = [];

onApprovalDecided("coa_change", (approval, outcome) => {
  const change = accountChanges.find((item) => item.id === approval.subjectId);
  if (!change) return;
  change.status = outcome === "approved" ? "approved" : "rejected";
  if (outcome !== "approved") return;
  const fields = change.proposed;
  if (change.kind === "create") {
    ACCOUNTS.push({
      id: mockId("acc", 500 + ACCOUNTS.length),
      code: fields.code!,
      nameTh: fields.nameTh ?? fields.code!,
      nameEn: fields.nameEn ?? fields.code!,
      accountType: fields.accountType ?? "expense",
      cashFlowClass: fields.cashFlowClass ?? "operating",
      normalSide: fields.normalSide ?? "debit",
      isControl: fields.isControl ?? false,
      isPostable: fields.isPostable ?? true,
      parentCode: fields.parentCode ?? null,
      requiredDimensions: fields.requiredDimensions ?? [],
      allowedDimensions: fields.allowedDimensions ?? ACCOUNTS[1]!.allowedDimensions,
      status: "active",
    });
    return;
  }
  const account = ACCOUNTS.find((item) => item.code === change.accountCode);
  if (!account) return;
  if (change.kind === "deactivate") account.status = "inactive";
  else if (change.kind === "reactivate") account.status = "active";
  else
    Object.assign(
      account,
      Object.fromEntries(Object.entries(fields).filter(([key, value]) => key !== "code" && value !== undefined)),
    );
});

const costCentres: Schemas["CostCentreDto"][] = [
  { id: mockId("cc", 1), code: "SALES", name: "ฝ่ายขายและบริการลูกค้า", status: "active" },
  { id: mockId("cc", 2), code: "OPS", name: "ปฏิบัติการและโลจิสติกส์", status: "active" },
  { id: mockId("cc", 3), code: "ADMIN", name: "บริหารและการเงิน", status: "active" },
  { id: mockId("cc", 4), code: "MKT", name: "การตลาด", status: "active" },
];

/* ---------------------------------------------------------------------------- posting rules */

type Template = {
  description: string;
  lines: { account: unknown; side: "debit" | "credit"; amount: string; taxCode?: string; taxBase?: string }[];
};

const RULE_SEEDS: [key: string, eventType: string, name: string, decisions: string[], lines: Template["lines"]][] = [
  [
    "P01",
    "customer_document.issued",
    "Instalment paid by gateway — TR",
    ["D-020", "D-033"],
    [
      {
        account: { switch: "receiptVia", cases: { twoc2p: "1131", scb: "1132" } },
        side: "debit",
        amount: "grossAmount",
      },
      { account: "2310", side: "credit", amount: "netAmount" },
      { account: "2210", side: "credit", amount: "vatAmount", taxCode: "output_vat", taxBase: "netAmount" },
    ],
  ],
  [
    "P02",
    "customer_document.issued",
    "Instalment paid by verified slip — TR",
    ["D-061"],
    [
      { account: "1133", side: "debit", amount: "grossAmount" },
      { account: "2310", side: "credit", amount: "netAmount" },
      { account: "2210", side: "credit", amount: "vatAmount", taxCode: "output_vat", taxBase: "netAmount" },
    ],
  ],
  [
    "P04",
    "gateway_settlement.matched",
    "Gateway settlement arrives in bank",
    ["D-093"],
    [
      { account: { path: "bankAccountCode" }, side: "debit", amount: "netAmount" },
      { account: "6110", side: "debit", amount: "feeAmount" },
      { account: "1241", side: "debit", amount: "vatOnFee", taxCode: "input_vat", taxBase: "feeAmount" },
      {
        account: { switch: "provider", cases: { twoc2p: "1131", scb: "1132" } },
        side: "credit",
        amount: "grossAmount",
      },
    ],
  ],
  [
    "P05",
    "bank_line.matched",
    "Slip transfer matched to the bank statement",
    ["D-061"],
    [
      { account: { path: "bankAccountCode" }, side: "debit", amount: "amount" },
      { account: "1133", side: "credit", amount: "amount" },
    ],
  ],
  [
    "P06",
    "customer_document.issued",
    "Delivery confirmed — final TR, revenue",
    ["D-010", "D-033"],
    [
      { account: "2310", side: "debit", amount: "appliedNet" },
      { account: "1210", side: "debit", amount: "remainingGross" },
      { account: "4110", side: "credit", amount: "revenueNet" },
      { account: "2210", side: "credit", amount: "remainingVat", taxCode: "output_vat", taxBase: "remainingNet" },
    ],
  ],
  [
    "P07",
    "customer_document.issued",
    "Credit-term invoice at delivery",
    ["D-121", "D-125"],
    [
      { account: "1210", side: "debit", amount: "grossAmount" },
      { account: "4110", side: "credit", amount: "netAmount" },
      { account: "2211", side: "credit", amount: "vatAmount", taxCode: "output_vat_not_due", taxBase: "netAmount" },
    ],
  ],
  [
    "P08",
    "customer_document.issued",
    "Collection of a credit-term invoice — RC",
    ["D-122"],
    [
      { account: { path: "bankAccountCode" }, side: "debit", amount: "cashAmount" },
      { account: "1230", side: "debit", amount: "whtAmount", taxCode: "wht_receivable", taxBase: "netAmount" },
      { account: "1210", side: "credit", amount: "grossAmount" },
      { account: "2211", side: "debit", amount: "vatAmount", taxCode: "output_vat_not_due" },
      { account: "2210", side: "credit", amount: "vatAmount", taxCode: "output_vat", taxBase: "netAmount" },
    ],
  ],
  [
    "P14",
    "payout_item.paid",
    "Advance payout to a factory",
    ["D-022"],
    [
      { account: "1250", side: "debit", amount: "netAmount" },
      {
        account: { switch: "vatClaimable", cases: { true: "1241", false: "1242" } },
        side: "debit",
        amount: "vatAmount",
      },
      { account: { path: "bankAccountCode" }, side: "credit", amount: "cashAmount" },
      { account: "2231", side: "credit", amount: "whtAmount", taxCode: "wht_pnd53", taxBase: "whtBase" },
    ],
  ],
  [
    "P15",
    "goods_receipt.recorded",
    "Delivery confirmed — goods receipt",
    ["D-165"],
    [
      { account: "5110", side: "debit", amount: "productionNet" },
      { account: "5120", side: "debit", amount: "shippingNet" },
      { account: "2110", side: "credit", amount: "netAmount" },
    ],
  ],
  [
    "P16",
    "goods_receipt.recorded",
    "Apply the advance to the payable",
    ["D-022"],
    [
      { account: "2110", side: "debit", amount: "advanceNet" },
      { account: "1250", side: "credit", amount: "advanceNet" },
    ],
  ],
  [
    "P17",
    "payout_item.paid",
    "Final payout after the claim window",
    ["D-022", "D-164"],
    [
      { account: "2110", side: "debit", amount: "netAmount" },
      {
        account: { switch: "vatClaimable", cases: { true: "1241", false: "1242" } },
        side: "debit",
        amount: "vatAmount",
      },
      { account: { path: "bankAccountCode" }, side: "credit", amount: "cashAmount" },
      { account: "2231", side: "credit", amount: "whtAmount", taxCode: "wht_pnd53", taxBase: "whtBase" },
      { account: "2130", side: "credit", amount: "retentionAmount" },
    ],
  ],
  [
    "P18",
    "payout_item.paid",
    "Retention released",
    ["D-164"],
    [
      { account: "2130", side: "debit", amount: "netAmount" },
      { account: { path: "bankAccountCode" }, side: "credit", amount: "cashAmount" },
      { account: "2231", side: "credit", amount: "whtAmount", taxCode: "wht_pnd53", taxBase: "netAmount" },
    ],
  ],
  [
    "P19",
    "customer_document.issued",
    "Quantity shortage within tolerance — CN",
    ["D-021", "D-080"],
    [
      { account: "4920", side: "debit", amount: "netAmount" },
      { account: "2210", side: "debit", amount: "vatAmount", taxCode: "output_vat" },
      {
        account: { switch: "settleTo", cases: { store_credit: "2320", receivable: "1210" } },
        side: "credit",
        amount: "grossAmount",
      },
    ],
  ],
  [
    "P22",
    "refund.succeeded",
    "Refund",
    ["D-169"],
    [
      { account: "2320", side: "debit", amount: "amount" },
      {
        account: { switch: "channel", cases: { original_gateway: "1131", bank_transfer: "1121" } },
        side: "credit",
        amount: "amount",
      },
    ],
  ],
  [
    "P25",
    "vendor_invoice.recorded",
    "Other vendor's bill",
    ["D-013"],
    [
      { account: { path: "lineAccountCode" }, side: "debit", amount: "netAmount" },
      { account: "1241", side: "debit", amount: "vatAmount", taxCode: "input_vat", taxBase: "netAmount" },
      { account: "2120", side: "credit", amount: "grossAmount" },
    ],
  ],
  [
    "P27",
    "tax_report.finalised",
    "Month-end VAT close (ภ.พ.30)",
    ["D-033"],
    [
      { account: "2210", side: "debit", amount: "outputVat" },
      { account: "1241", side: "credit", amount: "inputVat" },
      { account: "2220", side: "credit", amount: "netPayable" },
    ],
  ],
  [
    "P28",
    "tax_report.paid",
    "WHT remittance (ภ.ง.ด.3 / 53)",
    ["D-033"],
    [
      { account: { switch: "whtForm", cases: { pnd53: "2231", pnd3: "2232" } }, side: "debit", amount: "amount" },
      { account: { path: "bankAccountCode" }, side: "credit", amount: "amount" },
    ],
  ],
  [
    "P29",
    "bank_line.unidentified",
    "Unidentified receipt",
    ["D-061"],
    [
      { account: { path: "bankAccountCode" }, side: "debit", amount: "amount" },
      { account: "1140", side: "credit", amount: "amount" },
    ],
  ],
  [
    "P30",
    "receivable.allowance",
    "Bad-debt allowance / write-off",
    ["D-033"],
    [
      { account: "6130", side: "debit", amount: "amount" },
      { account: "1219", side: "credit", amount: "amount" },
    ],
  ],
];

const rules: Rule[] = RULE_SEEDS.map(([key, eventType, name, decisions, lines], index) => ({
  id: mockId("prl", index + 1),
  key,
  eventType,
  name,
  description: `${name} (accounting-design §5 ${key})`,
  decisionRefs: decisions,
  versions: [
    {
      id: mockId("prv", index + 1),
      versionNo: 1,
      status: "approved",
      effectiveFrom: "2026-09-22T00:00:00+07:00",
      reason: "ชุดกฎตั้งต้นตาม accounting-design §5 (⚖ รอผู้สอบบัญชียืนยัน)",
      approvalRequestId: null,
      conditions: null,
      template: { description: name, lines } as Record<string, unknown>,
    },
  ],
}));

function readPath(payload: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, part) => (value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined),
      payload,
    );
}

function accountOfSelector(selector: unknown, payload: Record<string, unknown>): string | null {
  if (typeof selector === "string") return selector;
  if (selector && typeof selector === "object") {
    const s = selector as { path?: string; switch?: string; cases?: Record<string, unknown>; default?: unknown };
    if (s.path) return String(readPath(payload, s.path) ?? "") || null;
    if (s.switch) {
      const value = String(readPath(payload, s.switch));
      return accountOfSelector(s.cases?.[value] ?? s.default, payload);
    }
  }
  return null;
}

/** Renders a template on a sample payload, the way the engine does (ADR-0007), without posting. */
function preview(
  rule: Rule,
  versionNo: number | undefined,
  payload: Record<string, unknown>,
): Schemas["RulePreviewDto"] | Response {
  const version = versionNo
    ? rule.versions.find((item) => item.versionNo === versionNo)
    : rule.versions.filter((item) => item.status === "approved").at(-1);
  if (!version) return notFound("ฉบับของกฎ");
  const template = version.template as unknown as Template;
  const lines: Schemas["PreviewLineDto"][] = [];
  for (const line of template.lines ?? []) {
    const raw = readPath(payload, line.amount);
    const amount =
      typeof raw === "string" && isMoney(raw) ? raw : typeof raw === "number" ? baht(Math.round(raw * 100)) : "0.00";
    if (amount === "0.00") continue;
    const account = accountOfSelector(line.account, payload);
    if (!account)
      return invalid([
        { path: "payload", code: "ledger.rule_invalid", message: `เลือกบัญชีของบรรทัดไม่ได้จาก payload` },
      ]);
    const base = line.taxBase ? readPath(payload, line.taxBase) : null;
    lines.push({
      accountCode: account,
      side: line.side,
      amount,
      taxCode: (line.taxCode as Schemas["TaxCode"]) ?? null,
      taxBase: typeof base === "string" && isMoney(base) ? base : null,
    });
  }
  const sum = (side: "debit" | "credit") =>
    lines.filter((line) => line.side === side).reduce((total, line) => total + satangOf(line.amount), 0);
  return {
    key: rule.key,
    versionNo: version.versionNo,
    applies: version.conditions === null || version.conditions === undefined,
    description: template.description ?? rule.name,
    lines,
    totalDebit: baht(sum("debit")),
    totalCredit: baht(sum("credit")),
    balanced: sum("debit") === sum("credit") && lines.length > 0,
  };
}

onApprovalDecided("posting_rule_change", (approval, outcome) => {
  for (const rule of rules) {
    const version = rule.versions.find((item) => item.id === approval.subjectId);
    if (!version) continue;
    version.status = outcome === "approved" ? "approved" : "rejected";
    return;
  }
});

/* ------------------------------------------------------------------------- recurring journals */

/** The first `dayOfMonth` on or after `from` (days 1–28 exist in every month). */
function nextRun(dayOfMonth: number, from: string): string {
  const day = String(dayOfMonth).padStart(2, "0");
  const same = `${from.slice(0, 8)}${day}`;
  if (same >= from) return same;
  const [year, month] = from.split("-").map(Number) as [number, number];
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 8);
  return `${next}${day}`;
}

const recurring: Schemas["RecurringJournalDto"][] = [
  {
    id: mockId("rcj", 1),
    name: "ตั้งค้างจ่ายค่าบริการระบบรายเดือน (ข้อมูลจำลอง)",
    description: "ค่าบริการคลาวด์และระบบรายเดือนที่ยังไม่ได้รับบิล",
    dayOfMonth: 28,
    startOn: `${previousMonth()}-28`,
    endOn: null,
    autoReverse: true,
    nextRunOn: `${previousMonth()}-28`,
    status: "active",
    approvalRequestId: null,
    lines: [
      {
        accountCode: "6900",
        side: "debit",
        amount: "12000.00",
        description: "ค่าบริการระบบ",
        dimensions: { costCentre: "ADMIN" },
      },
      { accountCode: "2410", side: "credit", amount: "12000.00", description: "ค่าใช้จ่ายค้างจ่าย" },
    ],
  },
];

/**
 * The monthly job (getpack-api `ledger.jobs`): every active definition whose run date has come
 * posts once, with its reversal on the first day of the next month when it auto-reverses.
 */
export function runRecurring(until = today()) {
  for (const item of recurring) {
    while (item.status === "active" && item.nextRunOn <= until && (!item.endOn || item.nextRunOn <= item.endOn)) {
      const lines = manualLines(item.lines);
      const [year, month] = item.nextRunOn.split("-").map(Number) as [number, number];
      const firstOfNext = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
      const posted = post({
        rule: null,
        kind: "recurring",
        jvNumber: jvNumberOf(item.nextRunOn),
        description: `${item.name} — ${item.nextRunOn.slice(0, 7)}`,
        documentDate: item.nextRunOn,
        source: null,
        lines,
        autoReverseOn: item.autoReverse ? firstOfNext : null,
      });
      if (item.autoReverse && firstOfNext <= until) {
        const reversal = post({
          rule: null,
          kind: "reversal",
          jvNumber: jvNumberOf(firstOfNext),
          description: `กลับรายการอัตโนมัติ ${posted.entryNo}`,
          documentDate: firstOfNext,
          source: null,
          reversesId: posted.id,
          lines: lines.map((line) => ({ ...line, debit: line.credit, credit: line.debit })),
        });
        posted.reversedById = reversal.id;
      }
      item.nextRunOn = nextRun(item.dayOfMonth, firstOfNext);
    }
    if (item.endOn && item.nextRunOn > item.endOn && item.status === "active") item.status = "ended";
  }
}
runRecurring();

onApprovalDecided("recurring_journal", (approval, outcome) => {
  const item = recurring.find((entry) => entry.id === approval.subjectId);
  if (!item) return;
  item.status = outcome === "approved" ? "active" : "rejected";
  if (outcome === "approved") runRecurring();
});

/* ------------------------------------------------------------------------------ periods */

const TRANSITIONS: Record<string, { from: Period["status"]; to: Period["status"] }> = {
  "soft-close": { from: "open", to: "soft_closed" },
  reopen: { from: "soft_closed", to: "open" },
  close: { from: "soft_closed", to: "closed" },
  lock: { from: "closed", to: "locked" },
};

/**
 * Closing or locking is gated by the month's close checklist (§7) — the close module registers
 * the gate, as `PERIOD_CLOSE_GATE` does in getpack-api; the ledger alone does not depend on it.
 */
let closeGate: ((period: Period, to: Period["status"]) => Response | null) | null = null;
export function registerCloseGate(gate: typeof closeGate) {
  closeGate = gate;
}

const sortedPeriods = () =>
  fiscalYears.flatMap((year) => year.periods).sort((a, b) => a.startDate.localeCompare(b.startDate));

/** `open ⇄ soft_closed → closed → locked`, in sequence; a closed month never reopens (§1.4). */
export function transitionPeriod(period: Period, action: string): Period | Response {
  const step = TRANSITIONS[action];
  const refuse = () => problem(409, "ledger.period_transition", `งวดนี้ ${action} จากสถานะ ${period.status} ไม่ได้`);
  if (!step || period.status !== step.from) return refuse();
  const periods = sortedPeriods();
  if (
    step.to === "open" &&
    periods.some((p) => p.startDate > period.startDate && ["closed", "locked"].includes(p.status))
  )
    return refuse();
  const blocking = step.to === "closed" ? ["open", "soft_closed"] : ["open", "soft_closed", "closed"];
  if (
    ["closed", "locked"].includes(step.to) &&
    periods.some((p) => p.startDate < period.startDate && blocking.includes(p.status))
  )
    return refuse();
  if (closeGate && ["closed", "locked"].includes(step.to)) {
    const refused = closeGate(period, step.to);
    if (refused) return refused;
  }
  Object.assign(period, { status: step.to, statusChangedAt: bangkokIso() });
  return period;
}

/* ---------------------------------------------------------------------------- handlers */

const periodById = (id: string | undefined) => fiscalYears.flatMap((year) => year.periods).find((p) => p.id === id);

export const ledgerHandlers = [
  finance.get("/v1/admin/ledger/journals", "ledger.read", ({ query }) => {
    const rows = allJournals()
      .filter((j) => !query.status || j.status === query.status)
      .filter((j) => !query.kind || j.kind === query.kind)
      .filter((j) => !query.periodId || j.periodId === query.periodId)
      .filter((j) => !query.sourceType || j.source?.type === query.sourceType)
      .filter((j) => !query.sourceId || j.source?.id === query.sourceId)
      .filter((j) => !query.domainEventId || j.domainEventId === query.domainEventId)
      .filter((j) => !query.accountCode || j.lines.some((line) => line.accountCode === query.accountCode))
      .filter((j) => !query.from || j.entryDate >= query.from)
      .filter((j) => !query.to || j.entryDate <= query.to)
      .filter((j) => matchesQuery(query.q, j.entryNo, j.jvNumber, j.description, j.source?.number, j.postingRule));
    return paginate(sortBy(rows, query.sort ?? "entryDate", query.order ?? "desc"), query);
  }),
  finance.get("/v1/admin/ledger/journals/{journalId}", "ledger.read", ({ params }) => {
    const draft = drafts.get(params.journalId!);
    if (draft) return HttpResponse.json(draft.journal, { headers: { etag: etagOfDraft(draft) } });
    return findJournal(params.journalId) ?? notFound("รายการบัญชี");
  }),
  finance.post(
    "/v1/admin/ledger/journals",
    { permission: "ledger.journals.manage", status: 201 },
    ({ body, persona }) => {
      const refused = checkManual(body);
      if (refused) return refused;
      const journal = draftOf(body, persona.id);
      drafts.set(journal.id, { journal, version: 1, makerId: persona.id });
      return journal;
    },
  ),
  finance.put(
    "/v1/admin/ledger/journals/{journalId}",
    { permission: "ledger.journals.manage" },
    ({ params, body, persona, request }) => {
      const entry = drafts.get(params.journalId!);
      if (!entry) return problem(409, "ledger.journal_not_editable", "แก้ไขได้เฉพาะฉบับร่าง");
      if (entry.makerId !== persona.id) return problem(403, "auth.forbidden", "ผู้จัดทำเท่านั้นที่แก้ไขฉบับร่างได้");
      if (entry.journal.status !== "draft")
        return problem(409, "ledger.journal_not_editable", "ส่งอนุมัติแล้ว แก้ไขไม่ได้");
      const match = request.headers.get("if-match");
      if (!match) return problem(428, "concurrency.precondition_required", "ต้องส่ง If-Match");
      if (match !== etagOfDraft(entry))
        return problem(412, "concurrency.stale", "มีผู้แก้ไขฉบับร่างนี้ไปแล้ว โหลดใหม่ก่อน");
      const refused = checkManual(body);
      if (refused) return refused;
      entry.journal = draftOf(body, persona.id, entry.journal);
      entry.version += 1;
      return HttpResponse.json(entry.journal, { headers: { etag: etagOfDraft(entry) } });
    },
  ),
  finance.delete(
    "/v1/admin/ledger/journals/{journalId}",
    { permission: "ledger.journals.manage", status: 204 },
    ({ params, persona }) => {
      const entry = drafts.get(params.journalId!);
      if (!entry || entry.journal.status !== "draft")
        return problem(409, "ledger.journal_not_editable", "ลบได้เฉพาะฉบับร่างที่ยังไม่ส่ง");
      if (entry.makerId !== persona.id) return problem(403, "auth.forbidden", "ผู้จัดทำเท่านั้นที่ลบฉบับร่างได้");
      drafts.delete(entry.journal.id);
      return undefined;
    },
  ),
  finance.post(
    "/v1/admin/ledger/journals/{journalId}/actions/submit",
    { permission: "ledger.journals.manage", idempotent: true },
    ({ params, persona }) => {
      const entry = drafts.get(params.journalId!);
      if (!entry || entry.journal.status !== "draft")
        return problem(409, "ledger.journal_not_editable", "ส่งได้เฉพาะฉบับร่าง");
      if (entry.makerId !== persona.id) return problem(403, "auth.forbidden", "ผู้จัดทำเท่านั้นที่ส่งอนุมัติได้");
      const approval = openApproval({
        policy: "manual_journal",
        subjectType: "journal_entry",
        subjectId: entry.journal.id,
        requester: persona,
        amount: entry.journal.totalDebit,
        payload: {
          description: entry.journal.description,
          documentDate: entry.journal.documentDate,
          lines: entry.journal.lines.length,
          totalDebit: entry.journal.totalDebit,
          reverses: entry.journal.reversesId ? (findJournal(entry.journal.reversesId)?.entryNo ?? null) : null,
        },
      });
      Object.assign(entry.journal, { status: "pending_approval", approvalRequestId: approval.id });
      return entry.journal;
    },
  ),
  finance.post(
    "/v1/admin/ledger/journals/{journalId}/actions/reverse",
    { permission: "ledger.journals.manage", idempotent: true, status: 201 },
    ({ params, body, persona }) => {
      const original = journals.find((journal) => journal.id === params.journalId);
      if (!original) return notFound("รายการบัญชี");
      if (original.status !== "posted" || original.reversedById)
        return problem(409, "ledger.not_reversible", "กลับรายการได้เฉพาะรายการที่บันทึกแล้วและยังไม่เคยกลับรายการ");
      if (original.kind === "auto" || original.kind === "reversal")
        return problem(
          409,
          "ledger.not_reversible",
          "รายการจากระบบย่อยแก้ด้วยเอกสาร (ยกเลิก ใบลดหนี้) ไม่ใช่การกลับรายการ",
        );
      if (!body.reason || body.reason.trim().length < 3)
        return invalid([{ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" }]);
      const reversal = draftOf(
        {
          description: `กลับรายการ ${original.entryNo}: ${body.reason.trim()}`,
          documentDate: body.documentDate,
          lines: original.lines.map((line) => ({
            accountCode: line.accountCode,
            side: satangOf(line.debit) > 0 ? "credit" : "debit",
            amount: satangOf(line.debit) > 0 ? line.debit : line.credit,
            description: line.description ?? undefined,
            dimensions: line.dimensions,
          })),
        },
        persona.id,
        { ...original, id: mockId("jnd", ++draftSeq), kind: "reversal", reversesId: original.id } as Journal,
      );
      drafts.set(reversal.id, { journal: reversal, version: 1, makerId: persona.id });
      const approval = openApproval({
        policy: "manual_journal",
        subjectType: "journal_entry",
        subjectId: reversal.id,
        requester: persona,
        amount: reversal.totalDebit,
        payload: {
          description: reversal.description,
          reverses: original.jvNumber ?? original.entryNo,
          totalDebit: reversal.totalDebit,
        },
      });
      Object.assign(reversal, { status: "pending_approval", approvalRequestId: approval.id });
      return reversal;
    },
  ),
  finance.get("/v1/admin/ledger/accounts", "ledger.read", () => ACCOUNTS),
  finance.get("/v1/admin/ledger/account-changes", "ledger.read", ({ query }) =>
    accountChanges.filter((change) => !query.status || change.status === query.status),
  ),
  finance.post(
    "/v1/admin/ledger/account-changes",
    { permission: "ledger.config.propose", status: 201 },
    ({ body, persona }) => {
      if (!body.reason || body.reason.trim().length < 3)
        return invalid([{ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" }]);
      if (body.kind === "create") {
        if (!body.fields?.code || !/^\d{4}$/.test(body.fields.code))
          return invalid([{ path: "fields.code", code: "pattern", message: "รหัสบัญชี 4 หลัก" }]);
        if (ACCOUNTS.some((account) => account.code === body.fields!.code))
          return problem(409, "ledger.account_exists", "มีรหัสบัญชีนี้แล้ว");
      } else if (!ACCOUNTS.some((account) => account.code === body.accountCode)) return notFound("บัญชี");
      else if (body.kind === "deactivate" && movement(body.accountCode!) !== 0)
        return problem(422, "ledger.account_invalid", "ปิดใช้บัญชีได้เมื่อยอดคงเหลือเป็นศูนย์เท่านั้น");
      if (
        accountChanges.some(
          (change) =>
            change.status === "proposed" &&
            (change.accountCode ?? change.proposed.code) === (body.accountCode ?? body.fields?.code),
        )
      )
        return problem(409, "ledger.change_pending", "บัญชีนี้มีคำขอเปลี่ยนแปลงรออนุมัติอยู่");
      const change: Schemas["AccountChangeDto"] = {
        id: mockId("acg", accountChanges.length + 1),
        kind: body.kind,
        accountCode: body.kind === "create" ? null : body.accountCode!,
        proposed: body.fields ?? {},
        reason: body.reason.trim(),
        status: "proposed",
        approvalRequestId: null,
        createdAt: bangkokIso(),
      };
      change.approvalRequestId = openApproval({
        policy: "coa_change",
        subjectType: "account_change",
        subjectId: change.id,
        requester: persona,
        payload: { kind: body.kind, accountCode: body.accountCode ?? body.fields?.code ?? null, reason: change.reason },
      }).id;
      accountChanges.unshift(change);
      return change;
    },
  ),
  finance.get("/v1/admin/ledger/cost-centres", "ledger.read", () => costCentres),
  finance.post("/v1/admin/ledger/cost-centres", { permission: "ledger.config.propose", status: 201 }, ({ body }) => {
    if (!body.code?.trim() || !body.name?.trim())
      return invalid([{ path: "code", code: "required", message: "ระบุรหัสและชื่อ" }]);
    if (costCentres.some((item) => item.code === body.code.trim().toUpperCase()))
      return problem(409, "ledger.cost_centre_exists", "มีรหัสนี้แล้ว");
    const created = {
      id: mockId("cc", costCentres.length + 1),
      code: body.code.trim().toUpperCase(),
      name: body.name.trim(),
      status: "active" as const,
    };
    costCentres.push(created);
    return created;
  }),
  finance.get("/v1/admin/ledger/fiscal-years", "ledger.read", () => fiscalYears),
  finance.post(
    "/v1/admin/ledger/periods/{periodId}/actions/{action}",
    { permission: "ledger.periods.manage" },
    ({ params }) => {
      const period = periodById(params.periodId);
      if (!period) return notFound("งวดบัญชี");
      return transitionPeriod(period, params.action!);
    },
  ),
  finance.get("/v1/admin/ledger/posting-rules", "ledger.read", () => rules),
  finance.get(
    "/v1/admin/ledger/posting-rules/{key}",
    "ledger.read",
    ({ params }) => rules.find((rule) => rule.key === params.key) ?? notFound("กฎการบันทึกบัญชี"),
  ),
  finance.post(
    "/v1/admin/ledger/posting-rules/{key}/actions/preview",
    { permission: "ledger.read" },
    ({ params, body }) => {
      const rule = rules.find((item) => item.key === params.key);
      if (!rule) return notFound("กฎการบันทึกบัญชี");
      if (!body.payload || typeof body.payload !== "object")
        return invalid([{ path: "payload", code: "required", message: "ระบุ payload ตัวอย่าง" }]);
      return preview(rule, body.versionNo, body.payload as Record<string, unknown>);
    },
  ),
  finance.post(
    "/v1/admin/ledger/posting-rules/{key}/versions",
    { permission: "ledger.config.propose", status: 201 },
    ({ params, body, persona }) => {
      const rule = rules.find((item) => item.key === params.key);
      if (!rule) return notFound("กฎการบันทึกบัญชี");
      const template = body.template as Partial<Template> | undefined;
      const bad = (template?.lines ?? []).find(
        (line) =>
          typeof line.account === "string" &&
          !ACCOUNTS.some((account) => account.code === line.account && account.isPostable),
      );
      if (!template?.lines?.length || bad)
        return problem(
          422,
          "ledger.rule_invalid",
          bad ? `บัญชี ${String(bad.account)} ไม่มีหรือบันทึกไม่ได้` : "แม่แบบต้องมีบรรทัด",
        );
      if (!body.reason || body.reason.trim().length < 3)
        return invalid([{ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" }]);
      if (!body.effectiveFrom || !(Date.parse(body.effectiveFrom) >= Date.now() - 60_000))
        return invalid([{ path: "effectiveFrom", code: "min", message: "มีผลตั้งแต่ตอนนี้เป็นต้นไป ย้อนหลังไม่ได้" }]);
      const version: Schemas["PostingRuleVersionDto"] = {
        id: mockId("prv", 100 + rules.flatMap((item) => item.versions).length),
        versionNo: rule.versions.length + 1,
        status: "proposed",
        effectiveFrom: body.effectiveFrom,
        reason: body.reason.trim(),
        conditions: (body.conditions as Record<string, unknown> | null | undefined) ?? null,
        template: body.template as Record<string, unknown>,
        approvalRequestId: null,
      };
      version.approvalRequestId = openApproval({
        policy: "posting_rule_change",
        subjectType: "posting_rule_version",
        subjectId: version.id,
        requester: persona,
        payload: {
          rule: rule.key,
          versionNo: version.versionNo,
          reason: version.reason,
          effectiveFrom: version.effectiveFrom,
        },
      }).id;
      rule.versions.push(version);
      return rule;
    },
  ),
  finance.get("/v1/admin/ledger/recurring-journals", "ledger.read", () => recurring),
  finance.post(
    "/v1/admin/ledger/recurring-journals",
    { permission: "ledger.journals.manage", status: 201 },
    ({ body, persona }) => {
      const refused = checkManual({
        description: body.description || body.name,
        documentDate: body.startOn,
        lines: body.lines,
      });
      if (refused) return refused;
      if (!body.name?.trim() || body.dayOfMonth < 1 || body.dayOfMonth > 28)
        return invalid([{ path: "dayOfMonth", code: "range", message: "วันที่ 1–28 ของเดือน" }]);
      const item: Schemas["RecurringJournalDto"] = {
        id: mockId("rcj", recurring.length + 1),
        name: body.name.trim(),
        description: body.description,
        dayOfMonth: body.dayOfMonth,
        startOn: body.startOn,
        endOn: body.endOn ?? null,
        autoReverse: body.autoReverse,
        nextRunOn: nextRun(body.dayOfMonth, body.startOn < today() ? today() : body.startOn),
        status: "pending_approval",
        approvalRequestId: null,
        lines: body.lines,
      };
      item.approvalRequestId = openApproval({
        policy: "recurring_journal",
        subjectType: "recurring_journal",
        subjectId: item.id,
        requester: persona,
        payload: {
          name: item.name,
          dayOfMonth: item.dayOfMonth,
          autoReverse: item.autoReverse,
          lines: item.lines.length,
        },
      }).id;
      recurring.unshift(item);
      return item;
    },
  ),
  finance.post(
    "/v1/admin/ledger/recurring-journals/{recurringId}/actions/{action}",
    { permission: "ledger.periods.manage" },
    ({ params }) => {
      const item = recurring.find((entry) => entry.id === params.recurringId);
      if (!item) return notFound("รายการประจำ");
      const next = { pause: ["active", "paused"], resume: ["paused", "active"], end: [item.status, "ended"] }[
        params.action!
      ];
      if (!next || (params.action !== "end" && item.status !== next[0]) || item.status === "ended")
        return problem(409, "ledger.recurring", "เปลี่ยนสถานะนี้ไม่ได้");
      item.status = next[1] as Schemas["RecurringJournalStatus"];
      if (item.status === "active") {
        item.nextRunOn = nextRun(item.dayOfMonth, today());
        runRecurring();
      }
      return item;
    },
  ),
];
