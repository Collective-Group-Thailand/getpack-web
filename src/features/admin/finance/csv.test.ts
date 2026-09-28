// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { reportCsv } from "../../../../mocks/admin/finance/tax";
import { toCsv } from "./csv";
import { trialBalanceCsv } from "./reports";

/**
 * What a finance export writes, byte for byte (F6.4 "export correctness snapshots"): the API's
 * strings as they came, UTF-8 with a BOM, CRLF, quoted where a comma, quote or line break needs
 * it. The ภ.ง.ด.53 attachment is the layout the backend stores at finalising.
 */

const trialBalance: Schemas["TrialBalanceDto"] = {
  from: "2026-01",
  to: "2026-09",
  balanced: true,
  accounts: [
    {
      accountCode: "1121",
      nameTh: "เงินฝากธนาคาร — ไทยพาณิชย์ กระแสรายวัน",
      nameEn: "Bank — SCB current",
      accountType: "asset",
      normalSide: "debit",
      opening: "0.00",
      debit: "1512345.67",
      credit: "250000.00",
      closing: "1262345.67",
    },
    {
      accountCode: "2210",
      nameTh: "ภาษีขาย",
      nameEn: "Output VAT",
      accountType: "liability",
      normalSide: "credit",
      opening: "0.00",
      debit: "0.00",
      credit: "12345.67",
      closing: "-12345.67",
    },
    {
      accountCode: "4110",
      nameTh: "รายได้ขาย, งานสั่งผลิต",
      nameEn: 'Sales — "made to order"',
      accountType: "revenue",
      normalSide: "credit",
      opening: "0.00",
      debit: "250000.00",
      credit: "1500000.00",
      closing: "-1250000.00",
    },
  ],
  totals: { opening: "0.00", debit: "1762345.67", credit: "1762345.67", closing: "0.00" },
};

describe("finance exports", () => {
  it("write the trial balance as the API returned it, with its total row", () => {
    expect(trialBalanceCsv(trialBalance)).toMatchSnapshot();
  });

  it("write the ภ.ง.ด.53 attachment in the stored layout", () => {
    const lines = [
      {
        seq: 1,
        wtNumber: "WT2569-00001",
        form: "pnd53",
        taxId: "0105561234567",
        branch: "00000",
        name: "บริษัท โรงพิมพ์ตัวอย่าง จำกัด",
        address: null,
        paidOn: "2026-09-12",
        incomeType: "hire_of_work",
        ratePct: "3.00",
        paidAmount: "45000.00",
        whtAmount: "1350.00",
        condition: 1,
        status: "issued",
      },
      {
        seq: 2,
        wtNumber: "WT2569-00002",
        form: "pnd53",
        taxId: "0105569876543",
        branch: "00001",
        name: 'ขนส่ง "ด่วน" จำกัด',
        address: "12/3 ถนนตัวอย่าง, กรุงเทพฯ",
        paidOn: "2026-09-20",
        incomeType: "transport",
        ratePct: "1.00",
        paidAmount: "3200.00",
        whtAmount: "32.00",
        condition: 1,
        status: "issued",
      },
    ];
    const csv = reportCsv(lines);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toMatchSnapshot();
  });

  it("quote only what needs quoting and keep empty cells empty", () => {
    const csv = toCsv<{ a: string | null; b: number }>(
      [
        { header: "a", value: (row) => row.a },
        { header: "b", value: (row) => row.b },
      ],
      [
        { a: "plain", b: 1 },
        { a: "comma, here", b: 2 },
        { a: 'quote "here"', b: 3 },
        { a: "line\nbreak", b: 4 },
        { a: null, b: 5 },
      ],
    );
    expect(csv).toBe('\uFEFFa,b\r\nplain,1\r\n"comma, here",2\r\n"quote ""here""",3\r\n"line\nbreak",4\r\n,5\r\n');
  });
});
