/** The management P&L planner's types and query keys (D-472), in a plain module the planner's parts share. */

import type { Schemas } from "@/lib/api/types";
import { queryKeys } from "@/lib/api/query-keys";

export type PnlPlan = Schemas["PnlPlanDto"];
export type PnlGrid = Schemas["PnlGridDto"];
export type PnlGridLine = Schemas["PnlGridLineDto"];
export type PnlLine = Schemas["PnlLineDto"];
export type PnlCell = Schemas["PnlCellDto"];
export type PnlMonth = Schemas["PnlMonthDto"];
export type PnlSummary = Schemas["PnlSummaryDto"];
export type PnlVariance = Schemas["PnlVarianceDto"];
export type PnlVarianceLine = Schemas["PnlVarianceLineDto"];
export type PnlVarianceCell = Schemas["PnlVarianceCellDto"];
export type PnlSourceItem = Schemas["PnlSourceItemDto"];
export type PnlScenario = Schemas["PnlScenario"];
export type PnlLineKey = Schemas["PnlLineKey"];
export type PnlLineGroup = Schemas["PnlLineGroup"];
export type PnlSourceKind = Schemas["PnlSourceKind"];

export const PNL_SCENARIOS = ["base", "best", "worst", "custom"] as const satisfies readonly PnlScenario[];

/** The grid's bands in the order the statement reads; `memo` is a separate band below the total. */
export const PNL_GROUPS = [
  "revenue",
  "cost_of_sales",
  "gross_margin",
  "selling_expenses",
  "admin_expenses",
  "operating_profit",
  "finance_and_tax",
  "net_profit",
  "memo",
] as const satisfies readonly PnlLineGroup[];

/** Groups that are one formula line — drawn as a subtotal row, not as a band with a header. */
export const SUBTOTAL_GROUPS: ReadonlySet<PnlLineGroup> = new Set(["gross_margin", "operating_profit", "net_profit"]);

/** The lines whose actuals the chart pairs with the plan (API-CHANGES-P6 §3: net revenue and net profit). */
export const CHART_LINES = { revenue: "net_revenue", profit: "net_profit" } as const satisfies Record<
  string,
  PnlLineKey
>;

/** Every P&L request is the planner's: one key prefix to invalidate after a write. */
export const PNL = "pnl";
export const pnlKeys = {
  all: () => queryKeys.resource("admin", PNL),
  plans: () => queryKeys.list("admin", PNL, { kind: "plans" }),
  grid: (planId: string) => queryKeys.related("admin", PNL, planId, "grid"),
  variance: (planId: string) => queryKeys.related("admin", PNL, planId, "variance"),
  sources: (planId: string, line: string, month: string, kind: string | null) =>
    queryKeys.related("admin", PNL, planId, `sources:${line}:${month}:${kind ?? "default"}`),
};
