/**
 * Tax (getpack-api B5.4, published): the sales and purchase tax reports built from the journal
 * lines the posting rules tagged, the ภ.พ.30 working paper (P27 when finalised, P27P when paid),
 * ภ.ง.ด.3 / 53 from the 50 ทวิ issued at payout with their attachment (P28 when remitted), the WHT
 * registers, and the tax calendar — plus the dated tax rates and the document series.
 *
 * Every report reconciles to its GL control accounts (setting `tax.gl_accounts`) the way the
 * backend's `TaxReportsService` does: the report is a sum over tagged lines or certificates, the
 * GL figure a sum over the accounts' movement, both over the same posted entries, excluding the
 * tax reports' own postings. It finalises only at a difference of 0.
 */

import { HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, mockId, problem } from "../../support";
import { baht } from "../commerce";
import { onApprovalDecided, openApproval, settingValue } from "../platform";
import { companyAccounts } from "./accounts";
import { fiscalYears, journals, post, previousMonth, satangOf, today } from "./books";
import { vendorOf } from "./payables";
import { whtIssued } from "./payouts";
import { documents, whtCertificates } from "./receivables";
import { finance, invalid, notFound } from "./support";

type Report = Schemas["TaxReportDto"];
type Kind = Schemas["TaxReportKind"];
type Line = Record<string, string | number | boolean | null>;
type Period = Schemas["FiscalPeriodDto"];
interface Built {
  lines: Line[];
  totals: Record<string, string>;
  /** Satang. */
  report: number;
  gl: number;
}

const TAX_REPORT_SOURCE = "tax_report";
const glAccounts = () =>
  settingValue<{
    output_vat: string[];
    input_vat: string[];
    wht_pnd3: string[];
    wht_pnd53: string[];
    wht_receivable: string[];
  }>("tax.gl_accounts");

const periodOfMonth = (month: string): Period | undefined =>
  fiscalYears.flatMap((year) => year.periods).find((period) => period.startDate === `${month}-01`);

/** Posted entries of a period, the tax reports' own (P27, P27P, P28) left out. */
const entriesOf = (period: Period) =>
  journals.filter((j) => j.status === "posted" && j.periodId === period.id && j.source?.type !== TAX_REPORT_SOURCE);

function glMovement(period: Period, codes: string[], side: "debit" | "credit"): number {
  let total = 0;
  for (const journal of entriesOf(period))
    for (const line of journal.lines)
      if (codes.includes(line.accountCode)) {
        const net = satangOf(line.debit) - satangOf(line.credit);
        total += side === "debit" ? net : -net;
      }
  return total;
}

/* ---------------------------------------------------------------------------------- building */

function vatReport(period: Period, code: "output_vat" | "input_vat", accounts: string[]): Built {
  const credit = code === "output_vat";
  const lines: Line[] = [];
  let vat = 0;
  let base = 0;
  for (const journal of entriesOf(period)) {
    const tagged = journal.lines.filter((line) => line.taxCode === code);
    if (!tagged.length) continue;
    let v = 0;
    let b = 0;
    for (const line of tagged) {
      // VAT in the report's direction; a reversal or credit note is negative and so is its base.
      const amount = credit
        ? satangOf(line.credit) - satangOf(line.debit)
        : satangOf(line.debit) - satangOf(line.credit);
      const magnitude = Math.abs(satangOf(line.taxBaseAmount ?? "0.00"));
      v += amount;
      b += amount < 0 ? -magnitude : magnitude;
    }
    const doc =
      journal.source?.type === "customer_document" ? documents.find((d) => d.id === journal.source!.id) : undefined;
    const partyId = tagged.map((line) => line.dimensions.vendor ?? line.dimensions.factory).find(Boolean);
    const vendor = partyId ? vendorOf(partyId) : undefined;
    vat += v;
    base += b;
    lines.push({
      seq: 0,
      documentDate: journal.documentDate,
      documentNo: journal.source?.number ?? journal.entryNo,
      sourceType: journal.source?.type ?? null,
      sourceId: journal.source?.id ?? null,
      journalEntryId: journal.id,
      partyName: credit ? (doc?.buyer.name ?? null) : (vendor?.legalName ?? null),
      partyTaxId: credit ? (doc?.buyer.taxId ?? null) : (vendor?.taxId ?? null),
      partyBranch: credit ? (doc?.buyer.branchCode ?? null) : (vendor?.branchCode ?? null),
      base: signed(b),
      vat: signed(v),
      late: journal.documentDate < period.startDate,
    });
  }
  lines.sort(
    (a, b) =>
      String(a.documentDate).localeCompare(String(b.documentDate)) ||
      String(a.documentNo).localeCompare(String(b.documentNo)),
  );
  lines.forEach((line, index) => (line.seq = index + 1));
  return {
    lines,
    totals: { vat: signed(vat), base: signed(base) },
    report: vat,
    gl: glMovement(period, accounts, credit ? "credit" : "debit"),
  };
}

/** A signed decimal string — a credit note's line on the sales tax report is negative. */
const signed = (satang: number) => (satang < 0 ? `-${baht(-satang)}` : baht(satang));

function whtIssuedReport(period: Period, form: "pnd3" | "pnd53" | null, accounts: string[]): Built {
  const certificates = whtIssued
    .filter((c) => c.paidOn >= period.startDate && c.paidOn <= period.endDate && (!form || c.whtForm === form))
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn) || a.wtNumber.localeCompare(b.wtNumber));
  let wht = 0;
  let base = 0;
  const lines = certificates.map((c, index): Line => {
    wht += c.amount;
    base += c.base;
    const vendor = vendorOf(c.vendorId);
    return {
      seq: index + 1,
      wtNumber: c.wtNumber,
      form: c.whtForm,
      taxId: c.taxId,
      branch: vendor?.branchCode ?? "00000",
      name: c.vendorName,
      address: null,
      paidOn: c.paidOn,
      incomeType: c.category,
      ratePct: { hire_of_work: "3.00", transport: "1.00", service: "3.00" }[c.category],
      paidAmount: baht(c.base),
      whtAmount: baht(c.amount),
      // 1 = withheld at source (the Revenue Department's condition code on the attachment).
      condition: 1,
      status: "issued",
    };
  });
  return {
    lines,
    totals: { whtAmount: baht(wht), whtBase: baht(base), certificates: String(lines.length) },
    report: wht,
    gl: glMovement(period, accounts, "credit"),
  };
}

function whtReceivedReport(period: Period, accounts: string[]): Built {
  let wht = 0;
  let base = 0;
  let pending = 0;
  const lines: Line[] = [];
  for (const certificate of whtCertificates) {
    const receipt = documents.find((doc) => doc.id === certificate.receipt.id);
    if (!receipt || receipt.documentDate < period.startDate || receipt.documentDate > period.endDate) continue;
    wht += satangOf(certificate.whtAmount);
    base += satangOf(certificate.whtBase);
    if (certificate.status === "pending") pending += satangOf(certificate.whtAmount);
    lines.push({
      seq: lines.length + 1,
      documentNo: receipt.docNumber,
      documentDate: receipt.documentDate,
      name: receipt.buyer.name,
      taxId: receipt.buyer.taxId,
      base: certificate.whtBase,
      whtAmount: certificate.whtAmount,
      status: certificate.status,
      certificateNo: certificate.certificateNo,
    });
  }
  return {
    lines,
    totals: { whtAmount: baht(wht), whtBase: baht(base), pendingAmount: baht(pending) },
    report: wht,
    gl: glMovement(period, accounts, "debit"),
  };
}

function build(kind: Kind, period: Period): Built {
  const gl = glAccounts();
  switch (kind) {
    case "sales_tax":
      return vatReport(period, "output_vat", gl.output_vat);
    case "purchase_tax":
      return vatReport(period, "input_vat", gl.input_vat);
    case "pp30": {
      const sales = vatReport(period, "output_vat", gl.output_vat);
      const purchases = vatReport(period, "input_vat", gl.input_vat);
      const net = sales.report - purchases.report;
      const late = sales.lines.filter((line) => line.late === true);
      return {
        lines: [
          {
            key: "output_vat",
            label: "ภาษีขาย",
            base: sales.totals.base!,
            vat: sales.totals.vat!,
            gl: signed(sales.gl),
            documents: sales.lines.length,
          },
          {
            key: "input_vat",
            label: "ภาษีซื้อ",
            base: purchases.totals.base!,
            vat: purchases.totals.vat!,
            gl: signed(purchases.gl),
            documents: purchases.lines.length,
          },
          {
            key: "late_output_vat",
            label: "ภาษีขายของเดือนก่อน (ยื่นเพิ่มเติม)",
            base: null,
            vat: signed(late.reduce((sum, line) => sum + satangOf(String(line.vat)), 0)),
            gl: null,
            documents: late.length,
          },
        ],
        totals: {
          outputVat: sales.totals.vat!,
          outputBase: sales.totals.base!,
          inputVat: purchases.totals.vat!,
          inputBase: purchases.totals.base!,
          netPayable: baht(Math.max(net, 0)),
          creditCarriedForward: baht(Math.max(-net, 0)),
        },
        report: net,
        gl: sales.gl - purchases.gl,
      };
    }
    case "pnd1":
      // Sales agents' commission (D-421); the mock has no agents, so the form is always empty.
      return whtIssuedReport(period, null, []);
    case "pnd3":
    case "pnd53":
      return whtIssuedReport(period, kind, kind === "pnd3" ? gl.wht_pnd3 : gl.wht_pnd53);
    case "wht_issued_register":
      return whtIssuedReport(period, null, [...gl.wht_pnd3, ...gl.wht_pnd53]);
    case "wht_received_register":
      return whtReceivedReport(period, gl.wht_receivable);
  }
}

/** The reconciliation of any kind and month, without storing a report — what the close checks read. */
export function taxDifference(kind: Kind, month: string): { report: number; gl: number; difference: number } | null {
  const period = periodOfMonth(month);
  if (!period) return null;
  const built = build(kind, period);
  return { report: built.report, gl: built.gl, difference: built.gl - built.report };
}

/* ----------------------------------------------------------------------------------- reports */

export const reports: Report[] = [];
const csvOf = new Map<string, string>();

const csvField = (value: Line[string]) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** The export as the backend stores it: UTF-8 with a BOM, CRLF, the line keys as columns. */
export function reportCsv(lines: Line[]): string {
  const columns = lines.length ? Object.keys(lines[0]!) : ["seq"];
  const body = [
    columns.join(","),
    ...lines.map((line) => columns.map((column) => csvField(line[column] ?? null)).join(",")),
  ];
  return `\uFEFF${body.join("\r\n")}\r\n`;
}

function apply(report: Report, built: Built) {
  Object.assign(report, {
    lines: built.lines,
    totals: built.totals,
    lineCount: built.lines.length,
    reportAmount: signed(built.report),
    glAmount: signed(built.gl),
    glDifference: signed(built.gl - built.report),
    generatedAt: bangkokIso(),
  });
}

export function generate(kind: Kind, month: string): Report | Response {
  const period = periodOfMonth(month);
  if (!period) return notFound("งวดบัญชี");
  const existing = reports.find((report) => report.kind === kind && report.period === month);
  if (existing && existing.status !== "draft")
    return problem(409, "tax.report_not_draft", "รายงานนี้ปิดแล้ว สร้างใหม่ไม่ได้");
  const report: Report = existing ?? {
    id: mockId("txr", reports.length + 1),
    kind,
    period: month,
    fiscalPeriodId: period.id,
    status: "draft",
    fileReady: false,
    filedAt: null,
    filingRef: null,
    finalisedAt: null,
    paidAmount: null,
    paidOn: null,
    generatedAt: bangkokIso(),
    lineCount: 0,
    lines: [],
    totals: {},
    reportAmount: "0.00",
    glAmount: "0.00",
    glDifference: "0.00",
  };
  apply(report, build(kind, period));
  if (!existing) reports.unshift(report);
  return report;
}

export function finalise(report: Report): Report | Response {
  if (report.status !== "draft") return problem(409, "tax.report_not_draft", "รายงานนี้ปิดแล้ว");
  const period = periodOfMonth(report.period)!;
  const built = build(report.kind, period);
  apply(report, built);
  if (built.gl !== built.report)
    return problem(
      422,
      "tax.gl_difference",
      `รายงาน ${signed(built.report)} ไม่ตรงกับบัญชีแยกประเภท ${signed(built.gl)} (ต่าง ${signed(built.gl - built.report)})`,
    );
  csvOf.set(report.id, reportCsv(built.lines));
  Object.assign(report, { status: "final", finalisedAt: bangkokIso(), fileReady: true });
  if (report.kind === "pp30") {
    const t = built.totals;
    const net = satangOf(t.outputVat!) - satangOf(t.inputVat!);
    post({
      rule: "P27",
      description: `ภ.พ.30 งวด ${report.period}`,
      documentDate: period.endDate < today() ? period.endDate : today(),
      source: { type: TAX_REPORT_SOURCE, id: report.id, number: `PP30-${report.period}` },
      lines: [
        { account: "2210", debit: satangOf(t.outputVat!), taxCode: "output_vat", taxBase: satangOf(t.outputBase!) },
        { account: "1241", credit: satangOf(t.inputVat!), taxCode: "input_vat", taxBase: satangOf(t.inputBase!) },
        net >= 0 ? { account: "2220", credit: net } : { account: "2220", debit: -net },
      ],
    });
  }
  return report;
}

/* ---------------------------------------------------------------------------------- calendar */

const FORMS = ["pp30", "pnd3", "pnd53"] as const;
type Form = (typeof FORMS)[number];

const addMonth = (month: string) => {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 7);
};

/** The months whose returns have fallen due or will: last month's, due this month (getpack-api `ensure`). */
export const calendar: Schemas["TaxCalendarItemDto"][] = [];
function ensureCalendar() {
  const setting = settingValue<Record<Form, { dayOfNextMonth: number }>>("tax.calendar");
  const month = previousMonth();
  for (const kind of FORMS) {
    if (calendar.some((item) => item.kind === kind && item.period === month)) continue;
    calendar.push({
      id: mockId("txc", calendar.length + 1),
      kind,
      period: month,
      dueOn: `${addMonth(month)}-${String(setting[kind].dayOfNextMonth).padStart(2, "0")}`,
      remindedAt: null,
      status: "open",
      taxReportId: null,
    });
  }
}

/* ------------------------------------------------------------------------------------- rates */

const LAUNCH = "2026-09-22T00:00:00+07:00";
const rate = (
  n: number,
  code: string,
  nameTh: string,
  nameEn: string,
  ratePct: string,
  description: string,
): Schemas["TaxRateDto"] => ({
  id: mockId("tax", n),
  code,
  nameTh,
  nameEn,
  description,
  versions: [
    {
      versionNo: 1,
      effectiveFrom: LAUNCH,
      ratePct,
      status: "approved",
      reason: "ค่าตั้งต้นตาม accounting-design §2 (⚖ รอผู้สอบบัญชียืนยัน)",
    },
  ],
});

export const taxRates: Schemas["TaxRateDto"][] = [
  rate(
    1,
    "vat_standard",
    "ภาษีมูลค่าเพิ่ม อัตราทั่วไป",
    "VAT, standard rate",
    "7",
    "Output VAT on sales; rate changes are dated, never edited in place (D-033)",
  ),
  rate(
    2,
    "wht_customer_hire_of_work",
    "ภาษีหัก ณ ที่จ่ายโดยลูกค้า ค่าจ้างทำของ",
    "Customer withholding tax, hire of work",
    "3",
    "Withheld by juristic / government customers on hire-of-work lines (D-033, D-174 ⚖)",
  ),
  rate(
    3,
    "wht_customer_transport",
    "ภาษีหัก ณ ที่จ่ายโดยลูกค้า ค่าขนส่ง",
    "Customer withholding tax, transport",
    "1",
    "Withheld by juristic / government customers on the shipping line (D-033, D-174 ⚖)",
  ),
  rate(
    4,
    "wht_customer_service",
    "ภาษีหัก ณ ที่จ่ายโดยลูกค้า ค่าบริการ",
    "Customer withholding tax, services",
    "3",
    "Withheld by juristic / government customers on design and other service lines (D-033, D-174 ⚖)",
  ),
  rate(
    5,
    "wht_hire_of_work",
    "ภาษีหัก ณ ที่จ่าย ค่าจ้างทำของ (ผู้ขาย)",
    "Vendor withholding tax, hire of work",
    "3",
    "Withheld from factory production lines at each payment, the advance included (D-022, D-033 ⚖)",
  ),
  rate(
    6,
    "wht_transport",
    "ภาษีหัก ณ ที่จ่าย ค่าขนส่ง (ผู้ขาย)",
    "Vendor withholding tax, transport",
    "1",
    "Withheld from factory shipping lines and carrier bills (D-022, D-114 ⚖)",
  ),
  rate(
    7,
    "wht_service",
    "ภาษีหัก ณ ที่จ่าย ค่าบริการ (ผู้ขาย)",
    "Vendor withholding tax, services",
    "3",
    "Withheld from design freelancers (ภ.ง.ด.3) and other services (D-071, D-033 ⚖)",
  ),
];

/** Proposed versions by approval request, so the decision applies the right one. */
const rateProposals = new Map<string, { code: string; versionNo: number }>();

onApprovalDecided("tax_setting_change", (approval, outcome) => {
  const proposal = rateProposals.get(approval.id);
  const version = taxRates
    .find((item) => item.code === proposal?.code)
    ?.versions.find((candidate) => candidate.versionNo === proposal?.versionNo);
  if (version) version.status = outcome === "approved" ? "approved" : "rejected";
});

/* ------------------------------------------------------------------------------------ series */

const SERIES: [Schemas["DocumentType"], string, string, Schemas["SequenceReset"], boolean, string][] = [
  ["iv", "IV", "{prefix}{yyyy}-{seq:5}", "yearly", true, "ใบแจ้งหนี้ / ใบกำกับภาษี (ข้อมูลจำลอง)"],
  ["tr", "TR", "{prefix}{yyyy}{mm}-{seq:5}", "monthly", true, "ใบเสร็จรับเงิน / ใบกำกับภาษี (ข้อมูลจำลอง)"],
  ["rc", "RC", "{prefix}{yyyy}{mm}-{seq:5}", "monthly", true, "ใบเสร็จรับเงิน (ข้อมูลจำลอง)"],
  ["cn", "CN", "{prefix}{yyyy}{mm}-{seq:5}", "monthly", true, "ใบลดหนี้ (ข้อมูลจำลอง)"],
  ["dn", "DN", "{prefix}{yyyy}{mm}-{seq:5}", "monthly", true, "ใบเพิ่มหนี้ (ข้อมูลจำลอง)"],
  ["po", "PO", "{prefix}{yyyy}{mm}-{seq:5}", "monthly", false, "ใบสั่งจ้างโรงงาน (ข้อมูลจำลอง)"],
  ["gr", "GR", "{prefix}{yyyy}{mm}-{seq:5}", "monthly", false, "ใบรับสินค้า (ข้อมูลจำลอง)"],
  ["bs", "BS", "{prefix}{yyyy}{mm}-{seq:5}", "monthly", false, "ใบวางบิลของโรงงาน (ข้อมูลจำลอง)"],
  ["pv", "PV", "{prefix}{yyyy}{mm}-{seq:5}", "monthly", true, "ใบสำคัญจ่าย (ข้อมูลจำลอง)"],
  ["wt", "WT", "{prefix}{yyyy}-{seq:5}", "yearly", true, "หนังสือรับรองการหักภาษี ณ ที่จ่าย 50 ทวิ (ข้อมูลจำลอง)"],
  ["jv", "JV", "{prefix}{yyyy}{mm}-{seq:5}", "monthly", true, "ใบสำคัญทั่วไป (ข้อมูลจำลอง)"],
];

export const documentSeries: Schemas["DocumentSeriesDto"][] = SERIES.map(
  ([docType, prefix, format, resetPeriod, isGapless, description], index) => ({
    id: mockId("dse", index + 1),
    docType,
    prefix,
    format,
    resetPeriod,
    isGapless,
    description,
    entityCode: "CGT",
    createdAt: LAUNCH,
  }),
);

/* ---------------------------------------------------------------------------------- handlers */

const find = (id: string | undefined) => reports.find((report) => report.id === id);
const summaryOf = ({ lines: _lines, ...summary }: Report): Schemas["TaxReportSummaryDto"] => summary;

export const taxHandlers = [
  finance.get("/v1/admin/tax-reports", "tax.read", ({ query }) =>
    reports
      .filter((report) => !query.period || report.period === query.period)
      .filter((report) => !query.kind || report.kind === query.kind)
      .map(summaryOf),
  ),
  finance.post("/v1/admin/tax-reports", { permission: "tax.manage", idempotent: true, status: 201 }, ({ body }) => {
    if (!body?.period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.period))
      return invalid([{ path: "period", code: "pattern", message: "YYYY-MM" }]);
    return generate(body.kind, body.period);
  }),
  finance.get(
    "/v1/admin/tax-reports/{reportId}",
    "tax.read",
    ({ params }) => find(params.reportId) ?? notFound("รายงานภาษี"),
  ),
  finance.post(
    "/v1/admin/tax-reports/{reportId}/actions/finalise",
    { permission: "tax.manage", idempotent: true },
    ({ params }) => {
      const report = find(params.reportId);
      return report ? finalise(report) : notFound("รายงานภาษี");
    },
  ),
  finance.post(
    "/v1/admin/tax-reports/{reportId}/actions/file",
    { permission: "tax.manage", idempotent: true },
    ({ params, body }) => {
      const report = find(params.reportId);
      if (!report) return notFound("รายงานภาษี");
      if (report.status !== "final") return problem(409, "tax.report_not_final", "ยื่นได้เมื่อรายงานปิดแล้ว");
      if (!body?.filingRef?.trim())
        return invalid([{ path: "filingRef", code: "required", message: "ระบุเลขอ้างอิงการยื่นแบบ" }]);
      Object.assign(report, {
        status: "filed",
        filingRef: body.filingRef.trim(),
        filedAt: body.filedAt ?? bangkokIso(),
      });
      const item = calendar.find((entry) => entry.kind === report.kind && entry.period === report.period);
      if (item) Object.assign(item, { status: "done", taxReportId: report.id });
      return report;
    },
  ),
  finance.post(
    "/v1/admin/tax-reports/{reportId}/actions/pay",
    { permission: "tax.pay", idempotent: true },
    ({ params, body }) => {
      const report = find(params.reportId);
      if (!report) return notFound("รายงานภาษี");
      if (!["pp30", "pnd3", "pnd53"].includes(report.kind) || report.status === "draft" || report.paidOn)
        return problem(409, "tax.report_not_payable", "รายงานนี้ชำระไม่ได้ หรือชำระแล้ว");
      if (!body?.paidOn || !/^\d{4}-\d{2}-\d{2}$/.test(body.paidOn))
        return invalid([{ path: "paidOn", code: "date", message: "YYYY-MM-DD" }]);
      const bank = companyAccounts.find(
        (account) => account.id === body.companyBankAccountId && account.status === "active",
      );
      if (!bank) return problem(409, "payouts.bank_account_missing", "ไม่พบบัญชีธนาคารของบริษัทที่ใช้งานได้");
      const amount =
        report.kind === "pp30" ? Math.max(satangOf(report.reportAmount), 0) : satangOf(report.reportAmount);
      Object.assign(report, { paidOn: body.paidOn, paidAmount: baht(amount) });
      if (amount === 0) return report;
      const source = {
        type: TAX_REPORT_SOURCE,
        id: report.id,
        number: `${report.kind.toUpperCase()}-${report.period}`,
      };
      if (report.kind === "pp30")
        post({
          rule: "P27P",
          description: `ชำระภาษีมูลค่าเพิ่ม งวด ${report.period}`,
          documentDate: body.paidOn,
          source,
          lines: [
            { account: "2220", debit: amount },
            { account: bank.glAccountCode, credit: amount },
          ],
        });
      else
        post({
          rule: "P28",
          description: `นำส่งภาษีหัก ณ ที่จ่าย ${report.kind} งวด ${report.period}`,
          documentDate: body.paidOn,
          source,
          lines: [
            {
              account: report.kind === "pnd3" ? "2232" : "2231",
              debit: amount,
              taxCode: report.kind === "pnd3" ? "wht_pnd3" : "wht_pnd53",
              taxBase: satangOf((report.totals as Record<string, string>).whtBase ?? "0.00"),
            },
            { account: bank.glAccountCode, credit: amount },
          ],
        });
      return report;
    },
  ),
  finance.get("/v1/admin/tax-reports/{reportId}/export", "tax.read", ({ params }) => {
    const report = find(params.reportId);
    if (!report) return notFound("รายงานภาษี");
    const csv = csvOf.get(report.id);
    if (!csv) return problem(409, "file.not_ready", "ส่งออกได้เมื่อรายงานปิดแล้ว");
    return {
      url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
      expiresAt: bangkokIso(15),
    };
  }),
  finance.get("/v1/admin/tax-calendar", "tax.read", ({ query }) => {
    ensureCalendar();
    return calendar
      .filter((item) => !query.status || item.status === query.status)
      .sort((a, b) => b.dueOn.localeCompare(a.dueOn) || a.kind.localeCompare(b.kind));
  }),
  finance.get("/v1/admin/tax/rates", "ledger.read", () => taxRates),
  finance.post(
    "/v1/admin/tax/rates/{code}/versions",
    { permission: "ledger.config.propose", status: 201 },
    ({ params, body, persona }) => {
      const item = taxRates.find((candidate) => candidate.code === params.code);
      if (!item) return notFound("อัตราภาษี");
      if (item.versions.some((version) => version.status === "proposed"))
        return problem(409, "ledger.change_pending", "อัตรานี้มีการเปลี่ยนแปลงรออนุมัติอยู่");
      const errors = [];
      if (!body?.ratePct || !/^\d{1,3}(\.\d{1,4})?$/.test(body.ratePct))
        errors.push({ path: "ratePct", code: "pattern", message: "ร้อยละ เช่น 7 หรือ 1.5" });
      if (!body?.reason || body.reason.trim().length < 3)
        errors.push({ path: "reason", code: "min", message: "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" });
      if (errors.length) return invalid(errors);
      if (!body.effectiveFrom || Date.parse(body.effectiveFrom) < Date.now() - 60_000)
        return problem(422, "settings.backdated", "วันที่มีผลต้องเป็นตอนนี้หรืออนาคต ย้อนหลังไม่ได้");
      const versionNo = item.versions.length + 1;
      item.versions.push({
        versionNo,
        effectiveFrom: body.effectiveFrom,
        ratePct: body.ratePct,
        reason: body.reason.trim(),
        status: "proposed",
      });
      const approval = openApproval({
        policy: "tax_setting_change",
        subjectType: "tax_rate_version",
        subjectId: item.id,
        requester: persona,
        pct: body.ratePct,
        payload: {
          code: item.code,
          versionNo,
          ratePct: body.ratePct,
          effectiveFrom: body.effectiveFrom,
          reason: body.reason.trim(),
        },
      });
      rateProposals.set(approval.id, { code: item.code, versionNo });
      return HttpResponse.json(item, { status: 201 });
    },
  ),
  finance.get("/v1/admin/document-series", "document_series.read", () => documentSeries),
  finance.post("/v1/admin/document-series", { permission: "document_series.manage", status: 201 }, ({ body }) => {
    if (documentSeries.some((series) => series.docType === body.docType))
      return problem(409, "numbering.series_exists", "มีชุดเลขที่ของเอกสารประเภทนี้แล้ว");
    const errors = [];
    if (!/^[A-Z0-9-]{1,10}$/.test(body.prefix ?? ""))
      errors.push({ path: "prefix", code: "pattern", message: "A–Z 0–9 และ - ไม่เกิน 10 ตัว" });
    if (!/\{seq:\d\}/.test(body.format ?? ""))
      errors.push({ path: "format", code: "pattern", message: "รูปแบบต้องมี {seq:N}" });
    if (!body.description?.trim()) errors.push({ path: "description", code: "required", message: "ระบุคำอธิบาย" });
    if (errors.length) return invalid(errors);
    const created: Schemas["DocumentSeriesDto"] = {
      id: mockId("dse", documentSeries.length + 1),
      docType: body.docType,
      prefix: body.prefix,
      format: body.format,
      resetPeriod: body.resetPeriod,
      isGapless: body.isGapless,
      description: body.description.trim(),
      entityCode: "CGT",
      createdAt: bangkokIso(),
    };
    documentSeries.push(created);
    return created;
  }),
];
