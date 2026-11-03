import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import contract from "../../../../../contract/openapi.json";
import { PNL_CATALOGUE } from "../../../../../mocks/admin/pnl-catalogue";
import { seededGridForTest } from "../../../../../mocks/admin/pnl";
import finance from "@/i18n/messages/th/admin/finance.json";
import status from "@/i18n/messages/th/common/status.json";

import { CellTipContent, LineTipContent } from "./CellTip";

/**
 * D-472 item 3: every line of the contract has its tooltip in the catalogue, and the planner draws all four parts of
 * it — definition, formula, source, how to fill — for every line, and the cell tooltip names the source of each
 * cell mode with the person and the reason where a person typed the value.
 */
const keys = (contract as { components: { schemas: Record<string, { enum?: string[] }> } }).components.schemas[
  "PnlLineKey"
]!.enum!;

function inIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ finance, status }} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

describe("P&L tooltips (D-472)", () => {
  it("has a catalogue entry for every PnlLineKey in the contract", () => {
    expect(new Set(PNL_CATALOGUE.map((line) => line.key))).toEqual(new Set(keys));
  });

  it.each(PNL_CATALOGUE.map((line) => [line.key, line] as const))("draws the four parts for %s", (_, line) => {
    const { container } = inIntl(<LineTipContent line={line} />);
    const part = (name: string) => container.querySelector(`[data-tip-part="${name}"]`)?.textContent?.trim() ?? "";
    expect(part("definition")).toBe(line.definition.th);
    expect(part("formula")).toContain(line.formula.th);
    expect(part("source")).toContain(line.source.th);
    expect(part("howToFill")).toMatch(/^วิธีกรอก: .{3,}/);
    if (line.howToFill) expect(part("howToFill")).toContain(line.howToFill.th);
    for (const account of line.glAccounts) expect(part("source")).toContain(account.code);
  });

  it("explains a cell of every mode, with who and why for a person's value", () => {
    const grid = seededGridForTest();
    const byMode = new Map(grid.lines.flatMap((row) => row.cells.map((cell) => [cell.mode, { row, cell }] as const)));
    expect([...byMode.keys()].sort()).toEqual(["auto", "calculated", "manual"]);
    for (const { row, cell } of byMode.values()) {
      const { container, unmount } = inIntl(
        <CellTipContent line={row.line} cell={cell} month={grid.months[0]} onDrill={() => undefined} />,
      );
      const text = container.textContent ?? "";
      expect(text).toContain(row.line.definition.th);
      expect(text).toContain(row.line.formula.th);
      expect(container.querySelector('[data-tip-part="source"]')).not.toBeNull();
      if (cell.mode === "manual") {
        expect(text).toContain(`ที่มา: ${cell.note}`);
        expect(text).toContain("กรอกโดย");
      }
      if (cell.drillable) expect(text).toContain("ดูรายการที่มา");
      unmount();
    }
    const override = {
      ...byMode.get("auto")!.cell,
      mode: "override" as const,
      note: "ดีลใหญ่ยืนยันแล้ว",
      autoValue: "100.00",
    };
    const { container } = inIntl(
      <CellTipContent line={byMode.get("auto")!.row.line} cell={override} month={grid.months[0]} />,
    );
    expect(container.textContent).toContain("เหตุผล: ดีลใหญ่ยืนยันแล้ว");
    expect(container.textContent).toContain("ค่าระบบ 100.00");
  });
});
