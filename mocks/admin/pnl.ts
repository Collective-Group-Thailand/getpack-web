/**
 * The management P&L planner (getpack-api P6, D-472) on the published contract: `admin.pnl.*` under
 * `/v1/admin/finance/pnl` — the line catalogue, plans by year and scenario, the grid with auto / calculated / manual /
 * override cells, recompute, copy to a scenario, lock (If-Match + Idempotency-Key), plan vs actual with variance
 * notes, the drill-down to source records and the export link.
 *
 * Stateful for the life of the mock server and obviously fake. The arithmetic below is the mock standing in for
 * getpack-api's `pnl-engine.ts` (in satang, rounded half away from zero, formulas over the rounded cells) — the web
 * never computes money; it renders these strings. The "ledger" is a deterministic made-up series per account class.
 *
 * A mock-only job, `POST /v1/admin/mock-jobs/pnl.close_month`, moves the mock's month clock forward by one so a
 * locked plan's next month gets its actual figures (plan vs actual in the e2e journey).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { mockId, paginate, problem } from "../support";
import { PNL_CATALOGUE } from "./pnl-catalogue";

type LineKey = Schemas["PnlLineKey"];
type Plan = Schemas["PnlPlanDto"];
type Cell = Schemas["PnlCellDto"];
type Grid = Schemas["PnlGridDto"];
type MonthDto = Schemas["PnlMonthDto"];
type Variance = Schemas["PnlVarianceDto"];
type VarianceCell = Schemas["PnlVarianceCellDto"];
type SourceItem = Schemas["PnlSourceItemDto"];
type Scenario = Schemas["PnlScenario"];
type CellSource = Schemas["PnlCellSource"];

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const notFound = () => problem(404, "http.not_found", "ไม่พบแผนนี้");
const locked = () => problem(409, "pnl.plan_locked", "แผนนี้ล็อกแล้ว แก้ไขไม่ได้ คัดลอกเป็นแผนใหม่เพื่อแก้");
const stale = () => problem(412, "concurrency.stale", "ข้อมูลนี้ถูกแก้ไขไปแล้ว กรุณาโหลดใหม่");
const preconditionRequired = () => problem(428, "concurrency.precondition_required", "ต้องส่ง If-Match");
const invalid = (path: string, message: string) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path, code: "invalid", message }]);

const reader = (who: StaffPersona | undefined) => (who && can(who, "pnl.read") ? who : null);
const manager = (who: StaffPersona | undefined) => (who && can(who, "pnl.manage") ? who : null);
const userRef = (who: StaffPersona): Schemas["UserRefDto"] => ({ id: who.id, displayName: who.displayName });

/* ------------------------------------------------------------------------------------------ money */

/** Satang (integer) → the API's decimal string with two places. */
function money(satang: number | null): string | null {
  if (satang === null) return null;
  const negative = satang < 0;
  const abs = Math.abs(Math.round(satang));
  return `${negative && abs !== 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
/** A decimal string → satang. */
const satangOf = (value: string | null | undefined) => (value ? Math.round(Number(value) * 100) : null);
/** Half away from zero, as the engine rounds. */
const round = (value: number) => Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
/** a ÷ b in hundredths (a percentage or days with two places), or null when b is 0. */
const ratio = (a: number, b: number, scale = 100) => (b === 0 ? null : round((a / b) * scale * 100));

/* ------------------------------------------------------------------------------------------ months */

const thisBangkokMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);
let clockShift = 0;
function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}
/** The mock's "current Bangkok month" (moved by the close-month job). */
const currentMonth = () => shiftMonth(thisBangkokMonth(), clockShift);
const monthsOf = (year: number) => Array.from({ length: 12 }, (_, at) => `${year}-${String(at + 1).padStart(2, "0")}`);
const daysIn = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const monthIndex = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return (y - 2025) * 12 + (m - 1);
};
const nowIso = () => `${new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 19)}+07:00`;

function monthDto(month: string): MonthDto {
  const now = currentMonth();
  if (month > now) return { month, kind: "forecast", periodOpen: false, periodStatus: null };
  const previous = shiftMonth(now, -1);
  const status: Schemas["PeriodStatus"] = month === now ? "open" : month === previous ? "soft_closed" : "closed";
  return { month, kind: "actual", periodOpen: status !== "closed", periodStatus: status };
}

/* ---------------------------------------------------------------------------- the made-up ledger */

/** FNV-1a — a stable "random" per key, so every run draws the same fake ledger. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const char of text) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
const jitter = (key: string, month: string, spread: number) => ((hash(`${key}:${month}`) % 2001) / 1000 - 1) * spread;

const SEASON = [0.92, 0.88, 1.0, 0.97, 1.04, 1.08, 1.02, 1.1, 1.06, 1.12, 1.18, 1.25];
const UNMAPPED: readonly LineKey[] = [
  "salaries",
  "rent_utilities",
  "software_cloud",
  "professional_fees",
  "finance_cost",
];
const DEPRECIATION = 1_845_000;

/** A full month's posted amount per mapped line (satang), before the open month's "to date" share. */
function ledgerFull(month: string): Record<string, number> {
  const t = monthIndex(month);
  const season = SEASON[Number(month.slice(5)) - 1]!;
  const goods = round(2_350_000_00 * season * (1 + 0.012 * t) * (1 + jitter("goods", month, 0.04)));
  const shipping = round(goods * (0.031 + jitter("ship", month, 0.003)));
  const discounts = round(goods * (0.024 + jitter("disc", month, 0.004)));
  const net = goods + shipping - discounts;
  return {
    revenue_goods: goods,
    revenue_shipping: shipping,
    discounts,
    factory_cost: round(goods * (0.638 + jitter("cogs", month, 0.012))),
    shipping_cost: round(shipping * (0.82 + jitter("shipc", month, 0.04))),
    payment_fees: round(net * 0.0135),
    agent_commission: round(goods * (0.026 + jitter("agent", month, 0.004))),
    employee_commission: round(goods * (0.009 + jitter("emp", month, 0.002))),
    marketing: round(95_000_00 * (1 + jitter("mkt", month, 0.18))),
    depreciation: DEPRECIATION,
    other_opex: round(42_000_00 * (1 + jitter("opex", month, 0.25))),
    ar: round(net * 1.07 * (1.22 + jitter("ar", month, 0.12))),
    ap: round(goods * 0.638 * (0.74 + jitter("ap", month, 0.1))),
  };
}
/** What the ledger holds for a month now: the whole month once it is past, "to date" in the open month. */
function ledger(month: string): Record<string, number> | null {
  const now = currentMonth();
  if (month > now) return null;
  const full = ledgerFull(month);
  if (month < now) return full;
  const share = 0.56;
  return Object.fromEntries(
    Object.entries(full).map(([key, value]) => [key, key === "depreciation" ? value : round(value * share)]),
  );
}

const DOCS_PER_MONTH = (key: string, month: string) => 6 + (hash(`n:${key}:${month}`) % 5);

/* ---------------------------------------------------------------------------------------- state */

interface StoredCell {
  value: number | null;
  mode: "auto" | "manual" | "override";
  autoValue: number | null;
  source: CellSource;
  sourceRef: Record<string, unknown> | null;
  note: string | null;
  asOf: string | null;
  updatedBy: Schemas["UserRefDto"] | null;
  updatedAt: string | null;
  etag: string;
}

interface PlanRecord {
  plan: Plan;
  deleted: boolean;
  /** `${lineKey}|${month}` → the stored cell of a source line (formula lines are worked out on read). */
  cells: Map<string, StoredCell>;
  notes: Map<string, { note: string; by: Schemas["UserRefDto"]; at: string }>;
}

let seq = 0;
const nextEtag = () => `"pnl-${(seq += 1).toString(36)}-${hash(String(Date.now() + seq)).toString(36)}"`;
const plans: PlanRecord[] = [];
const idempotency = new Map<string, Plan>();
const LINE = new Map(PNL_CATALOGUE.map((line) => [line.key, line]));
const SOURCE_LINES = PNL_CATALOGUE.filter((line) => line.calc === "source").map((line) => line.key);
const cellKey = (key: LineKey, month: string) => `${key}|${month}`;

/** The trailing window: the three complete months before the current one. */
function trailing(): string[] {
  const now = currentMonth();
  return [shiftMonth(now, -3), shiftMonth(now, -2), shiftMonth(now, -1)];
}
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** The system's value for a source line in a month: actual from the ledger, or the forecast rule; null = none. */
function autoValue(
  key: LineKey,
  month: string,
): { value: number | null; source: CellSource; ref: Record<string, unknown> | null } {
  const now = currentMonth();
  const line = LINE.get(key)!;
  if (month <= now) {
    const posted = ledger(month)!;
    if (key === "memo_dso" || key === "memo_dpo") return balanceDays(key, month);
    if (key === "memo_bad_debt")
      return { value: null, source: "balances", ref: { accounts: ["1210"], status: "not_set" } };
    if (!(key in posted)) return { value: null, source: "none", ref: null };
    return {
      value: posted[key]!,
      source: "gl",
      ref: { accounts: line.glAccounts.map((a) => a.code), lines: DOCS_PER_MONTH(key, month) },
    };
  }
  // Forecast.
  const window = trailing();
  const months = window.map((m) => ledgerFull(m));
  const windowRef = `${window[0]}..${window[2]}`;
  const avg = (k: string) => round(sum(months.map((m) => m[k]!)) / months.length);
  const share = (k: string, of: string) => sum(months.map((m) => m[k]!)) / sum(months.map((m) => m[of]!));
  const ahead =
    (Number(month.slice(0, 4)) - Number(now.slice(0, 4))) * 12 + Number(month.slice(5)) - Number(now.slice(5));
  const pipelinePerMonth = ahead <= 3 ? 920_000_00 : 0;
  const runRatePerMonth = round(avg("revenue_goods") * 0.88);
  const goods = pipelinePerMonth + runRatePerMonth;
  const shipping = round(goods * share("revenue_shipping", "revenue_goods"));
  const discounts = round(goods * share("discounts", "revenue_goods"));
  const ratioRef = (k: string, of: string) => ({ window: windowRef, ratioPct: (share(k, of) * 100).toFixed(2) });
  switch (key) {
    case "revenue_goods":
      return {
        value: goods,
        source: "pipeline_run_rate",
        ref: {
          pipelinePerMonth: money(pipelinePerMonth),
          runRatePerMonth: money(runRatePerMonth),
          openLeads: ahead <= 3 ? 7 : 0,
          repeatCustomers: 12,
          window: windowRef,
        },
      };
    case "revenue_shipping":
      return { value: shipping, source: "trailing_ratio", ref: ratioRef("revenue_shipping", "revenue_goods") };
    case "discounts":
      return { value: discounts, source: "trailing_ratio", ref: ratioRef("discounts", "revenue_goods") };
    case "factory_cost":
      return {
        value: round(goods * share("factory_cost", "revenue_goods")),
        source: "trailing_ratio",
        ref: {
          ...ratioRef("factory_cost", "revenue_goods"),
          byClass: [
            { productType: "กล่องลูกฟูก", mixPct: "58.00", costPct: "70.10" },
            { productType: "กล่องกระดาษแข็ง", mixPct: "42.00", costPct: "66.40" },
          ],
        },
      };
    case "shipping_cost":
      return {
        value: round(shipping * share("shipping_cost", "revenue_shipping")),
        source: "trailing_ratio",
        ref: ratioRef("shipping_cost", "revenue_shipping"),
      };
    case "payment_fees":
      return {
        value: round((goods + shipping - discounts) * 0.0135),
        source: "trailing_ratio",
        ref: { window: windowRef, ratioPct: "1.35" },
      };
    case "agent_commission":
    case "employee_commission":
      return {
        value: round(goods * share(key, "revenue_goods")),
        source: "commission_rates",
        ref: {
          window: windowRef,
          ratioPct: (share(key, "revenue_goods") * 100).toFixed(2),
          openLeads: ahead <= 3 ? 7 : 0,
        },
      };
    case "marketing":
    case "other_opex":
      return { value: avg(key), source: "trailing_average", ref: { window: windowRef } };
    case "depreciation":
      return { value: DEPRECIATION, source: "fixed_assets", ref: { assets: 4 } };
    case "memo_dso":
    case "memo_dpo": {
      const days = window.map((m) => balanceDays(key, m).value!);
      return { value: round(sum(days) / days.length), source: "trailing_average", ref: { window: windowRef } };
    }
    case "memo_bad_debt":
      return { value: null, source: "balances", ref: { accounts: ["1210"], status: "not_set" } };
    default:
      return { value: null, source: "none", ref: null };
  }
}

/** DSO / DPO of a month from the AR (1210) / factory payables (2110) balances, in hundredths of a day. */
function balanceDays(key: "memo_dso" | "memo_dpo", month: string) {
  const posted = ledgerFull(month);
  const before = ledgerFull(shiftMonth(month, -1));
  const net = posted["revenue_goods"]! + posted["revenue_shipping"]! - posted["discounts"]!;
  const cost = posted["factory_cost"]! + posted["shipping_cost"]!;
  const value =
    key === "memo_dso"
      ? ratio((posted["ar"]! + before["ar"]!) / 2, net, daysIn(month))
      : ratio((posted["ap"]! + before["ap"]!) / 2, cost, daysIn(month));
  return { value, source: "balances" as CellSource, ref: { accounts: [key === "memo_dso" ? "1210" : "2110"] } };
}

/** Fills (or refreshes) every source cell; manual and override values and their notes are kept. */
function compute(record: PlanRecord, at = nowIso()) {
  for (const key of SOURCE_LINES) {
    for (const month of monthsOf(record.plan.fiscalYear)) {
      const id = cellKey(key, month);
      const current = record.cells.get(id);
      const auto = autoValue(key, month);
      const editable = LINE.get(key)!.editable;
      const base: StoredCell = {
        value: auto.value,
        mode: "auto",
        autoValue: auto.value,
        source: auto.source,
        sourceRef: auto.ref,
        note: null,
        asOf: auto.value === null ? null : at,
        updatedBy: null,
        updatedAt: at,
        etag: nextEtag(),
      };
      if (editable && auto.value === null && current?.mode !== "override") {
        // No system data: a manual cell (kept if a person filled it).
        record.cells.set(id, {
          ...base,
          mode: "manual",
          value: current?.mode === "manual" ? current.value : null,
          autoValue: null,
          source: "none",
          sourceRef: null,
          note: current?.mode === "manual" ? current.note : null,
          updatedBy: current?.mode === "manual" ? current.updatedBy : null,
          updatedAt: current?.updatedAt ?? at,
          etag: current?.etag ?? base.etag,
        });
      } else if (
        editable &&
        current &&
        (current.mode === "override" || (current.mode === "manual" && current.value !== null))
      ) {
        // A manual line that gained system data becomes an override with its note as the reason.
        record.cells.set(id, {
          ...current,
          mode: "override",
          autoValue: auto.value,
          source: auto.source,
          sourceRef: auto.ref,
          asOf: at,
          etag: nextEtag(),
        });
      } else {
        record.cells.set(id, base);
      }
    }
  }
  record.plan.computedAt = at;
  record.plan.updatedAt = at;
  record.plan.etag = nextEtag();
}

/* ------------------------------------------------------------------------------- the formulas */

type Values = Record<string, (number | null)[]>;

/** Every line's 12 values: source cells as stored, formula lines worked out from the rounded cells. */
function evaluate(source: (key: LineKey, at: number) => number | null, months: readonly string[]): Values {
  const v: Values = {};
  const z = (key: string, at: number) => v[key]![at] ?? 0;
  for (const key of SOURCE_LINES) v[key] = months.map((_, at) => source(key, at));
  const each = (fn: (at: number) => number | null) => months.map((_, at) => fn(at));
  v["net_revenue"] = each((at) => z("revenue_goods", at) + z("revenue_shipping", at) - z("discounts", at));
  v["gross_margin"] = each(
    (at) => z("net_revenue", at) - z("factory_cost", at) - z("shipping_cost", at) - z("payment_fees", at),
  );
  const opex = [
    "agent_commission",
    "employee_commission",
    "marketing",
    "salaries",
    "rent_utilities",
    "software_cloud",
    "professional_fees",
    "depreciation",
    "other_opex",
  ];
  v["ebit"] = each((at) => z("gross_margin", at) - sum(opex.map((k) => z(k, at))));
  // CIT, cumulative: tax(YTD profit before tax) − tax(YTD to the month before); standard 20 % (paid-up capital unset).
  const tax = (profit: number) => (profit > 0 ? round(profit * 0.2) : 0);
  let ytd = 0;
  v["cit_estimate"] = each((at) => {
    const before = tax(ytd);
    ytd += z("ebit", at) - z("finance_cost", at);
    return tax(ytd) - before;
  });
  v["net_profit"] = each((at) => z("ebit", at) - z("finance_cost", at) - z("cit_estimate", at));
  v["memo_ebitda"] = each((at) => z("ebit", at) + z("depreciation", at));
  v["memo_commission_ratio"] = each((at) =>
    ratio(z("agent_commission", at) + z("employee_commission", at), z("gross_margin", at)),
  );
  v["memo_ccc"] = each((at) =>
    v["memo_dso"]![at] === null || v["memo_dpo"]![at] === null ? null : z("memo_dso", at) - z("memo_dpo", at),
  );
  v["memo_credit_cost"] = each((at) =>
    round(((z("factory_cost", at) + z("shipping_cost", at)) * 0.07 * Math.max(0, z("memo_ccc", at) / 100)) / 365),
  );
  const fixed = [
    "marketing",
    "salaries",
    "rent_utilities",
    "software_cloud",
    "professional_fees",
    "depreciation",
    "other_opex",
  ];
  v["memo_break_even"] = each((at) => {
    const contribution = z("gross_margin", at) - z("agent_commission", at) - z("employee_commission", at);
    return contribution <= 0 ? null : round((sum(fixed.map((k) => z(k, at))) * z("net_revenue", at)) / contribution);
  });
  return v;
}

/** The year's figure of a line: money summed, ratios and days on the year, bad debt the last month, break-even on totals. */
function totalOf(key: LineKey, v: Values, months: readonly string[]): number | null {
  const t = (k: string) => sum(v[k]!.map((x) => x ?? 0));
  const line = LINE.get(key)!;
  if (key === "memo_bad_debt") return [...v[key]!].reverse().find((x) => x !== null) ?? null;
  if (key === "memo_commission_ratio")
    return ratio(t("agent_commission") + t("employee_commission"), t("gross_margin"));
  if (key === "memo_dso" || key === "memo_dpo") {
    const known = v[key]!.filter((x): x is number => x !== null);
    return known.length ? round(sum(known) / known.length) : null;
  }
  if (key === "memo_ccc") {
    const dso = totalOf("memo_dso", v, months);
    const dpo = totalOf("memo_dpo", v, months);
    return dso === null || dpo === null ? null : dso - dpo;
  }
  if (key === "memo_break_even") {
    const fixed = [
      "marketing",
      "salaries",
      "rent_utilities",
      "software_cloud",
      "professional_fees",
      "depreciation",
      "other_opex",
    ];
    const contribution = t("gross_margin") - t("agent_commission") - t("employee_commission");
    return contribution <= 0 ? null : round((sum(fixed.map(t)) * t("net_revenue")) / contribution);
  }
  if (line.unit !== "money") return null;
  if (v[key]!.every((x) => x === null)) return null;
  return t(key);
}

/* ------------------------------------------------------------------------------------ the grid */

function gridOf(record: PlanRecord): Grid {
  const months = monthsOf(record.plan.fiscalYear);
  const stored = (key: LineKey, at: number) => record.cells.get(cellKey(key, months[at]!))?.value ?? null;
  const v = evaluate(stored, months);
  let emptyManual = 0;
  const lines: Schemas["PnlGridLineDto"][] = PNL_CATALOGUE.map((line) => {
    const cells: Cell[] = months.map((month, at) => {
      const period = monthDto(month);
      const cell = record.cells.get(cellKey(line.key, month));
      if (cell) {
        if (cell.mode === "manual" && cell.value === null) emptyManual += 1;
        return {
          month,
          value: money(cell.value),
          mode: cell.mode,
          autoValue: money(cell.autoValue),
          source: cell.source,
          sourceRef: cell.sourceRef,
          note: cell.note,
          periodOpen: period.periodOpen,
          asOf: cell.asOf,
          updatedBy: cell.updatedBy,
          updatedAt: cell.updatedAt,
          etag: cell.etag,
          drillable:
            cell.value !== null && cell.mode !== "manual" && cell.source !== "none" && cell.source !== "balances",
        };
      }
      return {
        month,
        value: money(v[line.key]![at] ?? null),
        mode: "calculated",
        autoValue: null,
        source: "formula",
        sourceRef: line.key === "cit_estimate" ? { smeApplied: false, ratePct: "20.00" } : null,
        note: null,
        periodOpen: period.periodOpen,
        asOf: record.plan.computedAt,
        updatedBy: null,
        updatedAt: record.plan.computedAt,
        etag: `"calc-${line.key}-${month}"`,
        drillable: false,
      };
    });
    return { line, cells, total: money(totalOf(line.key, v, months)) };
  });
  const total = (key: LineKey) => totalOf(key, v, months) ?? 0;
  const netRevenue = total("net_revenue");
  const grossMargin = total("gross_margin");
  const contribution = grossMargin - total("agent_commission") - total("employee_commission");
  return {
    plan: record.plan,
    currency: "THB",
    months: months.map(monthDto),
    lines,
    summary: {
      netRevenue: money(netRevenue),
      grossMargin: money(grossMargin),
      grossMarginPct: money(ratio(grossMargin, netRevenue)),
      contributionAfterCommission: money(contribution),
      contributionAfterCommissionPct: money(ratio(contribution, netRevenue)),
      ebitda: money(total("memo_ebitda")),
      netProfit: money(total("net_profit")),
      cashConversionDays: money(totalOf("memo_ccc", v, months)),
      breakEvenRevenue: money(totalOf("memo_break_even", v, months)),
      citSmeApplied: false,
      emptyManualCells: emptyManual,
    },
  };
}

/* ------------------------------------------------------------------------------- plan vs actual */

const DEPENDS_ON_MANUAL = new Set<LineKey>(["ebit", "cit_estimate", "net_profit", "memo_ebitda", "memo_break_even"]);

function varianceOf(record: PlanRecord): Variance {
  const months = monthsOf(record.plan.fiscalYear);
  const now = currentMonth();
  const plan = evaluate((key, at) => record.cells.get(cellKey(key, months[at]!))?.value ?? null, months);
  const actual = evaluate((key, at) => {
    const month = months[at]!;
    if (month > now) return null;
    if (UNMAPPED.includes(key)) return record.cells.get(cellKey(key, month))?.value ?? null;
    if (key === "memo_dso" || key === "memo_dpo") return balanceDays(key, month).value;
    if (key === "memo_bad_debt") return null;
    return ledger(month)![key] ?? null;
  }, months);
  const lines = PNL_CATALOGUE.map((line) => {
    const cells: VarianceCell[] = months.map((month, at) => {
      const p = plan[line.key]![at] ?? null;
      const isActual = month <= now;
      const basis: Schemas["PnlActualBasis"] = !isActual
        ? "not_yet"
        : UNMAPPED.includes(line.key) || line.key === "memo_bad_debt"
          ? "none"
          : line.calc === "formula"
            ? DEPENDS_ON_MANUAL.has(line.key)
              ? "includes_plan_values"
              : "calculated"
            : "ledger";
      const a = isActual && basis !== "none" ? (actual[line.key]![at] ?? null) : null;
      const note = record.notes.get(cellKey(line.key, month));
      const difference = a === null || p === null ? null : a - p;
      return {
        month,
        plan: money(p),
        actual: money(a),
        variance: money(difference),
        variancePct: difference === null || p === null || p === 0 ? null : money(ratio(difference, Math.abs(p))),
        actualBasis: basis,
        note: note?.note ?? null,
        noteBy: note?.by ?? null,
        noteUpdatedAt: note?.at ?? null,
      };
    });
    const actualAt = months.map((month, at) => (month <= now ? at : -1)).filter((at) => at >= 0);
    const money_ = line.unit === "money";
    const totalPlan = money_ && actualAt.length ? sum(actualAt.map((at) => plan[line.key]![at] ?? 0)) : null;
    const actuals = actualAt.map((at) => (cells[at]!.actual === null ? null : (actual[line.key]![at] ?? 0)));
    const totalActual = money_ && actuals.length && actuals.every((x) => x !== null) ? sum(actuals as number[]) : null;
    const totalVariance = totalPlan === null || totalActual === null ? null : totalActual - totalPlan;
    return {
      line,
      cells,
      totalPlan: money(totalPlan),
      totalActual: money(totalActual),
      totalVariance: money(totalVariance),
      totalVariancePct: totalVariance === null || !totalPlan ? null : money(ratio(totalVariance, Math.abs(totalPlan))),
    };
  });
  return { plan: record.plan, currency: "THB", asOf: nowIso(), months: months.map(monthDto), lines };
}

/* ---------------------------------------------------------------------------------- drill-down */

const GL_TEXT: Partial<Record<LineKey, string>> = {
  revenue_goods: "ขายสินค้า",
  revenue_shipping: "ค่าขนส่งที่เรียกเก็บ",
  discounts: "ส่วนลดตามใบกำกับ",
  factory_cost: "ค่าผลิตโรงงานพันธมิตร",
  shipping_cost: "ค่าขนส่งจ่าย",
  payment_fees: "ค่าธรรมเนียมรับชำระ",
  agent_commission: "ค่าคอมตัวแทน",
  employee_commission: "ค่าคอมพนักงานขาย",
  marketing: "ค่าโฆษณาออนไลน์",
  depreciation: "ค่าเสื่อมราคาประจำเดือน",
  other_opex: "ค่าธรรมเนียมธนาคาร",
};
const STAGES = [
  ["quoted", "เสนอราคาแล้ว", 40],
  ["negotiating", "กำลังต่อรอง", 60],
  ["contacted", "ติดต่อแล้ว", 20],
  ["new", "ใหม่", 10],
] as const;

/** Splits an amount into `count` parts that add up to it (the mock's journal lines of a month). */
function split(total: number, count: number, seed: string): number[] {
  const weights = Array.from({ length: count }, (_, at) => 1 + (hash(`${seed}:${at}`) % 9));
  const whole = sum(weights);
  const parts = weights.map((weight) => round((total * weight) / whole));
  parts[count - 1] = total - sum(parts.slice(0, -1));
  return parts;
}

function glItems(key: LineKey, months: readonly string[]): SourceItem[] {
  const line = LINE.get(key)!;
  return months.flatMap((month) => {
    const posted = ledger(month)?.[key] ?? ledgerFull(month)[key] ?? 0;
    const count = DOCS_PER_MONTH(key, month);
    return split(posted, count, `${key}:${month}`).map((amount, at) => {
      const code = `JE${month.replace("-", "")}-${String(120 + at * 7 + (hash(key) % 50)).padStart(6, "0")}`;
      const doc =
        key.startsWith("revenue") || key === "discounts"
          ? `TR${month.slice(2, 4)}${month.slice(5)}-${String(40 + at).padStart(5, "0")}`
          : null;
      return {
        kind: "gl_line" as const,
        id: mockId("pnlje", hash(code) % 0xffffff),
        code,
        date: `${month}-${String(Math.min(2 + at * 4, daysIn(month))).padStart(2, "0")}`,
        amount: money(amount),
        accountCode: line.glAccounts[at % Math.max(1, line.glAccounts.length)]?.code ?? null,
        description: `${GL_TEXT[key] ?? line.labelTh}${doc ? ` ${doc}` : ""} (ข้อมูลจำลอง)`,
        sourceDocumentType: doc ? "customer_document" : null,
        sourceDocumentId: null,
        sourceDocumentNo: doc,
        orderId: null,
        orderCode: doc ? `O${month.slice(2, 4)}${month.slice(5)}-${String(10 + at).padStart(5, "0")}` : null,
      };
    });
  });
}

function sourcesOf(record: PlanRecord, key: LineKey, month: string, kind: string | null): SourceItem[] | null {
  const cell = record.cells.get(cellKey(key, month));
  if (!cell) return null;
  const empty = (k: Schemas["PnlSourceKind"]): SourceItem => ({
    kind: k,
    id: null,
    code: null,
    date: null,
    amount: null,
    accountCode: null,
    description: null,
    sourceDocumentType: null,
    sourceDocumentId: null,
    sourceDocumentNo: null,
    orderId: null,
    orderCode: null,
  });
  const leads = (): SourceItem[] =>
    Array.from({ length: 7 }, (_, at) => {
      const [, stageTh, pct] = STAGES[at % STAGES.length]!;
      const expected = 420_000_00 + (hash(`lead${at}`) % 900_000_00);
      return {
        ...empty("lead"),
        id: mockId("pnllead", at + 1),
        code: `L${month.slice(2, 4)}${month.slice(5)}-${String(at + 31).padStart(4, "0")}`,
        amount: money(round((expected * pct) / 100)),
        description: `${stageTh} · ${pct}% ของมูลค่าที่คาด ${money(expected)}`,
      };
    });
  if (kind === "commission" && (key === "agent_commission" || key === "employee_commission")) {
    return split(cell.value ?? 0, 5, `com:${key}:${month}`).map((amount, at) => ({
      ...empty("commission"),
      id: mockId("pnlcom", at + 1),
      code: `CM${month.slice(2, 4)}${month.slice(5)}-${String(at + 11).padStart(4, "0")}`,
      date: `${month}-${String(5 + at * 5).padStart(2, "0")}`,
      amount: money(amount),
      description: `ค่าคอมที่รับรู้ ${key === "agent_commission" ? "ตัวแทนอิสระ" : "พนักงานขาย"} (ข้อมูลจำลอง)`,
    }));
  }
  switch (cell.source) {
    case "gl":
      return glItems(key, [month]);
    case "trailing_ratio":
    case "trailing_average":
      return glItems(key, trailing());
    case "pipeline_run_rate":
    case "commission_rates":
      return kind === "customer_run_rate"
        ? Array.from({ length: 12 }, (_, at) => ({
            ...empty("customer_run_rate"),
            id: mockId("pnlco", at + 1),
            amount: money(round((ledgerFull(trailing()[2]!)["revenue_goods"]! * 0.88) / 12)),
            description: "ลูกค้าที่มียอดซื้ออย่างน้อย 2 ใน 3 เดือนล่าสุด (รหัสบริษัทเท่านั้น)",
          }))
        : leads();
    case "fixed_assets":
      return [
        ["FA-0003", "เครื่องตัดกระดาษ (ข้อมูลจำลอง)", 8_250_00],
        ["FA-0007", "เครื่องพิมพ์ตัวอย่างดิจิทัล (ข้อมูลจำลอง)", 6_400_00],
        ["FA-0011", "คอมพิวเตอร์ทีมออกแบบ (ข้อมูลจำลอง)", 2_350_00],
        ["FA-0014", "ชั้นวางคลังตัวอย่าง (ข้อมูลจำลอง)", 1_450_00],
      ].map(([code, description, amount], at) => ({
        ...empty("fixed_asset"),
        id: mockId("pnlfa", at + 1),
        code: code as string,
        date: `${month}-${String(daysIn(month)).padStart(2, "0")}`,
        amount: money(amount as number),
        accountCode: "6150",
        description: description as string,
      }));
    default:
      return [];
  }
}

/* ------------------------------------------------------------------------------------- seeding */

const MANUAL_SEED: Partial<Record<LineKey, [number, string]>> = {
  salaries: [410_000_00, "พนักงาน 14 คน × ค่าจ้างเฉลี่ย 29,300 บาท รวมประกันสังคม (ข้อมูลจำลอง)"],
  rent_utilities: [68_000_00, "ค่าเช่าสำนักงานตามสัญญา + ค่าไฟเฉลี่ย (ข้อมูลจำลอง)"],
  software_cloud: [24_500_00, "cloud + SaaS ตามใบแจ้งหนี้รายเดือน (ข้อมูลจำลอง)"],
  professional_fees: [15_000_00, "ค่าสอบบัญชีปีละ 180,000 เฉลี่ยรายเดือน (ข้อมูลจำลอง)"],
  finance_cost: [6_200_00, "ดอกเบี้ยวงเงิน OD ตามสัญญา (ข้อมูลจำลอง)"],
};

function newRecord(input: {
  name: string;
  fiscalYear: number;
  scenario: Scenario;
  note: string | null;
  owner: Schemas["UserRefDto"];
  copiedFromId?: string | null;
}): PlanRecord {
  const version =
    1 +
    Math.max(
      0,
      ...plans
        .filter(
          (r) =>
            !r.deleted &&
            r.plan.name === input.name &&
            r.plan.fiscalYear === input.fiscalYear &&
            r.plan.scenario === input.scenario,
        )
        .map((r) => r.plan.version),
    );
  const at = nowIso();
  return {
    plan: {
      id: mockId("pnlplan", plans.length + 1),
      name: input.name,
      fiscalYear: input.fiscalYear,
      scenario: input.scenario,
      status: "draft",
      version,
      note: input.note,
      owner: input.owner,
      copiedFromId: input.copiedFromId ?? null,
      computedAt: null,
      lockedAt: null,
      lockedBy: null,
      snapshotSha256: null,
      etag: nextEtag(),
      createdAt: at,
      updatedAt: at,
    },
    deleted: false,
    cells: new Map(),
    notes: new Map(),
  };
}

function seed() {
  if (plans.length) return;
  const finance = PERSONAS.find((p) => p.key === "finance_manager")!;
  const owner = userRef(finance);
  const year = Number(currentMonth().slice(0, 4));
  // The baseline this year, computed and locked at the end of last year: every month was a forecast then, so the
  // plan's numbers sit off the actuals by a made-up forecast error.
  const base = newRecord({
    name: `แผนประจำปี ${year + 543}`,
    fiscalYear: year,
    scenario: "base",
    note: "แผนตั้งต้นที่ที่ประชุมผู้บริหารอนุมัติ (ข้อมูลจำลอง)",
    owner,
  });
  const lockAt = `${year - 1}-12-28T16:00:00+07:00`;
  for (const key of SOURCE_LINES) {
    for (const month of monthsOf(year)) {
      const manual = MANUAL_SEED[key];
      const full = ledgerFull(month)[key];
      const forecast = full === undefined ? null : round(full * (1 + jitter(`plan:${key}`, month, 0.09)));
      const days = key === "memo_dso" || key === "memo_dpo" ? balanceDays(key, shiftMonth(month, -12)).value : null;
      const value = manual ? manual[0] : (days ?? forecast);
      base.cells.set(cellKey(key, month), {
        value: key === "memo_bad_debt" ? null : value,
        mode: manual ? "manual" : "auto",
        autoValue: manual ? null : value,
        source: manual
          ? "none"
          : key === "revenue_goods"
            ? "pipeline_run_rate"
            : key === "depreciation"
              ? "fixed_assets"
              : key.startsWith("memo")
                ? "balances"
                : "trailing_ratio",
        sourceRef: manual
          ? null
          : key === "memo_bad_debt"
            ? { accounts: ["1210"], status: "not_set" }
            : { window: `${year - 1}-09..${year - 1}-11` },
        note: manual ? manual[1] : null,
        asOf: manual ? null : lockAt,
        updatedBy: manual ? owner : null,
        updatedAt: lockAt,
        etag: nextEtag(),
      });
    }
  }
  Object.assign(base.plan, {
    status: "locked",
    computedAt: `${year - 1}-12-20T09:00:00+07:00`,
    lockedAt: lockAt,
    lockedBy: owner,
    snapshotSha256: "5c1e0a9d7f3b2e4c6a8d0f1b3c5e7a9b2d4f6a8c0e1b3d5f7a9c2e4b6d8f0a1c",
    createdAt: `${year - 1}-12-15T10:00:00+07:00`,
    updatedAt: lockAt,
  } satisfies Partial<Plan>);
  const firstClosed = `${year}-02`;
  base.notes.set(cellKey("revenue_goods", firstClosed), {
    note: "ลูกค้ารายใหญ่เลื่อนสั่งไปเดือนมีนาคม (ข้อมูลจำลอง)",
    by: owner,
    at: `${year}-03-06T11:20:00+07:00`,
  });
  plans.push(base);

  const next = newRecord({
    name: `แผนประจำปี ${year + 544}`,
    fiscalYear: year + 1,
    scenario: "base",
    note: null,
    owner,
  });
  compute(next, `${year}-${currentMonth().slice(5)}-02T09:00:00+07:00`);
  for (const [key, [value, note]] of Object.entries(MANUAL_SEED) as [LineKey, [number, string]][]) {
    for (const month of monthsOf(year + 1)) {
      const cell = next.cells.get(cellKey(key, month))!;
      Object.assign(cell, { value: round(value * 1.04), note, updatedBy: owner });
    }
  }
  plans.push(next);
}

const recordOf = (id: string) => {
  seed();
  return plans.find((r) => r.plan.id === id && !r.deleted);
};

/* ------------------------------------------------------------------------------------- handlers */

const BASE = "*/v1/admin/finance/pnl";
const SCENARIOS: readonly Scenario[] = ["base", "best", "worst", "custom"];
const MONEY = /^-?\d{1,12}(\.\d{1,2})?$/;

export const pnlHandlers = [
  http.get(`${BASE}/lines`, ({ request }) => {
    if (!reader(staffPersonaOf(request))) return forbidden();
    return HttpResponse.json({
      effectiveFrom: "2026-11-03T00:00:00+07:00",
      lines: [...PNL_CATALOGUE],
    } satisfies Schemas["PnlLineCatalogueDto"]);
  }),

  http.get(`${BASE}/plans`, ({ request }) => {
    if (!reader(staffPersonaOf(request))) return forbidden();
    seed();
    const url = new URL(request.url);
    const year = url.searchParams.get("fiscalYear");
    const scenario = url.searchParams.get("scenario");
    const status = url.searchParams.get("status");
    const rows = plans
      .filter((r) => !r.deleted)
      .map((r) => r.plan)
      .filter(
        (p) =>
          (!year || p.fiscalYear === Number(year)) &&
          (!scenario || p.scenario === scenario) &&
          (!status || p.status === status),
      )
      .sort(
        (a, b) =>
          b.fiscalYear - a.fiscalYear ||
          SCENARIOS.indexOf(a.scenario) - SCENARIOS.indexOf(b.scenario) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  http.post(`${BASE}/plans`, async ({ request }) => {
    const who = manager(staffPersonaOf(request));
    if (!who) return forbidden();
    seed();
    const body = (await request.json()) as Partial<Schemas["CreatePnlPlanDto"]>;
    const name = body.name?.trim() ?? "";
    if (name.length < 1 || name.length > 120) return invalid("name", "ระบุชื่อแผน 1–120 ตัวอักษร");
    if (!Number.isInteger(body.fiscalYear) || body.fiscalYear! < 2000 || body.fiscalYear! > 2200)
      return invalid("fiscalYear", "ปีไม่ถูกต้อง");
    if (!SCENARIOS.includes(body.scenario as Scenario)) return invalid("scenario", "สถานการณ์ไม่ถูกต้อง");
    const record = newRecord({
      name,
      fiscalYear: body.fiscalYear!,
      scenario: body.scenario as Scenario,
      note: body.note?.trim() || null,
      owner: userRef(who),
    });
    compute(record);
    plans.push(record);
    return HttpResponse.json(record.plan, { status: 201 });
  }),

  http.get(`${BASE}/plans/:planId`, ({ request, params }) => {
    if (!reader(staffPersonaOf(request))) return forbidden();
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    return HttpResponse.json(record.plan, { headers: { ETag: record.plan.etag } });
  }),

  http.patch(`${BASE}/plans/:planId`, async ({ request, params }) => {
    if (!manager(staffPersonaOf(request))) return forbidden();
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    const match = request.headers.get("if-match");
    if (!match) return preconditionRequired();
    if (match !== record.plan.etag) return stale();
    if (record.plan.status === "locked") return locked();
    const body = (await request.json()) as Schemas["UpdatePnlPlanDto"];
    if (body.name !== undefined) record.plan.name = body.name.trim();
    if (body.note !== undefined) record.plan.note = body.note?.trim() || null;
    record.plan.updatedAt = nowIso();
    record.plan.etag = nextEtag();
    return HttpResponse.json(record.plan);
  }),

  http.delete(`${BASE}/plans/:planId`, ({ request, params }) => {
    if (!manager(staffPersonaOf(request))) return forbidden();
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    const match = request.headers.get("if-match");
    if (!match) return preconditionRequired();
    if (match !== record.plan.etag) return stale();
    if (record.plan.status === "locked") return locked();
    record.deleted = true;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/plans/:planId/grid`, ({ request, params }) => {
    if (!reader(staffPersonaOf(request))) return forbidden();
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    return HttpResponse.json(gridOf(record));
  }),

  http.put(`${BASE}/plans/:planId/cells/:lineKey/:month`, async ({ request, params }) => {
    const who = manager(staffPersonaOf(request));
    if (!who) return forbidden();
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    const key = String(params["lineKey"]) as LineKey;
    const month = String(params["month"]);
    const line = LINE.get(key);
    if (!line || !monthsOf(record.plan.fiscalYear).includes(month)) return notFound();
    if (record.plan.status === "locked") return locked();
    if (!line.editable)
      return problem(422, "pnl.line_read_only", "บรรทัดนี้คำนวณจากบรรทัดอื่นหรือเป็นข้อมูลอ้างอิง จึงกรอกเองไม่ได้");
    const cell = record.cells.get(cellKey(key, month))!;
    const match = request.headers.get("if-match");
    if (!match) return preconditionRequired();
    if (match !== cell.etag) return stale();
    const body = (await request.json()) as Partial<Schemas["UpdatePnlCellDto"]>;
    const value = body.value ?? null;
    const note = body.note?.trim() || null;
    if (value !== null && !MONEY.test(value)) return invalid("value", "ตัวเลขไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)");
    if (note && note.length > 1000) return invalid("note", "หมายเหตุยาวเกินไป");
    const at = nowIso();
    const touched = { updatedBy: userRef(who), updatedAt: at, etag: nextEtag() };
    if (cell.mode === "manual") {
      if (value !== null && cell.value === null && !note && !cell.note)
        return problem(422, "pnl.note_required", "การกรอกค่าครั้งแรกในบรรทัดที่ระบบไม่มีข้อมูลต้องระบุที่มาของตัวเลข");
      Object.assign(
        cell,
        value === null ? { value: null, note: null } : { value: satangOf(value), note: note ?? cell.note },
        touched,
      );
    } else if (value === null) {
      if (cell.mode === "override") Object.assign(cell, { mode: "auto", value: cell.autoValue, note: null }, touched);
    } else {
      if (!note) return problem(422, "pnl.reason_required", "การแก้ทับค่าที่ระบบคำนวณต้องระบุเหตุผลทุกครั้ง");
      Object.assign(cell, { mode: "override", value: satangOf(value), note }, touched);
    }
    record.plan.updatedAt = at;
    record.plan.etag = nextEtag();
    return HttpResponse.json(gridOf(record));
  }),

  http.post(`${BASE}/plans/:planId/actions/recompute`, ({ request, params }) => {
    if (!manager(staffPersonaOf(request))) return forbidden();
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    const match = request.headers.get("if-match");
    if (!match) return preconditionRequired();
    if (record.plan.status === "locked") return locked();
    if (match !== record.plan.etag) return stale();
    compute(record);
    return HttpResponse.json(gridOf(record));
  }),

  http.post(`${BASE}/plans/:planId/actions/copy`, async ({ request, params }) => {
    const who = manager(staffPersonaOf(request));
    if (!who) return forbidden();
    const from = recordOf(String(params["planId"]));
    if (!from) return notFound();
    const body = (await request.json()) as Partial<Schemas["CopyPnlPlanDto"]>;
    if (!SCENARIOS.includes(body.scenario as Scenario)) return invalid("scenario", "สถานการณ์ไม่ถูกต้อง");
    const record = newRecord({
      name: body.name?.trim() || from.plan.name,
      fiscalYear: from.plan.fiscalYear,
      scenario: body.scenario as Scenario,
      note: body.note?.trim() || null,
      owner: userRef(who),
      copiedFromId: from.plan.id,
    });
    for (const [id, cell] of from.cells) {
      if (cell.mode === "manual" || cell.mode === "override") record.cells.set(id, { ...cell, etag: nextEtag() });
    }
    compute(record);
    plans.push(record);
    return HttpResponse.json(record.plan, { status: 201 });
  }),

  http.post(`${BASE}/plans/:planId/actions/lock`, ({ request, params }) => {
    const who = manager(staffPersonaOf(request));
    if (!who) return forbidden();
    const key = request.headers.get("idempotency-key");
    if (!key) return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key");
    if (idempotency.has(key)) return HttpResponse.json(idempotency.get(key));
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    const match = request.headers.get("if-match");
    if (!match) return preconditionRequired();
    if (record.plan.status === "locked") return locked();
    if (match !== record.plan.etag) return stale();
    if (!record.plan.computedAt) return problem(409, "pnl.not_computed", "คำนวณแผนจากข้อมูลในระบบก่อนล็อก");
    const at = nowIso();
    const digest = [...record.cells.values()].map((c) => `${c.value}`).join(",");
    Object.assign(record.plan, {
      status: "locked",
      lockedAt: at,
      lockedBy: userRef(who),
      snapshotSha256: Array.from({ length: 8 }, (_, at_) =>
        hash(`${digest}:${at_}`).toString(16).padStart(8, "0"),
      ).join(""),
      updatedAt: at,
      etag: nextEtag(),
    } satisfies Partial<Plan>);
    idempotency.set(key, record.plan);
    return HttpResponse.json(record.plan);
  }),

  http.get(`${BASE}/plans/:planId/variance`, ({ request, params }) => {
    if (!reader(staffPersonaOf(request))) return forbidden();
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    return HttpResponse.json(varianceOf(record));
  }),

  http.put(`${BASE}/plans/:planId/variance-notes/:lineKey/:month`, async ({ request, params }) => {
    const who = manager(staffPersonaOf(request));
    if (!who) return forbidden();
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    const key = String(params["lineKey"]) as LineKey;
    const month = String(params["month"]);
    if (!LINE.has(key) || !monthsOf(record.plan.fiscalYear).includes(month)) return notFound();
    const body = (await request.json()) as Partial<Schemas["SetPnlVarianceNoteDto"]>;
    const note = body.note?.trim() ?? "";
    if (note.length < 3 || note.length > 1000) return invalid("note", "หมายเหตุ 3–1,000 ตัวอักษร");
    record.notes.set(cellKey(key, month), { note, by: userRef(who), at: nowIso() });
    return HttpResponse.json(varianceOf(record));
  }),

  http.get(`${BASE}/plans/:planId/cells/:lineKey/:month/sources`, ({ request, params }) => {
    if (!reader(staffPersonaOf(request))) return forbidden();
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    const url = new URL(request.url);
    const items = sourcesOf(
      record,
      String(params["lineKey"]) as LineKey,
      String(params["month"]),
      url.searchParams.get("kind"),
    );
    if (!items) return notFound();
    return HttpResponse.json(
      paginate(items, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  http.post(`${BASE}/plans/:planId/exports`, async ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "pnl.export")) return forbidden();
    const record = recordOf(String(params["planId"]));
    if (!record) return notFound();
    const body = (await request.json()) as Partial<Schemas["ExportPnlPlanDto"]>;
    if (body.format !== "xlsx" && body.format !== "pdf") return invalid("format", "รูปแบบไฟล์ไม่ถูกต้อง");
    const expires = new Date(Date.now() + 5 * 60_000 + 7 * 3_600_000).toISOString().slice(0, 19);
    return HttpResponse.json({
      url: `https://getpack-files.s3.example.com/pnl/${record.plan.id}-${body.view ?? "plan"}.${body.format}?X-Amz-Expires=300`,
      expiresAt: `${expires}+07:00`,
    } satisfies Schemas["DownloadUrlDto"]);
  }),

  /**
   * Mock only: closes the mock's current month (the clock moves one month on), so the next month of a locked plan has
   * actual figures to compare. A finance manager / C-Level only, through the admin BFF like any admin path.
   */
  http.post("*/v1/admin/mock-jobs/pnl.close_month", ({ request }) => {
    if (!manager(staffPersonaOf(request))) return forbidden();
    clockShift += 1;
    return HttpResponse.json({ currentMonth: currentMonth() });
  }),
];

/** For the unit tests: a fresh grid of the seeded draft (all four modes are reachable from it). */
export function seededGridForTest(): Grid {
  seed();
  return gridOf(plans[1]!);
}
