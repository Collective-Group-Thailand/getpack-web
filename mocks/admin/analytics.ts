/**
 * Demand analytics, the partner prospectus and operational reports on the published contract
 * (`admin.analytics.*`, `admin.reports.*`, U-F0.3), plus the journey funnels that are still a
 * request (CONTRACT-REQUEST admin.analytics-journeys, getpack-api U5.B6).
 *
 * Figures are deterministic per period so a screen and its test agree. Every dashboard takes an
 * explicit `from` / `to` (Asia/Bangkok) and answers the topic's rollup; staff dashboards are not
 * k-suppressed — k ≥ 3 (D-044, D-160, `analytics.prospectus_min_group_size`) applies to the
 * prospectus, whose export reports the threshold it used. Money is decimal strings throughout.
 *
 * The reports are getpack-api's definitions (`src/modules/reports/definitions`): names, filters,
 * columns (a subset) and the data permission of each; the rows are generated from the column types.
 */

import { http, HttpResponse, type JsonBodyType } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { bangkokIso, mockId, problem } from "../support";
import { PRODUCT_TYPES } from "./catalog";
import { catalogueRows } from "./catalogue";
import { baht } from "./commerce";
import { factoryTiers } from "./partners";

type Ref = Schemas["AnalyticsRefDto"];
type Dimension = Schemas["DemandDimension"];
type ReportKey = Schemas["ReportKey"];
type ColumnType = Schemas["ReportColumnType"];
type Filters = Schemas["ReportFiltersDto"];
type Resolved = Schemas["ResolvedReportFiltersDto"];

const DAY_MS = 86_400_000;
/** The mock's value of `analytics.prospectus_min_group_size` (D-160); the screen shows what comes back. */
const K_THRESHOLD = 3;
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const unauthenticated = () => problem(401, "auth.unauthenticated", "กรุณาเข้าสู่ระบบ");
const notReady = () => problem(409, "file.not_ready", "ไฟล์ยังไม่พร้อม");
const badRange = () =>
  problem(422, "validation.failed", "ช่วงวันที่ไม่ถูกต้อง", [{ path: "from", code: "range", message: "จาก ≤ ถึง" }]);
const pctOf = (part: number, whole: number) => (whole ? ((part / whole) * 100).toFixed(2) : null);

function days(from: string, to: string): number {
  return Math.max(
    1,
    Math.round((Date.parse(`${to}T00:00:00+07:00`) - Date.parse(`${from}T00:00:00+07:00`)) / DAY_MS) + 1,
  );
}
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00+07:00`) + n * DAY_MS + 7 * 3_600_000).toISOString().slice(0, 10);
const isDate = (value: string | null | undefined): value is string =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

/** `from` / `to` are required dates, `to` at most 366 days after `from` (the contract's rule). */
function rangeOf(request: Request): [string, string] | Response {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isDate(from) || !isDate(to) || from > to || days(from, to) > 367) return badRange();
  return [from, to];
}

function allowed(request: Request, ...permissions: string[]) {
  const who = staffPersonaOf(request);
  return who && permissions.every((permission) => can(who, permission)) ? who : null;
}

const wave = (i: number) => 1 + 0.35 * Math.sin(i / 2.3) + (i % 7 === 5 || i % 7 === 6 ? -0.25 : 0);

function typeRef(code: string): Ref {
  const type = PRODUCT_TYPES.find((candidate) => candidate.code === code);
  return type
    ? { id: type.id, code: type.code, nameTh: type.nameTh, nameEn: type.nameEn }
    : { id: null, code, nameTh: code, nameEn: code };
}

function provinceRef(code: string, nameTh: string, nameEn: string): Ref {
  const row = catalogueRows("provinces").find((candidate) => candidate.code === code);
  return { id: typeof row?.id === "string" ? row.id : null, code, nameTh, nameEn };
}

/* ------------------------------------------------------------------------ sales and traffic */

function dailySales(from: string, to: string) {
  return Array.from({ length: days(from, to) }, (_, i) => {
    const groupsPaid = Math.max(1, Math.round(9 * wave(i)));
    const gmv = groupsPaid * 1_684_000;
    return {
      period: addDays(from, i),
      groupsPaid,
      groupsPlaced: groupsPaid + 2 + (i % 3),
      gmv,
      net: Math.round(gmv / 1.07),
      sessions: Math.round(9 * wave(i) * 6.2 * 7),
    };
  });
}

function salesPoint(day: {
  period: string;
  groupsPaid: number;
  groupsPlaced: number;
  gmv: number;
  net: number;
}): Schemas["SalesPointDto"] {
  return {
    period: day.period,
    groupsPaid: day.groupsPaid,
    groupsPlaced: day.groupsPlaced,
    gmv: baht(day.gmv),
    netSales: baht(day.net),
    aov: day.groupsPaid ? baht(Math.round(day.gmv / day.groupsPaid)) : null,
    repeatRatePct: day.groupsPaid ? "31.40" : null,
  };
}

function totalOf(series: ReturnType<typeof dailySales>) {
  const sum = (key: "groupsPaid" | "groupsPlaced" | "gmv" | "net" | "sessions") =>
    series.reduce((total, day) => total + day[key], 0);
  return {
    groupsPaid: sum("groupsPaid"),
    groupsPlaced: sum("groupsPlaced"),
    gmv: sum("gmv"),
    net: sum("net"),
    sessions: sum("sessions"),
  };
}

function sales(from: string, to: string): Schemas["SalesReportDto"] {
  const series = dailySales(from, to);
  const total = totalOf(series);
  const share = (part: number) => ({
    groupsPaid: Math.round(total.groupsPaid * part),
    gmv: baht(Math.round(total.gmv * part)),
  });
  return {
    series: series.map(salesPoint),
    totals: salesPoint({ period: from, ...total }),
    sessionConversionPct: pctOf(total.groupsPaid, total.sessions),
    byChannel: [
      { key: "web", ...share(0.58) },
      { key: "cs", ...share(0.27) },
      { key: "b2b", ...share(0.15) },
    ],
    bySegment: [
      { key: "new", ...share(0.69) },
      { key: "returning", ...share(0.31) },
    ],
    byProductType: (
      [
        ["folding_carton", 0.46],
        ["corrugated", 0.28],
        ["paper_bag", 0.12],
        ["label_sticker", 0.09],
        ["rigid_box", 0.05],
      ] as const
    ).map(([code, part]) => ({
      productType: typeRef(code),
      ordersPaid: Math.round(total.groupsPaid * part * 1.2),
      quantityPaid: String(Math.round(total.groupsPaid * part * 1_900)),
      gmv: baht(Math.round(total.gmv * part)),
    })),
  };
}

function traffic(from: string, to: string): Schemas["TrafficReportDto"] {
  const series = dailySales(from, to).map((day) => ({
    period: day.period,
    sessions: day.sessions,
    visitorDays: Math.round(day.sessions * 0.82),
    pageViews: day.sessions * 4,
    unconsentedPageViews: Math.round(day.sessions * 0.9),
  }));
  const sum = (key: "sessions" | "visitorDays" | "pageViews" | "unconsentedPageViews") =>
    series.reduce((total, point) => total + point[key], 0);
  return {
    series,
    totals: {
      period: from,
      sessions: sum("sessions"),
      visitorDays: sum("visitorDays"),
      pageViews: sum("pageViews"),
      unconsentedPageViews: sum("unconsentedPageViews"),
    },
    sources: [],
    devices: [],
  };
}

function funnel(from: string, to: string): Schemas["FunnelReportDto"] {
  const total = totalOf(dailySales(from, to));
  const counts: [Schemas["FunnelStep"], number][] = [
    ["visit", total.sessions],
    ["configure", Math.round(total.sessions * 0.42)],
    ["quote", Math.round(total.sessions * 0.14)],
    ["cart", Math.round(total.sessions * 0.044)],
    ["checkout", Math.round(total.sessions * 0.031)],
    ["placed", total.groupsPlaced],
    ["paid", total.groupsPaid],
  ];
  return {
    productType: null,
    steps: counts.map(([step, count], index) => ({
      step,
      sessions: count,
      fromPreviousPct: index === 0 ? null : pctOf(count, counts[index - 1]![1]),
      fromVisitPct: index === 0 ? null : pctOf(count, total.sessions),
    })),
  };
}

/* ----------------------------------------------------------------------------------- demand */

type Cell = Pick<Schemas["DemandRowDto"], "productType" | "province" | "specBand" | "quantityBand" | "channel">;

function groups(dimension: Dimension): [Partial<Cell>, number][] {
  switch (dimension) {
    case "product_type":
      return (
        [
          ["folding_carton", 1],
          ["corrugated", 0.72],
          ["paper_bag", 0.41],
          ["label_sticker", 0.35],
          ["rigid_box", 0.22],
          ["food_packaging", 0.19],
          ["pop_display", 0.03],
        ] as const
      ).map(([code, weight]) => [{ productType: typeRef(code) }, weight]);
    case "spec_band":
      return (
        [
          ["W100-L100-H50", 1],
          ["W150-L200-H100", 0.8],
          ["W200-L300-H100", 0.34],
          ["W300-L400-H200", 0.27],
          ["W500-L600-H400", 0.18],
        ] as const
      ).map(([band, weight]) => [{ specBand: band }, weight]);
    case "quantity_band":
      return (
        [
          ["1-499", 0.62],
          ["500-999", 1],
          ["1000-4999", 0.74],
          ["5000-9999", 0.29],
          ["10000+", 0.12],
        ] as const
      ).map(([band, weight]) => [{ quantityBand: band }, weight]);
    case "province":
      return (
        [
          ["10", "กรุงเทพมหานคร", "Bangkok", 1],
          ["12", "นนทบุรี", "Nonthaburi", 0.31],
          ["20", "ชลบุรี", "Chon Buri", 0.24],
          ["50", "เชียงใหม่", "Chiang Mai", 0.17],
          ["40", "ขอนแก่น", "Khon Kaen", 0.09],
          ["90", "สงขลา", "Songkhla", 0.06],
          ["96", "นราธิวาส", "Narathiwat", 0.004],
        ] as const
      ).map(([code, th, en, weight]) => [{ province: provinceRef(code, th, en) }, weight]);
    case "channel":
      return (
        [
          ["web", 1],
          ["cs", 0.46],
          ["line", 0.21],
          ["b2b", 0.12],
        ] as const
      ).map(([channel, weight]) => [{ channel }, weight]);
  }
}

function demand(from: string, to: string, dimension: Dimension): Schemas["DemandRowDto"][] {
  const scale = days(from, to) * 11;
  return groups(dimension).map(([cell, weight], index) => {
    const savedQuotes = Math.round(scale * weight);
    const rfqsSubmitted = Math.round(savedQuotes * (index === 3 ? 0.45 : 0.12));
    return {
      productType: null,
      province: null,
      specBand: null,
      quantityBand: null,
      channel: null,
      ...cell,
      calculations: savedQuotes * 4,
      instantCalculations: Math.round(savedQuotes * 3.4),
      savedQuotes,
      convertedQuotes: Math.max(0, Math.round(savedQuotes * (0.16 - index * 0.012))),
      routedToRfq: Math.round(rfqsSubmitted * 1.2),
      rfqsSubmitted,
      rfqsQuoted: Math.round(rfqsSubmitted * 0.8),
      rfqsAccepted: Math.round(rfqsSubmitted * 0.35),
      rfqsDeclined: Math.round(rfqsSubmitted * 0.15),
      rfqsExpired: Math.round(rfqsSubmitted * 0.1),
      avgFirstResponseMinutes: rfqsSubmitted ? (95 + index * 12.5).toFixed(2) : null,
    };
  });
}

const DIMENSIONS: readonly Dimension[] = ["product_type", "spec_band", "quantity_band", "province", "channel"];

function groupByOf(url: URL): Dimension[] | Response {
  const values = url.searchParams.getAll("groupBy").flatMap((value) => value.split(","));
  if (values.some((value) => !DIMENSIONS.includes(value as Dimension)))
    return problem(422, "validation.failed", "groupBy ไม่ถูกต้อง", [
      { path: "groupBy", code: "enum", message: DIMENSIONS.join(" | ") },
    ]);
  return values.length ? (values as Dimension[]) : ["product_type"];
}

/**
 * `admin.analytics.sensitivity` (U-B0.3): sessions shown a price per lead-time band and per price
 * quartile, and how many carted the product type. The drop-off is worked out here, as the API does.
 */
function sensitivity(from: string, to: string): Schemas["SensitivityReportDto"] {
  const scale = days(from, to);
  const row = (band: string, shown: number, cartedShare: number): Schemas["SensitivityRowDto"] => {
    const carted = Math.round(shown * cartedShare);
    return { band, shown, carted, dropOffPct: shown ? ((1 - carted / shown) * 100).toFixed(2) : null };
  };
  return {
    byLeadTime: [
      row("1-7", scale * 9, 0.34),
      row("8-14", scale * 14, 0.27),
      row("15-21", scale * 6, 0.18),
      row("22+", scale * 2, 0.09),
    ],
    byPriceQuartile: [
      row("1", scale * 8, 0.36),
      row("2", scale * 8, 0.29),
      row("3", scale * 8, 0.21),
      row("4", scale * 7, 0.12),
    ],
  };
}

function unmet(from: string, to: string): Schemas["UnmetDemandReportDto"] {
  const scale = days(from, to);
  const n = (factor: number) => Math.max(1, Math.round(scale * factor));
  const bangkok = provinceRef("10", "กรุงเทพมหานคร", "Bangkok");
  return {
    // D-252: no cell reaches the five distinct customers in the mock, so every row is suppressed.
    priceGap: { minGroupSize: 5, rows: [], suppressedRows: 2 },
    bySource: [
      { key: "rfq_declined", records: n(2.6) },
      { key: "rfq_expired", records: n(1.3) },
      { key: "capability_missing", records: n(1.1) },
      { key: "capacity_limited", records: n(0.6) },
    ],
    byReason: [
      { key: "capability_missing", records: n(1.4) },
      { key: "capacity_full", records: n(0.9) },
      { key: "price_not_competitive", records: n(0.7) },
      { key: "spec_not_feasible", records: n(0.5) },
      { key: "customer_no_response", records: n(0.4) },
    ],
    rows: [
      {
        productType: typeRef("pop_display"),
        source: "capability_missing",
        reasonCode: "capability_missing",
        specBand: "W500-L600-H400",
        quantityBand: "1-499",
        province: bangkok,
        records: n(0.6),
      },
      {
        productType: typeRef("flexible_pouch"),
        source: "rfq_declined",
        reasonCode: "spec_not_feasible",
        specBand: "W150-L200-H100",
        quantityBand: "1000-4999",
        province: null,
        records: n(0.5),
      },
      {
        productType: typeRef("tube"),
        source: "capability_missing",
        reasonCode: "capability_missing",
        specBand: "W100-L100-H200",
        quantityBand: "500-999",
        province: bangkok,
        records: n(0.3),
      },
    ],
    capacityLimitedWeeks: [
      { weekStart: addDays(to, -13), productType: typeRef("folding_carton"), factories: 3, factoriesFull: 2 },
      { weekStart: addDays(to, -6), productType: typeRef("corrugated"), factories: 2, factoriesFull: 2 },
    ],
  };
}

function factories(from: string, to: string): Schemas["FactoryPerformanceDto"][] {
  const scale = Math.max(1, Math.round(days(from, to) / 30));
  return factoryTiers()
    .filter((entry) => ["active", "trial"].includes(entry.status))
    .map((entry, index) => {
      const released = (40 - index * 7) * scale;
      const trial = entry.status === "trial";
      return {
        factory: {
          id: entry.factory.id,
          code: entry.factory.code,
          nameTh: entry.factory.name,
          nameEn: entry.factory.name,
        },
        productType: typeRef(index % 2 ? "corrugated" : "folding_carton"),
        released,
        accepted: released - index,
        rejected: index,
        shipped: Math.round(released * 0.9),
        claims: index % 3,
        utilisationPct: trial ? null : (86 - index * 11).toFixed(2),
        acceptedOnTimePct: trial ? null : (97 - index * 2.5).toFixed(2),
        shippedOnTimePct: trial ? null : (96 - index * 3.5).toFixed(2),
      };
    });
}

function campaigns(from: string, to: string): Schemas["CampaignPerformanceDto"][] {
  const scale = days(from, to) / 30;
  return (
    [
      [1, "YEAR-END-2026", "ส่งท้ายปี 2569 (ข้อมูลจำลอง)", 530, 126300, "active"],
      [2, "SME-BOOST", "เพิ่มยอด SME ไตรมาส 4 (ข้อมูลจำลอง)", 41, 21450, "active"],
      [4, "RAINY-2026", "หน้าฝน 2569 (ข้อมูลจำลอง)", 188, 50000, "ended"],
    ] as const
  ).map(([n, code, name, redemptions, discount, status]) => ({
    id: mockId("cmp", n),
    code,
    name,
    status,
    redemptions: Math.round(redemptions * scale),
    reversals: Math.round(redemptions * scale * 0.02),
    orderGroups: Math.round(redemptions * scale),
    discountAmount: baht(Math.round(discount * scale) * 100),
    cappedAmount: baht(Math.round(discount * scale * 0.01) * 100),
    grossAmount: baht(Math.round(discount * scale * 9.4) * 100),
    newCustomers: Math.round(redemptions * scale * 0.4),
    budget: null,
    spent: baht(Math.round(discount * scale) * 100),
  }));
}

/* ------------------------------------------------------------------------------- prospectus */

type Prospectus = Schemas["ProspectusExportDto"] & { reads: number };
const prospectuses: Prospectus[] = [];
/** Idempotency-Key → export id, so a retried request answers the same export. */
const prospectusKeys = new Map<string, string>();

const presentProspectus = ({ reads: _reads, ...dto }: Prospectus): Schemas["ProspectusExportDto"] => dto;

/** The worker renders both files: the second status read finds it done. */
function advance(item: Prospectus) {
  item.reads += 1;
  if (item.status === "pending" && item.reads > 1) {
    item.status = "ready";
    item.generatedAt = bangkokIso();
    item.suppressedCells = demand(item.from, item.to, "province").filter((row) => row.savedQuotes < K_THRESHOLD).length;
  }
}

/* ---------------------------------------------------------------------------------- reports */

const CHANNELS = ["web", "cs", "line", "b2b"];
const ORDER_STATUSES = [
  "waiting_payment",
  "paid_for_production",
  "artwork_approved",
  "in_production",
  "shipping",
  "completed",
  "cancelled",
];
const PROVIDERS = ["scb", "twoc2p", "slip", "bank", "internal"];
const CLAIM_STATUSES = [
  "submitted",
  "under_review",
  "need_info",
  "factory_review",
  "approved",
  "rejected",
  "resolved",
  "closed",
];

type Column = Schemas["ReportColumnDto"];
type FilterDef = Schemas["ReportFilterDefDto"];
/** `total` as getpack-api: money and integer columns are summed unless the column says not to. */
const col = (
  key: string,
  labelTh: string,
  labelEn: string,
  type: ColumnType = "text",
  total = type === "money" || type === "integer",
): Column => ({
  key,
  labelTh,
  labelEn,
  type,
  total,
});

interface MockReport extends Omit<Schemas["ReportDefinitionDto"], "formats"> {
  key: ReportKey;
  /** The permission of the data shown; exports also need `reports.export`. */
  permission: string;
}

const range: FilterDef = { key: "period", kind: "range", required: true, values: null };
const asOf: FilterDef = { key: "period", kind: "as_of", required: true, values: null };
const month: FilterDef = { key: "period", kind: "month", required: true, values: null };
const enumOf = (key: "channel" | "status" | "provider", values: string[]): FilterDef => ({
  key,
  kind: "enum",
  required: false,
  values,
});
const uuidOf = (key: "productTypeId" | "factoryId"): FilterDef => ({
  key,
  kind: "uuid",
  required: false,
  values: null,
});

/** The totals row getpack-api adds (U-B0.3): money in satang, then back to a decimal string; counts as numbers. */
function totalsOf(
  columns: readonly Column[],
  rows: readonly Record<string, unknown>[],
): Record<string, string | number> {
  const totals: Record<string, string | number> = {};
  for (const column of columns.filter((item) => item.total)) {
    const values = rows.map((row) => row[column.key]);
    if (column.type === "money")
      totals[column.key] = baht(values.reduce<number>((sum, value) => sum + Math.round(Number(value ?? 0) * 100), 0));
    else totals[column.key] = values.reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
  }
  return totals;
}

/** getpack-api's R1 reports (B6.2, D-111), in its order. */
const REPORTS: MockReport[] = [
  {
    key: "sales",
    group: "sales",
    nameTh: "รายงานยอดขาย",
    nameEn: "Sales register",
    description: "Every order of the order groups placed in the period, with its amounts.",
    decisions: ["D-010", "D-020"],
    permission: "orders.read",
    filters: [range, enumOf("channel", CHANNELS), uuidOf("productTypeId")],
    columns: [
      col("placedAt", "วันที่สั่งซื้อ", "Placed at", "datetime"),
      col("orderCode", "เลขที่คำสั่งซื้อ", "Order"),
      col("channel", "ช่องทาง", "Channel"),
      col("quantity", "จำนวน", "Quantity", "integer"),
      col("net", "มูลค่าก่อนภาษี", "Net", "money"),
      col("vat", "ภาษีมูลค่าเพิ่ม", "VAT", "money"),
      col("gross", "รวมทั้งสิ้น", "Gross", "money"),
    ],
  },
  {
    key: "sales_tax",
    group: "finance",
    nameTh: "รายงานภาษีขาย",
    nameEn: "Sales tax report",
    description: "One line per document with output VAT posted in the month.",
    decisions: ["D-033", "D-092"],
    permission: "tax.read",
    filters: [month],
    columns: [
      col("seq", "ลำดับ", "No.", "integer", false),
      col("documentDate", "วันที่", "Date", "date"),
      col("documentNo", "เลขที่เอกสาร", "Document no."),
      col("partyTaxId", "เลขประจำตัวผู้เสียภาษี", "Tax id"),
      col("base", "มูลค่าสินค้าหรือบริการ", "Base", "money"),
      col("vat", "ภาษีมูลค่าเพิ่ม", "VAT", "money"),
      col("late", "เอกสารล่าช้า", "Late", "boolean"),
    ],
  },
  {
    key: "payments_by_channel",
    group: "finance",
    nameTh: "รายงานรับชำระตามช่องทาง",
    nameEn: "Payments by channel",
    description: "Successful payments of the period with fees, withholding, net and settlement date.",
    decisions: ["D-061", "D-176"],
    permission: "payments.read",
    filters: [range, enumOf("provider", PROVIDERS)],
    columns: [
      col("paidAt", "วันที่ชำระ", "Paid at", "datetime"),
      col("referenceCode", "เลขอ้างอิง", "Reference"),
      col("provider", "ผู้ให้บริการ", "Provider"),
      col("amount", "ยอดชำระ", "Amount", "money"),
      col("fee", "ค่าธรรมเนียม", "Fee", "money"),
      col("net", "สุทธิ", "Net", "money"),
      col("settlementDate", "วันที่เงินเข้าบัญชี", "Settlement date", "date"),
    ],
  },
  {
    key: "orders",
    group: "sales",
    nameTh: "รายงานสถานะคำสั่งซื้อ",
    nameEn: "Orders pipeline",
    description: "Orders placed in the period with their status and milestone dates.",
    decisions: ["D-073", "D-081"],
    permission: "orders.read",
    filters: [range, enumOf("status", ORDER_STATUSES), enumOf("channel", CHANNELS)],
    columns: [
      col("orderCode", "เลขที่คำสั่งซื้อ", "Order"),
      col("placedAt", "วันที่สั่งซื้อ", "Placed at", "datetime"),
      col("channel", "ช่องทาง", "Channel"),
      col("quantityOrdered", "จำนวนสั่ง", "Ordered", "integer"),
      col("status", "สถานะ", "Status"),
      col("promisedShipDate", "วันส่งที่สัญญา", "Promised ship date", "date"),
    ],
  },
  {
    key: "quotations",
    group: "sales",
    nameTh: "รายงานใบเสนอราคา",
    nameEn: "Quotations",
    description: "Quotations saved in the period (instant and from RFQs).",
    decisions: ["D-051", "D-100"],
    permission: "quotes.read",
    filters: [range, enumOf("channel", CHANNELS), uuidOf("productTypeId")],
    columns: [
      col("quoteCode", "เลขที่ใบเสนอราคา", "Quotation"),
      col("createdAt", "วันที่", "Created at", "datetime"),
      col("channel", "ช่องทาง", "Channel"),
      col("validUntil", "ใช้ได้ถึง", "Valid until", "datetime"),
    ],
  },
  {
    key: "campaign_usage",
    group: "marketing",
    nameTh: "รายงานการใช้แคมเปญและโปรโมชั่น",
    nameEn: "Campaign & promotion usage",
    description: "Per campaign and promotion: redemptions, discount given and the amount capped.",
    decisions: ["D-053", "D-154"],
    permission: "promotions.read",
    filters: [range],
    columns: [
      col("campaignCode", "รหัสแคมเปญ", "Campaign"),
      col("promotion", "โปรโมชั่น", "Promotion"),
      col("redemptions", "ใช้สิทธิ์", "Redemptions", "integer"),
      col("discount", "ส่วนลดที่ให้", "Discount given", "money"),
      col("capped", "ส่วนลดที่ถูกจำกัด", "Capped", "money"),
    ],
  },
  {
    key: "points_liability",
    group: "finance",
    nameTh: "รายงานภาระคะแนนสะสม",
    nameEn: "Points liability roll-forward",
    description: "Per month of the period: opening, earned, redeemed, expired and closing points.",
    decisions: ["D-130", "D-131", "D-132"],
    permission: "loyalty.read",
    filters: [range],
    columns: [
      col("month", "เดือน", "Month"),
      col("openingPoints", "ยกมา (คะแนน)", "Opening points", "integer"),
      col("earned", "ได้รับ", "Earned", "integer"),
      col("redeemed", "ใช้แลก", "Redeemed", "integer"),
      col("closingPoints", "ยกไป (คะแนน)", "Closing points", "integer"),
      col("closingValue", "ยกไป (บาท)", "Closing value", "money"),
    ],
  },
  {
    key: "ar_aging",
    group: "finance",
    nameTh: "รายงานอายุลูกหนี้",
    nameEn: "AR aging",
    description: "Open receivables at a date per customer or company, by days past due.",
    decisions: ["D-032", "D-122"],
    permission: "receivables.read",
    filters: [asOf],
    columns: [
      col("code", "รหัส", "Code"),
      col("name", "ชื่อ", "Name"),
      col("current", "ยังไม่ถึงกำหนด", "Current", "money"),
      col("d1_30", "1–30 วัน", "1–30 days", "money"),
      col("over_90", "เกิน 90 วัน", "Over 90 days", "money"),
      col("total", "รวม", "Total", "money"),
    ],
  },
  {
    key: "ap_aging",
    group: "finance",
    nameTh: "รายงานอายุเจ้าหนี้",
    nameEn: "AP aging",
    description: "Open payables at a date per vendor.",
    decisions: ["D-022", "D-032"],
    permission: "payables.read",
    filters: [asOf],
    columns: [
      col("vendor", "ผู้ขาย", "Vendor"),
      col("factoryCode", "รหัสโรงงาน", "Factory"),
      col("notYetPayable", "ยังไม่ถึงกำหนดจ่าย", "Not yet payable", "money"),
      col("d0_30", "0–30 วัน", "0–30 days", "money"),
      col("total", "รวม", "Total", "money"),
    ],
  },
  {
    key: "payout_history",
    group: "finance",
    nameTh: "ประวัติการจ่ายเงินโรงงานและผู้ขาย",
    nameEn: "Payout history",
    description: "Items of the payout runs with a pay date in the period.",
    decisions: ["D-022", "D-093", "D-164", "D-166"],
    permission: "payables.read",
    filters: [range],
    columns: [
      col("runNo", "เลขที่รอบจ่าย", "Run"),
      col("payOn", "วันที่จ่าย", "Pay date", "date"),
      col("factoryCode", "รหัสโรงงาน", "Factory"),
      col("apNet", "ยอดตั้งหนี้", "AP net", "money"),
      col("wht", "ภาษีหัก ณ ที่จ่าย", "WHT", "money"),
      col("cash", "ยอดโอน", "Cash", "money"),
    ],
  },
  {
    key: "factory_scorecards",
    group: "operations",
    nameTh: "ประวัติคะแนนโรงงาน",
    nameEn: "Factory scorecard history",
    description: "Monthly scorecards per factory for the months of the period.",
    decisions: ["D-075", "D-155"],
    permission: "production.read",
    filters: [range, uuidOf("factoryId")],
    columns: [
      col("month", "เดือน", "Month"),
      col("factoryCode", "รหัสโรงงาน", "Factory"),
      col("jobs", "จำนวนงาน", "Jobs", "integer"),
      col("onTimeShippingPct", "ส่งตรงเวลา %", "On-time shipping %", "percent"),
      col("qcFirstPassPct", "QC ผ่านครั้งแรก %", "QC first pass %", "percent"),
    ],
  },
  {
    key: "claims",
    group: "operations",
    nameTh: "รายงานเคลม",
    nameEn: "Claims register",
    description: "Claims submitted in the period with their liability, amount and resolution.",
    decisions: ["D-082", "D-083"],
    permission: "claims.read",
    filters: [range, enumOf("status", CLAIM_STATUSES)],
    columns: [
      col("claimNo", "เลขที่เคลม", "Claim"),
      col("submittedAt", "วันที่แจ้ง", "Submitted at", "datetime"),
      col("status", "สถานะ", "Status"),
      col("claimedAmount", "มูลค่าที่เคลม", "Claimed amount", "money"),
    ],
  },
];

const toDefinition = ({ permission: _permission, ...report }: MockReport): Schemas["ReportDefinitionDto"] => ({
  ...report,
  formats: ["xlsx", "csv"],
});

/** The preview's cap: the first rows only, `truncated` beyond them. */
const PREVIEW_ROWS = 200;
const RELATIVE: Record<Schemas["RelativePeriod"], (today: string) => [string, string]> = {
  previous_day: (today) => [addDays(today, -1), addDays(today, -1)],
  previous_week: (today) => [addDays(today, -7), addDays(today, -1)],
  previous_month: (today) => {
    const last = addDays(`${today.slice(0, 7)}-01`, -1);
    return [`${last.slice(0, 7)}-01`, last];
  },
  month_to_date: (today) => [`${today.slice(0, 7)}-01`, today],
  year_to_date: (today) => [`${today.slice(0, 4)}-01-01`, today],
};
const required = (path: string) =>
  problem(422, "validation.failed", "ต้องระบุตัวกรองนี้", [{ path, code: "required", message: path }]);

/** Resolves the filters the way the API echoes them, or a 422 naming the missing one. */
function resolveFilters(report: MockReport, filters: Filters): Resolved | Response {
  const resolved: Resolved = {};
  for (const filter of report.filters) {
    if (filter.key === "period") {
      if (filter.kind === "range") {
        const [from, to] = filters.period
          ? RELATIVE[filters.period](bangkokIso().slice(0, 10))
          : [filters.from, filters.to];
        if (!isDate(from) || !isDate(to) || from > to) return badRange();
        Object.assign(resolved, { from, to });
      } else if (filter.kind === "as_of") {
        if (!isDate(filters.asOf)) return required("asOf");
        resolved.asOf = filters.asOf;
      } else if (filter.kind === "month") {
        if (!/^\d{4}-\d{2}$/.test(filters.month ?? "")) return required("month");
        resolved.month = filters.month!;
      }
      continue;
    }
    const value = filters[filter.key];
    if (!value) continue;
    if (filter.values && !filter.values.includes(value))
      return problem(422, "validation.failed", "ค่าตัวกรองไม่ถูกต้อง", [
        { path: filter.key, code: "enum", message: filter.values.join(" | ") },
      ]);
    resolved[filter.key] = value;
  }
  return resolved;
}

function reportRows(report: MockReport, filters: Resolved) {
  const start = filters.from ?? filters.asOf ?? (filters.month ? `${filters.month}-01` : bangkokIso().slice(0, 10));
  const count = filters.from && filters.to ? Math.min(260, days(filters.from, filters.to) * 3) : 8;
  const valuesOf = (key: string) => report.filters.find((filter) => filter.key === key)?.values ?? null;
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(start, Math.floor(i / 3));
    const cell: Record<ColumnType, (column: Column) => string | number | boolean | null> = {
      text: (column) =>
        column.key.toLowerCase().includes("code") || column.key.endsWith("No")
          ? `${column.key.slice(0, 2).toUpperCase()}-${String(4100 + i).padStart(6, "0")}`
          : `${column.labelTh} ${i + 1}`,
      integer: () => 12 + ((i * 7) % 40),
      money: () => baht(1_540_000 + i * 73_100),
      decimal: () => (12.5 + i).toFixed(2),
      percent: () => (96 - (i % 5) * 1.5).toFixed(2),
      date: () => day,
      datetime: () => `${day}T10:${String(i % 60).padStart(2, "0")}:00+07:00`,
      boolean: () => i % 9 === 4,
    };
    return Object.fromEntries(
      report.columns.map((column) => {
        const fixed = filters[column.key as keyof Resolved];
        if (typeof fixed === "string") return [column.key, fixed];
        const values = valuesOf(column.key);
        return [column.key, values ? values[i % values.length]! : cell[column.type](column)];
      }),
    );
  });
}

type Run = Schemas["ReportRunDto"] & { reads: number };
const runs: Run[] = [];
const presentRun = ({ reads: _reads, ...dto }: Run): Schemas["ReportRunDto"] => dto;

/** A report the caller may read: its data permission (D-111). */
function reportFor(request: Request, key: unknown): MockReport | Response {
  const who = staffPersonaOf(request);
  if (!who) return unauthenticated();
  const report = REPORTS.find((candidate) => candidate.key === key);
  if (!report) return problem(404, "http.not_found", "ไม่พบรายงานนี้");
  return can(who, report.permission) ? report : forbidden();
}

const FILTER_PARAMS = [
  "from",
  "to",
  "asOf",
  "month",
  "period",
  "channel",
  "productTypeId",
  "factoryId",
  "status",
  "provider",
] as const;
const filtersOfUrl = (url: URL): Filters =>
  Object.fromEntries(
    FILTER_PARAMS.flatMap((name) => {
      const value = url.searchParams.get(name);
      return value ? [[name, value]] : [];
    }),
  ) as Filters;

/* ------------------------------------------------------------ journey funnels (U5.B6, D-303) */

type Journey = Schemas["ScorecardJourney"];

/**
 * getpack-api's journeys (`src/modules/analytics/journeys.ts`): the scorecard task, its steps, and
 * the share of the previous step's sessions that reach each one. `claim` drops this week, so the
 * weekly check has an alert to show.
 */
const JOURNEYS: { journey: Journey; task: string; entries: number; steps: [string, number][] }[] = [
  {
    journey: "discovery_price",
    task: "T1",
    entries: 60,
    steps: [
      ["browsed", 1],
      ["configured", 0.42],
      ["priced", 0.9],
    ],
  },
  {
    journey: "studio",
    task: "T2",
    entries: 21,
    steps: [
      ["started", 1],
      ["box_confirmed", 0.8],
      ["first_artwork", 0.62],
      ["added_to_cart", 0.3],
    ],
  },
  {
    journey: "checks",
    task: "T3",
    entries: 13,
    steps: [
      ["first_artwork", 1],
      ["checks_clean", 0.7],
    ],
  },
  {
    journey: "order",
    task: "T4",
    entries: 12,
    steps: [
      ["added_to_cart", 1],
      ["checkout_started", 0.7],
      ["address", 0.9],
      ["payment", 0.85],
      ["placed", 0.9],
    ],
  },
  { journey: "sample", task: "T5", entries: 0, steps: [] },
  {
    journey: "target_price",
    task: "T6",
    entries: 4,
    steps: [
      ["target_entered", 1],
      ["lever_applied", 0.4],
      ["quote_shown", 0.9],
    ],
  },
  {
    journey: "tracking",
    task: "T7",
    entries: 18,
    steps: [
      ["opened", 1],
      ["status_viewed", 0.95],
      ["delivery_date_viewed", 0.6],
    ],
  },
  {
    journey: "reorder",
    task: "T8",
    entries: 3,
    steps: [
      ["started", 1],
      ["previewed", 0.8],
      ["added_to_cart", 0.75],
    ],
  },
  {
    journey: "claim",
    task: "T9",
    entries: 6,
    steps: [
      ["started", 1],
      ["evidence_added", 0.7],
      ["submitted", 0.52],
    ],
  },
  {
    journey: "documents",
    task: "T10",
    entries: 7,
    steps: [
      ["opened", 1],
      ["downloaded", 0.8],
    ],
  },
  {
    journey: "dieline",
    task: "T12",
    entries: 5,
    steps: [
      ["opened", 1],
      ["size_entered", 0.7],
      ["downloaded", 0.6],
    ],
  },
];

const sharePct = (part: number, whole: number) => (whole > 0 ? ((part / whole) * 100).toFixed(2) : null);

function journeysReport(from: string, to: string): Schemas["JourneysReportDto"] {
  const n = days(from, to);
  const journeys = JOURNEYS.map(({ journey, task, entries, steps }) => {
    let sessions = entries * n;
    const counted = steps.map(([step, share], index) => {
      const previous = sessions;
      if (index > 0) sessions = Math.round(sessions * share);
      return { step, sessions, fromPreviousPct: index > 0 ? sharePct(sessions, previous) : null };
    });
    const first = counted[0]?.sessions ?? 0;
    const last = counted.at(-1)?.sessions ?? 0;
    return { journey, task, steps: counted, conversionPct: counted.length > 1 ? sharePct(last, first) : null };
  });
  // The last Monday-started week against the one before (D-303); the mock's claims fell by a third.
  const weekStart = addDays(to, -6);
  const weekChecks = JOURNEYS.filter((entry) => entry.steps.length > 1).map(({ journey, entries }) => {
    const firstSessions = entries * 7;
    const previousFirstSessions = Math.round(firstSessions * 0.95);
    const lastSessions = Math.round(firstSessions * (journey === "claim" ? 0.3 : 0.45));
    const previousLastSessions = Math.round(previousFirstSessions * 0.45);
    const conversion = firstSessions > 0 ? lastSessions / firstSessions : null;
    const before = previousFirstSessions > 0 ? previousLastSessions / previousFirstSessions : null;
    const drop = conversion !== null && before ? ((before - conversion) / before) * 100 : null;
    return {
      journey,
      weekStart,
      firstSessions,
      lastSessions,
      previousFirstSessions,
      previousLastSessions,
      conversionPct: conversion === null ? null : (conversion * 100).toFixed(2),
      previousConversionPct: before === null ? null : (before * 100).toFixed(2),
      dropPct: drop === null ? null : drop.toFixed(2),
      // `analytics.journey_drop_alert_pct` (15) with `analytics.journey_alert_min_sessions` (30) both weeks.
      alert: drop !== null && drop > 15 && firstSessions >= 30 && previousFirstSessions >= 30,
    };
  });
  return { from, to, journeys, weekChecks };
}

/* --------------------------------------------------------------------------------- handlers */

/** A dashboard read: its permissions (`x-required-permissions`), then the period. */
function dashboard<T extends JsonBodyType>(
  permissions: string[],
  build: (from: string, to: string, url: URL) => T | Response,
) {
  return ({ request }: { request: Request }) => {
    if (!allowed(request, ...permissions)) return forbidden();
    const period = rangeOf(request);
    if (period instanceof Response) return period;
    const body = build(...period, new URL(request.url));
    return body instanceof Response ? body : HttpResponse.json(body);
  };
}

export const analyticsContractHandlers = [
  http.get("*/v1/admin/analytics/sales", dashboard(["analytics.read"], sales)),
  http.get("*/v1/admin/analytics/traffic", dashboard(["analytics.read"], traffic)),
  http.get("*/v1/admin/analytics/funnel", dashboard(["analytics.read"], funnel)),
  http.get(
    "*/v1/admin/analytics/demand",
    dashboard(["analytics.read"], (from, to, url) => {
      const groupBy = groupByOf(url);
      // The mock breaks down by the first dimension asked for; the others stay null.
      return groupBy instanceof Response ? groupBy : demand(from, to, groupBy[0]!);
    }),
  ),
  http.get("*/v1/admin/analytics/unmet-demand", dashboard(["analytics.read"], unmet)),
  http.get("*/v1/admin/analytics/sensitivity", dashboard(["analytics.read"], sensitivity)),
  http.get("*/v1/admin/analytics/factories", dashboard(["analytics.read", "analytics.read_factories"], factories)),
  http.get("*/v1/admin/analytics/campaigns", dashboard(["analytics.read"], campaigns)),
  http.get("*/v1/admin/analytics/journeys", dashboard(["analytics.read"], journeysReport)),

  http.get("*/v1/admin/analytics/prospectus-exports", ({ request }) => {
    if (!allowed(request, "analytics.prospectus")) return forbidden();
    return HttpResponse.json([...prospectuses].reverse().slice(0, 50).map(presentProspectus));
  }),
  http.post("*/v1/admin/analytics/prospectus-exports", async ({ request }) => {
    if (!allowed(request, "analytics.prospectus")) return forbidden();
    const key = request.headers.get("Idempotency-Key");
    if (!key) return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key");
    const replay = prospectuses.find((item) => item.id === prospectusKeys.get(key));
    if (replay) return HttpResponse.json(presentProspectus(replay), { status: 202 });
    const body = (await request.json()) as Schemas["CreateProspectusDto"];
    if (!isDate(body.from) || !isDate(body.to) || body.from > body.to) return badRange();
    const item: Prospectus = {
      id: mockId("psp", prospectuses.length + 1),
      status: "pending",
      from: body.from,
      to: body.to,
      kThreshold: K_THRESHOLD,
      suppressedCells: null,
      error: null,
      requestedAt: bangkokIso(),
      generatedAt: null,
      reads: 0,
    };
    prospectuses.push(item);
    prospectusKeys.set(key, item.id);
    return HttpResponse.json(presentProspectus(item), { status: 202 });
  }),
  http.get("*/v1/admin/analytics/prospectus-exports/:exportId", ({ params, request }) => {
    if (!allowed(request, "analytics.prospectus")) return forbidden();
    const item = prospectuses.find((candidate) => candidate.id === params.exportId);
    if (!item) return problem(404, "http.not_found", "ไม่พบรายงานนี้");
    advance(item);
    return HttpResponse.json(presentProspectus(item));
  }),
  http.get("*/v1/admin/analytics/prospectus-exports/:exportId/file", ({ params, request }) => {
    if (!allowed(request, "analytics.prospectus")) return forbidden();
    const item = prospectuses.find((candidate) => candidate.id === params.exportId);
    if (!item) return problem(404, "http.not_found", "ไม่พบรายงานนี้");
    if (item.status !== "ready") return notReady();
    const format = new URL(request.url).searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
    return HttpResponse.json({
      // A data URL, so a mock download never leaves the page for a host that does not exist.
      url: `data:text/plain;charset=utf-8,${encodeURIComponent(`prospectus ${item.from} ${item.to} ${format}`)}`,
      expiresAt: bangkokIso(5),
    } satisfies Schemas["DownloadUrlDto"]);
  }),

  http.get("*/v1/admin/reports", ({ request }) => {
    // The catalogue needs no permission of its own; it lists the reports whose data the caller reads (D-111).
    const who = staffPersonaOf(request);
    if (!who) return unauthenticated();
    return HttpResponse.json(REPORTS.filter((report) => can(who, report.permission)).map(toDefinition));
  }),
  http.get("*/v1/admin/reports/:reportKey/preview", ({ params, request }) => {
    const report = reportFor(request, params.reportKey);
    if (report instanceof Response) return report;
    const filters = resolveFilters(report, filtersOfUrl(new URL(request.url)));
    if (filters instanceof Response) return filters;
    const rows = reportRows(report, filters);
    return HttpResponse.json({
      reportKey: report.key,
      columns: report.columns,
      filters,
      rows: rows.slice(0, PREVIEW_ROWS),
      truncated: rows.length > PREVIEW_ROWS,
      // As getpack-api: the sum of every row of the report, not only the previewed ones.
      totals: totalsOf(report.columns, rows),
      generatedAt: bangkokIso(),
    } satisfies Schemas["ReportPreviewDto"]);
  }),
  http.post("*/v1/admin/reports/:reportKey/exports", async ({ params, request }) => {
    const report = reportFor(request, params.reportKey);
    if (report instanceof Response) return report;
    if (!allowed(request, "reports.export")) return forbidden();
    const body = (await request.json()) as Schemas["CreateReportExportDto"];
    const filters = resolveFilters(report, body.filters ?? {});
    if (filters instanceof Response) return filters;
    const run: Run = {
      id: mockId("rrn", runs.length + 1),
      reportKey: report.key,
      format: body.format,
      filters,
      status: "queued",
      rowCount: null,
      error: null,
      scheduleId: null,
      queuedAt: bangkokIso(),
      finishedAt: null,
      reads: 0,
    };
    runs.push(run);
    return HttpResponse.json(presentRun(run), { status: 202 });
  }),
  http.get("*/v1/admin/report-runs/:runId", ({ params, request }) => {
    const run = runs.find((candidate) => candidate.id === params.runId);
    if (!run) return problem(404, "http.not_found", "ไม่พบไฟล์รายงานนี้");
    const report = reportFor(request, run.reportKey);
    if (report instanceof Response) return report;
    // The worker writes the file between two reads.
    run.reads += 1;
    if (run.status === "queued" || run.status === "running") {
      run.status = run.reads > 1 ? "succeeded" : "running";
      if (run.status === "succeeded") {
        run.rowCount = reportRows(report, run.filters).length;
        run.finishedAt = bangkokIso();
      }
    }
    return HttpResponse.json(presentRun(run));
  }),
  http.get("*/v1/admin/report-runs/:runId/file", ({ params, request }) => {
    const run = runs.find((candidate) => candidate.id === params.runId);
    if (!run) return problem(404, "http.not_found", "ไม่พบไฟล์รายงานนี้");
    const report = reportFor(request, run.reportKey);
    if (report instanceof Response) return report;
    if (run.status !== "succeeded") return notReady();
    return HttpResponse.json({
      url: `data:text/plain;charset=utf-8,${encodeURIComponent(`report ${run.reportKey} ${run.id} ${run.format}`)}`,
      expiresAt: bangkokIso(5),
    } satisfies Schemas["DownloadUrlDto"]);
  }),
];
