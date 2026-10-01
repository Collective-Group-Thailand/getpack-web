// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assets } from "../../../mocks/admin/finance/assets";
import {
  currentMonth,
  fiscalYears,
  journals,
  movement,
  previousMonth,
  satangOf,
} from "../../../mocks/admin/finance/books";
import { lines } from "../../../mocks/admin/finance/banking";
import { payables } from "../../../mocks/admin/finance/payables";
import { documents, receivables, taxedVat } from "../../../mocks/admin/finance/receivables";
import { handlers } from "../../../mocks/handlers";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";
import { createRequestClient } from "./requests/client";
import { REQUESTS } from "./requests/registry";

/**
 * The finance mocks behave like the B5 surface they stand in for (F6): every event posts a
 * balanced entry, the sub-ledgers agree with their control accounts, document numbers have no
 * gaps, and the controls of accounting-design §8 hold — permissions, maker-checker, idempotency.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const staff = (persona: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("staff", persona) });
const requestsAs = (persona: string) => createRequestClient(REQUESTS, staff(persona) as unknown as Client<never>);
const key = () => ({ "Idempotency-Key": crypto.randomUUID() });

describe("the books", () => {
  it("post only balanced entries", () => {
    expect(journals.length).toBeGreaterThan(20);
    for (const journal of journals) expect(journal.totalDebit, journal.entryNo ?? journal.id).toBe(journal.totalCredit);
    const debit = journals.flatMap((j) => j.lines).reduce((sum, line) => sum + satangOf(line.debit), 0);
    const credit = journals.flatMap((j) => j.lines).reduce((sum, line) => sum + satangOf(line.credit), 0);
    expect(debit).toBe(credit);
  });

  it("keep receivables equal to the AR control account (1210)", () => {
    const open = receivables
      .filter((item) => ["open", "partially_paid"].includes(item.status))
      .reduce((sum, item) => sum + satangOf(item.openAmount), 0);
    expect(movement("1210")).toBe(open);
  });

  it("keep output VAT equal to what the documents put at the tax point (2210)", () => {
    const taxed = documents
      .filter((doc) => doc.status === "issued")
      .reduce((sum, doc) => sum + (taxedVat.get(doc.id)?.vat ?? 0), 0);
    expect(-movement("2210")).toBe(taxed);
  });

  it("number every series without a gap (§4)", () => {
    const bySeries = new Map<string, number[]>();
    for (const doc of documents) {
      const [series, seq] = doc.docNumber.split("-") as [string, string];
      bySeries.set(series, [...(bySeries.get(series) ?? []), Number(seq)]);
    }
    for (const [series, numbers] of bySeries)
      expect(
        numbers.sort((a, b) => a - b),
        series,
      ).toEqual(numbers.map((_, index) => index + 1));
  });
});

describe("slips (D-061)", () => {
  it("are Finance's: CS Lead reads payments but cannot review a slip", async () => {
    const { data } = await staff("cs_lead").GET("/v1/admin/slips", {});
    const slip = data!.data[0]!;
    await expect(
      staff("cs_lead").POST("/v1/admin/slips/{slipId}/actions/review", {
        params: { path: { slipId: slip.id }, header: key() },
        body: { approve: true, bankTransRef: "BANK-0001" },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("approve with the bank reference, issue the TR and post P02 — once per key", async () => {
    const api = staff("finance");
    const before = (await api.GET("/v1/admin/slips", {})).data!;
    const slip = before.data[0]!;
    const header = key();

    await expect(
      api.POST("/v1/admin/slips/{slipId}/actions/review", {
        params: { path: { slipId: slip.id }, header },
        body: { approve: true },
      }),
    ).rejects.toMatchObject({ status: 422 });

    const first = await api.POST("/v1/admin/slips/{slipId}/actions/review", {
      params: { path: { slipId: slip.id }, header },
      body: { approve: true, bankTransRef: "SCB-TEST-000001" },
    });
    expect(first.data!.status).toBe("succeeded");
    const replay = await api.POST("/v1/admin/slips/{slipId}/actions/review", {
      params: { path: { slipId: slip.id }, header },
      body: { approve: true, bankTransRef: "SCB-TEST-000001" },
    });
    expect(replay.response.headers.get("Idempotent-Replayed")).toBe("true");

    const after = (await api.GET("/v1/admin/slips", {})).data!;
    expect(after.meta.total).toBe(before.meta.total - 1);
    const tr = documents.find((doc) => doc.paymentId === slip.paymentId && doc.docType === "tr")!;
    expect(tr.receiptVia).toBe("slip");
    expect(journals.find((j) => j.source?.id === tr.id)?.postingRule).toBe("P02");
  });

  it("refuse a bank reference already used (duplicate slip)", async () => {
    const api = staff("finance");
    const slip = (await api.GET("/v1/admin/slips", {})).data!.data[0]!;
    await expect(
      api.POST("/v1/admin/slips/{slipId}/actions/review", {
        params: { path: { slipId: slip.id }, header: key() },
        body: { approve: true, bankTransRef: "SCB-TEST-000001" },
      }),
    ).rejects.toMatchObject({ status: 409, code: "payments.slip_duplicate" });
  });
});

describe("credit notes and refunds (§8 maker-checker)", () => {
  it("issue a credit note only after a Finance Manager other than the requester approves", async () => {
    const order = documents.find((doc) => doc.docKind === "final" && doc.status === "issued" && doc.orderId)!;
    const requested = await staff("finance_manager").POST("/v1/admin/orders/{orderId}/credit-notes", {
      params: { path: { orderId: order.orderId! }, header: key() },
      body: { amount: "107.00", cnKind: "price_reduction", note: "ลดราคาหลังการขาย (ทดสอบ)" },
    });
    const request = requested.data!;
    expect(request.status).toBe("pending_approval");

    await expect(
      staff("finance_manager").POST("/v1/admin/approvals/{requestId}/actions/approve", {
        params: { path: { requestId: request.approvalRequestId! } },
        body: { comment: "self" },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("stop the requester of a refund from recording its payout", async () => {
    const { data } = await staff("finance").GET("/v1/admin/refunds", { params: { query: { status: "approved" } } });
    const refund = data!.data[0]!;
    await expect(
      staff("finance").POST("/v1/admin/refunds/{refundId}/actions/complete", {
        params: { path: { refundId: refund.id }, header: key() },
        body: { providerRef: "KB-OUT-0001" },
      }),
    ).rejects.toMatchObject({ status: 403 });
    const done = await staff("finance_manager").POST("/v1/admin/refunds/{refundId}/actions/complete", {
      params: { path: { refundId: refund.id }, header: key() },
      body: { providerRef: "KB-OUT-0001" },
    });
    expect(done.data!.status).toBe("succeeded");
  });
});

describe("the contract requests F6.1 raised", () => {
  it("hand out the slip image and the dunning log", async () => {
    const slip = (await staff("finance").GET("/v1/admin/slips", {})).data!.data[0]!;
    const file = await requestsAs("finance").call("GET /v1/admin/slips/{slipId}/file", { path: { slipId: slip.id } });
    expect(file.file.url).toMatch(/^data:image\//);
    const log = await requestsAs("finance").call("GET /v1/admin/dunning-log", { query: {} });
    expect(log.data.some((entry) => entry.kind === "overdue")).toBe(true);
  });
});

const open = (kind: string) =>
  payables
    .filter((row) => row.kind === kind && ["open", "eligible", "in_run"].includes(row.dto.status))
    .reduce(
      (sum, row) =>
        sum + satangOf(row.dto.openNetAmount) + (kind === "vendor_bill" ? satangOf(row.dto.openVatAmount) : 0),
      0,
    );

describe("supplier AP (§6)", () => {
  it("keeps the AP sub-ledger equal to its control accounts (2110, 2120, 2130)", () => {
    expect(-movement("2110") + 0).toBe(open("balance"));
    expect(-movement("2120") + 0).toBe(open("vendor_bill"));
    expect(-movement("2130") + 0).toBe(open("retention_release"));
  });

  it("pays a run only after a C-Level other than the proposer approves it, then posts from the bank's confirmation", async () => {
    const finance = staff("finance");
    const { data: accounts } = await finance.GET("/v1/admin/company-bank-accounts", {});
    const payout = accounts!.find((account) => account.purpose !== "collection")!;
    // Two weeks out: the balances whose claim window will have closed by then.
    const payOn = new Date(Date.now() + 7 * 3_600_000 + 14 * 86_400_000).toISOString().slice(0, 10);
    const { data: run } = await finance.POST("/v1/admin/payout-runs", {
      params: { header: key() },
      body: { payOn, companyBankAccountId: payout.id },
    });
    expect(run!.status).toBe("draft");
    expect(run!.items.some((item) => item.status === "excluded")).toBe(true); // a vendor with no verified account

    const { data: proposed } = await finance.POST("/v1/admin/payout-runs/{runId}/actions/propose", {
      params: { path: { runId: run!.id }, header: key() },
    });
    expect(proposed!.status).toBe("proposed");
    // Finance cannot approve (not C-Level, and the proposer); a C-Level can.
    await expect(
      finance.POST("/v1/admin/approvals/{requestId}/actions/approve", {
        params: { path: { requestId: proposed!.approvalRequestId! } },
        body: {},
      }),
    ).rejects.toMatchObject({ status: 403 });
    await staff("c_level").POST("/v1/admin/approvals/{requestId}/actions/approve", {
      params: { path: { requestId: proposed!.approvalRequestId! } },
      body: { comment: "ตรวจยอดแล้ว" },
    });

    await finance.POST("/v1/admin/payout-runs/{runId}/actions/generate-bank-file", {
      params: { path: { runId: run!.id }, header: key() },
    });
    const { data: file } = await finance.GET("/v1/admin/payout-runs/{runId}/bank-file", {
      params: { path: { runId: run!.id } },
    });
    expect(decodeURIComponent(file!.url.split(",")[1]!)).toContain("reference,bank_code");

    const included = run!.items.filter((item) => item.status === "included");
    const { data: confirmed } = await finance.POST("/v1/admin/payout-runs/{runId}/actions/confirm", {
      params: { path: { runId: run!.id }, header: key() },
      body: {
        confirmations: included.map((item, index) => ({
          reference: item.id,
          status: index === 0 && included.length > 1 ? ("failed" as const) : ("paid" as const),
          bankRef: `T-${index}`,
          reason: index === 0 && included.length > 1 ? "บัญชีปิดแล้ว" : undefined,
        })),
      },
    });
    expect(confirmed!.items.filter((item) => item.status === "paid").every((item) => item.pvNumber)).toBe(true);
    if (included.length > 1) expect(confirmed!.status).toBe("partially_failed");

    // The books still agree after the postings (P14 / P17 / P18 / bill payments).
    expect(-movement("2110") + 0).toBe(open("balance"));
    expect(-movement("2130") + 0).toBe(open("retention_release"));
    const debit = journals.flatMap((j) => j.lines).reduce((sum, line) => sum + satangOf(line.debit), 0);
    const credit = journals.flatMap((j) => j.lines).reduce((sum, line) => sum + satangOf(line.credit), 0);
    expect(debit).toBe(credit);
  }, 20_000);
});

describe("cash and bank (§6)", () => {
  it("matches an unmatched line to what the workbench suggests, and parks unknown money as unidentified (P29)", async () => {
    const finance = staff("finance");
    const unmatched = lines.filter((line) => line.matchStatus === "unmatched");
    const noReference = unmatched.find((line) => line.description.includes("ไม่มีเลขอ้างอิง"))!;
    const suggestions = await requestsAs("finance").call("GET /v1/admin/bank-statement-lines/{lineId}/suggestions", {
      path: { lineId: noReference.id },
    });
    const pick = suggestions.find((item) => item.reasons.includes("amount"))!;
    const { data: matched } = await finance.POST("/v1/admin/bank-statement-lines/{lineId}/actions/match", {
      params: { path: { lineId: noReference.id }, header: key() },
      body: { targetType: pick.targetType, targetId: pick.targetId },
    });
    expect(matched!.matchStatus).toBe("matched");

    const stranger = lines.find(
      (line) => line.matchStatus === "unmatched" && line.description.includes("นาย ตัวอย่าง"),
    )!;
    const before = movement("1140");
    await finance.POST("/v1/admin/bank-statement-lines/{lineId}/actions/mark-unidentified", {
      params: { path: { lineId: stranger.id }, header: key() },
    });
    expect(movement("1140") - before).toBe(-satangOf(stranger.amount));
  });
});

describe("the ledger (§1, §8)", () => {
  const draft = (amount: string, account = "6900") => ({
    documentDate: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10),
    description: "ตั้งค้างจ่ายค่าที่ปรึกษา (ทดสอบ)",
    lines: [
      { accountCode: account, side: "debit" as const, amount, dimensions: { costCentre: "ADMIN" } },
      { accountCode: "2410", side: "credit" as const, amount: "1500.00" },
    ],
  });

  it("refuses an unbalanced entry and a control account, then posts a manual journal only after another person approves", async () => {
    const finance = staff("finance");
    await expect(finance.POST("/v1/admin/ledger/journals", { body: draft("1400.00") })).rejects.toMatchObject({
      status: 422,
      code: "ledger.unbalanced",
    });
    await expect(finance.POST("/v1/admin/ledger/journals", { body: draft("1500.00", "1210") })).rejects.toMatchObject({
      status: 422,
    });
    const { data: created, response } = await finance.POST("/v1/admin/ledger/journals", { body: draft("1500.00") });
    expect(created!.status).toBe("draft");
    expect(response.status).toBe(201);
    // Only its maker edits it, and only with the current ETag.
    await expect(
      staff("finance_manager").PUT("/v1/admin/ledger/journals/{journalId}", {
        params: { path: { journalId: created!.id }, header: { "If-Match": 'W/"x"' } },
        body: draft("1500.00"),
      }),
    ).rejects.toMatchObject({ status: 403 });

    const { data: submitted } = await finance.POST("/v1/admin/ledger/journals/{journalId}/actions/submit", {
      params: { path: { journalId: created!.id }, header: key() },
    });
    expect(submitted!.status).toBe("pending_approval");
    await expect(
      finance.POST("/v1/admin/approvals/{requestId}/actions/approve", {
        params: { path: { requestId: submitted!.approvalRequestId! } },
        body: {},
      }),
    ).rejects.toMatchObject({ status: 403 });
    const before = movement("2410");
    await staff("finance_manager").POST("/v1/admin/approvals/{requestId}/actions/approve", {
      params: { path: { requestId: submitted!.approvalRequestId! } },
      body: { comment: "ตรวจแล้ว" },
    });
    const { data: posted } = await finance.GET("/v1/admin/ledger/journals/{journalId}", {
      params: { path: { journalId: created!.id } },
    });
    expect(posted!.status).toBe("posted");
    expect(posted!.jvNumber).toMatch(/^JV\d{6}-\d{5}$/);
    expect(posted!.approvedBy).not.toBe(posted!.createdBy);
    expect(movement("2410") - before).toBe(-150_000);

    // A correction is a reversal, approved the same way; a sub-ledger entry is not reversible here.
    const { data: reversal } = await finance.POST("/v1/admin/ledger/journals/{journalId}/actions/reverse", {
      params: { path: { journalId: created!.id }, header: key() },
      body: { documentDate: posted!.documentDate, reason: "บันทึกซ้ำ" },
    });
    expect(reversal!.kind).toBe("reversal");
    const auto = journals.find((journal) => journal.kind === "auto")!;
    await expect(
      finance.POST("/v1/admin/ledger/journals/{journalId}/actions/reverse", {
        params: { path: { journalId: auto.id }, header: key() },
        body: { documentDate: posted!.documentDate, reason: "ทดสอบ" },
      }),
    ).rejects.toMatchObject({ status: 409, code: "ledger.not_reversible" });
  });

  it("moves periods only in order, and never reopens a closed one", async () => {
    const manager = staff("finance_manager");
    const periods = fiscalYears.flatMap((year) => year.periods);
    const current = periods.find((period) => period.startDate.startsWith(currentMonth()))!;
    const later = periods.find((period) => period.periodNo === current.periodNo + 1);
    const closed = periods.find((period) => period.status === "closed");
    if (closed)
      await expect(
        manager.POST("/v1/admin/ledger/periods/{periodId}/actions/{action}", {
          params: { path: { periodId: closed.id, action: "reopen" } },
          body: {},
        }),
      ).rejects.toMatchObject({ status: 409, code: "ledger.period_transition" });
    if (later) {
      await manager.POST("/v1/admin/ledger/periods/{periodId}/actions/{action}", {
        params: { path: { periodId: later.id, action: "soft-close" } },
        body: {},
      });
      // Next month cannot close while this month is open.
      await expect(
        manager.POST("/v1/admin/ledger/periods/{periodId}/actions/{action}", {
          params: { path: { periodId: later.id, action: "close" } },
          body: {},
        }),
      ).rejects.toMatchObject({ status: 409 });
      await manager.POST("/v1/admin/ledger/periods/{periodId}/actions/{action}", {
        params: { path: { periodId: later.id, action: "reopen" } },
        body: { reason: "ทดสอบ" },
      });
    }
    await expect(
      staff("finance").POST("/v1/admin/ledger/periods/{periodId}/actions/{action}", {
        params: { path: { periodId: current.id, action: "soft-close" } },
        body: {},
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("previews a posting rule without posting it", async () => {
    const count = journals.length;
    const { data } = await staff("auditor").POST("/v1/admin/ledger/posting-rules/{key}/actions/preview", {
      params: { path: { key: "P02" } },
      body: { payload: { grossAmount: "1070.00", netAmount: "1000.00", vatAmount: "70.00" } },
    });
    expect(data!.balanced).toBe(true);
    expect(data!.lines.map((line) => line.accountCode)).toEqual(["1133", "2310", "2210"]);
    expect(journals.length).toBe(count);
  });
});

describe("tax (§6, §7 step 7)", () => {
  it("builds every paper of the month from the books with a GL difference of zero, and finalises ภ.พ.30 into VAT payable", async () => {
    const finance = staff("finance");
    const month = currentMonth();
    for (const kind of [
      "sales_tax",
      "purchase_tax",
      "pp30",
      "pnd3",
      "pnd53",
      "wht_issued_register",
      "wht_received_register",
    ] as const) {
      const { data } = await finance.POST("/v1/admin/tax-reports", {
        params: { header: key() },
        body: { kind, period: month },
      });
      expect(data!.glDifference, kind).toBe("0.00");
    }
    const { data: list } = await finance.GET("/v1/admin/tax-reports", { params: { query: { period: month } } });
    const pp30 = list!.find((report) => report.kind === "pp30")!;
    const payable = movement("2220");
    const { data: final } = await finance.POST("/v1/admin/tax-reports/{reportId}/actions/finalise", {
      params: { path: { reportId: pp30.id }, header: key() },
    });
    expect(final!.status).toBe("final");
    expect(final!.fileReady).toBe(true);
    const totals = final!.totals as Record<string, string>;
    expect(-(movement("2220") - payable)).toBe(satangOf(totals.netPayable!));
    // Its own P27 does not disturb the reconciliation of the other papers.
    const { data: again } = await finance.POST("/v1/admin/tax-reports", {
      params: { header: key() },
      body: { kind: "sales_tax", period: month },
    });
    expect(again!.glDifference).toBe("0.00");
    await expect(
      finance.POST("/v1/admin/tax-reports", { params: { header: key() }, body: { kind: "pp30", period: month } }),
    ).rejects.toMatchObject({ status: 409, code: "tax.report_not_draft" });
    const { data: file } = await finance.GET("/v1/admin/tax-reports/{reportId}/export", {
      params: { path: { reportId: pp30.id } },
    });
    expect(decodeURIComponent(file!.url.split(",")[1]!)).toContain("key,label,base,vat,gl,documents");
    // Paying is a Finance Manager's (tax.pay).
    await expect(
      finance.POST("/v1/admin/tax-reports/{reportId}/actions/pay", {
        params: { path: { reportId: pp30.id }, header: key() },
        body: { paidOn: month + "-28", companyBankAccountId: "00000000-0000-0000-0000-000000000000" },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("fixed assets (D-150)", () => {
  it("posts what the preview showed, once, and keeps the register equal to the GL", async () => {
    const finance = staff("finance");
    const month = currentMonth();
    const preview = await requestsAs("finance").call("GET /v1/admin/depreciation-runs/preview", {
      query: { period: month },
    });
    expect(preview.assetCount).toBeGreaterThan(0);
    const { data: run } = await finance.POST("/v1/admin/depreciation-runs", {
      params: { header: key() },
      body: { period: month },
    });
    expect(run!.totalAmount).toBe(preview.totalAmount);
    await expect(
      finance.POST("/v1/admin/depreciation-runs", { params: { header: key() }, body: { period: month } }),
    ).rejects.toMatchObject({ status: 409, code: "fixed_assets.run_exists" });
    const { data: roll } = await finance.GET("/v1/admin/fixed-assets-reports/roll-forward", {
      params: { query: { from: `${month.slice(0, 4)}-01`, to: month } },
    });
    expect(roll!.reconciliation.length).toBe(2);
    for (const row of roll!.reconciliation) expect(row.difference, row.accountCode).toBe("0.00");
    expect(assets.every((asset) => satangOf(asset.accumulatedDepreciation) > 0)).toBe(true);
  });
});

describe("the financial reports (§6, §1.7)", () => {
  it("balance: Σ debit = Σ credit, assets = liabilities + equity, cash change = cash accounts, sub-ledgers = GL", async () => {
    const auditor = staff("auditor");
    const year = currentMonth().slice(0, 4);
    const { data: tb } = await auditor.GET("/v1/admin/financial-reports/trial-balance", {
      params: { query: { from: `${year}-01`, to: currentMonth() } },
    });
    expect(tb!.balanced).toBe(true);
    expect(tb!.totals.debit).toBe(tb!.totals.credit);
    const { data: bs } = await auditor.GET("/v1/admin/financial-reports/balance-sheet", {
      params: { query: { asOf: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10) } },
    });
    expect(bs!.difference).toBe("0.00");
    expect(bs!.liabilities.some((line) => line.accountCode === "2330")).toBe(true);
    const { data: cf } = await auditor.GET("/v1/admin/financial-reports/cash-flow", {
      params: { query: { from: `${year}-01`, to: currentMonth() } },
    });
    expect(cf!.difference).toBe("0.00");
    const { data: pl } = await auditor.GET("/v1/admin/financial-reports/profit-and-loss", {
      params: { query: { from: `${year}-01`, to: currentMonth(), dimension: "cost_centre" } },
    });
    expect(pl!.lines.some((line) => line.dimension === "ADMIN")).toBe(true);
    const recon = await requestsAs("auditor").call("GET /v1/admin/financial-reports/subledger-reconciliation", {
      query: {},
    });
    for (const row of recon.rows) expect(row.difference, row.key).toBe("0.00");
    const points = await requestsAs("auditor").call("GET /v1/admin/financial-reports/roll-forward", {
      query: { accountCode: "2330", from: `${year}-01`, to: currentMonth() },
    });
    const last = points.months.at(-1)!;
    expect(satangOf(last.closing)).toBe(-movement("2330"));
  });
});

describe("the period close (§7, §8)", () => {
  it("closes last month only through the checklist, never by its own submitter, and locks it against posting", async () => {
    const finance = staff("finance");
    const manager = staff("finance_manager");
    const month = previousMonth();
    const path = { period: month };
    await expect(finance.GET("/v1/admin/close-checklists/{period}", { params: { path } })).rejects.toMatchObject({
      status: 404,
    });
    await finance.POST("/v1/admin/close-checklists/{period}", { params: { path, header: key() } });
    // The tax papers of the month, final at a difference of zero.
    for (const kind of ["sales_tax", "purchase_tax", "pp30", "pnd3", "pnd53"] as const) {
      const { data } = await finance.POST("/v1/admin/tax-reports", {
        params: { header: key() },
        body: { kind, period: month },
      });
      await finance.POST("/v1/admin/tax-reports/{reportId}/actions/finalise", {
        params: { path: { reportId: data!.id }, header: key() },
      });
    }
    let checklist = (await finance.GET("/v1/admin/close-checklists/{period}", { params: { path } })).data!;
    for (const task of checklist.tasks.filter((item) => item.key !== "review")) {
      const done = await finance
        .POST("/v1/admin/close-checklists/{period}/tasks/{taskKey}/actions/complete", {
          params: { path: { ...path, taskKey: task.key }, header: key() },
          body: { note: "ตรวจแล้ว" },
        })
        .catch((error: { code?: string }) => error);
      if ("code" in done && done.code === "close.check_failed")
        await manager.POST("/v1/admin/close-checklists/{period}/tasks/{taskKey}/actions/waive", {
          params: { path: { ...path, taskKey: task.key }, header: key() },
          body: { reason: "รายการค้างอยู่ระหว่างตรวจสอบ มีคำอธิบายแนบ" },
        });
    }
    // A closed month needs its checklist: the ledger refuses to close it directly.
    const period = fiscalYears.flatMap((year) => year.periods).find((item) => item.startDate === `${month}-01`)!;
    await manager.POST("/v1/admin/ledger/periods/{periodId}/actions/{action}", {
      params: { path: { periodId: period.id, action: "soft-close" } },
      body: {},
    });
    await expect(
      manager.POST("/v1/admin/ledger/periods/{periodId}/actions/{action}", {
        params: { path: { periodId: period.id, action: "close" } },
        body: {},
      }),
    ).rejects.toMatchObject({ status: 409, code: "close.checklist_incomplete" });

    // The Finance Manager who submits cannot approve (SoD); the one who approves is another person.
    await manager.POST("/v1/admin/close-checklists/{period}/actions/submit", { params: { path, header: key() } });
    await expect(
      manager.POST("/v1/admin/close-checklists/{period}/actions/approve", {
        params: { path, header: key() },
        body: {},
      }),
    ).rejects.toMatchObject({ status: 409, code: "iam.sod_conflict" });
    await manager.POST("/v1/admin/close-checklists/{period}/actions/return", {
      params: { path, header: key() },
      body: { reason: "ให้ฝ่ายการเงินส่งเอง" },
    });
    await finance.POST("/v1/admin/close-checklists/{period}/actions/submit", { params: { path, header: key() } });
    await expect(
      finance.POST("/v1/admin/close-checklists/{period}/actions/approve", {
        params: { path, header: key() },
        body: {},
      }),
    ).rejects.toMatchObject({ status: 403 });
    checklist = (
      await manager.POST("/v1/admin/close-checklists/{period}/actions/approve", {
        params: { path, header: key() },
        body: { note: "ตรวจครบทุกขั้น" },
      })
    ).data!;
    expect(checklist.status).toBe("closed");
    expect(checklist.periodStatus).toBe("closed");
    checklist = (
      await manager.POST("/v1/admin/close-checklists/{period}/actions/lock", { params: { path, header: key() } })
    ).data!;
    expect(checklist.periodStatus).toBe("locked");

    // A journal dated in the locked month posts into the next open one, its document date kept.
    const { data: draft } = await finance.POST("/v1/admin/ledger/journals", {
      body: {
        documentDate: `${month}-25`,
        description: "ค่าใช้จ่ายค้างจ่ายที่พบหลังปิดงวด (ทดสอบ)",
        lines: [
          { accountCode: "6900", side: "debit", amount: "300.00", dimensions: { costCentre: "ADMIN" } },
          { accountCode: "2410", side: "credit", amount: "300.00" },
        ],
      },
    });
    const { data: submitted } = await finance.POST("/v1/admin/ledger/journals/{journalId}/actions/submit", {
      params: { path: { journalId: draft!.id }, header: key() },
    });
    await manager.POST("/v1/admin/approvals/{requestId}/actions/approve", {
      params: { path: { requestId: submitted!.approvalRequestId! } },
      body: {},
    });
    const { data: late } = await finance.GET("/v1/admin/ledger/journals/{journalId}", {
      params: { path: { journalId: draft!.id } },
    });
    expect(late!.documentDate).toBe(`${month}-25`);
    expect(late!.entryDate.slice(0, 7)).toBe(currentMonth());
    await expect(
      finance.POST("/v1/admin/depreciation-runs", { params: { header: key() }, body: { period: month } }),
    ).rejects.toMatchObject({ status: 409 });
  }, 20_000);
});

describe("audit support (§8)", () => {
  it("draws a sample the same way from the same seed, lists the exceptions and hands out a hashed PBC pack", async () => {
    const auditor = staff("auditor");
    const body = {
      period: currentMonth(),
      population: "customer_documents" as const,
      method: "stratified" as const,
      size: 5,
      seed: "4242",
    };
    const { data: first } = await auditor.POST("/v1/admin/audit/samples", { params: { header: key() }, body });
    const { data: again } = await auditor.POST("/v1/admin/audit/samples", { params: { header: key() }, body });
    // The seeded documents are dated relative to today, so early in a month the period may hold
    // fewer than the five asked for; the sample is then the whole population.
    expect(first!.populationSize).toBeGreaterThan(0);
    expect(first!.selected.length).toBe(Math.min(5, first!.populationSize));
    expect(again!.selected.map((item) => item.id)).toEqual(first!.selected.map((item) => item.id));
    const { data: exceptions } = await auditor.GET("/v1/admin/audit/exceptions", {
      params: { query: { period: currentMonth() } },
    });
    expect(exceptions!.map((item) => item.key)).toContain("payouts_without_valid_tax_invoice");
    expect(exceptions!).toHaveLength(9);
    const { data: pack } = await auditor.POST("/v1/admin/audit/pbc-exports", {
      params: { header: key() },
      body: { period: currentMonth() },
    });
    expect(pack!.sha256).toMatch(/^[0-9a-f]{64}$/);
    const { data: file } = await auditor.GET("/v1/admin/audit/pbc-exports/{exportId}/file", {
      params: { path: { exportId: pack!.id } },
    });
    const text = decodeURIComponent(file!.url.split(",")[1]!);
    expect(text).toContain("## TrialBalance");
    expect(text).toContain("## Exceptions");
    // The auditor reads; it never posts.
    await expect(
      auditor.POST("/v1/admin/ledger/journals", {
        body: { documentDate: `${currentMonth()}-01`, description: "x", lines: [] },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
