import { describe, expect, it } from "vitest";

import { checkMarginLines, emptyMarginLine, toApiLines, toEditable, type EditableMarginLine } from "./margins";

const line = (patch: Partial<EditableMarginLine>): EditableMarginLine => ({
  ...emptyMarginLine(),
  value: "25",
  ...patch,
});

describe("sell-margin lines (D-063)", () => {
  it("accepts adjacent runs and touching price bands", () => {
    const lines = [
      line({ qtyMin: "1", qtyMax: "999", priceMin: "0", priceMax: "10" }),
      line({ qtyMin: "1000", qtyMax: "", priceMin: "0", priceMax: "10" }),
      line({ qtyMin: "1", qtyMax: "999", priceMin: "10", priceMax: "" }),
    ];
    expect(checkMarginLines(lines).size).toBe(0);
  });

  it("marks both lines that cover the same point", () => {
    const a = line({ qtyMin: "1", qtyMax: "1000" });
    const b = line({ qtyMin: "1000", qtyMax: "" });
    const problems = checkMarginLines([a, b]);
    expect(problems.get(a.key)).toEqual(["overlap"]);
    expect(problems.get(b.key)).toEqual(["overlap"]);
  });

  it("lets lines of different colour counts or levels overlap", () => {
    expect(checkMarginLines([line({ colourCount: "1" }), line({ colourCount: "2" })]).size).toBe(0);
    expect(checkMarginLines([line({ difficultyLevelId: "a" }), line({ difficultyLevelId: "b" })]).size).toBe(0);
  });

  it("checks values, percentages and band order", () => {
    const pct = line({ value: "100" });
    const empty = line({ value: "" });
    const order = line({ qtyMin: "10", qtyMax: "5", priceMin: "5", priceMax: "5", colourCount: "9" });
    const problems = checkMarginLines([pct, empty, order]);
    expect(problems.get(pct.key)).toEqual(["pct"]);
    expect(problems.get(empty.key)).toEqual(["value"]);
    expect(problems.get(order.key)).toEqual(["qtyOrder", "priceOrder"]);
  });

  it("round-trips the API's lines", () => {
    const api = {
      qtyMin: 1,
      qtyMax: null,
      priceMin: "0",
      priceMax: null,
      colourCount: null,
      difficultyLevelId: null,
      valuePct: null,
      valueAmount: "150.00",
      minAmount: "500",
    };
    expect(toApiLines([toEditable(api)])).toEqual([api]);
  });
});
