// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import contract from "../../contract/openapi.json";
import { seededGridForTest } from "./pnl";
import { PNL_CATALOGUE } from "./pnl-catalogue";

type LineKey = Schemas["PnlLineKey"];

/**
 * The mock P&L planner stands in for getpack-api (D-472): its catalogue must be the contract's — every line key, with
 * the four tooltip parts (definition, formula, source, how to fill for a line a person may enter) — and its grid must
 * add up the way the engine does, from the rounded cells.
 */
const contractKeys = (contract as { components: { schemas: Record<string, { enum?: string[] }> } }).components.schemas[
  "PnlLineKey"
]!.enum! as LineKey[];

describe("P&L mock catalogue (D-472)", () => {
  it("has every line key of the contract, in the contract's order, once", () => {
    expect(PNL_CATALOGUE.map((line) => line.key)).toEqual(contractKeys);
  });

  it("gives every line a definition, a formula and a source, and every line a person may fill a how-to-fill", () => {
    for (const line of PNL_CATALOGUE) {
      expect(line.labelTh.trim(), line.key).not.toBe("");
      expect(line.definition.th.trim(), `${line.key} definition`).not.toBe("");
      expect(line.formula.th.trim(), `${line.key} formula`).not.toBe("");
      expect(line.source.th.trim(), `${line.key} source`).not.toBe("");
      // Depreciation comes from the fixed-asset schedule: PNL-LINES.md gives it no manual method ("—").
      if (line.editable && line.key !== "depreciation")
        expect(line.howToFill?.th.trim(), `${line.key} howToFill`).toBeTruthy();
    }
  });
});

describe("P&L mock grid", () => {
  const grid = seededGridForTest();
  const satang = (value: string | null) => (value === null ? 0 : Math.round(Number(value) * 100));
  const line = (key: LineKey) => grid.lines.find((row) => row.line.key === key)!;

  it("draws twelve months for every line", () => {
    expect(grid.months).toHaveLength(12);
    for (const row of grid.lines) expect(row.cells, row.line.key).toHaveLength(12);
  });

  it("works the formula lines out from the rounded cells", () => {
    for (let at = 0; at < 12; at += 1) {
      const v = (key: LineKey) => satang(line(key).cells[at]!.value);
      expect(v("net_revenue")).toBe(v("revenue_goods") + v("revenue_shipping") - v("discounts"));
      expect(v("gross_margin")).toBe(v("net_revenue") - v("factory_cost") - v("shipping_cost") - v("payment_fees"));
      expect(v("net_profit")).toBe(v("ebit") - v("finance_cost") - v("cit_estimate"));
      expect(v("memo_ebitda")).toBe(v("ebit") + v("depreciation"));
    }
  });

  it("marks formula lines calculated and keeps manual cells for the unmapped lines", () => {
    expect(line("net_profit").cells.every((cell) => cell.mode === "calculated")).toBe(true);
    expect(line("salaries").cells.every((cell) => cell.mode === "manual")).toBe(true);
    expect(line("revenue_goods").cells.every((cell) => cell.mode === "auto")).toBe(true);
  });

  it("sums money totals over the year and reports them in the summary", () => {
    const total = line("net_revenue").cells.reduce((sum, cell) => sum + satang(cell.value), 0);
    expect(satang(line("net_revenue").total)).toBe(total);
    expect(grid.summary.netRevenue).toBe(line("net_revenue").total);
    expect(grid.summary.netProfit).toBe(line("net_profit").total);
  });
});
