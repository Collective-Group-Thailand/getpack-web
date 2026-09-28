/**
 * The books behind every finance mock (packio-api B5.1, published): the chart of accounts from
 * accounting-design §3, one fiscal year of monthly periods, and the journal.
 *
 * Every other finance mock posts through `post()`, which refuses an entry whose debits and
 * credits differ — so the trial balance, the tax working papers and the sub-ledger
 * reconciliations the F6 screens show are sums over the same entries, and a difference of zero
 * is a property of the data rather than a number someone typed. Amounts are satang (integers)
 * inside the mock and decimal strings on the wire, as the contract says.
 *
 * Obviously fake: codes and names are the design's defaults, the entity is a placeholder.
 */

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, mockId } from "../../support";
import { baht } from "../commerce";

type Account = Schemas["AccountDto"];
type Journal = Schemas["JournalDto"];
type JournalLine = Schemas["JournalLineDto"];
type Dimensions = Schemas["JournalLineDimensionsDto"];
type FiscalYear = Schemas["FiscalYearDto"];
type Period = Schemas["FiscalPeriodDto"];

/* ------------------------------------------------------------------------------ the entity */

/** The issuing entity (D-092) — the settings `entity.*` hold the real one. */
export const SELLER: Schemas["DocumentPartyDto"] = {
  name: "บริษัท คอลเลคทีฟ กรุ๊ป (ประเทศไทย) จำกัด (ข้อมูลจำลอง)",
  taxId: "0105566000000",
  branchCode: "00000",
  address: "99 อาคารตัวอย่าง ถนนตัวอย่าง กรุงเทพมหานคร 10110",
};

/* -------------------------------------------------------------------- chart of accounts §3 */

type Seed = [
  code: string,
  nameTh: string,
  nameEn: string,
  type: Account["accountType"],
  cashFlow: Account["cashFlowClass"],
  options?: { control?: boolean; heading?: boolean; parent?: string; required?: Account["requiredDimensions"] },
];

const SEEDS: Seed[] = [
  ["1000", "สินทรัพย์", "Assets", "asset", "non_cash", { heading: true }],
  ["1110", "เงินสดในมือ", "Cash on hand", "asset", "cash", { parent: "1000" }],
  ["1121", "เงินฝากธนาคาร — ไทยพาณิชย์ กระแสรายวัน", "Bank — SCB current", "asset", "cash", { parent: "1000" }],
  ["1122", "เงินฝากธนาคาร — กสิกรไทย ออมทรัพย์", "Bank — KBank savings", "asset", "cash", { parent: "1000" }],
  ["1131", "บัญชีพัก — 2C2P", "Clearing — 2C2P", "asset", "operating", { parent: "1000" }],
  ["1132", "บัญชีพัก — SCB", "Clearing — SCB", "asset", "operating", { parent: "1000" }],
  [
    "1133",
    "บัญชีพัก — สลิปรอจับคู่ธนาคาร",
    "Clearing — slips pending bank match",
    "asset",
    "operating",
    { parent: "1000" },
  ],
  [
    "1140",
    "เงินรับที่ยังไม่ระบุผู้โอน",
    "Undeposited / unidentified receipts",
    "asset",
    "operating",
    { parent: "1000" },
  ],
  [
    "1210",
    "ลูกหนี้การค้า",
    "Trade receivables",
    "asset",
    "operating",
    { parent: "1000", control: true, required: ["customer"] },
  ],
  ["1219", "ค่าเผื่อหนี้สงสัยจะสูญ", "Allowance for doubtful accounts", "asset", "operating", { parent: "1000" }],
  ["1230", "ภาษีถูกหัก ณ ที่จ่าย", "WHT receivable", "asset", "operating", { parent: "1000" }],
  ["1241", "ภาษีซื้อ", "Input VAT", "asset", "operating", { parent: "1000" }],
  [
    "1242",
    "ภาษีซื้อยังไม่ถึงกำหนด / รอเอกสาร",
    "Input VAT not yet due / pending document",
    "asset",
    "operating",
    { parent: "1000" },
  ],
  [
    "1250",
    "เงินจ่ายล่วงหน้าโรงงาน",
    "Advances to factories",
    "asset",
    "operating",
    { parent: "1000", control: true, required: ["factory"] },
  ],
  ["1260", "ลูกหนี้เคลมจากโรงงาน", "Claims receivable from factories", "asset", "operating", { parent: "1000" }],
  ["1270", "ลูกหนี้อื่น", "Other receivables", "asset", "operating", { parent: "1000" }],
  ["1510", "สินทรัพย์ถาวร", "Fixed assets", "asset", "investing", { parent: "1000" }],
  ["1519", "ค่าเสื่อมราคาสะสม", "Accumulated depreciation", "asset", "non_cash", { parent: "1000" }],
  ["2000", "หนี้สิน", "Liabilities", "liability", "non_cash", { heading: true }],
  [
    "2110",
    "เจ้าหนี้การค้า — โรงงาน",
    "Trade payables — factories",
    "liability",
    "operating",
    { parent: "2000", control: true, required: ["factory"] },
  ],
  [
    "2120",
    "เจ้าหนี้การค้า — ผู้ขายอื่น",
    "Trade payables — other vendors",
    "liability",
    "operating",
    { parent: "2000", control: true, required: ["vendor"] },
  ],
  ["2130", "เงินประกันผลงานโรงงาน", "Factory retention payable", "liability", "operating", { parent: "2000" }],
  ["2210", "ภาษีขาย", "Output VAT", "liability", "operating", { parent: "2000" }],
  ["2211", "ภาษีขายยังไม่ถึงกำหนด", "Output VAT not yet due", "liability", "operating", { parent: "2000" }],
  ["2220", "ภาษีมูลค่าเพิ่มค้างจ่าย (ภ.พ.30)", "VAT payable (PP30 net)", "liability", "operating", { parent: "2000" }],
  ["2231", "ภาษีหัก ณ ที่จ่ายค้างจ่าย — ภ.ง.ด.53", "WHT payable — PND53", "liability", "operating", { parent: "2000" }],
  ["2232", "ภาษีหัก ณ ที่จ่ายค้างจ่าย — ภ.ง.ด.3", "WHT payable — PND3", "liability", "operating", { parent: "2000" }],
  [
    "2310",
    "เงินรับล่วงหน้าจากลูกค้า",
    "Customer advances / contract liabilities",
    "liability",
    "operating",
    { parent: "2000" },
  ],
  ["2320", "ยอดเครดิตคงเหลือของลูกค้า", "Customer credit balances", "liability", "operating", { parent: "2000" }],
  ["2330", "หนี้สินคะแนนสะสม", "Loyalty points liability", "liability", "operating", { parent: "2000" }],
  ["2340", "เงินรับที่ยังไม่ได้ตัดชำระ", "Unapplied receipts", "liability", "operating", { parent: "2000" }],
  ["2410", "ค่าใช้จ่ายค้างจ่าย", "Accrued expenses", "liability", "operating", { parent: "2000" }],
  ["3000", "ส่วนของผู้ถือหุ้น", "Equity", "equity", "non_cash", { heading: true }],
  ["3100", "ทุนจดทะเบียนที่ชำระแล้ว", "Share capital", "equity", "financing", { parent: "3000" }],
  ["3200", "กำไรสะสม", "Retained earnings", "equity", "equity", { parent: "3000" }],
  ["3300", "กำไรปีปัจจุบัน", "Current-year profit", "equity", "equity", { parent: "3000" }],
  ["4000", "รายได้", "Revenue", "revenue", "non_cash", { heading: true }],
  [
    "4110",
    "รายได้ขาย — บรรจุภัณฑ์สั่งผลิต",
    "Sales — made-to-order packaging",
    "revenue",
    "operating",
    { parent: "4000" },
  ],
  ["4120", "รายได้ขาย — สินค้ามาตรฐาน", "Sales — standard products", "revenue", "operating", { parent: "4000" }],
  ["4130", "รายได้ค่าออกแบบ", "Design services", "revenue", "operating", { parent: "4000" }],
  ["4140", "รายได้ค่าตัวอย่าง / ม็อกอัป", "Mockup / sample fees", "revenue", "operating", { parent: "4000" }],
  ["4150", "รายได้ค่าขนส่ง", "Shipping income", "revenue", "operating", { parent: "4000" }],
  ["4160", "รายได้ค่าแก้ไขเพิ่มเติม", "Extra revision / service fees", "revenue", "operating", { parent: "4000" }],
  ["4910", "ส่วนลดจ่ายและโปรโมชัน", "Sales discounts & promotions", "revenue", "operating", { parent: "4000" }],
  ["4920", "รับคืนและส่วนลดหลังการขาย", "Sales returns & allowances", "revenue", "operating", { parent: "4000" }],
  ["4930", "การใช้คะแนนสะสม", "Points redemption", "revenue", "operating", { parent: "4000" }],
  ["4990", "รายได้อื่น", "Other income", "revenue", "operating", { parent: "4000" }],
  ["5000", "ต้นทุนขาย", "Cost of sales", "cost_of_sales", "non_cash", { heading: true }],
  [
    "5110",
    "ต้นทุนผลิต — โรงงานพาร์ตเนอร์",
    "Production cost — partner factories",
    "cost_of_sales",
    "operating",
    { parent: "5000" },
  ],
  [
    "5120",
    "ต้นทุนขนส่ง — ค่าส่งของโรงงาน",
    "Shipping cost — factory delivery payout",
    "cost_of_sales",
    "operating",
    { parent: "5000" },
  ],
  [
    "5130",
    "ต้นทุนขนส่ง — ขนส่งภายนอก",
    "Shipping cost — external carriers",
    "cost_of_sales",
    "operating",
    { parent: "5000" },
  ],
  ["5140", "ต้นทุนออกแบบภายนอก", "Design outsourcing", "cost_of_sales", "operating", { parent: "5000" }],
  ["5150", "ต้นทุนตัวอย่าง / ม็อกอัป", "Mockup / sample cost", "cost_of_sales", "operating", { parent: "5000" }],
  ["5190", "ต้นทุนเคลมสุทธิ", "Claim costs net of recoveries", "cost_of_sales", "operating", { parent: "5000" }],
  ["6000", "ค่าใช้จ่ายในการดำเนินงาน", "Operating expenses", "expense", "non_cash", { heading: true }],
  ["6110", "ค่าธรรมเนียมรับชำระเงิน", "Payment gateway fees", "expense", "operating", { parent: "6000" }],
  ["6120", "ค่าใช้จ่ายโปรโมชันและคะแนนสะสม", "Promotion & loyalty expense", "expense", "operating", { parent: "6000" }],
  ["6130", "หนี้สูญ", "Bad debts", "expense", "operating", { parent: "6000" }],
  ["6140", "ค่าธรรมเนียมธนาคาร", "Bank charges", "expense", "operating", { parent: "6000" }],
  ["6150", "ค่าเสื่อมราคา", "Depreciation", "expense", "non_cash", { parent: "6000" }],
  ["6900", "ค่าใช้จ่ายอื่น", "Other expenses", "expense", "operating", { parent: "6000" }],
];

const DEBIT_NORMAL = new Set<Account["accountType"]>(["asset", "cost_of_sales", "expense"]);
/** Contra accounts sit against their type's normal side. */
const CONTRA = new Set(["1219", "1519", "4910", "4920", "4930"]);

export const ACCOUNTS: Account[] = SEEDS.map(([code, nameTh, nameEn, accountType, cashFlowClass, options], index) => {
  const debitNormal = DEBIT_NORMAL.has(accountType) !== CONTRA.has(code);
  return {
    id: mockId("acc", index + 1),
    code,
    nameTh,
    nameEn,
    accountType,
    cashFlowClass,
    normalSide: debitNormal ? "debit" : "credit",
    isControl: options?.control ?? false,
    isPostable: !options?.heading,
    parentCode: options?.parent ?? null,
    requiredDimensions: options?.required ?? [],
    allowedDimensions: [
      "order",
      "order_group",
      "customer",
      "company",
      "factory",
      "vendor",
      "product_type",
      "channel",
      "campaign",
      "promotion",
      "cost_centre",
    ],
    status: "active",
  };
});

export const accountOf = (code: string): Account => {
  const account = ACCOUNTS.find((candidate) => candidate.code === code);
  if (!account) throw new Error(`[finance mock] no account ${code}`);
  return account;
};

/* ---------------------------------------------------------------------------------- periods */

/** `YYYY-MM` of a Bangkok date-time or date. */
export const monthOf = (at: string) => at.slice(0, 7);
export const today = () => bangkokIso().slice(0, 10);
export const currentMonth = () => monthOf(today());

function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const index = year * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}
export const previousMonth = () => shiftMonth(currentMonth(), -1);

function lastDay(month: string): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return `${month}-${String(new Date(Date.UTC(year, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/**
 * One fiscal year, the calendar year of "now". Months before last month are closed (the new
 * business had nothing in them, D-092); last month is still open while its close runs; this month
 * is open.
 */
function buildYear(): FiscalYear {
  const year = Number(currentMonth().slice(0, 4));
  const periods: Period[] = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const status: Period["status"] = month < previousMonth() ? "closed" : "open";
    return {
      id: mockId("prd", year * 100 + index + 1),
      periodNo: index + 1,
      startDate: `${month}-01`,
      endDate: lastDay(month),
      status,
      statusChangedAt: status === "closed" ? `${lastDay(month)}T18:00:00+07:00` : null,
    };
  });
  return {
    id: mockId("fy", year),
    label: `FY${year}`,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    status: "open",
    periods,
  };
}

export const fiscalYears: FiscalYear[] = [buildYear()];

export function periodOfDate(date: string): Period | undefined {
  return fiscalYears.flatMap((year) => year.periods).find((p) => p.startDate <= date && p.endDate >= date);
}

/** The first period on or after `date` that still takes postings (§1.4: late items move forward). */
export function postingPeriod(date: string, allowSoftClosed = false): Period {
  const periods = fiscalYears.flatMap((year) => year.periods).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const open = periods.find(
    (p) => p.endDate >= date && (p.status === "open" || (allowSoftClosed && p.status === "soft_closed")),
  );
  if (!open) throw new Error(`[finance mock] no open period on or after ${date}`);
  return open;
}

/* ---------------------------------------------------------------------------------- journal */

export interface PostLine {
  account: string;
  /** Satang. Exactly one of debit / credit. */
  debit?: number;
  credit?: number;
  description?: string | null;
  dimensions?: Dimensions;
  taxCode?: JournalLine["taxCode"];
  /** Satang: the base a tax line was computed on (the working papers read it). */
  taxBase?: number;
}

export interface PostInput {
  /** P01–P30, FA01…, or null for a manual journal. */
  rule: string | null;
  kind?: Journal["kind"];
  description: string;
  /** The source document's own date (tax reporting keeps it, §1.4). */
  documentDate: string;
  source: Journal["source"];
  lines: PostLine[];
  createdBy?: string | null;
  approvedBy?: string | null;
  status?: Journal["status"];
  jvNumber?: string | null;
  reversesId?: string | null;
  approvalRequestId?: string | null;
  autoReverseOn?: string | null;
  /** The instant it was posted; defaults to now. */
  postedAt?: string;
}

export const journals: Journal[] = [];

let entrySeq = 0;
let eventSeq = 0;

/** Sum of a side, satang, from decimal strings — the mock's arithmetic, never the UI's. */
export const satangOf = (amount: string) => Math.round(Number(amount) * 100);

export function toLines(lines: PostLine[]): JournalLine[] {
  return lines.map((line, index) => ({
    lineNo: index + 1,
    accountCode: line.account,
    accountName: accountOf(line.account).nameTh,
    debit: baht(line.debit ?? 0),
    credit: baht(line.credit ?? 0),
    description: line.description ?? null,
    dimensions: line.dimensions ?? {},
    taxCode: line.taxCode ?? null,
    taxBaseAmount: line.taxBase === undefined ? null : baht(line.taxBase),
  }));
}

/**
 * Posts one entry. Throws on an unbalanced entry, a zero line or a heading account — the mock's
 * own bug, loud on purpose (the backend answers `ledger.unbalanced`).
 */
export function post(input: PostInput): Journal {
  const lines = input.lines.filter((line) => (line.debit ?? 0) !== 0 || (line.credit ?? 0) !== 0);
  const debit = lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
  const credit = lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
  if (debit !== credit) throw new Error(`[finance mock] unbalanced ${input.rule}: ${debit} ≠ ${credit}`);
  for (const line of lines) {
    if (!accountOf(line.account).isPostable) throw new Error(`[finance mock] ${line.account} is a heading`);
    if ((line.debit ?? 0) < 0 || (line.credit ?? 0) < 0) throw new Error(`[finance mock] negative line`);
  }
  const posted = (input.status ?? "posted") === "posted";
  const period = postingPeriod(input.documentDate);
  const entryDate = input.documentDate < period.startDate ? period.startDate : input.documentDate;
  entrySeq += 1;
  const journal: Journal = {
    id: mockId("jnl", entrySeq),
    entryNo: posted ? `JE-${entryDate.slice(0, 7).replace("-", "")}-${String(entrySeq).padStart(5, "0")}` : null,
    jvNumber: input.jvNumber ?? null,
    kind: input.kind ?? (input.rule ? "auto" : "manual"),
    status: input.status ?? "posted",
    description: input.description,
    documentDate: input.documentDate,
    entryDate,
    periodId: period.id,
    currency: "THB",
    postingRule: input.rule,
    postingRuleVersion: input.rule ? 1 : null,
    source: input.source,
    domainEventId: input.rule || input.kind === "auto" ? mockId("evt", ++eventSeq) : null,
    createdBy: input.createdBy ?? null,
    approvedBy: input.approvedBy ?? null,
    approvalRequestId: input.approvalRequestId ?? null,
    autoReverseOn: input.autoReverseOn ?? null,
    postedAt: posted ? (input.postedAt ?? bangkokIso()) : null,
    rejectionReason: null,
    reversesId: input.reversesId ?? null,
    reversedById: null,
    totalDebit: baht(debit),
    totalCredit: baht(credit),
    lines: toLines(lines),
  };
  journals.push(journal);
  return journal;
}

/** Journals a source document produced, newest last. */
export const journalsOf = (sourceType: string, sourceId: string) =>
  journals.filter((journal) => journal.source?.type === sourceType && journal.source.id === sourceId);

/**
 * Net movement of an account over posted entries (debit − credit, satang), optionally within a
 * date range on the entry date and filtered by a line predicate.
 */
export function movement(
  code: string,
  options: { from?: string; to?: string; where?: (line: JournalLine, journal: Journal) => boolean } = {},
): number {
  let total = 0;
  for (const journal of journals) {
    if (journal.status !== "posted") continue;
    if (options.from && journal.entryDate < options.from) continue;
    if (options.to && journal.entryDate > options.to) continue;
    for (const line of journal.lines) {
      if (line.accountCode !== code) continue;
      if (options.where && !options.where(line, journal)) continue;
      total += satangOf(line.debit) - satangOf(line.credit);
    }
  }
  return total;
}

export const monthRange = (month: string) => ({ from: `${month}-01`, to: lastDay(month) });
