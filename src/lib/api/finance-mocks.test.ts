// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { journals, movement, satangOf } from "../../../mocks/admin/finance/books";
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
