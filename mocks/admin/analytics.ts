/**
 * Demand analytics, the partner prospectus and operational reports, mocked
 * (CONTRACT-REQUEST admin.analytics, admin.prospectus, admin.reports).
 *
 * Figures are deterministic per period so a screen and its test agree. The minimum group size is
 * the API's to apply: D-044 says k ≥ 3 factories for price breakdowns, B6.1 k ≥ 5 for any group;
 * the mock reports 5 and suppresses below it. Money is decimal strings throughout.
 */

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, mockId, problem } from "../support";
import { baht } from "./commerce";
import { factoryTiers } from "./partners";

const DAY_MS = 86_400_000;
const MIN_GROUP = 5;
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const pctOf = (part: number, whole: number) => (whole ? ((part / whole) * 100).toFixed(4) : "0.0000");

function days(from: string, to: string): number {
  return Math.max(
    1,
    Math.round((Date.parse(`${to}T00:00:00+07:00`) - Date.parse(`${from}T00:00:00+07:00`)) / DAY_MS) + 1,
  );
}
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00+07:00`) + n * DAY_MS + 7 * 3_600_000).toISOString().slice(0, 10);
const period = (from: string, to: string) => ({ from, to });
const wave = (i: number) => 1 + 0.35 * Math.sin(i / 2.3) + (i % 7 === 5 || i % 7 === 6 ? -0.25 : 0);

function overview(from: string, to: string) {
  const n = days(from, to);
  const trend = Array.from({ length: n }, (_, i) => {
    const paidOrders = Math.max(1, Math.round(9 * wave(i)));
    return {
      date: addDays(from, i),
      gmv: baht(paidOrders * 1_684_000),
      paidOrders,
      quotes: Math.round(paidOrders * 6.2),
    };
  });
  const paidOrders = trend.reduce((sum, day) => sum + day.paidOrders, 0);
  const quotes = trend.reduce((sum, day) => sum + day.quotes, 0);
  const sessions = quotes * 7;
  const gmvSatang = trend.reduce((sum, day) => sum + Math.round(Number(day.gmv) * 100), 0);
  return {
    period: period(from, to),
    kpis: {
      sessions,
      quotes,
      rfqs: Math.round(quotes * 0.18),
      paidOrders,
      gmv: baht(gmvSatang),
      aov: baht(Math.round(gmvSatang / paidOrders)),
      conversionPct: pctOf(paidOrders, sessions),
      repeatRatePct: "31.4000",
    },
    previous: {
      gmv: baht(Math.round(gmvSatang * 0.88)),
      paidOrders: Math.round(paidOrders * 0.9),
      conversionPct: pctOf(paidOrders * 0.9, sessions * 1.02),
    },
    funnel: [
      { step: "visit" as const, count: sessions },
      { step: "configure" as const, count: Math.round(sessions * 0.42) },
      { step: "quote" as const, count: quotes },
      { step: "cart" as const, count: Math.round(quotes * 0.31) },
      { step: "checkout" as const, count: Math.round(quotes * 0.22) },
      { step: "paid" as const, count: paidOrders },
    ],
    trend,
    computedAt: bangkokIso(-60 * 3),
  };
}

const DIMENSIONS = {
  product_type: [
    ["folding_carton", "กล่องกระดาษแข็ง", 1],
    ["corrugated", "กล่องกระดาษลูกฟูก", 0.72],
    ["paper_bag", "ถุงกระดาษ", 0.41],
    ["label_sticker", "สติ๊กเกอร์และฉลาก", 0.35],
    ["rigid_box", "กล่องแข็งและกล่องของขวัญ", 0.22],
    ["food_packaging", "บรรจุภัณฑ์อาหาร", 0.19],
    ["pop_display", "ชั้นวางสินค้า POP", 0.03],
  ],
  spec_band: [
    ["small_standard", "ขนาดเล็ก มาตรฐาน", 1],
    ["medium_standard", "ขนาดกลาง มาตรฐาน", 0.8],
    ["large", "ขนาดใหญ่", 0.34],
    ["special_finish", "งานเคลือบพิเศษ/ฟอยล์", 0.27],
    ["food_grade", "เกรดอาหาร", 0.18],
  ],
  quantity_band: [
    ["q_500", "ไม่เกิน 500", 0.62],
    ["q_1000", "501–1,000", 1],
    ["q_5000", "1,001–5,000", 0.74],
    ["q_10000", "5,001–10,000", 0.29],
    ["q_more", "มากกว่า 10,000", 0.12],
  ],
  province: [
    ["bangkok", "กรุงเทพมหานคร", 1],
    ["nonthaburi", "นนทบุรี", 0.31],
    ["chonburi", "ชลบุรี", 0.24],
    ["chiangmai", "เชียงใหม่", 0.17],
    ["khonkaen", "ขอนแก่น", 0.09],
    ["songkhla", "สงขลา", 0.06],
    ["narathiwat", "นราธิวาส", 0.004],
    ["maehongson", "แม่ฮ่องสอน", 0.003],
  ],
} as const;

function demand(from: string, to: string, dimension: keyof typeof DIMENSIONS) {
  const scale = days(from, to) * 11;
  const all = DIMENSIONS[dimension].map(([key, label, weight], index) => {
    const quotes = Math.round(scale * weight);
    const paidOrders = Math.round(quotes * (0.16 - index * 0.012));
    return {
      key,
      label,
      quotes,
      rfqs: Math.round(quotes * (dimension === "spec_band" && key === "special_finish" ? 0.45 : 0.12)),
      paidOrders: Math.max(0, paidOrders),
      gmv: baht(Math.max(0, paidOrders) * 1_684_000),
      conversionPct: pctOf(Math.max(0, paidOrders), quotes),
      abandonedAfterPricePct: (38 + index * 4.5).toFixed(4),
    };
  });
  // A breakdown smaller than the minimum group is withheld, and only counted (D-044).
  const rows = all.filter((row) => row.quotes >= MIN_GROUP);
  return {
    period: period(from, to),
    dimension,
    rows,
    suppressedGroups: all.length - rows.length,
    minGroupSize: MIN_GROUP,
  };
}

function unmet(from: string, to: string) {
  const scale = days(from, to);
  return {
    period: period(from, to),
    reasons: [
      { code: "no_capable_factory", label: "ไม่มีโรงงานผลิตได้", count: Math.round(scale * 1.4) },
      { code: "capacity_full", label: "กำลังผลิตเต็ม", count: Math.round(scale * 0.9) },
      { code: "price_not_accepted", label: "ลูกค้าไม่รับราคา", count: Math.round(scale * 0.7) },
      { code: "lead_time", label: "ระยะเวลาผลิตนานเกินไป", count: Math.round(scale * 0.5) },
      { code: "minimum_quantity", label: "จำนวนต่ำกว่าขั้นต่ำ", count: Math.round(scale * 0.4) },
    ],
    specs: [
      {
        productTypeCode: "pop_display",
        spec: "ชั้นวางกระดาษลูกฟูกพิมพ์ 4 สี สูง 150 ซม.",
        requests: Math.round(scale * 0.6),
      },
      { productTypeCode: "flexible_pouch", spec: "ถุงซิปล็อกฟอยล์ ตั้งได้", requests: Math.round(scale * 0.5) },
      { productTypeCode: "tube", spec: "กระบอกกระดาษ เส้นผ่านศูนย์กลาง 8 ซม.", requests: Math.round(scale * 0.3) },
    ],
    capacityLimited: [
      { week: "2026-W44", productTypeCode: "folding_carton", requests: 14 },
      { week: "2026-W45", productTypeCode: "corrugated", requests: 9 },
    ],
    rfqsDeclined: Math.round(scale * 2.6),
    rfqsExpired: Math.round(scale * 1.3),
  };
}

function factories(from: string, to: string) {
  return {
    period: period(from, to),
    rows: factoryTiers()
      .filter((entry) => ["active", "trial"].includes(entry.status))
      .map((entry, index) => ({
        factory: entry.factory,
        jobs: 40 - index * 7,
        utilisationPct: (86 - index * 11).toFixed(4),
        onTimePct: entry.status === "trial" ? null : (96 - index * 3.5).toFixed(4),
      })),
  };
}

function campaignsReport(from: string, to: string) {
  const scale = days(from, to) / 30;
  return {
    period: period(from, to),
    rows: [
      ["YEAR-END-2026", "ส่งท้ายปี 2569 (ข้อมูลจำลอง)", 530, 126300],
      ["SME-BOOST", "เพิ่มยอด SME ไตรมาส 4 (ข้อมูลจำลอง)", 41, 21450],
      ["RAINY-2026", "หน้าฝน 2569 (ข้อมูลจำลอง)", 188, 50000],
    ].map(([code, name, redemptions, discount], index) => ({
      campaign: { id: mockId("cmp", [1, 2, 4][index]!), code: code as string, name: name as string },
      redemptions: Math.round((redemptions as number) * scale),
      paidOrders: Math.round((redemptions as number) * scale),
      discountAmount: baht(Math.round((discount as number) * scale) * 100),
      revenueAmount: baht(Math.round((discount as number) * scale * 9.4) * 100),
      newCustomers: Math.round((redemptions as number) * scale * 0.4),
    })),
  };
}

/* ---------------------------------------------------------------------------------- reports */

type Column = { key: string; type: "text" | "code" | "money" | "number" | "pct" | "date" | "datetime"; total: boolean };
type Cell = string | number | null;

const REPORTS: {
  key:
    | "sales"
    | "sales_tax"
    | "payments"
    | "orders_quotations"
    | "promotion_usage"
    | "points_liability"
    | "claims"
    | "payout_history"
    | "ar_aging"
    | "ap_aging";
  group: "sales" | "finance" | "marketing" | "operations";
  asOf: boolean;
  permission: string;
  filters: { key: string; options: { value: string; label: string }[] }[];
  columns: Column[];
  row: (i: number, day: string) => Record<string, Cell>;
}[] = [
  {
    key: "sales",
    group: "sales",
    asOf: false,
    permission: "reports.read",
    filters: [
      {
        key: "channel",
        options: [
          { value: "web", label: "เว็บไซต์" },
          { value: "cs", label: "CS" },
          { value: "b2b", label: "B2B" },
        ],
      },
    ],
    columns: [
      { key: "date", type: "date", total: false },
      { key: "orderCode", type: "code", total: false },
      { key: "channel", type: "text", total: false },
      { key: "net", type: "money", total: true },
      { key: "vat", type: "money", total: true },
      { key: "gross", type: "money", total: true },
    ],
    row: (i, day) => {
      const net = 1_540_000 + i * 73_100;
      return {
        date: day,
        orderCode: `PK2569${String(4100 + i).padStart(6, "0")}`,
        channel: ["web", "cs", "b2b"][i % 3]!,
        net: baht(net),
        vat: baht(Math.round(net * 0.07)),
        gross: baht(net + Math.round(net * 0.07)),
      };
    },
  },
  {
    key: "sales_tax",
    group: "finance",
    asOf: false,
    permission: "reports.read",
    filters: [],
    columns: [
      { key: "date", type: "date", total: false },
      { key: "documentNo", type: "code", total: false },
      { key: "customer", type: "text", total: false },
      { key: "taxId", type: "code", total: false },
      { key: "net", type: "money", total: true },
      { key: "vat", type: "money", total: true },
    ],
    row: (i, day) => {
      const net = 1_210_000 + i * 51_700;
      return {
        date: day,
        documentNo: `IV-2569-${String(1200 + i).padStart(5, "0")}`,
        customer: `ลูกค้าตัวอย่าง ${i + 1} (ข้อมูลจำลอง)`,
        taxId: `0105${String(560000000 + i * 911).slice(0, 9)}`,
        net: baht(net),
        vat: baht(Math.round(net * 0.07)),
      };
    },
  },
  {
    key: "payments",
    group: "finance",
    asOf: false,
    permission: "reports.read",
    filters: [
      {
        key: "method",
        options: [
          { value: "scb_qr", label: "SCB QR" },
          { value: "card_2c2p", label: "บัตร (2C2P)" },
          { value: "bank_transfer_slip", label: "โอน (สลิป)" },
        ],
      },
    ],
    columns: [
      { key: "date", type: "date", total: false },
      { key: "method", type: "text", total: false },
      { key: "gross", type: "money", total: true },
      { key: "fee", type: "money", total: true },
      { key: "wht", type: "money", total: true },
      { key: "net", type: "money", total: true },
      { key: "settledOn", type: "date", total: false },
    ],
    row: (i, day) => {
      const gross = 980_000 + i * 44_300;
      const fee = i % 3 === 1 ? Math.round(gross * 0.0225) : 0;
      const wht = i % 4 === 0 ? Math.round(gross * 0.03) : 0;
      return {
        date: day,
        method: ["scb_qr", "card_2c2p", "bank_transfer_slip"][i % 3]!,
        gross: baht(gross),
        fee: baht(fee),
        wht: baht(wht),
        net: baht(gross - fee - wht),
        settledOn: addDays(day, i % 3 === 1 ? 2 : 0),
      };
    },
  },
  {
    key: "orders_quotations",
    group: "sales",
    asOf: false,
    permission: "reports.read",
    filters: [],
    columns: [
      { key: "date", type: "date", total: false },
      { key: "quotes", type: "number", total: true },
      { key: "orders", type: "number", total: true },
      { key: "conversionPct", type: "pct", total: false },
    ],
    row: (i, day) => {
      const quotes = 40 + (i % 9) * 3;
      const ordersCount = Math.round(quotes * 0.17);
      return { date: day, quotes, orders: ordersCount, conversionPct: pctOf(ordersCount, quotes) };
    },
  },
  {
    key: "promotion_usage",
    group: "marketing",
    asOf: false,
    permission: "reports.read",
    filters: [],
    columns: [
      { key: "promotion", type: "text", total: false },
      { key: "code", type: "code", total: false },
      { key: "redemptions", type: "number", total: true },
      { key: "discount", type: "money", total: true },
      { key: "capped", type: "money", total: true },
    ],
    row: (i) => ({
      promotion: ["ลูกค้าใหม่ลด 10 %", "ส่งฟรีเมื่อซื้อครบ ฿5,000", "ซื้อมากลดมาก"][i % 3]!,
      code: ["WELCOME10", "–", "–"][i % 3]!,
      redemptions: 12 + i,
      discount: baht((4000 + i * 310) * 100),
      capped: baht((i % 3 === 2 ? 120 + i : 0) * 100),
    }),
  },
  {
    key: "points_liability",
    group: "finance",
    asOf: true,
    permission: "reports.read",
    filters: [],
    columns: [
      { key: "month", type: "text", total: false },
      { key: "opening", type: "number", total: false },
      { key: "earned", type: "number", total: true },
      { key: "redeemed", type: "number", total: true },
      { key: "expired", type: "number", total: true },
      { key: "closing", type: "number", total: false },
      { key: "liability", type: "money", total: false },
    ],
    row: (i) => {
      const opening = 42_000 + i * 1_300;
      const earned = 5_200 + i * 90;
      const redeemed = 3_100 + i * 40;
      const expired = 400;
      const closing = opening + earned - redeemed - expired;
      return {
        month: `2569-${String(4 + i).padStart(2, "0")}`,
        opening,
        earned,
        redeemed,
        expired,
        closing,
        liability: baht(Math.round(closing * 250)),
      };
    },
  },
  {
    key: "claims",
    group: "operations",
    asOf: false,
    permission: "claims.read",
    filters: [],
    columns: [
      { key: "claimNo", type: "code", total: false },
      { key: "type", type: "text", total: false },
      { key: "liability", type: "text", total: false },
      { key: "amount", type: "money", total: true },
      { key: "resolvedOn", type: "date", total: false },
    ],
    row: (i, day) => ({
      claimNo: `CL-2569-${String(10 + i).padStart(5, "0")}`,
      type: ["ชำรุด", "พิมพ์ผิด", "จำนวนขาด"][i % 3]!,
      liability: ["โรงงาน", "โรงงาน", "ลูกค้า"][i % 3]!,
      amount: baht((1800 + i * 240) * 100),
      resolvedOn: day,
    }),
  },
  {
    key: "payout_history",
    group: "finance",
    asOf: false,
    permission: "factory_cost.read",
    filters: [],
    columns: [
      { key: "date", type: "date", total: false },
      { key: "factory", type: "text", total: false },
      { key: "gross", type: "money", total: true },
      { key: "wht", type: "money", total: true },
      { key: "net", type: "money", total: true },
    ],
    row: (i, day) => {
      const gross = 3_800_000 + i * 120_000;
      return {
        date: day,
        factory: ["F001", "F002", "F003"][i % 3]!,
        gross: baht(gross),
        wht: baht(Math.round(gross * 0.03)),
        net: baht(gross - Math.round(gross * 0.03)),
      };
    },
  },
  {
    key: "ar_aging",
    group: "finance",
    asOf: true,
    permission: "companies.read",
    filters: [],
    columns: [
      { key: "customer", type: "text", total: false },
      { key: "current", type: "money", total: true },
      { key: "d1_30", type: "money", total: true },
      { key: "d31_60", type: "money", total: true },
      { key: "d61_90", type: "money", total: true },
      { key: "over90", type: "money", total: true },
    ],
    row: (i) => ({
      customer: `B${2601 + (i % 5)} บริษัทตัวอย่าง ${i + 1} (ข้อมูลจำลอง)`,
      current: baht((20000 + i * 900) * 100),
      d1_30: baht((i % 2 ? 8000 : 0) * 100),
      d31_60: baht((i % 4 === 3 ? 3800 : 0) * 100),
      d61_90: baht(0),
      over90: baht(0),
    }),
  },
  {
    key: "ap_aging",
    group: "finance",
    asOf: true,
    permission: "factory_cost.read",
    filters: [],
    columns: [
      { key: "vendor", type: "text", total: false },
      { key: "current", type: "money", total: true },
      { key: "d1_30", type: "money", total: true },
      { key: "d31_60", type: "money", total: true },
      { key: "over60", type: "money", total: true },
    ],
    row: (i) => ({
      vendor: ["F001", "F002", "F003", "F004"][i % 4]!,
      current: baht((52000 + i * 1300) * 100),
      d1_30: baht((i % 3 ? 11000 : 0) * 100),
      d31_60: baht(0),
      over60: baht(0),
    }),
  },
];

export const analyticsHandlers = [
  mockRequest("GET /v1/admin/analytics/overview", ({ query, request }) => {
    if (!can(staffPersonaOf(request), "analytics.read")) return forbidden();
    return overview(query.from, query.to);
  }),
  mockRequest("GET /v1/admin/analytics/demand", ({ query, request }) => {
    if (!can(staffPersonaOf(request), "analytics.read")) return forbidden();
    return demand(query.from, query.to, query.dimension);
  }),
  mockRequest("GET /v1/admin/analytics/unmet-demand", ({ query, request }) => {
    if (!can(staffPersonaOf(request), "analytics.read")) return forbidden();
    return unmet(query.from, query.to);
  }),
  mockRequest("GET /v1/admin/analytics/factories", ({ query, request }) => {
    if (!can(staffPersonaOf(request), "analytics.read")) return forbidden();
    return factories(query.from, query.to);
  }),
  mockRequest("GET /v1/admin/analytics/campaigns", ({ query, request }) => {
    if (!can(staffPersonaOf(request), "analytics.read")) return forbidden();
    return campaignsReport(query.from, query.to);
  }),
  mockRequest("POST /v1/admin/analytics/prospectus", ({ body, request }) => {
    if (!can(staffPersonaOf(request), "analytics.prospectus")) return forbidden();
    const suppressed = demand(body.from, body.to, "province").suppressedGroups;
    return {
      url: `https://files.example.invalid/prospectus-${body.from}-${body.to}.${body.format}`,
      expiresAt: bangkokIso(15),
      minGroupSize: MIN_GROUP,
      suppressedGroups: suppressed,
    };
  }),
  mockRequest("GET /v1/admin/reports", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!can(who, "reports.read")) return forbidden();
    return REPORTS.filter((report) => can(who, report.permission)).map(({ key, group, asOf, filters }) => ({
      key,
      group,
      asOf,
      filters,
    }));
  }),
  mockRequest("GET /v1/admin/reports/{reportKey}", ({ params, query, request }) => {
    const who = staffPersonaOf(request);
    const report = REPORTS.find((candidate) => candidate.key === params.reportKey);
    if (!report) return problem(404, "http.not_found", "ไม่พบรายงานนี้");
    if (!can(who, "reports.read") || !can(who, report.permission)) return forbidden();
    const from = query.from ?? query.asOf ?? bangkokIso().slice(0, 10);
    const to = query.to ?? from;
    const count = report.asOf ? 6 : Math.min(60, days(from, to) * 2);
    const all = Array.from({ length: count }, (_, i) => report.row(i, addDays(from, Math.floor(i / 2)))).filter(
      (row) => !query.filter || !query.value || String(row[query.filter]) === query.value,
    );
    const perPage = query.perPage ?? 50;
    const pageNo = query.page ?? 1;
    const totals = Object.fromEntries(
      report.columns
        .filter((column) => column.total)
        .map((column) => {
          const sum = all.reduce(
            (acc, row) =>
              acc + (column.type === "money" ? Math.round(Number(row[column.key]) * 100) : Number(row[column.key])),
            0,
          );
          return [column.key, column.type === "money" ? baht(sum) : sum];
        }),
    );
    return {
      key: report.key,
      columns: report.columns,
      rows: all.slice((pageNo - 1) * perPage, pageNo * perPage),
      totals: Object.keys(totals).length ? totals : null,
      meta: { page: pageNo, perPage, total: all.length },
      generatedAt: bangkokIso(),
    };
  }),
];
