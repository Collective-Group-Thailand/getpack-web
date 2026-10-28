import { describe, expect, it } from "vitest";

import { csvCell, ordersCsv } from "./export-csv";

describe("orders CSV export (C6 Phase 2)", () => {
  it("quotes cells and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("-12.50")).toBe("-12.50");
    expect(csvCell(null)).toBe("");
  });

  it("writes one line per order after a BOM, amounts as the API's strings", () => {
    const groups = [
      {
        groupCode: "OG-1",
        orders: [
          { orderCode: "OR-1", totals: { grossAmount: "4302.86" } },
          { orderCode: "OR-2", totals: { grossAmount: "4982.10" } },
        ],
      },
    ] as never;
    const csv = ordersCsv(groups, {
      headers: ["เลขที่", "ยอด"],
      row: (_group, order) => [order.orderCode, order.totals.grossAmount],
    });
    expect(csv).toBe("﻿เลขที่,ยอด\r\nOR-1,4302.86\r\nOR-2,4982.10\r\n");
  });
});
