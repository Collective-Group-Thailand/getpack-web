/**
 * Cash and bank, mocked over the published B5.3 surface (D-061, D-093): company bank accounts
 * under dual approval, statement import with automatic matching (setting `banking.auto_match`:
 * amount, reference, date window), the matching workbench (manual match, split, ignore, park as
 * unidentified), gateway settlements, unidentified receipts through to the order group they
 * belong to, and the daily cash position.
 *
 * Postings happen where the money meets the bank (accounting-design §5): a slip transfer matched
 * to its line is P05 (bank / 1133), a settlement P04 (bank + fee + VAT on fee / clearing), money
 * nobody claims P29 (bank / 1140). Collections on credit terms, payouts and refunds posted to the
 * bank when they happened, so matching them only reconciles.
 */

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../../support";
import { baht, orders } from "../commerce";
import { registerQueue } from "../console";
import { fileDataUrl, onApprovalDecided, openApproval } from "../platform";
import { companyAccounts } from "./accounts";
import { journals, movement, post, satangOf, today } from "./books";
import { runs } from "./payouts";
import { payments, recordInstalment, refunds } from "./receivables";
import { finance, invalid, isMoney, notFound } from "./support";

type Line = Schemas["BankStatementLineDto"];
type Settlement = Schemas["SettlementDto"] & { companyBankAccountId: string; providerRefs: string[]; posted: boolean };
type Unidentified = Schemas["UnidentifiedReceiptDto"];
type Target = Schemas["BankMatchTarget"];

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() + 7 * 3_600_000 - days * DAY).toISOString().slice(0, 10);

export const lines: Line[] = [];
export const settlements: Settlement[] = [];
export const unidentified: Unidentified[] = [];
/** Targets already matched to a bank line, so nothing is matched twice. */
const matchedTargets = new Set<string>();
/** Files and row sets already imported (a statement imported twice is refused). */
const importedFiles = new Set<string>();

let lineSeq = 0;

const accountOfLine = (line: Line) => companyAccounts.find((item) => item.id === line.companyBankAccountId)!;

/* ------------------------------------------------------------------------ what a line can be */

interface Candidate {
  targetType: Target;
  targetId: string;
  label: string;
  amount: number;
  date: string;
  reference: string | null;
}

/** Everything still waiting for its bank line. */
function candidates(): Candidate[] {
  const out: Candidate[] = [];
  for (const payment of payments) {
    if (payment.status !== "succeeded" && payment.status !== "partially_refunded") continue;
    if (!["bank_transfer_slip", "credit_term_transfer"].includes(payment.method)) continue;
    out.push({
      targetType: "payment",
      targetId: payment.id,
      label: `${payment.referenceCode}${payment.providerRef ? ` · ${payment.providerRef}` : ""}`,
      amount: satangOf(payment.cashAmount),
      date: (payment.paidAt ?? payment.createdAt).slice(0, 10),
      reference: payment.providerRef,
    });
  }
  for (const settlement of settlements.filter((item) => !item.posted))
    out.push({
      targetType: "gateway_settlement",
      targetId: settlement.id,
      label: `${settlement.provider === "scb" ? "SCB" : "2C2P"} ${settlement.settlementDate}`,
      amount: satangOf(settlement.netAmount),
      date: settlement.settlementDate,
      reference: null,
    });
  for (const state of runs.filter((item) => ["confirmed", "partially_failed"].includes(item.run.status))) {
    const paid = state.run.items.filter((item) => item.status === "paid");
    if (!paid.length) continue;
    out.push({
      targetType: "payout_run",
      targetId: state.run.id,
      label: state.run.runNo,
      amount: -paid.reduce((sum, item) => sum + satangOf(item.cashAmount), 0),
      date: paid[0]!.paidOn ?? state.run.payOn,
      reference: state.run.runNo,
    });
  }
  for (const refund of refunds.filter((item) => item.status === "succeeded" && item.channel === "bank_transfer"))
    out.push({
      targetType: "refund",
      targetId: refund.id,
      label: refund.providerRef ?? refund.id.slice(0, 8),
      amount: -satangOf(refund.amount),
      date: (refund.completedAt ?? refund.createdAt).slice(0, 10),
      reference: refund.providerRef,
    });
  return out.filter((candidate) => !matchedTargets.has(`${candidate.targetType}:${candidate.targetId}`));
}

function suggestionsFor(line: Line) {
  const amount = satangOf(line.amount);
  const window = 3; // `banking.auto_match.dateWindowDays`
  return candidates()
    .map((candidate) => {
      const reasons: ("amount" | "reference" | "date_window")[] = [];
      if (candidate.amount === amount) reasons.push("amount");
      if (candidate.reference && line.reference && candidate.reference === line.reference) reasons.push("reference");
      if (Math.abs(Date.parse(candidate.date) - Date.parse(line.txnDate)) <= window * DAY) reasons.push("date_window");
      return { candidate, reasons };
    })
    .filter(({ reasons }) => reasons.includes("amount") || reasons.includes("reference"))
    .sort((a, b) => b.reasons.length - a.reasons.length);
}

/** Posts what meeting the bank means for a target (P05 / P04), and records the match. */
function applyMatch(line: Line, candidate: Candidate, amount: number, auto: boolean, createdBy: string | null) {
  const bank = accountOfLine(line).glAccountCode;
  const common = {
    documentDate: line.txnDate,
    postedAt: `${line.txnDate}T16:00:00+07:00`,
    source: { type: "bank_statement_line", id: line.id, number: line.reference ?? line.description },
    createdBy,
  };
  if (candidate.targetType === "payment") {
    const payment = payments.find((item) => item.id === candidate.targetId)!;
    if (payment.method === "bank_transfer_slip")
      post({
        ...common,
        rule: "P05",
        description: `สลิปจับคู่รายการธนาคาร ${payment.referenceCode}`,
        lines: [
          { account: bank, debit: amount },
          { account: "1133", credit: amount },
        ],
      });
    // A credit-term transfer posted to the bank when it was collected (P08): nothing to add.
  }
  if (candidate.targetType === "gateway_settlement") {
    const settlement = settlements.find((item) => item.id === candidate.targetId)!;
    const fee = satangOf(settlement.feeAmount);
    const vat = satangOf(settlement.vatOnFee);
    post({
      ...common,
      rule: "P04",
      description: `เงินโอนจาก ${settlement.provider === "scb" ? "SCB" : "2C2P"} รอบ ${settlement.settlementDate}`,
      lines: [
        { account: bank, debit: amount },
        { account: "6110", debit: fee },
        ...(vat ? [{ account: "1241", debit: vat, taxCode: "input_vat" as const, taxBase: fee }] : []),
        { account: settlement.provider === "scb" ? "1132" : "1131", credit: satangOf(settlement.grossAmount) },
      ],
    });
    Object.assign(settlement, { posted: true, status: "posted" });
  }
  matchedTargets.add(`${candidate.targetType}:${candidate.targetId}`);
  line.matches.push({ targetType: candidate.targetType, targetId: candidate.targetId, amount: baht(amount), auto });
}

function addLine(accountId: string, row: Schemas["StatementRowDto"], balance: number | null): Line {
  lineSeq += 1;
  const account = companyAccounts.find((item) => item.id === accountId)!;
  const line: Line = {
    id: mockId("bsl", 5000 + lineSeq),
    companyBankAccountId: accountId,
    accountNoLast4: account.accountNoLast4,
    txnDate: row.txnDate,
    description: row.description,
    reference: row.reference ?? null,
    amount: row.amount,
    runningBalance: balance === null ? (row.balance ?? null) : baht(balance),
    matchStatus: "unmatched",
    matches: [],
  };
  lines.push(line);
  return line;
}

/** Automatic matching of a new line: one candidate agreeing on the amount, and on the reference when there is one. */
function autoMatch(line: Line): boolean {
  const found = suggestionsFor(line).filter(
    ({ reasons }) =>
      reasons.includes("amount") &&
      (reasons.includes("reference") || (!line.reference && reasons.includes("date_window"))),
  );
  if (found.length !== 1) return false;
  applyMatch(line, found[0]!.candidate, satangOf(line.amount), true, null);
  line.matchStatus = "matched";
  return true;
}

/* ------------------------------------------------------------------------------ settlements */

function importSettlement(input: Schemas["ImportSettlementDto"]): Settlement | Response {
  const refs = new Set(payments.map((payment) => payment.providerRef).filter(Boolean));
  const gross = input.lines.reduce((sum, line) => sum + satangOf(line.grossAmount), 0);
  const fee = input.lines.reduce((sum, line) => sum + satangOf(line.feeAmount), 0);
  const vat = satangOf(input.vatOnFee);
  const key = `${input.provider}:${input.settlementDate}:${input.lines
    .map((line) => line.providerRef)
    .sort()
    .join(",")}`;
  if (importedFiles.has(key)) return problem(409, "banking.duplicate_import", "นำเข้ารายงานการโอนนี้ไปแล้ว");
  importedFiles.add(key);
  const settlement: Settlement = {
    id: mockId("stl", settlements.length + 1),
    provider: input.provider,
    settlementDate: input.settlementDate,
    grossAmount: baht(gross),
    feeAmount: baht(fee),
    vatOnFee: baht(vat),
    netAmount: baht(gross - fee - vat),
    lineCount: input.lines.length,
    unmatchedLines: input.lines.filter((line) => !refs.has(line.providerRef)).length,
    status: "imported",
    companyBankAccountId: input.companyBankAccountId,
    providerRefs: input.lines.map((line) => line.providerRef),
    posted: false,
  };
  settlements.push(settlement);
  return settlement;
}

/* ---------------------------------------------------------------------------------- seed */

{
  // The company's paid-up capital, the opening of the SCB account (a manual JV, approved).
  const opening = 150_000_000;
  const firstOpen = journals.length ? journals.map((j) => j.entryDate).sort()[0]! : today();
  post({
    rule: null,
    kind: "manual",
    jvNumber: `JV${Number(firstOpen.slice(0, 4)) + 543}${firstOpen.slice(5, 7)}-00001`,
    description: "รับชำระค่าหุ้นเข้าบัญชีธนาคาร (ข้อมูลจำลอง)",
    documentDate: firstOpen,
    postedAt: `${firstOpen}T09:00:00+07:00`,
    source: null,
    createdBy: "00000000-0000-4000-8000-000000005109",
    approvedBy: "00000000-0000-4000-8000-00000000510a",
    lines: [
      { account: "1121", debit: opening },
      { account: "3100", credit: opening },
    ],
  });

  // Gateway settlements: SCB paid the QR payments of two days ago (posted when its line met it),
  // and yesterday's is imported and waiting for its bank line.
  const qr = payments.filter(
    (payment) => payment.method === "scb_qr" && payment.status === "succeeded" && payment.paidAt,
  );
  const half = Math.ceil(qr.length / 2);
  const settle = (rows: typeof qr, date: string) =>
    importSettlement({
      provider: "scb",
      settlementDate: date,
      companyBankAccountId: companyAccounts[0]!.id,
      feeTaxInvoiceNo: `SCB-FEE-${date.replace(/-/g, "")}`,
      vatOnFee: baht(Math.round(rows.reduce((sum, row) => sum + Math.round(satangOf(row.amount) * 0.0065), 0) * 0.07)),
      lines: rows.map((row) => ({
        providerRef: row.providerRef!,
        grossAmount: row.amount,
        feeAmount: baht(Math.round(satangOf(row.amount) * 0.0065)),
      })),
    }) as Settlement;
  const older = qr.length ? settle(qr.slice(0, half), daysAgo(2)) : null;
  const newer = qr.length > 1 ? settle(qr.slice(half), daysAgo(1)) : null;

  const scb = companyAccounts[0]!.id;
  // Collected first, then written oldest first, so the running balance reads like a statement.
  const seeds: { days: number; description: string; amount: number; reference: string | null; match: boolean }[] = [];
  // B2B collections (P08 posted to the bank when collected): matched automatically.
  for (const payment of payments.filter((item) => item.method === "credit_term_transfer"))
    seeds.push({
      days: Math.max(1, Math.round((Date.now() - Date.parse(payment.paidAt!)) / DAY)),
      description: `รับโอน ${payment.referenceCode}`,
      amount: satangOf(payment.cashAmount),
      reference: payment.providerRef,
      match: true,
    });
  // Slip transfers the bank shows with the reference Finance approved against: P05.
  const slipPaid = payments.filter(
    (payment) => payment.method === "bank_transfer_slip" && payment.status === "succeeded",
  );
  for (const payment of slipPaid.slice(0, -1))
    seeds.push({
      days: 3,
      description: `รับโอนพร้อมเพย์ ${payment.providerRef}`,
      amount: satangOf(payment.cashAmount),
      reference: payment.providerRef,
      match: true,
    });
  // One whose bank line carries no reference: left for the workbench to suggest by amount.
  const odd = slipPaid.at(-1);
  if (odd)
    seeds.push({
      days: 2,
      description: "รับโอนเงิน (ไม่มีเลขอ้างอิง)",
      amount: satangOf(odd.cashAmount),
      reference: null,
      match: false,
    });
  if (older)
    seeds.push({
      days: 2,
      description: "SCB MERCHANT SETTLEMENT",
      amount: satangOf(older.netAmount),
      reference: null,
      match: true,
    });
  if (newer)
    seeds.push({
      days: 1,
      description: "SCB MERCHANT SETTLEMENT",
      amount: satangOf(newer.netAmount),
      reference: null,
      match: false,
    });
  // Last week's payout run, as one bulk debit: matched to the run.
  const lastRun = runs.find((state) => state.run.status === "confirmed");
  if (lastRun) {
    const cash = lastRun.run.items
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + satangOf(item.cashAmount), 0);
    seeds.push({
      days: 5,
      description: `BULK PAYMENT ${lastRun.run.runNo}`,
      amount: -cash,
      reference: lastRun.run.runNo,
      match: true,
    });
  }
  // A customer paid PK-2569-00105's instalment without a reference: Finance finds whose it is.
  const unpaid = orders.find((order) => order.orderCode === "PK-2569-00105")?.instalments[0];
  seeds.push({
    days: 1,
    description: "รับโอนเงิน จาก นาย ตัวอย่าง ใจดี",
    amount: unpaid ? satangOf(unpaid.grossAmount) : 1_284_000,
    reference: null,
    match: false,
  });
  // A transfer between the company's own accounts, and a bank charge (for a manual journal).
  seeds.push({
    days: 1,
    description: "โอนไปบัญชีออมทรัพย์ของบริษัท",
    amount: -5_000_000,
    reference: "INTERNAL-TRF-01",
    match: false,
  });
  seeds.push({ days: 0, description: "ค่าธรรมเนียมธนาคาร", amount: -2_500, reference: null, match: false });

  let balance = opening;
  for (const seed of [...seeds].sort((a, b) => b.days - a.days)) {
    balance += seed.amount;
    const line = addLine(
      scb,
      {
        txnDate: daysAgo(seed.days),
        description: seed.description,
        amount: baht(seed.amount),
        reference: seed.reference,
      },
      balance,
    );
    if (seed.match) autoMatch(line);
  }
}

/* ------------------------------------------------------------------------ bank accounts */

onApprovalDecided("company_bank_account_change", (approval, outcome) => {
  const account = companyAccounts.find((item) => item.id === approval.subjectId);
  if (!account) return;
  account.status = outcome === "approved" ? "active" : "rejected";
});

/* ---------------------------------------------------------------------------- queues */

registerQueue("banking.manage", () => {
  const open = lines.filter((line) => line.matchStatus === "unmatched");
  return {
    key: "finance.unmatched_bank_lines",
    path: "/admin/finance/banking/lines",
    count: open.length,
    overdueCount: open.filter((line) => line.txnDate < daysAgo(3)).length,
    nextDueAt: null,
  };
});
registerQueue("banking.read", () => {
  const open = unidentified.filter((item) => item.status === "open");
  return {
    key: "finance.unidentified_receipts",
    path: "/admin/finance/banking/unidentified",
    count: open.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});

/* ---------------------------------------------------------------------------- handlers */

/** A generic bank CSV: `date,description,reference,amount,balance` (the generic adapter, D-093). */
function parseCsv(text: string): Schemas["StatementRowDto"][] | null {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (rows[0]?.toLowerCase().startsWith("date")) rows.shift();
  const parsed = rows.map((row) => {
    const [txnDate, description, reference, amount, balance] = row.split(",").map((cell) => cell?.trim() ?? "");
    return {
      txnDate: txnDate!,
      description: description!,
      reference: reference || null,
      amount: amount!,
      balance: balance || null,
    };
  });
  return parsed.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.txnDate) && /^-?\d+\.\d{2}$/.test(row.amount))
    ? parsed
    : null;
}

function decodeFile(fileId: string): string | null {
  const url = fileDataUrl(fileId);
  if (!url) return null;
  const [, meta, data] = url.match(/^data:([^,]*),(.*)$/) ?? [];
  if (data === undefined) return null;
  return meta?.includes(";base64") ? Buffer.from(data, "base64").toString("utf8") : decodeURIComponent(data);
}

export const bankingHandlers = [
  finance.get("/v1/admin/company-bank-accounts", "banking.read", () => companyAccounts),
  finance.post(
    "/v1/admin/company-bank-accounts",
    { permission: "banking.accounts.propose", idempotent: true, status: 201 },
    ({ body, persona }) => {
      const digits = (body.accountNo ?? "").replace(/[\s-]/g, "");
      const errors = [
        ...(!/^\d{10,15}$/.test(digits)
          ? [{ path: "accountNo", code: "pattern", message: "เลขบัญชี 10–15 หลัก" }]
          : []),
        ...(!body.accountName?.trim() ? [{ path: "accountName", code: "required", message: "กรอกชื่อบัญชี" }] : []),
        ...(!/^112\d$/.test(body.glAccountCode ?? "")
          ? [{ path: "glAccountCode", code: "invalid", message: "เลือกบัญชีเงินฝากธนาคาร (112x)" }]
          : []),
        ...(companyAccounts.some((item) => item.glAccountCode === body.glAccountCode && item.status !== "rejected")
          ? [{ path: "glAccountCode", code: "taken", message: "บัญชีแยกประเภทนี้ผูกกับบัญชีธนาคารอื่นแล้ว" }]
          : []),
      ];
      if (errors.length) return invalid(errors);
      const account: Schemas["CompanyBankAccountDto"] = {
        id: mockId("cba", companyAccounts.length + 1),
        bankCode: body.bankCode,
        accountName: body.accountName.trim(),
        accountNoLast4: digits.slice(-4),
        branchName: body.branchName ?? null,
        purpose: body.purpose,
        glAccountCode: body.glAccountCode,
        defaultBulkFormat: body.defaultBulkFormat ?? "generic_csv",
        status: "pending_approval",
        approvalRequestId: null,
      };
      account.approvalRequestId = openApproval({
        policy: "company_bank_account_change",
        subjectType: "company_bank_account",
        subjectId: account.id,
        requester: persona,
        payload: {
          bankCode: body.bankCode,
          bankLast4: account.accountNoLast4,
          purpose: body.purpose,
          glAccountCode: body.glAccountCode,
        },
      }).id;
      companyAccounts.push(account);
      return account;
    },
  ),
  finance.post(
    "/v1/admin/bank-statements",
    { permission: "banking.manage", idempotent: true, status: 201 },
    ({ body }) => {
      const account = companyAccounts.find((item) => item.id === body.companyBankAccountId && item.status === "active");
      if (!account)
        return invalid([{ path: "companyBankAccountId", code: "invalid", message: "เลือกบัญชีธนาคารของบริษัท" }]);
      let rows = body.rows ?? null;
      if (body.fileId) {
        if (importedFiles.has(body.fileId)) return problem(409, "banking.duplicate_import", "นำเข้าไฟล์นี้ไปแล้ว");
        const text = decodeFile(body.fileId);
        rows = text ? parseCsv(text) : null;
        if (!rows)
          return problem(
            422,
            "banking.statement_invalid",
            "อ่านไฟล์ไม่ได้ ใช้รูปแบบ date,description,reference,amount,balance",
          );
        importedFiles.add(body.fileId);
      }
      if (!rows?.length) return invalid([{ path: "rows", code: "required", message: "แนบไฟล์หรือระบุรายการ" }]);
      let added = 0;
      let matched = 0;
      for (const row of rows) {
        if (!/^-?\d+\.\d{2}$/.test(row.amount))
          return invalid([{ path: "rows", code: "pattern", message: `จำนวนเงินไม่ถูกต้อง: ${row.amount}` }]);
        // Lines already imported from an overlapping file are skipped.
        const seen = lines.some(
          (line) =>
            line.companyBankAccountId === account.id &&
            line.txnDate === row.txnDate &&
            line.amount === row.amount &&
            (line.reference ?? null) === (row.reference ?? null) &&
            line.description === row.description,
        );
        if (seen) continue;
        const line = addLine(account.id, row, null);
        added += 1;
        if (autoMatch(line)) matched += 1;
      }
      return { importId: mockId("imp", 900 + lines.length), lines: added, matched };
    },
  ),
  finance.get("/v1/admin/bank-statement-lines", "banking.read", ({ query }) => {
    const rows = lines
      .filter((line) => !query.companyBankAccountId || line.companyBankAccountId === query.companyBankAccountId)
      .filter((line) => !query.matchStatus || line.matchStatus === query.matchStatus)
      .filter((line) => matchesQuery(query.q, line.description, line.reference, line.amount));
    return paginate(sortBy(rows, query.sort ?? "txnDate", query.order ?? "desc"), query);
  }),
  finance.get("/v1/admin/bank-statement-lines/{lineId}/suggestions", "banking.read", ({ params }) => {
    const line = lines.find((item) => item.id === params.lineId);
    if (!line) return notFound("รายการธนาคาร");
    return suggestionsFor(line).map(({ candidate, reasons }) => ({
      targetType: candidate.targetType,
      targetId: candidate.targetId,
      label: candidate.label,
      amount: baht(candidate.amount),
      date: candidate.date,
      reasons,
    }));
  }),
  finance.post(
    "/v1/admin/bank-statement-lines/{lineId}/actions/match",
    { permission: "banking.manage", idempotent: true },
    ({ params, body, persona }) => {
      const line = lines.find((item) => item.id === params.lineId);
      if (!line) return notFound("รายการธนาคาร");
      if (line.matchStatus !== "unmatched")
        return problem(409, "banking.line_already_matched", "รายการนี้จับคู่หรือจัดการไปแล้ว");
      const candidate = candidates().find(
        (item) => item.targetType === body.targetType && item.targetId === body.targetId,
      );
      if (!candidate) return problem(422, "banking.target_invalid", "ไม่พบรายการที่จะจับคู่ หรือจับคู่ไปแล้ว");
      if (candidate.amount !== satangOf(line.amount))
        return problem(
          422,
          "banking.amount_mismatch",
          `ยอดไม่ตรงกัน: รายการธนาคาร ${line.amount} บาท, รายการที่เลือก ${baht(candidate.amount)} บาท`,
        );
      applyMatch(line, candidate, candidate.amount, false, persona.id);
      line.matchStatus = "matched";
      return line;
    },
  ),
  finance.post(
    "/v1/admin/bank-statement-lines/{lineId}/actions/split",
    { permission: "banking.manage", idempotent: true },
    ({ params, body, persona }) => {
      const line = lines.find((item) => item.id === params.lineId);
      if (!line) return notFound("รายการธนาคาร");
      if (line.matchStatus !== "unmatched")
        return problem(409, "banking.line_already_matched", "รายการนี้จับคู่หรือจัดการไปแล้ว");
      const total = body.parts.reduce((sum, part) => sum + satangOf(part.amount), 0);
      if (total !== satangOf(line.amount))
        return problem(
          422,
          "banking.amount_mismatch",
          `ยอดรวมของส่วนที่แบ่ง ${baht(total)} ไม่เท่ากับรายการธนาคาร ${line.amount}`,
        );
      const open = candidates();
      const picked = body.parts.map((part) => ({
        part,
        candidate: open.find((item) => item.targetType === part.targetType && item.targetId === part.targetId),
      }));
      if (picked.some(({ candidate, part }) => !candidate || candidate.amount !== satangOf(part.amount)))
        return problem(422, "banking.target_invalid", "ส่วนที่แบ่งต้องตรงกับยอดของรายการที่เลือกแต่ละรายการ");
      for (const { candidate, part } of picked) applyMatch(line, candidate!, satangOf(part.amount), false, persona.id);
      line.matchStatus = "matched";
      // The published answer is the line itself, with its matches (as `admin.banking.matchLine`).
      return line;
    },
  ),
  finance.post(
    "/v1/admin/bank-statement-lines/{lineId}/actions/ignore",
    { permission: "banking.manage", idempotent: true },
    ({ params, body }) => {
      const line = lines.find((item) => item.id === params.lineId);
      if (!line) return notFound("รายการธนาคาร");
      if (line.matchStatus !== "unmatched")
        return problem(409, "banking.line_already_matched", "รายการนี้จับคู่หรือจัดการไปแล้ว");
      if (!body.reason || body.reason.trim().length < 3)
        return invalid([{ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" }]);
      line.matchStatus = "ignored";
      return line;
    },
  ),
  finance.post(
    "/v1/admin/bank-statement-lines/{lineId}/actions/mark-unidentified",
    { permission: "banking.manage", idempotent: true },
    ({ params, persona }) => {
      const line = lines.find((item) => item.id === params.lineId);
      if (!line) return notFound("รายการธนาคาร");
      if (line.matchStatus !== "unmatched")
        return problem(409, "banking.line_already_matched", "รายการนี้จับคู่หรือจัดการไปแล้ว");
      if (satangOf(line.amount) <= 0)
        return problem(422, "banking.not_money_in", "พักเป็นเงินรับไม่ระบุผู้โอนได้เฉพาะเงินเข้า");
      const receipt: Unidentified = {
        id: mockId("unr", unidentified.length + 1),
        amount: line.amount,
        description: line.description,
        reference: line.reference,
        receivedOn: line.txnDate,
        status: "open",
      };
      unidentified.unshift(receipt);
      post({
        rule: "P29",
        description: `พักเงินรับไม่ระบุผู้โอน ${line.description}`,
        documentDate: line.txnDate,
        source: { type: "unidentified_receipt", id: receipt.id, number: line.reference ?? line.description },
        createdBy: persona.id,
        lines: [
          { account: accountOfLine(line).glAccountCode, debit: satangOf(line.amount) },
          { account: "1140", credit: satangOf(line.amount) },
        ],
      });
      line.matchStatus = "unidentified";
      line.matches.push({ targetType: "unidentified_receipt", targetId: receipt.id, amount: line.amount, auto: false });
      return line;
    },
  ),
  finance.get("/v1/admin/unidentified-receipts", "banking.read", ({ query }) =>
    unidentified.filter((item) => !query.status || item.status === query.status),
  ),
  finance.post(
    "/v1/admin/unidentified-receipts/{receiptId}/actions/identify",
    { permission: "banking.manage", idempotent: true },
    ({ params, body }) => {
      const receipt = unidentified.find((item) => item.id === params.receiptId);
      if (!receipt) return notFound("เงินรับไม่ระบุผู้โอน");
      if (receipt.status !== "open") return problem(409, "payments.not_unidentified", "รายการนี้ระบุผู้โอนไปแล้ว");
      const order = orders.find((item) => item.groupId === body.orderGroupId);
      if (!order) return invalid([{ path: "orderGroupId", code: "ref", message: "ไม่พบกลุ่มคำสั่งซื้อนี้" }]);
      const due = order.instalments.find((item) => item.status !== "paid" && item.status !== "cancelled");
      if (!due) return problem(409, "payments.nothing_to_pay", "กลุ่มคำสั่งซื้อนี้ไม่มียอดค้างชำระ");
      if (due.grossAmount !== receipt.amount)
        return problem(
          422,
          "banking.amount_mismatch",
          `ยอดเงินรับ ${receipt.amount} ไม่ตรงกับงวดที่ค้าง ${due.grossAmount} บาท`,
        );
      const paidAt = bangkokIso();
      const id = mockId("pay", 950 + payments.length);
      payments.push({
        id,
        groupId: order.groupId,
        method: "bank_transfer_slip",
        provider: "bank_transfer",
        providerRef: receipt.reference ?? `UNR-${receipt.id.slice(-4)}`,
        status: "succeeded",
        amount: receipt.amount,
        cashAmount: receipt.amount,
        whtAmount: "0.00",
        feeAmount: "0.00",
        refundedAmount: "0.00",
        currency: "THB",
        referenceCode: `REF${order.orderCode.slice(-5)}UN`,
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
      Object.assign(due, { status: "paid", paidAmount: due.grossAmount });
      if (order.status === "waiting_payment") order.status = "paid_for_production";
      recordInstalment(order, {
        paymentId: id,
        method: "bank_transfer_slip",
        gross: satangOf(receipt.amount),
        seq: due.seq,
        paidAt,
        clearing: "1140",
      });
      receipt.status = "matched";
      return receipt;
    },
  ),
  finance.post(
    "/v1/admin/gateway-settlements",
    { permission: "banking.manage", idempotent: true, status: 201 },
    ({ body }) => {
      if (!body.lines?.length)
        return invalid([{ path: "lines", code: "min", message: "เพิ่มรายการอย่างน้อยหนึ่งรายการ" }]);
      const bad = body.lines.findIndex(
        (line) => !isMoney(line.grossAmount) || !isMoney(line.feeAmount) || !line.providerRef?.trim(),
      );
      if (bad >= 0)
        return invalid([{ path: `lines[${bad}]`, code: "invalid", message: "เลขอ้างอิง ยอด และค่าธรรมเนียมต้องครบ" }]);
      if (!isMoney(body.vatOnFee))
        return invalid([{ path: "vatOnFee", code: "pattern", message: "จำนวนเงินไม่ถูกต้อง" }]);
      const created = importSettlement(body);
      if (created instanceof Response) return created;
      return {
        id: created.id,
        provider: created.provider,
        settlementDate: created.settlementDate,
        grossAmount: created.grossAmount,
        feeAmount: created.feeAmount,
        vatOnFee: created.vatOnFee,
        netAmount: created.netAmount,
        lineCount: created.lineCount,
        unmatchedLines: created.unmatchedLines,
        status: created.status,
        companyBankAccountId: created.companyBankAccountId,
      };
    },
  ),
  finance.get("/v1/admin/gateway-settlements", "banking.read", ({ query }) => {
    const rows = settlements
      .filter((item) => !query.status || item.status === query.status)
      .filter((item) => !query.provider || item.provider === query.provider)
      .filter((item) => matchesQuery(query.q, item.settlementDate, item.grossAmount, item.netAmount))
      .map((item) => ({
        id: item.id,
        provider: item.provider,
        settlementDate: item.settlementDate,
        grossAmount: item.grossAmount,
        feeAmount: item.feeAmount,
        vatOnFee: item.vatOnFee,
        netAmount: item.netAmount,
        lineCount: item.lineCount,
        unmatchedLines: item.unmatchedLines,
        status: item.status,
        companyBankAccountId: item.companyBankAccountId,
      }));
    return paginate(sortBy(rows, query.sort ?? "settlementDate", query.order ?? "desc"), query);
  }),
  finance.get("/v1/admin/cash-position", "banking.read", ({ query }) => {
    const asOf = query.asOf ?? today();
    return {
      asOf,
      banks: companyAccounts
        .filter((account) => account.status === "active")
        .map((account) => {
          const mine = lines.filter((line) => line.companyBankAccountId === account.id && line.txnDate <= asOf);
          // The latest line the bank gave a running balance for (an imported file may not carry one).
          const last = mine
            .filter((line) => line.runningBalance !== null)
            .sort((a, b) => a.txnDate.localeCompare(b.txnDate))
            .at(-1);
          return {
            companyBankAccountId: account.id,
            accountNoLast4: account.accountNoLast4,
            glAccountCode: account.glAccountCode,
            glBalance: baht(movement(account.glAccountCode, { to: asOf })),
            statementBalance: last?.runningBalance ?? null,
            unmatchedLines: mine.filter((line) => line.matchStatus === "unmatched").length,
          };
        }),
      clearing: ["1131", "1132", "1133", "1140"].map((code) => ({
        accountCode: code,
        balance: baht(movement(code, { to: asOf })),
      })),
    };
  }),
];
